import { NextResponse } from 'next/server';

// 独自ドメインが「実際にこのサービスへ届いているか」を確かめるための目印。
//
// 公開DNSのレコードを見るだけでは判断できない構成がある
// （Cloudflareのプロキシを有効にすると、CNAMEもRenderの共有IPも公開DNSに出ない）。
// また共有Aレコードへの一致は、このサービスに届いている証拠にはなっても
// Render登録やTLSの完了までは意味しない。
//
// そこで、そのホスト名でHTTPSを話しかけてこの応答が返るかどうかを、
// 接続済み判定の必須条件にしている。
//
// 秘密は返さない。返すのは固定の目印と、受け取った Host だけ。
export const dynamic = 'force-dynamic';

export const DOMAIN_PROBE_MARKER = 'laruhp-domain-probe';

export async function GET(req: Request) {
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  return NextResponse.json(
    { marker: DOMAIN_PROBE_MARKER, host },
    { headers: { 'cache-control': 'no-store' } },
  );
}
