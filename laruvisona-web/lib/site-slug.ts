/**
 * 顧客サイトの公開URLに入る文字列（slug）。
 *
 * 2026-09-17、本番で見つかったこと。
 *
 * 作るときと直すときで、**別の決まりを使っていた。**
 *   作る（POST /api/sites）  ひらがな・漢字を残す
 *   直す（PATCH /api/sites） 英数字とハイフンだけ、連続ハイフンも禁止
 *
 * その結果、すべてのサイトが「直すほうの決まりでは通らない値」で生まれていた。
 * 実際の値: `新しい--mtzlm6eu`（日本語が入り、ハイフンが2つ続く）
 *
 * これが表に出るとどうなるか。
 *   ・貼ると `laruvisona.jp/hp/%E6%96%B0%E3%81%97%E3%81%84--mtzlm6eu` になる。
 *     LINEでもXでもメールでも、この形で出る。**怪しいリンクに見える。**
 *   ・屋号を後から直しても、URLは作った時の名前のまま。
 *     作った直後は「新しいサイト」なので、**全員のURLに「新しい」が残る。**
 *     お客様が配るチラシに載る文字が、それ。
 *
 * 決めごと:
 *   ・決まりはこのファイルにだけ置く。作る側も直す側も、ここを使う。
 *   ・URLに入るのは英数字とハイフンだけ。日本語は入れない。
 *   ・名前から英数字が拾えないとき（日本語だけの屋号）は、当たり障りのない
 *     形にしておき、**画面で「URLを決めてください」と言う**。
 *     勝手にローマ字へ直すと、読み方を間違えたURLが一生残る。
 */

/** 直す側（PATCH）が前から使っていた決まり。これを正本にする。 */
export const SITE_SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
export const SITE_SLUG_MIN = 3;
export const SITE_SLUG_MAX = 60;

/** 画面にも受け口にも、同じ文言を出す。 */
export const SITE_SLUG_RULE = '3〜60文字・英数字とハイフン（先頭末尾・連続ハイフン不可）';

export function isValidSiteSlug(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length < SITE_SLUG_MIN || value.length > SITE_SLUG_MAX) return false;
  if (value.includes('--')) return false;
  return SITE_SLUG_RE.test(value);
}

/** 打っている最中に、使えない文字を落とす。画面の入力欄で使う。 */
export function cleanSiteSlugInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, SITE_SLUG_MAX);
}

/**
 * 自動で付けた値かどうか。
 * これが true のあいだは、画面で「URLを決めてください」と出す。
 */
export function isAutoSiteSlug(slug: string): boolean {
  return /^site-[a-z0-9]{4,}$/.test(slug);
}

/**
 * 屋号から、URLに入れる値を作る。
 *
 * 英数字が拾えたらそれを使う（「LARU Cafe」→ `laru-cafe-xxxx`）。
 * 拾えなければ `site-xxxx`。**ローマ字への読み替えはしない。**
 * 「木もれ日」を kimoreb i と読むか komorebi と読むかは、こちらには分からない。
 * 間違えた読みがURLとして一生残るより、画面で本人に決めてもらうほうがよい。
 */
export function makeSiteSlug(name: string, now: number = Date.now()): string {
  const suffix = now.toString(36);

  const ascii = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // 接尾辞のぶんを残して切る。切った末尾がハイフンなら落とす。
  const room = SITE_SLUG_MAX - suffix.length - 1;
  const base = ascii.slice(0, Math.max(0, room)).replace(/-+$/, '');

  const slug = base.length >= 2 ? `${base}-${suffix}` : `site-${suffix}`;
  // ここまでで決まりを満たすはずだが、満たさないものを世に出さない。
  return isValidSiteSlug(slug) ? slug : `site-${suffix}`;
}
