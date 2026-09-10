// 基準作品のHTMLを、本番と同じ経路で書き出す。
//
//   node docs/reference-sites/salon/build.mjs --app-root . --out ./tmp/salon
//
// 公開API（app/api/sites/[id]/publish/route.ts）がやっていることと同じ:
//   blocks_json → pages → exportToHTML(pages, seo, settings, name, businessInfo)
// つまり、この site.json を builder に読み込ませて「保存 → 公開」を押した結果と
// 同じHTMLになる。手書きのHTMLは1行も混ぜていない。
import fs from 'node:fs';
import path from 'node:path';

const args = { 'app-root': '.', out: './tmp/salon', site: '' };
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

// 画像を出力先へ写す（公開時は /salon/ で配信される想定）
const imgSrc = path.join(HERE, 'images');
if (fs.existsSync(imgSrc)) {
  const imgOut = path.join(OUT, 'salon');
  fs.mkdirSync(imgOut, { recursive: true });
  for (const f of fs.readdirSync(imgSrc)) fs.copyFileSync(path.join(imgSrc, f), path.join(imgOut, f));
}

console.log(`書き出しました: ${path.join(OUT, 'index.html')}  (${(html.length / 1024).toFixed(0)} KB)`);
