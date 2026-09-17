import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isAdminEmail } from '@/lib/adminAuth';
import { createClient } from '@/lib/supabase/server';
import { laruHpSitemapXml } from '@/lib/laruhp-public';

/**
 * IndexNow へ「このURLが変わった」と知らせる。
 *
 * なぜサーバー側に置くか。
 * scripts/submit-indexnow.mjs は同じことをするが、手元の端末から外へ出られる
 * ネットワークが要る。実際には、作業する環境から api.indexnow.org へ出られず、
 * ブラウザから直接叩こうにも別ドメインへのPOSTはCORSで止まる。
 * 結果として「送る手段はあるのに一度も送れない」状態になっていた。
 * 公開している本番サーバーからなら、どちらの制約も無い。
 *
 * 鍵は public/indexnow-key.txt（公開している値）をそのまま読む。
 * 応答にも記録にも鍵は出さない。
 */

export const runtime = 'nodejs';

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const HOST = 'laruhp.com';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let key: string;
  try {
    key = (await readFile(path.join(process.cwd(), 'public', 'indexnow-key.txt'), 'utf8')).trim();
  } catch {
    return NextResponse.json({ error: '鍵のファイルが読めません。' }, { status: 500 });
  }
  // 形が違う鍵を送ると、以後その host が弾かれることがある。先に止める。
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
    return NextResponse.json({ error: '鍵の形式が正しくありません。' }, { status: 500 });
  }

  const urlList = [...laruHpSitemapXml().matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  if (!urlList.length || urlList.some(url => new URL(url).host !== HOST)) {
    return NextResponse.json({ error: '送る先のURL一覧が正しくありません。' }, { status: 500 });
  }

  let status: number;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/indexnow-key.txt`, urlList }),
      signal: AbortSignal.timeout(15_000),
    });
    status = res.status;
  } catch {
    return NextResponse.json({ error: 'IndexNow へ届きませんでした。' }, { status: 502 });
  }

  // 200/202 以外は受け付けられていない。202 は「受け取った、これから見る」。
  const accepted = status === 200 || status === 202;
  return NextResponse.json({ ok: accepted, status, submitted: urlList.length }, { status: accepted ? 200 : 502 });
}
