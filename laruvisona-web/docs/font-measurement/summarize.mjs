// 1回ごとの記録（samples）から、表に出す代表値（summary）を作る。
//
// measure.mjs（測り終わった直後）と recount.mjs（保存済みデータの数え直し）の
// 両方がこれを使う。2か所に同じ計算を書くと、片方だけ直したときに食い違うため。

/**
 * 1回分の記録から合計を出す。
 *
 * **重複しない内訳だけを足す。**
 * appFontCss（会社書体の@font-face宣言のCSS）は css の一部なので足さない。
 * 足すと1リクエストを2回数えることになる（2026-09-10の初回集計の誤り）。
 *
 * total を入力に使わないので、何度実行しても同じ値になる。
 */
export function totalOf(r) {
  return (r.html || 0)
    + (r.appFont || 0)
    + (r.customerFont || 0)
    + (r.customerFontCss || 0)
    + (r.css || 0)
    + (r.js || 0)
    + (r.img || 0)
    + (r.other || 0);
}

const median = a => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/**
 * samples を「画面 × 端末」でまとめ、中央値の行にする。
 * 入力の順序が同じなら、出力も必ず同じになる。
 */
export function summarize(samples) {
  const groups = new Map();
  for (const s of samples) {
    const k = `${s.page}|${s.viewport}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }
  const out = [];
  for (const arr of groups.values()) {
    const f = arr[0];
    const row = {
      variant: f.variant, page: f.page, label: f.label, viewport: f.viewport, runs: arr.length,
      total: median(arr.map(totalOf)),
      appFont: median(arr.map(x => x.appFont)), appFontFiles: f.appFontFiles,
      appFontCss: median(arr.map(x => x.appFontCss)),
      customerFont: median(arr.map(x => x.customerFont)), customerFontFiles: f.customerFontFiles,
      customerFontCss: median(arr.map(x => x.customerFontCss)),
      css: median(arr.map(x => x.css)), js: median(arr.map(x => x.js)),
      lcp: median(arr.map(x => x.lcp)), lcpAll: arr.map(x => x.lcp),
      cls: median(arr.map(x => x.cls)), clsAll: arr.map(x => x.cls),
      h1Font: f.h1Font, bodyFont: f.bodyFont, loadedFaces: f.loadedFaces,
    };
    // 訂正前の合計を持つ記録が1つでもあれば、その中央値も残す（経緯を追えるように）。
    // samples から毎回作り直すので、何度実行しても同じ値になる。
    if (arr.some(x => typeof x.totalBeforeCorrection === 'number')) {
      row.totalBeforeCorrection = median(arr.map(x =>
        typeof x.totalBeforeCorrection === 'number' ? x.totalBeforeCorrection : totalOf(x)));
    }
    out.push(row);
  }
  return out;
}
