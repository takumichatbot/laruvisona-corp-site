import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/adminAuth';
import { createClient } from '@/lib/supabase/server';
import { laruHpSitemapXml } from '@/lib/laruhp-public';
import { submitIndexNow } from '@/lib/indexnow';

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

const HOST = 'laruhp.com';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  /*
    送る処理そのものは lib/indexnow.ts に1つだけ置いてある。
    顧客サイトの公開時（app/api/sites/[id]/publish）も同じものを呼ぶ。
    鍵の形の確認も、host の照合も、あちらに入っている。
    ここで書き直すと、片方だけ直したときに食い違う。
  */
  const urlList = [...laruHpSitemapXml().matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const sent = await submitIndexNow(HOST, urlList);
  if (!sent.ok) {
    const message: Record<string, string> = {
      key_unreadable: '鍵のファイルが読めません。',
      key_invalid: '鍵の形式が正しくありません。',
      no_urls: '送る先のURL一覧が正しくありません。',
      host_mismatch: '送る先のURL一覧が正しくありません。',
      unreachable: 'IndexNow へ届きませんでした。',
      rejected: 'IndexNow に受け付けてもらえませんでした。',
    };
    const serverSide = sent.reason === 'key_unreadable' || sent.reason === 'key_invalid' || sent.reason === 'no_urls' || sent.reason === 'host_mismatch';
    return NextResponse.json(
      { error: message[sent.reason], reason: sent.reason, ...(sent.status ? { status: sent.status } : {}) },
      { status: serverSide ? 500 : 502 },
    );
  }
  return NextResponse.json({ ok: true, status: sent.status, submitted: sent.count });
}
