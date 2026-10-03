import type { Block, Page } from '@/types/laruHP';
import { normalizeDesign } from '@/lib/site-design';
import { isPlaceholderText } from '@/lib/placeholder-text';
import { isStarterSamplePhoto } from '@/lib/studio-image';
import { blockName, makePlan, PALETTE_OPS, type DesignChangePlan, type PlanSettingsLike } from '@/lib/design-change';
import { planFromWords } from '@/lib/design-words';
import type { ReadyItem } from '@/lib/publish-readiness';

/**
 * 公開前の見直し（AI Design Director）。
 *
 * まずコードで確かめられることを確かめる（AI を使わない・何度押しても同じ結果・費用0）。
 * 点数や「完成率」は出さない。何が起きているか・なぜ気になるか・どこを直すか、だけを出す。
 * 「公開の準備」と同じ判定（例文・見本写真・題名・届け先など）は、ここで別に判定しない
 * （公開の準備の件数を1行で示し、そちらへ案内する）。
 * 直し方：見た目の設定で直せるものは変更計画（見比べてから採用）、文章などはその欄を開く。
 * 自動ですべて直すことはしない。
 */

export type FindingLevel = 'now' | 'better';
export type FindingAction =
  | { kind: 'plan'; plan: DesignChangePlan }
  | { kind: 'open'; blockId: string; field?: string }
  | { kind: 'ready' };
export interface Finding {
  id: string;
  level: FindingLevel;
  title: string;
  what: string;
  why: string;
  where?: string;
  action?: FindingAction;
  /** AIの見立てから出たもの（コードの判定と分けて表示する） */
  ai?: boolean;
}
export interface DirectorResult { findings: Finding[]; passed: string[] }

