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
 * 【書き直しの経緯】
 * 最初の版は「カメラは固定でほぼ静止」「情景は変わらない」「暗い部分を作るな」
 * 「影を作るな」「ハイキーで」と、映画的な質感を作る要素を片っ端から禁止していた。
 * コントラスト・光の落ち方・被写界深度・レンズの癖・空気中の粒子・モーションブラー、
 * これらこそが「映画みたい」の正体なのに、見出しの可読性を守ることだけを考えて
 * 全部潰していた。結果、平坦で安っぽい絵しか出なかった。
 *
 * 可読性は映像側ではなくCSS側（不透明度・上に重ねる膜・ぼかし）で解く。
 * 映像には、良い絵を作るのに必要な自由を返す。
 *
 * もうひとつの反省: 被写体が「白い面の上の線」だった。Veoが強いのは
 * 実在する素材と光の相互作用であって、平面的なベクター風の絵はいちばん安く見える。
 * どの案も、厚みと表面を持った実在の素材に光が当たっている状態にする。
 *
 * 変わらない制約は3つだけ:
 *   - 文字・UI・ロゴを出さない（Veoは読める文字を描けない。必ず崩れた偽物になる）
 *   - 人を出さない（視線を持っていかれる。安全フィルタにも落ちやすい）
 *   - カットを割らない（ループにならない）
 */

/** 全案に共通の撮影仕様。ここが「映画みたい」の実体。 */
const CINEMA = [
  'Shot on ARRI Alexa, anamorphic prime lens, shot wide open for a very shallow depth of field.',
  'Natural motion blur at 24fps, creamy bokeh, delicate lens flare, a whisper of film grain.',
  'Volumetric light with fine particles drifting through the beams.',
  'Rich micro-texture on every surface. Physically accurate light, real specular highlights, soft shadow falloff.',
  'Elegant, expensive, restrained. Premium commercial cinematography.',
].join(' ');

/** どの案でも守る禁止事項。ここだけは緩めない。 */
const HERO_COMMON = [
  'No people, no faces, no hands, no bodies.',
  'No text, no letters, no numbers, no logos, no watermark, no user interface, no on-screen graphics.',
  'One continuous take. No cuts, no scene change, no whip pan, no zoom burst.',
  'No audio.',
].join(' ');

export const HERO_VARIANTS = {
  // 案A: 紙 = ページ。マクロで繊維まで見せて、朝の斜光で影を作る。
  paper: [
    'Extreme macro, cinematic.',
    'Thick sheets of heavy cotton paper with visible fibre texture and torn deckled edges drift down through a shaft of low morning sunlight and settle one by one into a precise aligned grid on a pale limestone surface.',
    'The raking light catches the fibres and the paper edges glow; long soft shadows sweep and settle as each sheet lands.',
    'Dust motes turn slowly in the sunbeam.',
    'Camera: a slow, weighted dolly in, drifting just past the nearest sheet as it comes to rest.',
    'Palette: warm white paper, pale limestone, a cool sky-blue bounce in the shadows.',
    'The sheets are blank.',
  ],
  // 案B: 光そのものを被写体にする。ヘイズに通した光でしか出ない絵。
  blueprint: [
    'Cinematic, atmospheric.',
    'Thin blades of pale blue light cut through a haze-filled void, extending and meeting each other to draw luminous rectangular frames that glide into perfect alignment and lock into a calm architectural stack.',
    'Where the beams cross they bloom; the haze carries the light so every beam has body and depth; fine particles drift across them.',
    'Deep space falling away behind, bright core, gentle anamorphic streaks.',
    'Camera: a slow crane move rising as the last frame locks into place.',
    'Palette: pale cyan and white light against soft blue-grey depth.',
    'The frames stay empty.',
  ],
  // 案C: 分厚いガラス。屈折・コースティクス・色収差で、素材の質感を出す。
  glass: [
    'Extreme macro, cinematic.',
    'Slabs of thick frosted glass with polished bevelled edges slide in from the darkness and layer themselves into one perfectly aligned stack on a bright surface.',
    'Light refracts through the bevels into sharp caustics and faint chromatic fringing that ripple across the surface as the slabs settle; the frosted faces glow from within.',
    'Camera: a slow orbit around the stack, the focus racking from the front bevel to the depths of the glass.',
    'Palette: clear glass, cool sky-blue refraction, warm highlight on the bevels.',
    'The glass is blank and unmarked.',
  ],
} as const;

export type HeroVariant = keyof typeof HERO_VARIANTS;

export function isHeroVariant(v: string): v is HeroVariant {
  return Object.prototype.hasOwnProperty.call(HERO_VARIANTS, v);
}

/** 候補の保存先。決定した1本は lp-hero.mp4 にコピーして使う。 */
export function heroVariantPath(v: HeroVariant): string {
  return `videos/lp-hero-${v}.mp4`;
}

export function buildHeroVariantPrompt(v: HeroVariant): string {
  return [...HERO_VARIANTS[v], CINEMA, HERO_COMMON].join(' ');
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
