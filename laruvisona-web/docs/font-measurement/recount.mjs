// 保存済みの計測データから合計を数え直す（再計算であり、再測定ではない）。
//
//   node docs/font-measurement/recount.mjs --in ./docs/font-measurement --variants now,b
//   node docs/font-measurement/recount.mjs --in ./tmp/measure --variants b --write no
//
// 2026-09-10 の初回集計は、フォント用CSSを css と appFontCss の両方で
// 合計に足していた。1リクエストを2回数えていたので、フォント用CSSを
// 読み込むページの合計が約101KB多く出ていた。
//
// このスクリプトは、各リクエストのバイト数（css / appFont / customerFont / …）は
// そのままに、合計だけを「重複しない内訳の足し算」で作り直す。
//
// 【何度実行しても値が変わらないこと】
//   - 合計は既存の total から引き算しない。内訳から毎回まっさら に組み立てる
//     （summarize.mjs の totalOf）。だから2回目以降も同じ値になる。
//   - 訂正前の値（totalBeforeCorrection）は、まだ無いときにだけ書く。上書きしない。
//   - summary は「訂正後の samples」から毎回作り直す。summary 自身は入力にしない。
// 旧データ・訂正済みデータ・新しく測ったデータのどれに対しても、
// 2回目の実行でファイルの中身が1バイトも変わらないことを --check で確かめられる。
import fs from 'node:fs';
import path from 'node:path';
import { totalOf, summarize } from './summarize.mjs';

const DEFAULTS = { in: './docs/font-measurement', variants: 'now,b', write: 'yes', check: 'no' };
const args = { ...DEFAULTS };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
}
const IN = path.resolve(args.in);

const CORRECTION = {
  correctedAt: '2026-09-10',
  correction: 'フォント用CSSを css と appFontCss の両方で合計に足していた二重計上を除いた。'
    + 'これは再計算であり、再測定ではない。各リクエストのバイト数は初回計測のまま。'
    + '合計は内訳から組み立て直すので、何度実行しても同じ値になる。',
  totalFormula: 'html + appFont + customerFont + customerFontCss + css + js + img + other'
    + '（appFontCss は css の内訳なので足さない）',
};

/** <dir>/<v>.samples.json と <dir>/<v>/samples.json のどちらの置き方にも対応する */
function locate(variant) {
  const flat = { samples: path.join(IN, `${variant}.samples.json`), summary: path.join(IN, `${variant}.summary.json`) };
  if (fs.existsSync(flat.samples)) return flat;
  const nested = { samples: path.join(IN, variant, 'samples.json'), summary: path.join(IN, variant, 'summary.json') };
  if (fs.existsSync(nested.samples)) return nested;
  return null;
}

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const rowsOf = j => (Array.isArray(j) ? j : j.rows);
const metaOf = j => (Array.isArray(j) ? {} : Object.fromEntries(Object.entries(j).filter(([k]) => k !== 'rows')));

for (const variant of args.variants.split(',').map(s => s.trim()).filter(Boolean)) {
  const at = locate(variant);
  if (!at) { console.error(`データが見つかりません: ${variant}（${IN}）`); process.exitCode = 1; continue; }

  const raw = readJson(at.samples);
  const samples = rowsOf(raw);
  const meta = metaOf(raw);

  let corrected = 0;
  for (const r of samples) {
    const t = totalOf(r);
    // 訂正前の値は、まだ無いときにだけ残す。2回目以降は触らない。
    if (!('totalBeforeCorrection' in r) && r.total !== t) {
      r.totalBeforeCorrection = r.total;
      corrected++;
    }
    r.total = t;
  }

  const samplesOut = { ...meta, ...CORRECTION, rows: samples };
  // summary は訂正後の samples からのみ作る（前の summary は入力にしない）
  const summaryOut = { ...meta, ...CORRECTION, rows: summarize(samples) };

  const write = (p, obj) => {
    const text = JSON.stringify(obj, null, 2);
    if (args.check === 'yes') {
      const same = fs.existsSync(p) && fs.readFileSync(p, 'utf8') === text;
      console.log(`${same ? 'OK  変化なし' : 'NG  変化あり'}: ${path.relative(IN, p) || p}`);
      if (!same) process.exitCode = 1;
      return;
    }
    if (args.write !== 'no') fs.writeFileSync(p, text);
  };
  write(at.samples, samplesOut);
  write(at.summary, summaryOut);

  if (args.check !== 'yes') {
    console.log(`${variant}: ${corrected}/${samples.length} 行に訂正前の値を記録`);
    for (const r of summaryOut.rows) {
      const kb = n => String(Math.round(n / 1024)).padStart(5);
      const was = r.totalBeforeCorrection ? `（訂正前 ${Math.round(r.totalBeforeCorrection / 1024)}KB）` : '';
      console.log(`  ${r.viewport.padEnd(6)} ${r.label.padEnd(6)} 合計${kb(r.total)}KB ${was}`);
    }
  }
}
