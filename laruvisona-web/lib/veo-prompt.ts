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
