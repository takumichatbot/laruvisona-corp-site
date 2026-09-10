// 文字を「文字として」出すための道具。
//
// ブロックの中身は、人が打った文字だけとは限らない。AIの生成結果、他サイトの
// 取り込み、CSVの読み込み、連携先の応答が同じ場所に入る。これらをHTMLとして
// そのまま描くと、認証済みの編集画面や公開ページでスクリプトが動く。
//
// ここに集めた関数だけを通す。用途ごとに関数が分かれているのは、
// 「本文」「URL」「CSSの値」「リッチテキスト」で安全の条件が違うため。

/** 本文・属性の中身。& < > " ' を実体参照にする */
export function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * href / src に入れてよいURLだけを通す。
 *
 * 属性のエスケープだけでは足りない。javascript: や data:text/html は、
 * 引用符から出ていなくても押した瞬間に動く。
 */
export function safeUrl(input: unknown, fallback = '#'): string {
  const s = String(input ?? '').trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (!s) return fallback;
  // 相対パス・ページ内リンク・クエリ
  if (/^[/#?]/.test(s) && !s.startsWith('//')) return s;
  if (/^\.{1,2}\//.test(s)) return s;
  // 明示したスキームだけ
  if (/^https?:\/\/[^\s]+$/i.test(s)) return s;
  if (/^mailto:[^\s]+$/i.test(s)) return s;
  if (/^tel:[+0-9\-() ]+$/i.test(s)) return s;
  // 画像のデータURL。SVGはスクリプトを持てるので通さない
  if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=]+$/i.test(s)) return s;
  return fallback;
}

/**
 * style="" の中に入れる値。
 * 宣言の区切りや別の属性へ抜け出せる文字を落とす。
 */
export function safeCssValue(input: unknown, fallback = ''): string {
  const s = String(input ?? '').trim();
  if (!s) return fallback;
  if (/[;{}<>"'\\]/.test(s)) return fallback;
  if (/expression\s*\(|url\s*\(|@import|javascript:/i.test(s)) return fallback;
  if (s.length > 120) return fallback;
  return s;
}

/** 数値として使う値。単位付きの文字列や式を弾く */
export function safeNumber(input: unknown, fallback: number, lo = -1e6, hi = 1e6): number {
  if (input === null || input === undefined || String(input).trim() === '') return fallback;
  const n = typeof input === 'number' ? input : Number(String(input).trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

/* ── リッチテキスト ───────────────────────────────────────────────────
   本文に「太字」「改行」「リンク」だけを許す入れ物。
   通常のテキスト項目とは型を分け、こちらを通ったものだけHTMLとして出す。 */

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'a', 'ul', 'ol', 'li', 'p', 'span', 'small']);
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
};

/**
 * 許可した札と属性だけを残す。それ以外は文字として出す。
 *
 * 完全なHTMLパーサではない。だからこそ「許したものだけ残す」側に倒し、
 * 判断がつかないものはすべてエスケープする。
 */
export function sanitizeRichText(input: unknown): string {
  const src = String(input ?? '');
  let out = '';
  let i = 0;
  const openTags: string[] = [];

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) { out += escapeHtml(src.slice(i)); break; }
    out += escapeHtml(src.slice(i, lt));

    const gt = src.indexOf('>', lt);
    if (gt === -1) { out += escapeHtml(src.slice(lt)); break; }

    const inner = src.slice(lt + 1, gt);
    const m = inner.match(/^\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([\s\S]*)$/);
    if (!m) { out += escapeHtml(src.slice(lt, gt + 1)); i = gt + 1; continue; }

    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const rest = m[3];

    if (!ALLOWED_TAGS.has(name)) {
      // 許していない札は、中身ごと文字にする（<script> の中身を出さない）
      out += escapeHtml(src.slice(lt, gt + 1));
      i = gt + 1;
      continue;
    }

    if (closing) {
      const at = openTags.lastIndexOf(name);
      if (at !== -1) { openTags.splice(at, 1); out += `</${name}>`; }
      i = gt + 1;
      continue;
    }

    const attrs: string[] = [];
    const allow = ALLOWED_ATTRS[name];
    if (allow) {
      const re = /([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
      let a: RegExpExecArray | null;
      while ((a = re.exec(rest))) {
        const key = a[1].toLowerCase();
        if (!allow.has(key)) continue;
        const value = a[3] ?? a[4] ?? a[5] ?? '';
        if (key === 'href') attrs.push(`href="${escapeHtml(safeUrl(value))}"`);
        else if (key === 'target' && value === '_blank') attrs.push('target="_blank"');
        else if (key === 'rel') attrs.push('rel="noopener noreferrer"');
      }
      if (attrs.some(x => x.startsWith('target=')) && !attrs.some(x => x.startsWith('rel='))) {
        attrs.push('rel="noopener noreferrer"');
      }
    }

    if (name === 'br') { out += '<br>'; i = gt + 1; continue; }
    openTags.push(name);
    out += `<${name}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
    i = gt + 1;
  }

  // 閉じ忘れを閉じる
  for (let k = openTags.length - 1; k >= 0; k--) out += `</${openTags[k]}>`;
  return out;
}

/**
 * 編集画面の入力欄に入れる前に、見えない制御文字と過剰な長さを落とす。
 * 取り込み・AI生成の文字列をブロックへ入れる入口で使う。
 */
export function cleanIncomingText(input: unknown, maxLength = 20000): string {
  return String(input ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .slice(0, maxLength);
}
