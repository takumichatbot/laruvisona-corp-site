import type { Page } from '@/types/laruHP';
import { normalizeDesign, type SiteDesign, type SpaceScale } from '@/lib/site-design';
import { isStarterSamplePhoto } from '@/lib/studio-image';
import { blockName, makePlan, PALETTE_OPS, type DesignChangePlan, type DesignOp, type PlanSettingsLike } from '@/lib/design-change';

/**
 * 言葉で直す：普通の日本語の指示を、見た目の変更計画にする。
 *
 * 読み取りはこのファイルの決まった言い回し（INTENTS）で行う。AIの呼び出しは要らない。
 * 決まった言い回しで読めないときだけ、呼ぶ側が AI に「どの意図か」（INTENT_IDS のどれか）を選ばせ、
 * その意図をここで同じ規則で計画にする（AIが値や CSS を作ることはない）。
 * 1つの指示に1つの計画。案をいくつも作らない。値は今の状態から一段ずつ動かす（極端にしない）。
 */

export const INTENT_IDS = [
  'calm', 'luxury', 'simple', 'friendly', 'sharp', 'bold-heading', 'soft-heading',
  'more-space', 'less-space', 'bigger-photo', 'larger-text', 'less-motion', 'more-motion',
  'align-left', 'align-center', 'palette-warm', 'palette-cool', 'palette-mono', 'palette-green',
] as const;
export type IntentId = (typeof INTENT_IDS)[number];
export const INTENT_LABEL: Record<IntentId, string> = {
  calm: '落ち着いた印象に', luxury: '高級感を出す', simple: 'シンプルに', friendly: '親しみやすく', sharp: 'きりっと引き締める',
  'bold-heading': '見出しを強く', 'soft-heading': '見出しを控えめに', 'more-space': '余白を増やす', 'less-space': '余白を詰める',
  'bigger-photo': '写真を大きく見せる', 'larger-text': '文字を読みやすく', 'less-motion': '動きを控えめに', 'more-motion': '少し動きを付ける',
  'align-left': '左寄せにそろえる', 'align-center': '中央寄せにそろえる',
  'palette-warm': '温かみのある配色に', 'palette-cool': '青系のすっきりした配色に', 'palette-mono': '白と黒の配色に', 'palette-green': '緑の落ち着いた配色に',
};

const INTENTS: { id: IntentId; re: RegExp }[] = [
  { id: 'luxury', re: /高級|上品|エレガント|洗練|大人っぽ|ラグジュアリ/ },
  { id: 'calm', re: /落ち着|穏やか|静か(?!に動)|しっとり|ゆったりした(印象|雰囲気)/ },
  { id: 'simple', re: /シンプル|すっきり|ミニマル|飾りを?(減ら|少な|なく)/ },
  { id: 'friendly', re: /親しみ|やわらか|柔らか|かわいい|可愛い|丸く|まるく|ポップ/ },
  { id: 'sharp', re: /シャープ|きりっと|キリッと|引き締|角ばら|角を?(なく|立て)|かっちり|硬め/ },
  { id: 'bold-heading', re: /見出し.{0,6}(強く|太く|大きく|目立)|タイトル.{0,6}(強く|太く|大きく|目立)/ },
  { id: 'soft-heading', re: /見出し.{0,6}(控えめ|小さく|細く|弱く)|タイトル.{0,6}(控えめ|小さく|細く)/ },
  { id: 'more-space', re: /余白.{0,6}(増|広|多|ゆったり|とって)|ゆとり|窮屈|詰まって(い|見)/ },
  { id: 'less-space', re: /余白.{0,6}(減|狭|少な|詰め)|間延び|スカスカ|詰めて/ },
  { id: 'bigger-photo', re: /写真.{0,8}(大きく|目立|大胆|主役|迫力|全面)|画像.{0,6}(大きく|目立)/ },
  { id: 'larger-text', re: /(文字|本文|字).{0,6}(大きく|読みやすく|見やすく)|読みやすく/ },
  { id: 'less-motion', re: /動き.{0,6}(減|少な|控え|なく|止め|いらない)|動かさない|アニメーション.{0,6}(なし|減|止め)/ },
  { id: 'more-motion', re: /動き.{0,6}(付け|つけ|足|加え|増)|アニメーション.{0,6}(付け|つけ|足|加え)/ },
  { id: 'align-left', re: /左寄せ|左に(寄せ|揃え|そろえ)/ },
  { id: 'align-center', re: /中央寄せ|真ん中に(寄せ|揃え|そろえ)|センター/ },
  { id: 'palette-warm', re: /(温かみ|暖か|あたたか|ナチュラル|ベージュ|茶色).{0,6}(色|配色)?/ },
  { id: 'palette-cool', re: /(青|ブルー|爽やか|さわやか|クール).{0,4}(色|配色|に|系)/ },
  { id: 'palette-mono', re: /(白黒|モノトーン|白と黒|モノクロ)/ },
  { id: 'palette-green', re: /(緑|グリーン).{0,4}(色|配色|に|系)/ },
];
const SECTION_WORDS = /この(セクション|節|部分|ブロック|場所|欄)|ここ(だけ|の)|選んだ(節|ところ|場所)/;

