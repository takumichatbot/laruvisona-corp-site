import { createHash } from 'node:crypto';

/**
 * 記事ページの応答。ステータス（200/301/404/410/503）を正しく返すため、ページではなく Route Handler で返す。
 * 200 は CDN に 5 分置いてよい（LARU SEO の再検証と同じ）。ETag が一致すれば 304。エラーは置かない。
 */
export function htmlResponse(req: Request, html: string, status = 200, extra: Record<string, string> = {}): Response {
  const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8', ...extra };
  if (status !== 200) {
    // 404 は置かない（公開・再公開の直後に LARU SEO の公開先を登録したとき、古い 404 が残らないように）。410 は記事の削除なので 60 秒
    headers['Cache-Control'] = status === 410 ? 'public, max-age=0, s-maxage=60' : 'no-store';
    if (status === 503) headers['Retry-After'] = '300';
    return new Response(req.method === 'HEAD' ? null : html, { status, headers });
  }
  const etag = `W/"${createHash('sha1').update(html).digest('hex').slice(0, 32)}"`;
  headers.ETag = etag;
  headers['Cache-Control'] = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600';
  const inm = req.headers.get('if-none-match');
  if (inm && inm.split(',').map((s) => s.trim()).includes(etag)) return new Response(null, { status: 304, headers });
  return new Response(req.method === 'HEAD' ? null : html, { status: 200, headers });
}

export function redirectResponse(to: string): Response {
  return new Response(null, { status: 301, headers: { Location: to, 'Cache-Control': 'public, max-age=0, s-maxage=300' } });
}
