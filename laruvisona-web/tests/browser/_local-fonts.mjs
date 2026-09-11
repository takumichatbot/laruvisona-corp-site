// 実ブラウザでの確認を「顧客が選んだ書体のまま」行うための差し替え。
//
// 公開HTMLは書体を Google Fonts（fonts.googleapis.com）から読む。
// 検証環境は外へ出られないので、そのままだと端末の既定書体で表示され、
// 字面・行間・折り返しが本番と変わってしまう。
//
// そこで、同じ書体のファイル（@fontsource パッケージ。中身は Google Fonts と
// 同じ配布物）を手元の小さなサーバから配り、fonts.googleapis.com への
// 要求だけを、その @font-face に差し替える。
//   ・差し替えるのは「どこから取るか」だけ。書体そのものは本物
//   ・ページ側のコードは1行も変えない（公開HTMLはそのまま）
//   ・外部への通信は行わない
//
// 使い方:
//   import { installLocalFonts } from './_local-fonts.mjs';
//   const fonts = await installLocalFonts(ctx);   // ctx は Playwright の context
//   ...
//   await fonts.close();
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../node_modules/@fontsource');

/** 公開HTMLが指定する書体名 → @fontsource のパッケージ名 */
const PKG = {
  'Noto Sans JP': 'noto-sans-jp',
  'Zen Kaku Gothic New': 'zen-kaku-gothic-new',
  'Shippori Mincho': 'shippori-mincho',
  'M PLUS Rounded 1c': 'm-plus-rounded-1c',
  'BIZ UDPGothic': 'biz-udpgothic',
  'Kaisei Opti': 'kaisei-opti',
  'Space Grotesk': 'space-grotesk',
};

const TYPES = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.css': 'text/css' };

export function fontsAvailable() {
  return fs.existsSync(ROOT) && Object.values(PKG).some(p => fs.existsSync(path.join(ROOT, p)));
}

export async function installLocalFonts(ctx, { port = 0 } = {}) {
  if (!fontsAvailable()) {
    throw new Error(
      '書体ファイルが見つかりません。次で入れてください:\n' +
      '  npm install --no-save @fontsource/shippori-mincho @fontsource/noto-sans-jp ' +
      '@fontsource/zen-kaku-gothic-new @fontsource/m-plus-rounded-1c ' +
      '@fontsource/biz-udpgothic @fontsource/kaisei-opti @fontsource/space-grotesk',
    );
  }

  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end(); return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  /** そのパッケージにある太さ別CSSを集めて、参照先を手元のサーバへ向け直す */
  const cssFor = (family, weights) => {
    const pkg = PKG[family];
    if (!pkg) return '';
    const dir = path.join(ROOT, pkg);
    if (!fs.existsSync(dir)) return '';
    const want = weights.length ? weights : ['400'];
    let out = `/* 手元の書体ファイルに差し替え: ${family} (${pkg}) */\n`;
    for (const w of want) {
      const f = path.join(dir, `${w}.css`);
      if (!fs.existsSync(f)) continue;
      out += fs.readFileSync(f, 'utf8').replace(/url\(\.\/files\//g, `url(${base}/${pkg}/files/`);
    }
    return out;
  };

  await ctx.route(/https:\/\/fonts\.googleapis\.com\/css2.*/, route => {
    const url = new URL(route.request().url());
    let css = '';
    for (const spec of url.searchParams.getAll('family')) {
      // 例: "Shippori Mincho:wght@400;500;700;800"
      const [rawName, axis = ''] = spec.split(':');
      const family = rawName.replace(/\+/g, ' ');
      const weights = (axis.match(/\d{3}/g) || []).filter((v, i, a) => a.indexOf(v) === i);
      css += cssFor(family, weights);
    }
    route.fulfill({ status: 200, contentType: 'text/css', body: css });
  });
  // 手元のCSSは gstatic を指さない。万一出たら、外へ出さずに落とす
  await ctx.route(/https:\/\/fonts\.gstatic\.com\/.*/, route => route.abort());

  return {
    base,
    close: () => new Promise(r => server.close(r)),
    /** その書体が実際に読み込まれて使われたかを、ページ側で確かめる。
        日本語の書体は文字の範囲ごとに分かれているので、
        ページに出ている文字で読み込ませてから見る。 */
    async assertLoaded(page, family) {
      return page.evaluate(async f => {
        await document.fonts.ready;
        const sample = (document.body.innerText || 'あア亜A1').slice(0, 40) || 'あア亜A1';
        try { await document.fonts.load(`400 16px "${f}"`, sample); } catch { /* 読めなければ下で false になる */ }
        await document.fonts.ready;
        /* 日本語の書体は文字の範囲ごとに分かれている。ページに出ている文字ぶんが
           読み込めていれば「その書体で組まれている」と言える。全範囲がそろう
           ことは無いので、check() を全文で通すことは求めない。 */
        return [...document.fonts].some(ff => ff.family.replace(/["']/g, '') === f && ff.status === 'loaded');
      }, family);
    },
  };
}
