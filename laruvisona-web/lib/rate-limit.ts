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

/**
 * リクエスト元 IP。
 *
 * x-forwarded-for の**先頭**を使ってはいけない。逆プロキシは自分が見た相手を
 * 右に足していくので、先頭は送信者が自由に書ける値になる。先頭を採ると、
 *   X-Forwarded-For: 1.2.3.<毎回変える>
 * を付けるだけで、回数制限のバケツが毎回新しくなり、制限が丸ごと無効になる。
 * 管理PINの総当たり・会員ログインの総当たり・メール送信の連打が通ってしまう。
 *
 * 最後の要素が、こちらの手前にいるプロキシ（Render/CDN）が実際に見た接続元。
 * 信頼できるのはそこだけなので、右から採る。
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const hops = fwd.split(',').map(v => v.trim()).filter(Boolean);
    const nearest = hops[hops.length - 1];
    if (nearest) return nearest;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
