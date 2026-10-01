/**
 * 公開HTML（sites.published_html）から、公開した時点の「名乗り」を読む。
 *
 * 「保存」は下書き、「公開」は外部への反映。公開ページの head（title・description・
 * og:・twitter:）と、構造化データ・OGカードも、公開した時点の内容で出す。
 * 下書き（sites.name / seo_json / settings_json）は保存のたびに変わるので、ここでは使わない。
 *
 * 公開HTMLは lib/html-export.ts が作った文書。<head> に title・description・og:・twitter: を
 * escapeHtml して焼き込んでいる。ここでは正規表現で値を拾うだけで、HTMLもscriptも実行しない。
 * 新しく公開したHTMLには、末尾に <!--lhpmeta:...--> （base64 の JSON）も入る。
 * サイト名・事業者情報・OGカードの色など、標準のタグに無い公開時点の値はここから読む。
 */

export type PublishedMeta = {
  siteName?: string;
  businessInfo?: Record<string, unknown>;
  primaryColor?: string;
};

export type PublishedHead = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  /** 新しい公開HTMLだけにある、公開時点の補足（無ければ null） */
  meta: PublishedMeta | null;
};

const MAX = 2000;

/* 書き出しはブラウザ（制作画面のプレビュー）でも動くので、Buffer を使わない */
function toBase64(text: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromBase64(b64: string): string {
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** escapeHtml（lib/safe-markup.ts）の逆と、よく出る数値参照だけ戻す */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d{1,7});/g, (_, n) => safeChar(Number(n)))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, n) => safeChar(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
function safeChar(code: number): string {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
}
const clean = (s: string | undefined) => decodeEntities(String(s ?? '')).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, MAX);

/** <body> より前（文書の頭）だけを見る。本文に同じ形の文字列があっても拾わない */
function headPart(html: string): string {
  const at = html.search(/<body\b/i);
  return at >= 0 ? html.slice(0, at) : html.slice(0, 20000);
}

function metaContent(head: string, attr: 'name' | 'property', key: string): string {
  const re = new RegExp(`<meta\\b[^>]*\\b${attr}\\s*=\\s*"${key.replace(/[:.]/g, '\\$&')}"[^>]*>`, 'i');
  const tag = head.match(re)?.[0];
  if (!tag) return '';
  return clean(tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1]);
}

/** http(s) の絶対URLだけ。それ以外（相対・javascript: 等）は空にする */
export function httpUrl(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!/^https?:\/\//i.test(s) || s.length > MAX) return '';
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:' ? s : ''; } catch { return ''; }
}

/** 公開HTMLに焼き込まれた補足（<!--lhpmeta:base64-->）。壊れていれば null */
export function readPublishedMeta(html: string): PublishedMeta | null {
  const m = String(html ?? '').match(/<!--lhpmeta:([A-Za-z0-9+/=]{1,40000})-->/);
  if (!m) return null;
  try {
    const raw = JSON.parse(fromBase64(m[1])) as Record<string, unknown>;
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
    const out: PublishedMeta = {};
    if (typeof raw.siteName === 'string') out.siteName = raw.siteName.slice(0, 200);
    if (raw.businessInfo && typeof raw.businessInfo === 'object' && !Array.isArray(raw.businessInfo)) out.businessInfo = raw.businessInfo as Record<string, unknown>;
    if (typeof raw.primaryColor === 'string' && /^#[0-9a-f]{3,8}$/i.test(raw.primaryColor)) out.primaryColor = raw.primaryColor;
    return out;
  } catch { return null; }
}

/** 公開HTMLへ焼き込む補足を作る（lib/html-export.ts から使う） */
export function publishedMetaComment(meta: PublishedMeta): string {
  const json = JSON.stringify({ v: 1, ...meta });
  return `<!--lhpmeta:${toBase64(json)}-->`;
}

export function readPublishedHead(html: string): PublishedHead {
  const head = headPart(String(html ?? ''));
  return {
    title: clean(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]),
    description: metaContent(head, 'name', 'description'),
    ogTitle: metaContent(head, 'property', 'og:title'),
    ogDescription: metaContent(head, 'property', 'og:description'),
    ogImage: httpUrl(metaContent(head, 'property', 'og:image')),
    twitterTitle: metaContent(head, 'name', 'twitter:title'),
    twitterDescription: metaContent(head, 'name', 'twitter:description'),
    twitterImage: httpUrl(metaContent(head, 'name', 'twitter:image')),
    meta: readPublishedMeta(html),
  };
}

/** 書き出しが自動で付けるOG画像（/api/og?title=…）か。自分で指定した画像と区別する */
export function isAutoOgImage(url: string): boolean {
  try { return new URL(url).pathname === '/api/og'; } catch { return false; }
}

/**
 * 本文の中身の指紋。見える文字と、リンク先・画像・代替テキストを順に並べる。
 * 部品IDが同じでも、文字・リンク・写真が違えば別物になる。script と style は見ない。
 */
export function bodyFingerprint(html: string): string {
  const s = String(html ?? '');
  const at = s.search(/<body\b/i);
  const body = (at >= 0 ? s.slice(at) : s)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const parts: string[] = [];
  for (const m of body.matchAll(/<[^>]+>|[^<]+/g)) {
    const t = m[0];
    if (t.startsWith('<')) {
      for (const a of t.matchAll(/\b(href|src|alt|action|data-lhp-block)\s*=\s*"([^"]*)"/gi)) {
        parts.push(`${a[1].toLowerCase()}=${decodeEntities(a[2]).split('?')[0]}`);
      }
    } else {
      const text = decodeEntities(t).replace(/\s+/g, ' ').trim();
      if (text) parts.push(text);
    }
  }
  return parts.join('\n');
}
