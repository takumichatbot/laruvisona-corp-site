// Google OAuth の state 検証。
//
// 以前の実装は state に Supabase のユーザーID をそのまま入れ、コールバックでは
// その値を書き込み先として信用していた。ID は秘密ではないため、
//   1) 攻撃者が自分の Google アカウントで code を取得し、
//   2) state を被害者のユーザーID に差し替えてコールバックを叩く
// だけで、被害者の profiles.google_refresh_token を攻撃者のトークンに書き換えられる
// （逆に、被害者にコールバックURLを踏ませて連携先を乗っ取ることもできる）。
//
// 対策は 2 つ:
//   - state は「そのブラウザが認可を開始した」ことだけを示す使い捨て乱数にし、
//     httpOnly Cookie に同じ値を置いて突き合わせる（CSRF 対策）。
//   - 書き込み先の user_id は state からではなく、コールバック時点の
//     ログインセッションから取る（IDを推測されても他人の行に書けない）。
export const OAUTH_STATE_COOKIE = 'g_oauth_state';
export const OAUTH_STATE_MAX_AGE_SEC = 10 * 60; // 認可画面の滞在を見て10分

/** 使い捨ての state を作る（URL 安全な 256bit 乱数）。 */
export function createOAuthState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 長さ非依存の比較。空文字は常に不一致にする（Cookie 欠落を成功にしない）。 */
export function oauthStateMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
