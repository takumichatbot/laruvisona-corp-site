import { NextResponse } from 'next/server';
import { probeSecret, verifyChallenge } from '@/lib/domain-probe-proof';

// 独自ドメインが「実際にこのサービスへ届いているか」を確かめるための応答。
//
// 固定の文字列を返すだけだと、別のサーバーで同じJSONを返して偽装できる。
// そこで、要求ごとの nonce と期限に対して、共有鍵でしか作れない応答署名を返す。
// 鍵（DOMAIN_PROBE_SECRET）はこのサービスだけが持つ。
//
// 秘密そのものは返さない。返すのは、その要求に対する署名だけ。

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = probeSecret();
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }

  const url = new URL(req.url);
  const actualHost = (req.headers.get('host') || '').split(':')[0];

  const res = verifyChallenge(secret, {
    host: url.searchParams.get('host'),
    nonce: url.searchParams.get('nonce'),
    exp: url.searchParams.get('exp'),
    sig: url.searchParams.get('sig'),
  }, actualHost);

  if (!res.ok) {
    return NextResponse.json({ ok: false, reason: res.reason }, { status: 400, headers: { 'cache-control': 'no-store' } });
  }
  return NextResponse.json({ ok: true, proof: res.proof }, { headers: { 'cache-control': 'no-store' } });
}
