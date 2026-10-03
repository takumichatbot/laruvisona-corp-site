import type { Page } from '@/types/laruHP';
import { normalizeDesign, type SpaceScale } from '@/lib/site-design';
import { STUDIO_PALETTES } from '@/lib/studio-palettes';
import { heroHasOwnPhoto } from '@/lib/design-words';
import { makePlan, PALETTE_OPS, type DesignChangePlan, type DesignOp, type PlanSettingsLike } from '@/lib/design-change';

/**
 * 参考画像から、雰囲気だけを読み取る。
 *
 * 読み取りは利用者のブラウザの中で、画像の画素の数値（明るさ・色の傾き・余白の割合・線の多さ・
 * 写真らしい部分の割合）だけを計算する。画像はサーバーへ送らず、保存もせず、サイトの素材にもしない。
 * 文字（本文・キャッチコピー）・ロゴ・写真・イラスト・節の順番・装飾・HTML/CSS は読まない＝写せない。
 * AI は使わない（費用0・同じ画像なら同じ結果）。
 *
 * 画像から確かに言えないこと（書体の種類・動き）は「判断しない」と表示し、今の設定のまま残す。
 */

export interface ReferenceStats {
  /** 平均の明るさ 0..1 */
  lightness: number;
  /** 彩度の高い画素の割合 0..1（差し色の強さ） */
  vivid: number;
  /** 地色に近い、平らな画素の割合 0..1（余白の多さ） */
  whitespace: number;
  /** 強い境目（線・枠）の割合 0..1 */
  edges: number;
  /** 写真らしい（色の変化が細かい）区画の割合 0..1 */
  photo: number;
  /** いちばん多い色の色相 0..360（無彩色なら -1） */
  hue: number;
}

/** 画素（RGBA）から数値を出す。画像は縮小してから渡す（長辺 160px 程度） */
export function referenceStats(px: ArrayLike<number>, width: number, height: number): ReferenceStats {
  const n = width * height;
  if (!n || px.length < n * 4) return { lightness: 1, vivid: 0, whitespace: 1, edges: 0, photo: 0, hue: -1 };
  const lum = new Float32Array(n);
  let sumL = 0, vivid = 0;
  const hueBins = new Array(12).fill(0);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lum[i] = l; sumL += l;
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat > 0.35 && max > 0.25) {
      vivid++;
      let h = 0;
      if (max === r) h = ((g - b) / (max - min)) % 6; else if (max === g) h = (b - r) / (max - min) + 2; else h = (r - g) / (max - min) + 4;
      hueBins[Math.floor(((h * 60 + 360) % 360) / 30)]++;
    }
  }
  const mean = sumL / n;
  // 地色：明るさの最頻（16段）
  const bins = new Array(16).fill(0);
  for (let i = 0; i < n; i++) bins[Math.min(15, Math.floor(lum[i] * 16))]++;
  const bgBin = bins.indexOf(Math.max(...bins));
  let flatBg = 0, edges = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = lum[i + 1] - lum[i - 1], gy = lum[i + width] - lum[i - width];
      const g = Math.abs(gx) + Math.abs(gy);
      if (g > 0.25) edges++;
      if (g < 0.02 && Math.abs(Math.floor(lum[i] * 16) - bgBin) <= 1) flatBg++;
    }
  }
  const inner = Math.max(1, (width - 2) * (height - 2));
  // 写真らしさ：8x8 区画ごとの明るさのばらつきが中くらい以上で、平らでない区画
  const bs = 8;
  let photoCells = 0, cells = 0;
  for (let by = 0; by + bs <= height; by += bs) {
    for (let bx = 0; bx + bs <= width; bx += bs) {
      let s = 0, s2 = 0;
      for (let y = by; y < by + bs; y++) for (let x = bx; x < bx + bs; x++) { const v = lum[y * width + x]; s += v; s2 += v * v; }
      const m = s / (bs * bs), varc = s2 / (bs * bs) - m * m;
      cells++;
      if (varc > 0.004 && varc < 0.08) photoCells++;
    }
  }
  const topHue = Math.max(...hueBins);
  return {
    lightness: mean,
    vivid: vivid / n,
    whitespace: flatBg / inner,
    edges: edges / inner,
    photo: cells ? photoCells / cells : 0,
    hue: vivid / n > 0.02 && topHue > 0 ? hueBins.indexOf(topHue) * 30 + 15 : -1,
  };
}

export interface ReferenceTrait { label: string; value: string; used: boolean }

