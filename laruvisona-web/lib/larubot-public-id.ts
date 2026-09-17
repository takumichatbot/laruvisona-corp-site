/**
 * LARUbot の連携ID（public_id）の扱い。
 *
 * 2026-09-17、LARUbot 側からの回答で分かったこと。
 *
 *   「`laruseo_public_id` は `larubot_public_id` と同じ値です。別の ID ではありません。
 *     こちらのアカウントは public_id を1つだけ持ち、チャットも LARUSEO も同じ値で参照します。」
 *
 * こちらは長いあいだ、チャット用（larubotPublicId）と LARUSEO 用（laruseoPublicId）を
 * **別の値として**持ち、編集画面にも別々の入力欄を出していた。
 *
 * ここが食い違うと、公開HTMLの設置タグに違う値が入り、
 * **ブログの記事が0件になる。しかもエラーは1つも出ない。**
 * 記事が出ないことに気づくのはサイトの持ち主だけで、こちらには何も届かない。
 *
 * 決めごと:
 *   ・LARUSEO の欄が空なら、チャットのIDを使う（同じ値なので、これで正しい）
 *   ・両方に値があって違っていたら、それは設定の誤り。画面で知らせる
 */

export interface PublicIdSettings {
  larubotPublicId?: string;
  laruseoPublicId?: string;
}

const clean = (value: string | undefined): string => (value || '').trim();

/** ブログ（blog.js）の data-id に入れる値。 */
export function blogPublicId(settings: PublicIdSettings): string {
  return clean(settings.laruseoPublicId) || clean(settings.larubotPublicId);
}

/** チャット（embed.js）の data-public-id に入れる値。 */
export function chatPublicId(settings: PublicIdSettings): string {
  return clean(settings.larubotPublicId) || clean(settings.laruseoPublicId);
}

/**
 * 2つのIDが食い違っているか。
 * 片方しか無いときは食い違いではない（もう片方は補われる）。
 */
export function publicIdMismatch(settings: PublicIdSettings): boolean {
  const chat = clean(settings.larubotPublicId);
  const seo = clean(settings.laruseoPublicId);
  return !!chat && !!seo && chat !== seo;
}
