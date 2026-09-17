/**
 * 「まだ直していない、ひな形のままの文字」を見分ける。
 *
 * 置いてある場所が2つあり、別々の判断をしていた。
 *   公開前の確認（lib/publish-readiness.ts）… ここにだけ一覧があった
 *   説明文の自動生成（lib/auto-description.ts）… **何も見ていなかった**
 *
 * 後者が何をしていたか。自分で説明文を書いていないとき、本文をつないで
 * <meta name="description"> を作る。ひな形のままの節があれば、その文字が
 * そのまま入る。実際、本番で公開中のページはこうなっていた。
 *
 *   <meta name="description" content="メニュー・料金プラン 紹介文を入力してください …">
 *   <meta property="og:description" content="… 紹介文を入力してください …">
 *
 * これが出る場所は、検索結果と、**LINEやXに貼ったときのプレビュー**。
 * お客様にURLを送ると、相手の画面に「紹介文を入力してください」と出る。
 * 空っぽより悪い。空なら検索側が本文から拾うが、これは違う文が確定で出る。
 *
 * だから一覧はここに1つだけ置き、両方から使う。
 */

/**
 * ひな形のままの言い回し。
 *
 * 入れてよいのは「人が書いた文章には、まず出てこない」ものだけ。
 * 迷うものを入れると、ちゃんと書いた人の文まで弾いてしまう。
 */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /入力してください/,
  /を入力(?![ぁ-んァ-ヶ一-龯])/,   // 「見出しを入力」「お知らせ1のタイトルを入力」
  /ここに/,
  /【例】/,
  /サンプル/,
  /ドラッグで好きな位置に置けます/, // 編集画面の説明が、公開ページへ出ていた
  /サブテキスト（任意）/,
];

/** この一文が、ひな形のままか */
export function isPlaceholderText(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return PLACEHOLDER_PATTERNS.some(re => re.test(value));
}

/** この中身のどこかに、ひな形のままの文字があるか */
export function hasPlaceholderText(value: unknown): boolean {
  if (typeof value === 'string') return isPlaceholderText(value);
  if (Array.isArray(value)) return value.some(hasPlaceholderText);
  if (value && typeof value === 'object') return Object.values(value).some(hasPlaceholderText);
  return false;
}
