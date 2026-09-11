// 保存済みの公開HTMLを、そのまま静的に配る小さなサーバ。
//
//   node docs/reference-sites/salon/serve-published.mjs --port 3400 [--images public/salon]
//
// 何のためか:
//   顧客ページ（/hp/<slug>）が返すのは、DBに保存された published_html **そのもの**。
//   （publish-check.mjs の「DBのHTMLがそのまま出ている」で確認している）
//   写真を入れる前と後で「ページ自身が何バイト落とすか・いつ描き終わるか」を
//   比べたいときは、アプリを挟まずこのHTMLだけを配ったほうが、
//   条件をそろえやすく、差が読みやすい。
//
// 画像の置き場所を差し替えられるので、「写真を入れる前／後」を同じHTMLで比べられる。
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const args = { port: '3400', html: '', images: 'public/salon', root: 'public' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
if (!args.html) { console.error('--html <公開HTMLのファイル> が要ります'); process.exit(2); }

const HTML = readFileSync(args.html);
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/' || url === '/index.html') {
    const body = gzipSync(HTML);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-encoding': 'gzip', 'cache-control': 'no-store' });
    return res.end(body);
  }
  // /salon/... は --images の場所から。それ以外は --root から
  const rel = url.replace(/^\//, '');
  const file = rel.startsWith('salon/')
    ? path.join(args.images, rel.slice('salon/'.length))
    : path.join(args.root, rel);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); return res.end('not found'); }
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const buf = readFileSync(file);
  res.writeHead(200, { 'content-type': type, 'content-length': buf.length, 'cache-control': 'no-store' });
  res.end(buf);
}).listen(Number(args.port), '127.0.0.1', () => console.log(`published html on ${args.port}（画像: ${args.images}）`));
