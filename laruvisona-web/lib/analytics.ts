// GA4カスタムイベント送信ヘルパー。
// NEXT_PUBLIC_GA_MEASUREMENT_ID 未設定（gtag不在）の環境では何もしない。
export function track(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.('event', event, params);
}
