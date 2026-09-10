// 基準作品のHTMLを、本番と同じ経路で書き出す。
//
//   node --import ./tests/_resolve-ts.mjs docs/reference-sites/salon/build.mjs \
//     --app-root . --out ./tmp/salon
//
// 公開用の場所へ画像も置くなら:
//   ... --public ./public/salon
//
// 公開API（app/api/sites/[id]/publish/route.ts）がやっていることと同じ:
//   blocks_json → pages → exportToHTML(pages, seo, settings, name, businessInfo)
// つまり、この site.json を builder に読み込ませて「保存 → 公開」を押した結果と
// 同じHTMLになる。手書きのHTMLは1行も混ぜていない。
import fs from 'node:fs';
import path from 'node:path';

const args = { 'app-root': '.', out: './tmp/salon', site: '', public: '' };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
}
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(args['app-root']);
const OUT = path.resolve(args.out);
const SITE = path.resolve(args.site || path.join(HERE, 'site.json'));

const { exportToHTML } = await import(path.join(ROOT, 'lib/html-export.ts'));

const site = JSON.parse(fs.readFileSync(SITE, 'utf8'));
const raw = site.blocks_json;
const pages = raw?.v === 2 && raw.pages?.length
  ? raw.pages
  : [{ id: 'page-main', name: 'トップページ', path: '/', blocks: raw ?? [], seo: site.seo_json }];

const html = exportToHTML(
  pages,
  site.seo_json,
  site.settings_json,
  site.name,
  { name: site.name, industry: site.industry, siteId: 'reference-salon', slug: site.slug },
);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// 画像を写す（公開時は /salon/ で配信される想定）。
//
// images/ の直下にあるファイルだけが配信用。images/original は原本置き場で、
// 配信には使わない。以前はここを読み飛ばさずに copyFileSync へ渡していたため、
// ディレクトリをコピーしようとして EISDIR で落ちていた（手順どおりに実行すると
// 必ず exit 1 になっていた）。
//
// 形式も全部そろえて写す。jpg だけだと、公開HTMLが優先して選ぶ avif / webp が
// 置かれず、ブラウザは大きい jpg しか落とせない（画像が出ないこともある）。
const DELIVERY = /\.(avif|webp|jpg|jpeg|png|svg)$/i;
const imgSrc = path.join(HERE, 'images');
const copyImages = (dest) => {
  fs.mkdirSync(dest, { recursive: true });
  const kinds = {};
  for (const e of fs.readdirSync(imgSrc, { withFileTypes: true })) {
    if (!e.isFile()) continue;                 // original/ などの入れ物は写さない
    const m = e.name.match(DELIVERY);
    if (!m) continue;
    fs.copyFileSync(path.join(imgSrc, e.name), path.join(dest, e.name));
    const k = m[1].toLowerCase();
    kinds[k] = (kinds[k] || 0) + 1;
  }
  const total = Object.values(kinds).reduce((a, b) => a + b, 0);
  console.log(`画像を写しました: ${total}枚（${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(' / ')}） → ${dest}`);
  return total;
};
if (fs.existsSync(imgSrc)) {
  copyImages(path.join(OUT, 'salon'));
  if (args.public) copyImages(path.resolve(args.public));
}

console.log(`書き出しました: ${path.join(OUT, 'index.html')}  (${(html.length / 1024).toFixed(0)} KB)`);
