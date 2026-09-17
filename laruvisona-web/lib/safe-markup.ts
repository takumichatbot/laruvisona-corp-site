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
/** 閉じ札を持たない札。 */
const VOID_TAGS = new Set(['br', 'hr', 'img']);

/** 記事の本文。見出し・画像・表まで通す。 */
const ARTICLE_TAGS = new Set([
  'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'span', 'small',
  'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'code',
  'figure', 'figcaption', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);
const ARTICLE_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height']),
};
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
};

/**
 * 記事では、この札は**中身ごと捨てる**。
 *
 * 許していない札は普通、文字にして残す（利用者が打った `<b>` を
 * 消してしまわないため）。ただし記事の本文は人が打ったものではない。
 * ここで `<script>` を文字にすると、読み手の画面に JavaScript が
 * そのまま並ぶ。動きはしないが、記事としては壊れている。
 *
 * リッチテキスト（利用者の入力）では、打った通りを見せたいので捨てない。
 */
const ARTICLE_DROP = new Set(['script', 'style', 'iframe', 'noscript', 'object', 'embed', 'template', 'svg', 'math', 'form']);

/**
 * 許可した札と属性だけを残す。それ以外は文字として出す。
 *
 * 完全なHTMLパーサではない。だからこそ「許したものだけ残す」側に倒し、
 * 判断がつかないものはすべてエスケープする。
 */
/**
 * 許す札と属性を差し替えられる、共通の本体。
 *
 * 2026-09-17: 記事の本文（見出し・画像・表を含む）も通す必要が出たので、
 * 方針だけ差し替えられるようにした。**解析の仕方は1つに保つこと。**
 * ここを写して別の除菌器を作ると、片方だけ穴が残る。
 */
function sanitizeWithPolicy(
  input: unknown,
  allowedTags: Set<string>,
  allowedAttrs: Record<string, Set<string>>,
  dropContent: Set<string> = new Set(),
): string {
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

    if (!allowedTags.has(name)) {
      if (dropContent.has(name)) {
        if (closing) { i = gt + 1; continue; }
        // 閉じ札まで読み飛ばす。無ければ、そこから先は全部捨てる。
        const end = src.toLowerCase().indexOf(`</${name}`, gt);
        if (end === -1) { i = src.length; break; }
        const endGt = src.indexOf('>', end);
        i = endGt === -1 ? src.length : endGt + 1;
        continue;
      }
      // 許していない札は、文字にして残す（利用者が打った通りを見せる）
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
    const allow = allowedAttrs[name];
    if (allow) {
      const re = /([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
      let a: RegExpExecArray | null;
      while ((a = re.exec(rest))) {
        const key = a[1].toLowerCase();
        if (!allow.has(key)) continue;
        const value = a[3] ?? a[4] ?? a[5] ?? '';
        if (key === 'href') attrs.push(`href="${escapeHtml(safeUrl(value))}"`);
        else if (key === 'src') {
          // よそのサーバーの絵。http や data: を混ぜない。
          const url = safeUrl(value, '');
          if (url.startsWith('https://')) attrs.push(`src="${escapeHtml(url)}"`);
        }
        else if (key === 'alt') attrs.push(`alt="${escapeHtml(value)}"`);
        else if (key === 'width' || key === 'height') {
          if (/^\d{1,5}$/.test(value)) attrs.push(`${key}="${value}"`);
        }
        else if (key === 'target' && value === '_blank') attrs.push('target="_blank"');
        else if (key === 'rel') attrs.push('rel="noopener noreferrer"');
      }
      if (attrs.some(x => x.startsWith('target=')) && !attrs.some(x => x.startsWith('rel='))) {
        attrs.push('rel="noopener noreferrer"');
      }
    }

    if (VOID_TAGS.has(name)) {
      // 閉じ札を持たない。開いたままにすると、あとで勝手に閉じてしまう。
      if (name === 'img') {
        // 絵が読めなくても、そこにあったことが分かるように alt は残す。
        // 読み込みは後回しにして、本文の表示を止めない。
        out += `<img ${attrs.join(' ')} loading="lazy" decoding="async">`;
      } else {
        out += `<${name}>`;
      }
      i = gt + 1;
      continue;
    }
    openTags.push(name);
    out += `<${name}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
    i = gt + 1;
  }

  // 閉じ忘れを閉じる
  for (let k = openTags.length - 1; k >= 0; k--) out += `</${openTags[k]}>`;
  return out;
}

export function sanitizeRichText(input: unknown): string {
  return sanitizeWithPolicy(input, ALLOWED_TAGS, ALLOWED_ATTRS);
}

/**
 * よそから受け取った記事の本文を、こちらのページに出す前に通す。
 *
 * LARUSEO（larubot.tokyo）が生成したHTMLをそのまま出すと、
 * 向こうに何かが混ざった日に、こちらのドメインで実行される。
 * 見出し・段落・箇条書き・引用・表・画像だけを残し、それ以外は文字にする。
 */
export function sanitizeArticleHtml(input: unknown): string {
  return sanitizeWithPolicy(input, ARTICLE_TAGS, ARTICLE_ATTRS, ARTICLE_DROP);
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

/* ── <script> と <style> の中に値を置く ──────────────────────────────
   HTMLの中では、script も style も「終わりの札が出たらそこで終わり」。
   中身がJSONとして正しいかどうかは関係がない。JSON.stringify は
   </script> を文字列のままにするので、これだけでは外へ出られてしまう。 */

/**
 * `<script>` の中に置くJSON。
 *
 * `<` `>` `&` をUnicodeエスケープする。JSONとしての意味は変わらないので
 * 受け取る側の JSON.parse や JS の解釈はそのまま。行区切り文字（U+2028/2029）は
 * JavaScriptでは改行として扱われるため、これも逃がす。
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value === undefined ? null : value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * `<style>` の中に置くCSS。利用者が書いた追加CSSなど。
 *
 * CSSとしての自由は残したいので、値を捨てるのではなく
 * 「札を閉じられる形」だけを壊す。`</style` を含む文字列は、
 * CSSの意味を変えずに `<\/style` と書ける。
 */
export function safeStyleText(input: unknown): string {
  return String(input ?? '')
    .replace(/<(\/?)(style|script)\b/gi, '<\\$1$2')
    .replace(/<!--/g, '<\\!--')
    .replace(/(expression|javascript)\s*(?=\()/gi, '$1\\ ')
    .replace(/@import/gi, '@\\import');
}

/**
 * 外部サービスのIDなど、記号を含まないはずの値。
 * 英数字と `-` `_` だけを通す。属性にもJS文字列にも安全に置ける。
 */
export function safeToken(input: unknown, maxLength = 64): string {
  const s = String(input ?? '').trim();
  if (!s) return '';
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return '';
  return s.slice(0, maxLength);
}

/**
 * CSSの色。名前・#rgb・rgb()・hsl() だけを通す。
 * `:root{--x:...}` のように、閉じ札の外に出られる場所で使う。
 */
export function safeCssColor(input: unknown, fallback: string): string {
  const s = String(input ?? '').trim();
  if (!s) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^[a-zA-Z]{3,20}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([0-9a-zA-Z.,%\s/-]{1,60}\)$/.test(s)) return s;
  return fallback;
}
