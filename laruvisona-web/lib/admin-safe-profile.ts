/*
  管理画面へ返す profiles から、秘密の値を外す（2026-10-01）。

  /api/admin/users が profiles を「そのまま広げて」返していたため、
  google_refresh_token・instagram_access_token などの値が管理画面のブラウザまで届いていた
  （管理者だけとはいえ、ブラウザの開発ツール・拡張機能・画面共有から漏れうる）。
  値は返さず、「持っているか」だけを has_<名前> で返す。
*/
const SECRET_KEY = /(token|secret|password|api_key|apikey|refresh)/i;

export function safeProfile(p: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!p) return out;
  for (const [k, v] of Object.entries(p)) {
    if (SECRET_KEY.test(k)) {
      out[`has_${k}`] = v !== null && v !== undefined && v !== '';
      continue;
    }
    out[k] = v;
  }
  return out;
}