/** 数値を、利用者に見せる言葉にする（読み取ったこと・判断しないこと） */
export function describeReference(s: ReferenceStats): ReferenceTrait[] {
  return [
    { label: '明るさ', value: s.lightness > 0.7 ? '明るい地' : s.lightness < 0.35 ? '暗い地' : '中間の明るさ', used: true },
    { label: '色の強さ', value: s.vivid > 0.18 ? '差し色がはっきり' : s.vivid > 0.05 ? '差し色は控えめ' : 'ほぼ無彩色', used: true },
    { label: '余白', value: s.whitespace > 0.55 ? 'たっぷり' : s.whitespace > 0.3 ? 'ふつう' : '詰まっている', used: true },
    { label: '線・枠', value: s.edges > 0.12 ? '多い（きっちり区切る）' : s.edges > 0.05 ? 'ふつう' : '少ない（面で見せる）', used: true },
    { label: '写真の存在感', value: s.photo > 0.45 ? '大きい（写真が主役）' : s.photo > 0.2 ? 'ふつう' : '小さい（文字・情報が中心）', used: true },
    { label: '書体', value: '画像からは判断しません（今の書体のまま）', used: false },
    { label: '動き', value: '画像からは判断しません（今の動きのまま）', used: false },
  ];
}

/** 色相に近い配色（すでにある5つから選ぶ。新しい色は作らない） */
function paletteFor(s: ReferenceStats): string {
  if (s.vivid < 0.05) return '白と黒';
  const h = s.hue;
  if (h >= 180 && h < 270) return '夜明けの青';
  if (h >= 75 && h < 180) return '深い森';
  if (h < 20 || h >= 330) return 'やわらかな朱';
  return '墨と生成り';
}

export function planFromReference<S extends PlanSettingsLike>(
  site: { pages: Page[]; settings: S },
  s: ReferenceStats,
  opts: { usePalette: boolean } = { usePalette: false },
): DesignChangePlan & { traits: ReferenceTrait[]; palette: string } {
  const d = normalizeDesign(site.settings.design);
  const top = site.pages[0]?.blocks ?? [];
  const hero = top.find((b) => b.type === 'hero');
  const gallery = top.find((b) => b.type === 'gallery');
  const space: SpaceScale = s.whitespace > 0.55 ? 'airy' : s.whitespace > 0.4 ? 'roomy' : s.whitespace > 0.2 ? 'normal' : 'tight';
  const ops: DesignOp[] = [
    { t: 'design', key: 'space', value: space },
    { t: 'design', key: 'radius', value: s.edges > 0.12 ? 0 : s.edges > 0.05 ? Math.min(d.radius, 8) : Math.max(d.radius, 12) },
    { t: 'design', key: 'titleRule', value: s.edges > 0.12 ? 'underline' : s.edges < 0.05 ? 'none' : d.titleRule },
    { t: 'design', key: 'buttonShape', value: s.edges > 0.12 ? 'square' : d.buttonShape },
    { t: 'design', key: 'headingWeight', value: s.vivid > 0.18 || s.edges > 0.12 ? Math.max(d.headingWeight, 700) : Math.min(d.headingWeight, 600) },
  ];
  if (s.photo > 0.45) {
    if (hero && heroHasOwnPhoto(hero)) ops.push({ t: 'block', blockId: hero.id, key: 'heroLayout', value: 'center' });
    if (gallery) ops.push({ t: 'block', blockId: gallery.id, key: 'columns', value: '2' });
    ops.push({ t: 'design', key: 'photoRatio', value: '4:3' });
  } else if (s.photo < 0.2 && hero) {
    ops.push({ t: 'block', blockId: hero.id, key: 'heroLayout', value: 'split' });
  }
  const palette = paletteFor(s);
  if (opts.usePalette) ops.push(...PALETTE_OPS(palette));
  const traits = describeReference(s);
  if (s.lightness < 0.35) traits.push({ label: '暗い配色', value: '暗い地の配色は今の配色候補に無いため、明るい地のまま雰囲気だけを寄せます', used: false });
  const plan = makePlan(site, {
    source: 'reference',
    title: '参考画像の雰囲気に寄せる',
    reason: '画像の明るさ・余白・線の多さ・写真の存在感だけを読み取り、今の文章と写真のまま設定に置き換えます。画像そのもの・文字・ロゴ・写真は使いません。',
    scope: { kind: 'site' },
    ops,
  });
  if (!plan.ops.length) plan.note = '今の設定が、すでに参考画像の雰囲気に近いため、変えるものはありません。';
  return { ...plan, traits, palette };
}

/** 同じ画像の再読み込みで計算し直さないための、内容の要約（ハッシュ） */
export function statsKey(px: ArrayLike<number>): string {
  let h = 2166136261;
  for (let i = 0; i < px.length; i += 7) { h ^= px[i]; h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36) + ':' + px.length;
}

export const REFERENCE_PALETTES = STUDIO_PALETTES.map((p) => p.name);
