// 案内サイトと、ログイン・保存を扱うアプリの origin を分ける。
export const LARUHP_ORIGIN = 'https://laruhp.com';
export const LARUHP_APP_ORIGIN = 'https://laruvisona.jp';
export function isLaruHpHost(host: string): boolean {
  return ['laruhp.com', 'www.laruhp.com'].includes(host.toLowerCase());
}
