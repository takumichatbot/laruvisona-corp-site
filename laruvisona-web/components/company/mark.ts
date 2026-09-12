/**
 * 正式ロゴの粒。public/images/laruvisona_mark.svg の座標・半径・配色そのもの。
 * 画面用にここへ書き写しているが、値を足したり間引いたりしない。
 * （目測でトレースしないこと。増減はロゴ資産の側を直してから。）
 */
export const MARK: ReadonlyArray<readonly [number, number, number]> = [
  [280, 850, 62], [280, 700, 62], [280, 550, 62], [280, 400, 62], [280, 250, 62],
  [430, 850, 62], [580, 850, 62],
  [422.5, 137.5, 40], [542.5, 55, 26], [640, -8, 15],
];

/** ロゴの viewBox。SVGファイルと同じ */
export const MARK_VIEWBOX = '0 -40 1000 1040';

/** ロゴの青。SVGファイルと同じ指定 */
export const BRAND_GRADIENT = {
  x1: 0, y1: 1000, x2: 400, y2: 0,
  from: '#0EA5E9', to: '#BAE6FD',
} as const;