/* ── コントラスト（WCAG の相対輝度） ── */
function lum(hex: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
export function contrast(a: string, b: string): number | null {
  const x = lum(a), y = lum(b);
  if (x === null || y === null) return null;
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const visibleTexts = (b: Block): string[] => {
  const out: string[] = [];
  const walk = (v: unknown, k = '') => {
    if (typeof v === 'string') { if (!/Link$|Image|image|icon|Color|^bg|url|video|Position|Fit|Layout|align|columns|animation|padding|composition|mode/i.test(k)) out.push(v); }
    else if (Array.isArray(v)) v.forEach((x) => walk(x, k));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([kk, x]) => walk(x, kk));
  };
  walk(b.data);
  return out;
};
const PHONE = /0\d{1,4}[-‐－ー\s]?\d{1,4}[-‐－ー\s]?\d{3,4}/g;
const digits = (s: string) => s.replace(/\D/g, '');

export function directorChecks<S extends PlanSettingsLike & { businessInfo?: Record<string, unknown> }>(input: {
  pages: Page[];
  settings: S;
  readiness: ReadyItem[];
  businessPhone?: string;
}): DirectorResult {
  const { pages, settings } = input;
  const site = { pages, settings };
  const top = pages[0]?.blocks ?? [];
  const findings: Finding[] = [];
  const passed: string[] = [];

  // 1) 公開の準備（同じ判定はそちらに任せる）
  const mustLeft = input.readiness.filter((i) => !i.ok && i.level === 'must');
  const betterLeft = input.readiness.filter((i) => !i.ok && i.level === 'better');
  if (mustLeft.length || betterLeft.length) {
    findings.push({
      id: 'ready', level: mustLeft.length ? 'now' : 'better', title: '「公開の準備」に残りがあります',
      what: `直さないと困ること ${mustLeft.length} 件・直したほうが良いこと ${betterLeft.length} 件（例文・見本写真・題名など）`,
      why: '来た人に見本の文章や写真が見えると、本物の情報か分からなくなります。',
      action: { kind: 'ready' },
    });
  } else passed.push('公開の準備（例文・見本写真・題名・届け先）');

  // 2) 文字と地の色の差（読みやすさ）
  if (settings.design) {
    const d = normalizeDesign(settings.design);
    const pairs: [string, string, string][] = [['本文の文字と地', d.ink, d.bg], ['ボタンの文字と色', d.onAccent, d.accent], ['薄い面の上の文字', d.ink, d.surface]];
    const low = pairs.map(([label, a, b]) => ({ label, r: contrast(a, b) })).filter((p) => p.r !== null && p.r < 4.5);
    if (low.length) {
      findings.push({
        id: 'contrast', level: 'now', title: '文字が読みにくい色の組み合わせがあります',
        what: low.map((p) => `${p.label}：差が ${p.r!.toFixed(1)}（読みやすさの目安 4.5 未満）`).join(' ／ '),
        why: '色の差が小さいと、スマホの屋外や年配の方には読めません。',
        action: { kind: 'plan', plan: makePlan(site, { source: 'director', title: '読みやすい配色にする', reason: '用意してある配色（文字と地の差を確かめ済み）のうち、白と黒の配色に置き換えます。あとで別の配色にも変えられます。', scope: { kind: 'site' }, ops: PALETTE_OPS('白と黒') }) },
      });
    } else passed.push('文字と地の色の差');
  }
  for (const b of top) {
    const d = b.data as Record<string, unknown>;
    if (b.type === 'hero' && String(d.heroLayout || settings.heroLayout || '') === 'split') {
      const r = contrast(text(d.textColor), text(d.bgColor));
      if (r !== null && r < 4.5) findings.push({ id: `contrast-${b.id}`, level: 'now', title: '最初の画面の文字が読みにくい色です', what: `文字と地の色の差が ${r.toFixed(1)}`, why: '最初に読まれる場所です。', where: blockName(top, b), action: { kind: 'open', blockId: b.id } });
    }
  }

  // 3) 最初の画面の行動ボタン
  const hero = top.find((b) => b.type === 'hero');
  if (hero) {
    const d = hero.data as Record<string, unknown>;
    if (!text(d.ctaText).trim() || !text(d.ctaLink).trim()) {
      findings.push({ id: 'cta', level: 'better', title: '最初の画面に、次に押すボタンがありません', what: 'ボタンの文字か行き先が空です。', why: '最初の画面で「予約」「相談」へ進めると、問い合わせまでの迷いが減ります。', where: blockName(top, hero), action: { kind: 'open', blockId: hero.id, field: 'ctaText' } });
    } else passed.push('最初の画面のボタン');
    const heading = text(d.heading);
    if (heading.replace(/\s/g, '').length > 34) findings.push({ id: 'hero-long', level: 'better', title: '最初の画面の見出しが長めです', what: `${heading.replace(/\s/g, '').length}文字あります。`, why: 'スマホでは4〜5行になり、写真が隠れます。20〜30文字が目安です。', where: blockName(top, hero), action: { kind: 'open', blockId: hero.id, field: 'heading' } });
    // 自分の写真なのに説明が空（見本写真は公開の準備側で扱う）
    if (text(d.bgImage) && !isStarterSamplePhoto(d) && !text(d.bgImageAlt).trim())
      findings.push({ id: 'alt-hero', level: 'better', title: '最初の画面の写真に説明がありません', what: '写真の説明（代わりの文字）が空です。', why: '読み上げを使う方と、写真が出ないときのためです。', where: blockName(top, hero), action: { kind: 'open', blockId: hero.id, field: 'bgImageAlt' } });
  }

  // 4) 長すぎる文章・ボタン、途切れない長い英数字（スマホで横にはみ出す原因）
  const long: Block[] = [], wide: Block[] = [];
  for (const b of top) {
    const d = b.data as Record<string, unknown>;
    if (b.type === 'paragraph' && text(d.text).length > 420) long.push(b);
    if (visibleTexts(b).some((t) => /[A-Za-z0-9._%+\-/:@?=&#]{34,}/.test(t))) wide.push(b);
  }
  if (long.length) findings.push({ id: 'long-text', level: 'better', title: '一度に読む文章が長い節があります', what: long.map((b) => blockName(top, b)).join('、'), why: '400文字を超えると、スマホでは画面数枚分の文字だけになります。段落を分けるか、要点を先に置くと読まれます。', where: blockName(top, long[0]), action: { kind: 'open', blockId: long[0].id, field: 'text' } });
  if (wide.length) findings.push({ id: 'overflow', level: 'now', title: 'スマホで横にはみ出すおそれのある文字があります', what: `途切れのない長い英数字（URL・メールなど）：${wide.map((b) => blockName(top, b)).join('、')}`, why: '折り返せない文字列は、スマホの画面からはみ出して横に揺れます。リンクはボタンや短い表記にします。', where: blockName(top, wide[0]), action: { kind: 'open', blockId: wide[0].id } });
  if (!long.length && !wide.length) passed.push('文章の長さ・横のはみ出し');

  // 5) 中身の無い節
  const empty = top.filter((b) => {
    const d = b.data as Record<string, unknown>;
    if (b.type === 'gallery') return !(Array.isArray(d.images) && (d.images as unknown[]).some((x) => text(x).trim()));
    if (['services', 'faq', 'tabs', 'team', 'testimonials'].includes(b.type)) return !(Array.isArray(d.items) && (d.items as unknown[]).length);
    if (b.type === 'price-table') return !(Array.isArray(d.plans) && (d.plans as unknown[]).length);
    if (b.type === 'paragraph') return !text(d.text).trim();
    return false;
  });
  if (empty.length) findings.push({ id: 'empty', level: 'better', title: '中身の無い節があります', what: empty.map((b) => blockName(top, b)).join('、'), why: '公開ページでは表示されないか、見出しだけが見えて作りかけに見えます。中身を入れるか、節を外します。', where: blockName(top, empty[0]), action: { kind: 'open', blockId: empty[0].id } });
  else passed.push('中身の無い節');

  // 6) 連絡先の食い違い（電話番号）
  const phones = new Set<string>();
  for (const b of pages.flatMap((p) => p.blocks ?? [])) for (const t of visibleTexts(b)) for (const m of t.match(PHONE) ?? []) if (!isPlaceholderText(t)) phones.add(digits(m));
  if (input.businessPhone) phones.add(digits(input.businessPhone));
  if (phones.size > 1) findings.push({ id: 'phone', level: 'now', title: '電話番号が複数あります', what: [...phones].join(' ／ '), why: '番号が食い違うと、どれにかければよいか分かりません（検索向けの事業者情報も含めて確かめています）。' });
  else passed.push('連絡先（電話番号）の食い違い');

  // 7) 動きの強さ（動きを減らす設定の人には動かない作り。ここでは見る人全体の落ち着きを見る）
  const zooms = top.filter((b) => (b.data as Record<string, unknown>).animation === 'zoom').length;
  if (settings.animLevel === 'full' || zooms >= 3) {
    findings.push({ id: 'motion', level: 'better', title: '動きが多めです', what: settings.animLevel === 'full' ? '表示の動きが「しっかり」です。' : `「奥から近づく」動きが ${zooms} か所あります。`, why: '動きが多いと内容より動きに目が行き、酔いやすい方もいます（動きを減らす設定の端末では、もともと止まります）。', action: { kind: 'plan', plan: { ...planFromWords(site, '動きを控えめに', { scope: 'site' }), source: 'director', title: '動きを控えめにする' } } });
  } else passed.push('動きの量');

  // 8) 文字だけの節が続く（区切りの単調さ）
  let run = 0, worst = 0, at = -1;
  top.forEach((b, i) => { if (b.type === 'heading' || b.type === 'paragraph') { run++; if (run > worst) { worst = run; at = i; } } else run = 0; });
  if (worst >= 4) findings.push({ id: 'rhythm', level: 'better', title: '文字だけの節が続いています', what: `見出しと本文が ${worst} 節続きます。`, why: '写真や特徴の節をはさむと、スマホでスクロールしても位置が分かりやすくなります。', where: blockName(top, top[at]), action: { kind: 'open', blockId: top[at].id } });
  else passed.push('節の並びの単調さ');

  // 9) サイト全体の設定を使っていない（ボタンの大きさ・余白が以前の既定のまま）
  if (!settings.design) findings.push({ id: 'legacy', level: 'better', title: 'サイト全体の見た目の設定を使っていません', what: 'ボタンの高さ（指で押しやすい52px）や読み幅の調整が効いていません。', why: '「サイト全体」の雰囲気か、見た目の案を選ぶと、まとめて整います（見え方が変わるので、選ぶかどうかはお任せします）。' });
  else passed.push('ボタンの大きさ・読み幅（サイト全体の設定）');

  return { findings: findings.sort((a, b) => (a.level === b.level ? 0 : a.level === 'now' ? -1 : 1)), passed };
}

/* ── AI の見立て（使えるときだけ）。AI は決まった種類から選ぶだけで、直し方はここで決める ── */
export const REVIEW_CODES = ['hierarchy-weak', 'too-dense', 'too-sparse', 'photo-small', 'heading-weak', 'motion-busy', 'direction-mismatch'] as const;
export type ReviewCode = (typeof REVIEW_CODES)[number];
const REVIEW_TEXT: Record<ReviewCode, { title: string; why: string; words?: string }> = {
  'hierarchy-weak': { title: '見出しと本文の強弱が弱めです', why: 'どこから読めばよいか分かりにくくなります。', words: '見出しを少し強く' },
  'too-dense': { title: '情報が詰まって見えます', why: '余白が少ないと、スマホでは読む前に疲れます。', words: '余白を増やす' },
  'too-sparse': { title: '間延びして見えます', why: '余白が広すぎると、次の節があるか分かりにくくなります。', words: '余白を詰める' },
  'photo-small': { title: '写真の存在感が控えめです', why: '仕事やお店の雰囲気は、写真がいちばん早く伝えます。', words: '写真を大きく' },
  'heading-weak': { title: '見出しが目立ちにくいです', why: '流し読みする人は見出しだけを拾います。', words: '見出しを少し強く' },
  'motion-busy': { title: '動きが気になります', why: '内容より動きに目が行きます。', words: '動きを控えめに' },
  'direction-mismatch': { title: '選んだ見せ方と、今の設定が合っていません', why: '採用した案の印象と、あとから変えた設定がずれています。' },
};
/** AI が選んだ種類を、見立て（直し方つき）にする。知らない種類は捨てる */
export function findingsFromReview<S extends PlanSettingsLike>(site: { pages: Page[]; settings: S }, codes: unknown): Finding[] {
  if (!Array.isArray(codes)) return [];
  return [...new Set(codes)].filter((c): c is ReviewCode => (REVIEW_CODES as readonly string[]).includes(c as string)).slice(0, 4).map((c) => {
    const r = REVIEW_TEXT[c];
    const plan = r.words ? { ...planFromWords(site, r.words, { scope: 'site' }), source: 'director' as const } : undefined;
    return { id: `ai-${c}`, level: 'better' as const, title: r.title, what: 'AIの見立てです（確かめた事実ではありません）。', why: r.why, ai: true, ...(plan && plan.ops.length ? { action: { kind: 'plan' as const, plan } } : {}) };
  });
}

/** AI に渡す、サイトの形だけの要約（本文・連絡先・写真は渡さない） */
export function reviewSummary<S extends PlanSettingsLike>(site: { pages: Page[]; settings: S }) {
  const d = normalizeDesign(site.settings.design);
  return {
    design: site.settings.design ? { headingScale: d.headingScale, headingWeight: d.headingWeight, space: d.space, radius: d.radius, photoRatio: d.photoRatio, titleRule: d.titleRule } : null,
    fontFamily: site.settings.fontFamily ?? '', animLevel: site.settings.animLevel ?? '',
    blocks: (site.pages[0]?.blocks ?? []).slice(0, 30).map((b) => {
      const x = b.data as Record<string, unknown>;
      return { type: b.type, textLength: visibleTexts(b).join('').length, images: b.type === 'gallery' && Array.isArray(x.images) ? (x.images as unknown[]).length : b.type === 'hero' && x.bgImage ? 1 : 0, heroLayout: b.type === 'hero' ? String(x.heroLayout || '') : undefined, animation: x.animation ? String(x.animation) : undefined };
    }),
  };
}
