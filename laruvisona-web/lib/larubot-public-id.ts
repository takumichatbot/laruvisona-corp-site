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

/**
 * LARUbot が発行する public_id の形（lib/larubot-provision.ts と同じ）。
 * 形の合わない値は、公開ページに出さない（手入力の欄が旧ビルダーに残っているため）。
 */
export const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const clean = (value: string | undefined): string => {
  const v = (typeof value === 'string' ? value : '').trim();
  return PUBLIC_ID_PATTERN.test(v) ? v : '';
};

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

/**
 * LARU SEO の記事一覧を置く場所（公開ページが HTML に差し込む）。
 *
 * これまでは blog.js を data-target なしで読んでいたので、記事一覧は
 * 「script タグの直前」＝**フッターのさらに下**に、見出しも無く出ていた。
 * blog.js は data-target で描く場所を指定できる（LARUbot 側 2026-09-17）ので、それを使う。
 *
 * 記事が1件も無いうちは、見出しごと隠す（:has で .card の有無を見る）。
 */
export const SEO_ARTICLE_TARGET = '#laru-seo-list';

const SEO_ARTICLE_SLOT =
  '<section id="laru-seo-articles" aria-label="コラム">'
  + '<style>#laru-seo-articles{padding:48px 20px}#laru-seo-articles>div{max-width:1100px;margin:0 auto}'
  + '#laru-seo-articles h2{font-size:1.4rem;font-weight:700;margin:0 0 16px}'
  + '#laru-seo-articles:not(:has(.card)){display:none}</style>'
  + '<div><h2>コラム</h2><div id="laru-seo-list"></div></div></section>';

/** 記事一覧の置き場を、フッターの直前（無ければ本文の最後）に1つだけ差し込む。 */
export function withSeoArticleSlot(html: string): string {
  if (html.includes('id="laru-seo-articles"')) return html;
  const last = (re: RegExp): number => {
    let at = -1;
    for (const m of html.matchAll(re)) at = m.index ?? at;
    return at;
  };
  const footer = last(/<footer\b/gi);
  if (footer >= 0) return html.slice(0, footer) + SEO_ARTICLE_SLOT + html.slice(footer);
  const body = last(/<\/body>/gi);
  if (body >= 0) return html.slice(0, body) + SEO_ARTICLE_SLOT + html.slice(body);
  return html + SEO_ARTICLE_SLOT;
}
