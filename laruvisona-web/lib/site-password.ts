import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * 公開サイトの閲覧パスワード。
 *
 * 2026-09-17まで、これは**保護ではなかった。**
 *
 * 編集画面はこう書いている。
 *   「設定すると公開サイトにアクセス時にパスワードの入力が必要になります。」
 *
 * 実際にやっていたのは、ページを丸ごと配信したあとで、JSで白い覆いを
 * 被せるだけ。パスワードは公開HTMLに `var pw="..."` と**平文で入っていた。**
 * ソースを表示すれば読めるし、本文もそこに全部ある。
 * サーバ側の遮断は無かった。
 *
 * ブラウザで開けば確かにパスワードを聞かれるので、見た目には効いている。
 * 「内覧用に身内だけへ見せたい」「開店前に取引先だけへ」という用途で
 * 使う人にとっては、約束が守られていない。
 *
 * いまは、合っているときだけ本文を返す。合うまで本文は一度も配信しない。
 *
 * 合鍵（cookie）の作り:
 *   ・値は HMAC(サイトの鍵 + パスワード)。**パスワードそのものは入れない。**
 *   ・パスワードを変えると値が変わるので、**古い合鍵は自動で無効になる。**
 *   ・httpOnly。ページのJSからは読めない。
 *   ・サイトごとに別の名前。別のサイトの合鍵では入れない。
 */

/** 鍵とパスワードの境目。slug にもUUIDにも出てこない並びにする。 */
const SEP = '::pw::';

function secret(): string {
  const value = process.env.ANALYTICS_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (value.length < 32) throw new Error('site_password_unavailable');
  return value;
}

/** その合鍵が正しいかを調べるための値。 */
export function sitePasswordToken(siteKey: string, password: string): string {
  return createHmac('sha256', secret())
    .update(`laruhp-site-pw:v1:${siteKey}${SEP}${password}`)
    .digest('hex');
}

/** cookie の名前。サイトごとに分ける。 */
export function sitePasswordCookieName(siteKey: string): string {
  const safe = createHmac('sha256', 'laruhp-site-pw-name:v1').update(siteKey).digest('hex').slice(0, 16);
  return `lhp_pw_${safe}`;
}

/** 持っている合鍵が、いまのパスワードに対して正しいか。 */
export function sitePasswordCookieValid(
  siteKey: string,
  password: string,
  cookieValue: string | undefined,
): boolean {
  if (!cookieValue || !/^[a-f0-9]{64}$/i.test(cookieValue)) return false;
  let expected: string;
  try { expected = sitePasswordToken(siteKey, password); }
  catch { return false; }
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(cookieValue, 'hex'));
}

/**
 * 打たれたパスワードが合っているか。
 *
 * 一度ハッシュにしてから比べる。長さの違いや、先頭何文字が合っているかが、
 * 返るまでの時間に出ないようにするため。
 */
export function sitePasswordMatches(password: string, attempt: string): boolean {
  const a = createHmac('sha256', 'laruhp-site-pw-cmp:v1').update(password).digest();
  const b = createHmac('sha256', 'laruhp-site-pw-cmp:v1').update(attempt).digest();
  return timingSafeEqual(a, b);
}

/**
 * 入口の画面。**本文は一切入れない。**
 *
 * ここに本文の断片やパスワードを混ぜると、直した意味が無くなる。
 * 出してよいのは、店名と、入力欄と、間違いのお知らせだけ。
 */
export function sitePasswordPageHtml(siteName: string, opts: { failed?: boolean } = {}): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  return `<!DOCTYPE html>
<html lang="ja"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(siteName)}</title>
<style>
  body{margin:0;min-height:100svh;display:flex;align-items:center;justify-content:center;
       background:#0f172a;font-family:system-ui,-apple-system,'Hiragino Sans','Yu Gothic UI',sans-serif;padding:24px}
  .card{background:#1e293b;border:1px solid rgba(255,255,255,.1);border-radius:20px;
        padding:40px 32px;max-width:360px;width:100%;text-align:center;box-sizing:border-box}
  .eyebrow{font-size:.68rem;font-weight:800;letter-spacing:.18em;color:#94a3b8;margin-bottom:14px}
  h1{color:#fff;font-size:1.25rem;font-weight:700;margin:0 0 8px}
  p{color:#94a3b8;font-size:.875rem;margin:0 0 24px}
  input{width:100%;box-sizing:border-box;background:#0f172a;border:1px solid rgba(255,255,255,.2);
        border-radius:10px;padding:14px 16px;color:#fff;font-size:16px;outline:none;margin-bottom:12px}
  input:focus{border-color:#3b82f6}
  button{width:100%;background:#3b82f6;color:#fff;border:none;border-radius:10px;
         padding:14px;font-size:1rem;font-weight:700;cursor:pointer;min-height:48px}
  .err{color:#f87171;font-size:.8rem;margin:12px 0 0}
</style></head>
<body>
  <form class="card" method="POST" action="">
    <div class="eyebrow">閲覧制限</div>
    <h1>${esc(siteName)}</h1>
    <p>このページを見るには、パスワードが必要です。</p>
    <input type="password" name="password" placeholder="パスワード" autocomplete="current-password"
           aria-label="パスワード" autofocus required />
    <button type="submit">入る</button>
    ${opts.failed ? '<p class="err" role="alert">パスワードが違います。</p>' : ''}
  </form>
</body></html>`;
}
