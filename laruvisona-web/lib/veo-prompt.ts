// 動画プロンプトと保存先の決定。外部依存を持たせない（単体テストから直接読むため）。
// 生成そのものは lib/veo.ts（Storage と API キーを使う）。

/** 保存先。画像ライブラリと同じバケット内に videos/ で分ける。 */
export function videoStoragePath(industry: string): string {
  return `videos/${industry}.mp4`;
}

// 業種ごとの「動き」。カメラの動きだけを指示し、被写体は種画像に任せる。
// 派手なカット割りやズームはループに向かないので入れない。
const MOTION: Record<string, string> = {
  restaurant: 'very slow push-in, steam rising gently from a dish, warm light flickering softly',
  beauty: 'very slow lateral drift past the mirrors, soft light shifting',
  clinic: 'very slow push-in, sheer curtain moving slightly in the light',
  legal: 'very slow lateral drift across the bookshelves, dust motes in sunlight',
  construction: 'very slow tilt up the facade, clouds drifting behind',
  realestate: 'very slow push-in toward the window, daylight shifting subtly',
  retail: 'very slow lateral drift along the shelves, soft highlights moving',
  fitness: 'very slow push-in, light shifting across the equipment',
  hotel: 'very slow push-in through the lobby, warm lamps glowing',
  education: 'very slow lateral drift across the room, sunlight moving on the desks',
  wedding: 'very slow push-in, petals and fabric moving faintly in a breeze',
  pet: 'very slow push-in, soft light shifting',
  dental: 'very slow lateral drift, clean daylight shifting',
  photo: 'very slow push-in, studio light falling off gently',
  accounting: 'very slow lateral drift across the desk, daylight shifting',
  other: 'very slow push-in, daylight shifting subtly',
};

/** ループ用の動画プロンプト。文字や人の顔のアップは出さない。 */
export function buildShowcaseVideoPrompt(industry: string): string {
  const motion = MOTION[industry] || MOTION.other;
  return [
    'Cinematic ambient background loop for a website showcase.',
    `Camera: ${motion}.`,
    'The scene stays the same throughout. No cuts, no scene change, no zoom burst.',
    'Photorealistic, natural light, shallow depth of field, calm and premium.',
    'No text, no letters, no logos, no watermark, no on-screen graphics.',
  ].join(' ');
}

/** LPのファーストビュー用の1本。業種ライブラリとは別枠で1本だけ持つ。 */
export const HERO_VIDEO_PATH = 'videos/lp-hero.mp4';

/**
 * LPファーストビュー用の候補。3案を作って見比べてから1本を選ぶ。
 *
 * 選定の前提（ここを外すと前回と同じ失敗をする）:
 *   1. 「浮いているだけの抽象」にしない。3Dの浮遊オブジェクトを外したのは
 *      商品の説明を何もしていなかったからで、同じものを動画で作り直しても
 *      意味がない。どの案も「バラバラのものが整列して1枚になる」という
 *      組み上がりの動きを持たせる。
 *   2. Veoは読める文字やUIを描けない。頼むと必ず崩れた偽の文字になるので、
 *      画面・文字・ロゴは一切出さず、素材と光だけで「構築」を表す。
 *   3. 見出しは濃い色で、下地は sky-50 の明るい配色。映像は高キー（明るい）で
 *      暗部を持たないこと。暗いと文字が読みにくくなり、ページからも浮く。
 */
export const HERO_VARIANTS = {
  // 案A: 紙 = ページ。「ホームページ」の直訳的な比喩で、いちばん意味が近い。
  paper: [
    'Cinematic ambient background loop for a website hero section.',
    'Clean sheets of white paper float down and settle into a neat, perfectly aligned grid on a bright white surface.',
    'Soft daylight from a large window, gentle soft-edged shadows, a few sheets still drifting into place.',
    'Camera: locked off, almost still, an extremely slow drift.',
    'High-key, airy, bright. White and pale sky-blue, soft pastel tones.',
    'The sheets are completely blank.',
  ],
  // 案B: 光の線が矩形を描く。設計図が引かれていく感じ。
  blueprint: [
    'Cinematic ambient background loop for a website hero section.',
    'Thin luminous pale-blue lines draw themselves across a bright white surface, extending and meeting to form clean empty rectangular frames that stack into a calm ordered layout.',
    'Soft glow where the lines cross, faint depth of field, everything precise and geometric.',
    'Camera: locked off, almost still, an extremely slow drift.',
    'High-key, airy, bright. White and pale sky-blue.',
    'The frames stay completely empty.',
  ],
  // 案C: すりガラスの板が重なる。レイヤーが積み重なってひとつになる感じ。
  glass: [
    'Cinematic ambient background loop for a website hero section.',
    'Translucent frosted glass panels slide in from different directions and layer themselves into one aligned stack on a bright white surface.',
    'Soft blue light refracting through the frosted edges, gentle caustics, smooth premium material.',
    'Camera: locked off, almost still, an extremely slow drift.',
    'High-key, airy, bright. White and pale sky-blue, soft pastel tones.',
    'The panels are completely blank.',
  ],
} as const;

export type HeroVariant = keyof typeof HERO_VARIANTS;

/** 全案に共通で付ける禁止条件。Veoが崩しやすいものをまとめて弾く。 */
const HERO_COMMON = [
  'No people, no faces, no hands, no bodies.',
  'No cuts, no scene change, no zoom burst, no camera shake.',
  'No text, no letters, no numbers, no logos, no watermark, no user interface, no on-screen graphics.',
  'Nothing dark: no black areas, no heavy shadows, no vignette.',
];

export function isHeroVariant(v: string): v is HeroVariant {
  return Object.prototype.hasOwnProperty.call(HERO_VARIANTS, v);
}

/** 候補の保存先。決定した1本は lp-hero.mp4 にコピーして使う。 */
export function heroVariantPath(v: HeroVariant): string {
  return `videos/lp-hero-${v}.mp4`;
}

export function buildHeroVariantPrompt(v: HeroVariant): string {
  return [...HERO_VARIANTS[v], ...HERO_COMMON].join(' ');
}

/**
 * LPの背景に敷く映像。
 * 主役は見出しとCTAなので、映像は「動きすぎない」「明るい」「無人」を守る。
 *   - 動きすぎると文字が読みにくくなる
 *   - 暗いとページ全体（sky-50 の明るい配色）から浮く
 *   - 人が写ると視線が持っていかれるうえ、生成も安全フィルタで落ちやすい
 */
export function buildHeroVideoPrompt(): string {
  return [
    'Cinematic ambient background loop for a website hero section.',
    'A bright, empty Japanese small shop interior in early morning light, just before opening.',
    'Clean wooden counter, plants, large windows with soft daylight, dust motes drifting in the light.',
    'Camera: extremely slow forward drift, almost still. The scene never changes.',
    'High-key, airy, bright and calm. Soft pastel tones, gentle blue-grey daylight.',
    'No people, no faces, no hands.',
    'No cuts, no scene change, no zoom burst, no camera shake.',
    'No text, no letters, no logos, no watermark, no on-screen graphics.',
  ].join(' ');
}
