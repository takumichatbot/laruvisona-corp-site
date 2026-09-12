/**
 * 会社トップで選んだ「見せ方」を、制作画面まで持っていくための小さな受け渡し。
 *
 * 決めごと:
 *  ・持っていくのは見せ方の名前（DESIGN_PRESETS の id）だけ。
 *    お客さまの情報・サイトの中身・アカウントの情報は入れない。
 *  ・ログインを挟んでも消えないように端末へ置くが、24時間で切れる。
 *  ・使うのは「新しく作りはじめるとき」だけ。既にあるサイトを開いたときは読まない。
 *    （別のサイト・別のアカウントの設定が混ざらないようにするため）
 *  ・一度使ったら消す。持ち越さない。
 */
const KEY = 'laruhp.design-choice';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** 受け渡してよい値かどうかは、呼ぶ側が DESIGN_PRESETS で確かめる */
export function saveDesignChoice(presetId: string): void {
  if (!presetId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ presetId, at: Date.now() }));
  } catch { /* 端末が保存を許していないときは、何も持っていかない */ }
}

export function readDesignChoice(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return '';
    const v = JSON.parse(raw) as { presetId?: unknown; at?: unknown };
    if (typeof v.presetId !== 'string' || typeof v.at !== 'number') return '';
    if (Date.now() - v.at > MAX_AGE_MS) { clearDesignChoice(); return ''; }
    return v.presetId;
  } catch { return ''; }
}

export function clearDesignChoice(): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(KEY); } catch { /* noop */ }
}