/** 決まった言い回しから意図を読む（重なりは文中の順） */
export function readIntents(text: string): IntentId[] {
  const t = text.normalize('NFKC');
  return INTENTS.map((x) => ({ id: x.id, at: t.search(x.re) })).filter((x) => x.at >= 0).sort((a, b) => a.at - b.at).map((x) => x.id);
}
export const wantsSection = (text: string) => SECTION_WORDS.test(text.normalize('NFKC'));

const SPACE_ORDER: SpaceScale[] = ['tight', 'normal', 'roomy', 'airy'];
const step = (s: SpaceScale, d: number) => SPACE_ORDER[Math.max(0, Math.min(SPACE_ORDER.length - 1, SPACE_ORDER.indexOf(s) + d))];
const PAD_ORDER = ['', 'sm', 'lg', 'xl'];
const padStep = (v: unknown, d: number) => PAD_ORDER[Math.max(0, Math.min(PAD_ORDER.length - 1, PAD_ORDER.indexOf(String(v ?? '')) + d))];
const r2 = (n: number) => Math.round(n * 100) / 100;

export const heroHasOwnPhoto = (hero: Page['blocks'][number]) => {
  const d = hero.data as Record<string, unknown>;
  return !!d.bgImage && !isStarterSamplePhoto(d);
};

