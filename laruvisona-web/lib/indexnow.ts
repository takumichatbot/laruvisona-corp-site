import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * IndexNow へ「このURLが変わった」と知らせる。
 *
 * ── なぜ要るか ──
 *
 * 顧客がサイトを公開しても、**検索エンジンには何も伝えていなかった。**
 * 見つけてもらえるのは、どこかからリンクされるか、クロールが偶然通るまで。
 * 「検索流入を継続的に獲得」と売っている製品で、公開した瞬間に
 * 誰にも知らせていないのは、いちばん最初の一歩が抜けている。
 *
 * ── 気をつけること ──
 *
 * 鍵の形が違うものを送ると、以後その host ごと弾かれることがある。
 * 送る前に形を確かめる。鍵は応答にも記録にも出さない
 * （公開しているファイルの値だが、わざわざログに流さない）。
 *
 * 送り先の host と、送るURLの host が一致していること。
 * 一致していないURLが1つでも混じると、まとめて無効になる。
 *
 * **ここは投げるだけ。公開そのものを止めない。**
 */

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const KEY_SHAPE = /^[A-Za-z0-9-]{8,128}$/;

export type IndexNowResult =
  | { ok: true; status: number; count: number }
  | { ok: false; reason: 'key_unreadable' | 'key_invalid' | 'no_urls' | 'host_mismatch' | 'unreachable' | 'rejected'; status?: number };

async function readKey(): Promise<string | null> {
  try {
    const key = (await readFile(path.join(process.cwd(), 'public', 'indexnow-key.txt'), 'utf8')).trim();
    return key || null;
  } catch {
    return null;
  }
}

/** 投げる。例外は出さない。呼ぶ側は結果を見て記録する。 */
export async function submitIndexNow(host: string, urls: string[]): Promise<IndexNowResult> {
  if (!urls.length) return { ok: false, reason: 'no_urls' };

  const key = await readKey();
  if (!key) return { ok: false, reason: 'key_unreadable' };
  if (!KEY_SHAPE.test(key)) return { ok: false, reason: 'key_invalid' };

  for (const url of urls) {
    let parsed: URL;
    try { parsed = new URL(url); } catch { return { ok: false, reason: 'host_mismatch' }; }
    if (parsed.host !== host) return { ok: false, reason: 'host_mismatch' };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `https://${host}/indexnow-key.txt`, urlList: urls }),
      signal: AbortSignal.timeout(6_000),
    });
    // 200 も 202 も受理。それ以外は、受け取ってもらえていない。
    if (res.status === 200 || res.status === 202) return { ok: true, status: res.status, count: urls.length };
    return { ok: false, reason: 'rejected', status: res.status };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}
