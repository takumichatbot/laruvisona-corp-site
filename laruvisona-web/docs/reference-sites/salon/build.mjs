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

// 画像は public/salon/ に置いてある（アプリの通常の配信物）。
//
// 以前はここ（docs/…/images/）に置き、この道具で public へ写していた。
// そのため「READMEの手順を踏まないと画像が出ない」状態になっていて、
// クリーンな取得から普通にビルドして起動すると /salon/hero-1600.jpg が
// 404 になっていた。いまは置き場所そのものを public/salon/ に移してある。
// 原本（切り出し前のPNG）だけが images/original/ に残っている。
//
// ここでは、書き出し先でも同じ絵が見えるように写し、
// 配信に必要な形式がそろっているかを確かめる。
const DELIVERY = /\.(avif|webp|jpg|jpeg|png|svg)$/i;
const imgSrc = path.join(ROOT, 'public', 'salon');
if (!fs.existsSync(imgSrc)) {
  console.error(`画像が見つかりません: ${imgSrc}`);
  process.exit(1);
}
{
  const dest = path.join(OUT, 'salon');
  fs.mkdirSync(dest, { recursive: true });
  const kinds = {};
  for (const e of fs.readdirSync(imgSrc, { withFileTypes: true })) {
    if (!e.isFile()) continue;
    const m = e.name.match(DELIVERY);
    if (!m) continue;
    fs.copyFileSync(path.join(imgSrc, e.name), path.join(dest, e.name));
    const k = m[1].toLowerCase();
    kinds[k] = (kinds[k] || 0) + 1;
  }
  const total = Object.values(kinds).reduce((a, b) => a + b, 0);
  console.log(`画像: ${total}枚（${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(' / ')}） → ${dest}`);
  // 公開HTMLは avif → webp → jpg の順に選ぶ。どれか欠けると、
  // 端末によっては大きい画像しか落とせない・出ないことがある。
  for (const k of ['avif', 'webp', 'jpg']) {
    if (!kinds[k]) { console.error(`配信用の ${k} がありません`); process.exit(1); }
  }
}

console.log(`書き出しました: ${path.join(OUT, 'index.html')}  (${(html.length / 1024).toFixed(0)} KB)`);