/** 1つの意図を、サイト全体の操作にする（今の値から一段） */
function siteOps(id: IntentId, d: SiteDesign, pages: Page[], s: PlanSettingsLike): DesignOp[] {
  const top = pages[0]?.blocks ?? [];
  const textBlocks = top.filter((b) => b.type === 'heading' || b.type === 'paragraph');
  const hero = top.find((b) => b.type === 'hero');
  const gallery = top.find((b) => b.type === 'gallery');
  // 最初の画面を写真の上に文字を重ねる組み方にするのは、自分の写真が入っているときだけ
  // （見本写真には「写真を入れる場所」の文字が入っていて、重ねると見出しとぶつかる）
  const ownHeroPhoto = !!hero && heroHasOwnPhoto(hero);
  switch (id) {
    case 'calm':
      return [
        { t: 'design', key: 'space', value: step(d.space, 1) },
        { t: 'design', key: 'headingWeight', value: Math.max(500, d.headingWeight - 100) },
        { t: 'design', key: 'headingTracking', value: r2(Math.min(0.12, d.headingTracking + 0.03)) },
        { t: 'design', key: 'bodyLeading', value: r2(Math.min(2.2, d.bodyLeading + 0.1)) },
        { t: 'setting', key: 'motionProfile', value: 'calm' },
        ...(s.animLevel === 'full' ? [{ t: 'setting', key: 'animLevel', value: 'subtle' } as DesignOp] : []),
      ];
    case 'luxury':
      return [
        { t: 'setting', key: 'fontFamily', value: 'mincho' },
        { t: 'design', key: 'headingWeight', value: 500 },
        { t: 'design', key: 'headingTracking', value: r2(Math.min(0.12, Math.max(d.headingTracking, 0.06))) },
        { t: 'design', key: 'space', value: step(d.space, 1) },
        { t: 'design', key: 'radius', value: Math.min(d.radius, 2) },
        { t: 'design', key: 'buttonShape', value: 'square' },
        { t: 'design', key: 'titleRule', value: 'none' },
        { t: 'setting', key: 'motionProfile', value: 'calm' },
      ];
    case 'simple':
      return [
        { t: 'design', key: 'titleRule', value: 'none' },
        { t: 'design', key: 'radius', value: Math.min(d.radius, 4) },
        { t: 'setting', key: 'designStyle', value: 'minimal' },
        ...(s.animLevel === 'full' ? [{ t: 'setting', key: 'animLevel', value: 'subtle' } as DesignOp] : []),
      ];
    case 'friendly':
      return [
        { t: 'design', key: 'radius', value: Math.max(d.radius, 16) },
        { t: 'design', key: 'buttonShape', value: 'pill' },
        { t: 'setting', key: 'fontFamily', value: 'rounded' },
      ];
    case 'sharp':
      return [
        { t: 'design', key: 'radius', value: 0 },
        { t: 'design', key: 'buttonShape', value: 'square' },
        { t: 'design', key: 'headingWeight', value: Math.min(800, Math.max(d.headingWeight, 700)) },
      ];
    case 'bold-heading':
      return [
        { t: 'design', key: 'headingScale', value: r2(Math.min(1.3, d.headingScale + 0.1)) },
        { t: 'design', key: 'headingWeight', value: Math.min(800, d.headingWeight + 100) },
      ];
    case 'soft-heading':
      return [
        { t: 'design', key: 'headingScale', value: r2(Math.max(0.9, d.headingScale - 0.1)) },
        { t: 'design', key: 'headingWeight', value: Math.max(400, d.headingWeight - 100) },
      ];
    case 'more-space': return [{ t: 'design', key: 'space', value: step(d.space, 1) }];
    case 'less-space': return [{ t: 'design', key: 'space', value: step(d.space, -1) }];
    case 'bigger-photo':
      return [
        ...(hero && ownHeroPhoto ? [{ t: 'block', blockId: hero.id, key: 'heroLayout', value: 'center' } as DesignOp] : []),
        ...(gallery ? [{ t: 'block', blockId: gallery.id, key: 'columns', value: '2' } as DesignOp] : []),
        { t: 'design', key: 'photoRatio', value: '4:3' },
      ];
    case 'larger-text':
      return [
        { t: 'design', key: 'bodyScale', value: r2(Math.min(1.15, d.bodyScale + 0.05)) },
        { t: 'design', key: 'bodyLeading', value: r2(Math.min(2.2, d.bodyLeading + 0.1)) },
      ];
    case 'less-motion': return [{ t: 'setting', key: 'animLevel', value: s.animLevel === 'full' ? 'subtle' : 'none' }, { t: 'setting', key: 'motionProfile', value: 'calm' }];
    case 'more-motion': return [{ t: 'setting', key: 'animLevel', value: 'subtle' }];
    case 'align-left': return textBlocks.map((b) => ({ t: 'block', blockId: b.id, key: 'align', value: 'left' }) as DesignOp);
    case 'align-center': return textBlocks.map((b) => ({ t: 'block', blockId: b.id, key: 'align', value: 'center' }) as DesignOp);
    case 'palette-warm': return PALETTE_OPS('墨と生成り');
    case 'palette-cool': return PALETTE_OPS('夜明けの青');
    case 'palette-mono': return PALETTE_OPS('白と黒');
    case 'palette-green': return PALETTE_OPS('深い森');
  }
}

/** 1つの意図を、選んだ節だけの操作にする（節ごとの見せ方だけ。サイト全体の設定は変えない） */
function sectionOps(id: IntentId, block: Page['blocks'][number]): DesignOp[] {
  const d = block.data as Record<string, unknown>;
  const b = (key: string, value: string) => ({ t: 'block', blockId: block.id, key, value }) as DesignOp;
  switch (id) {
    case 'calm': case 'luxury': case 'simple': return [b('animation', 'fade'), b('paddingTop', padStep(d.paddingTop, 1)), b('paddingBottom', padStep(d.paddingBottom, 1))];
    case 'more-space': return [b('paddingTop', padStep(d.paddingTop, 1)), b('paddingBottom', padStep(d.paddingBottom, 1))];
    case 'less-space': return [b('paddingTop', padStep(d.paddingTop, -1)), b('paddingBottom', padStep(d.paddingBottom, -1))];
    case 'less-motion': return [b('animation', 'none')];
    case 'more-motion': return [b('animation', 'slide-up')];
    case 'align-left': return [b('align', 'left')];
    case 'align-center': return [b('align', 'center')];
    case 'bigger-photo': return block.type === 'hero' ? (heroHasOwnPhoto(block) ? [b('heroLayout', 'center'), b('mobilePhotoFit', 'cover')] : []) : block.type === 'gallery' ? [b('columns', '2')] : [];
    default: return [];
  }
}

