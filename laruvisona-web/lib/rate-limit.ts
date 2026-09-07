// プロセス内の簡易レート制限。Render は単一インスタンスのため実用上これで足りる。
// 複数インスタンス化する場合は Redis 等の共有ストアへ差し替えること。

const buckets = new Map<string, number[]>();

export interface RateLimitResult { ok: boolean; remaining: number; retryAfterSec: number }

/** key ごとに windowMs の間 limit 回まで許可する。 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000));
    buckets.set(key, hits);
    return { ok: false, remaining: 0, retryAfterSec };
  }
  hits.push(now);
  buckets.set(key, hits);
  // 肥大化防止（古いキーを間引く）
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every(t => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return { ok: true, remaining: limit - hits.length, retryAfterSec: 0 };
}

/** 失敗回数のカウントを消す（認証成功時など）。 */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** リクエスト元 IP。プロキシ配下では x-forwarded-for の先頭を使う。 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
