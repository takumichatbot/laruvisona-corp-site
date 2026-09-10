// 保存済みの計測データから合計を数え直す（再測定ではない）。
//
//   node docs/font-measurement/recount.mjs --in ./docs/font-measurement --variants now,b
//
// 2026-09-10 の初回集計は、フォント用CSSを css と appFontCss の両方に足し、
// 合計でも両方を数えていた。1リクエストを2回数えていたので、
// フォント用CSSを読み込むページは約101KB多く出ていた。
//
// このスクリプトは、各リクエストの内訳（css / appFont / customerFont / …）は
// そのままに、合計だけを「1リクエスト1回」で計算し直す。
// ブラウザは開かないので、値は初回の計測そのままである。
import fs from 'node:fs';
import path from 'node:path';

const DEFAULTS = { in: './docs/font-measurement', variants: 'now,b', write: 'yes' };
const args = { ...DEFAULTS };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
}
const IN = path.resolve(args.in);

/**
 * 訂正後の合計。
 *
 * 初回集計の合計は「html + appFont + customerFont + appFontCss +
 * customerFontCss + css + js + img + other」だった。
 * appFontCss は css にも入っているので、多く数えていた分はちょうど appFontCss。
 * 引けば、各リクエストを一度だけ数えた合計になる。
 * （集計だけの訂正なので、各リクエストのバイト数には触らない）
 */
function recount(r) {
  return r.total - (r.appFontCss || 0);
}

const CORRECTION = {
  correctedAt: '2026-09-10',
  correction: 'フォント用CSSを css と appFontCss の両方で合計に足していた二重計上を除いた。'
    + 'これは再計算であり、再測定ではない。各リクエストのバイト数は初回計測のまま。',
};

for (const v of args.variants.split(',')) {
  for (const kind of ['samples', 'summary']) {
    const p = path.join(IN, `${v}.${kind}.json`);
    if (!fs.existsSync(p)) { console.error(`ありません: ${p}`); continue; }
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const rows = Array.isArray(raw) ? raw : raw.rows;
    let changed = 0;
    for (const r of rows) {
      const before = r.total;
      const after = recount(r);
      if (before !== after) {
        r.totalBeforeCorrection = before;
        r.total = after;
        changed++;
      }
    }
    const out = Array.isArray(raw)
      ? { ...CORRECTION, note: 'appFontCss は css の内訳。合計には css として一度だけ含む', rows }
      : { ...raw, ...CORRECTION, rows };
    if (args.write !== 'no') fs.writeFileSync(p, JSON.stringify(out, null, 2));
    console.log(`${v}.${kind}.json: ${changed}/${rows.length} 行を訂正`);
  }
}

// 訂正後の一覧
for (const v of args.variants.split(',')) {
  const p = path.join(IN, `${v}.summary.json`);
  if (!fs.existsSync(p)) continue;
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const r of (Array.isArray(raw) ? raw : raw.rows)) {
    const kb = n => String(Math.round(n / 1024)).padStart(5);
    const was = r.totalBeforeCorrection ? `（訂正前 ${Math.round(r.totalBeforeCorrection / 1024)}KB）` : '';
    console.log(`${v.padEnd(4)} ${r.viewport.padEnd(6)} ${r.label.padEnd(6)} 合計${kb(r.total)}KB ${was}`);
  }
}