/**
 * 指示文から計画を作る。intents を渡すと（AIが選んだ意図など）、言い回しの読み取りの代わりに使う。
 * selected：画面で選んでいる節（「この節」と言われたときに使う）
 */
export function planFromWords<S extends PlanSettingsLike>(
  site: { pages: Page[]; settings: S },
  text: string,
  opts: { selectedId?: string | null; scope?: 'site' | 'section'; intents?: IntentId[] } = {},
): DesignChangePlan {
  const intents = (opts.intents ?? readIntents(text)).filter((x): x is IntentId => (INTENT_IDS as readonly string[]).includes(x));
  const home = site.pages.find((p) => p.blocks?.some((b) => b.id === opts.selectedId));
  const top = home?.blocks ?? site.pages[0]?.blocks ?? [];
  const selected = opts.selectedId ? top.find((b) => b.id === opts.selectedId) : undefined;
  const sectionWanted = opts.scope === 'section' || (opts.scope !== 'site' && wantsSection(text));
  const scope = sectionWanted && selected
    ? { kind: 'section' as const, blockId: selected.id, label: blockName(top, selected) }
    : { kind: 'site' as const };
  const title = intents.length ? intents.slice(0, 3).map((i) => INTENT_LABEL[i]).join('・') : '読み取れませんでした';
  if (!intents.length) {
    return { source: 'words', title, reason: '', scope, ops: [], base: '[]',
      note: '変えたいことを、たとえば「もう少し落ち着いた印象に」「余白を増やす」「写真を大きく」「見出しを少し強く」のように書いてください。文章・料金・連絡先は、ここでは変えません。' };
  }
  if (sectionWanted && !selected) {
    return { source: 'words', title, reason: '', scope, ops: [], base: '[]', note: '「この節」を直すときは、先に完成像か「ページの中身」で節を選んでください。' };
  }
  const d = normalizeDesign(site.settings.design);
  const ops = intents.flatMap((id) => (scope.kind === 'section' ? sectionOps(id, selected!) : siteOps(id, d, site.pages, site.settings)));
  const plan = makePlan(site, {
    source: 'words', title, scope, ops,
    reason: scope.kind === 'section'
      ? 'この節の余白・現れ方・寄せだけを動かします。書体や色はサイト全体の設定なので、ここでは変えません。'
      : '今の設定から一段ずつ動かします。文章・写真・料金・連絡先は変えません。',
  });
  // 複数の意図のうち、すでにその方向の端にあって変えるものが無かったものは、黙って落とさずに伝える
  if (intents.length > 1 && plan.ops.length) {
    const already = intents.filter((id) => {
      const own = scope.kind === 'section' ? sectionOps(id, selected!) : siteOps(id, d, site.pages, site.settings);
      return !makePlan(site, { source: 'words', title, reason: '', scope, ops: own }).ops.length;
    });
    if (already.length) plan.reason = `${plan.reason} 「${already.map((i) => INTENT_LABEL[i]).join('」「')}」は、すでにその方向の設定なので変えません。`;
  }
  const heroBlock = scope.kind === 'section' ? (selected?.type === 'hero' ? selected : undefined) : top.find((b) => b.type === 'hero');
  if (intents.includes('bigger-photo') && heroBlock && !heroHasOwnPhoto(heroBlock)) {
    const hint = '最初の画面は見本の写真のままなので、写真の上に文字を重ねる組み方にはしていません。自分の写真に差し替えると、大きく見せられます。';
    plan.reason = `${plan.reason} ${hint}`;
    if (!plan.ops.length) { plan.note = hint; return plan; }
  }
  if (!plan.ops.length) {
    plan.note = scope.kind === 'section'
      ? 'この節では変えられる見せ方が見つかりませんでした（書体・色・見出しの大きさはサイト全体の設定です）。「サイト全体」で試してください。'
      : 'すでにその方向の設定になっています。変えるものはありません。';
  }
  return plan;
}
