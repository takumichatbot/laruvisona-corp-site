/**
 * 公開済みHTMLに、保存してある翻訳をあてる。
 *
 * これが無かったので、翻訳は「完了しました（142件）」と出るのに、
 * 案内されたURL（/hp/<slug>?lang=en）を開くと日本語のページが出ていた。
 * しかもそのURLを sitemap で検索側に送っていた。
 *
 * やり方は「テキストの節だけ差し替える」。タグの中（属性・スクリプト・スタイル）には
 * 触らない。壊すくらいなら、訳さないほうがよい。
 */

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
};

function decode(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, m => ENTITIES[m] ?? m);
}

function encode(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function applyTranslationToHtml(html: string, map: Record<string, string> | null | undefined): string {
  if (!html || !map) return html;
  const entries = Object.keys(map).length;
  if (!entries) return html;

  const parts = html.split(/(<[^>]*>)/);
  let skip = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (part[0] === '<') {
      const open = /^<\s*(script|style|textarea)\b/i.exec(part);
      const close = /^<\s*\/\s*(script|style|textarea)\b/i.exec(part);
      if (open) skip++;
      else if (close && skip > 0) skip--;
      continue;
    }
    if (skip > 0) continue;

    const raw = decode(part);
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const hit = map[trimmed];
    if (!hit) continue;
    const lead = raw.slice(0, raw.indexOf(trimmed));
    const tail = raw.slice(raw.indexOf(trimmed) + trimmed.length);
    parts[i] = lead + encode(hit) + tail;
  }
  return parts.join('');
}

/** 対応している言語。翻訳の作成側（app/api/ai/translate）と同じ並びにする。 */
export const TRANSLATION_LOCALES: Record<string, { name: string; hreflang: string }> = {
  en: { name: 'English', hreflang: 'en' },
  zh: { name: '中文（简体）', hreflang: 'zh-Hans' },
  ko: { name: '한국어', hreflang: 'ko' },
};

export function isTranslationLocale(value: unknown): value is string {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TRANSLATION_LOCALES, value);
}

export type StoredTranslation = { map?: Record<string, string>; translatedAt?: string; textCount?: number };

/** settings_json.translations から、その言語の対応表を取り出す。無ければ null。 */
export function translationFor(
  settings: Record<string, unknown> | null | undefined,
  locale: string,
): StoredTranslation | null {
  if (!settings || !isTranslationLocale(locale)) return null;
  const all = settings.translations as Record<string, StoredTranslation> | undefined;
  const found = all?.[locale];
  if (!found || !found.map || !Object.keys(found.map).length) return null;
  return found;
}
