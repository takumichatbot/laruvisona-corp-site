// 会社トップの主役ビジュアルを、原画から配信用に作る。
//
//   node scripts/brand-hero.mjs --src <原画.png>
//
// 原画（4800×3584 PNG・約23MB）はそのまま配信しない。ここで
//   ・パソコン用とスマホ用に、別々に切り抜き（単純な全面coverにしない）
//   ・縁をページの地色へなじませ（枠の境目が線として出ないように）
//   ・avif / webp / jpg の3形式を、表示寸法に合う幅だけ
// を作る。
//
// 縁のなじませ方:
//   原画の地は濃紺だが、左下の床が明るく、ページの地色(#070e18)とは差がある。
//   そのまま四角く置くと、その差が「枠の線」として見える。
//   ここでは明るさから被写体の面を作り、**被写体は触らずに、地だけ**を
//   外側へ向けてページの地色へ寄せる。被写体の輪郭は暗くならない。
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = { src: '', out: 'public/brand' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
if (!args.src) { console.error('--src <原画.png> が要ります'); process.exit(2); }

/** ページの地色（app/page.tsx の main と同じ）。ここが変わったら作り直す */
const PAGE = [0x07, 0x0e, 0x18];

/* 切り抜き。原画 4800×3584 の座標。
   被写体の外接は x 512..4284 / y 484..3008（明るさで測った実測値）。
   パソコンは 16:10、スマホは 4:3。どちらも被写体の中心に合わせ、
   被写体が枠の幅の 84%／88% を占めるところまで寄る。 */
const VARIANTS = [
  { key: 'pc', left: 153, top: 343, width: 4490, height: 2806, widths: [640, 960, 1280] },
  { key: 'sp', left: 255, top: 139, width: 4286, height: 3214, widths: [420, 780, 1170] },
];

const EDGE = 0.24;      // 縁をなじませる幅（短辺に対する割合）。被写体は下の面で守るので広く取れる
const SUBJECT_LO = 150; // この明るさ以下は地とみなす
const SUBJECT_HI = 210; // この明るさ以上は被写体とみなす

const blur = (a, w, h, r) => {
  // 横→縦の移動平均。被写体の面の境目をなめらかにするだけなので、これで足りる
  const tmp = new Float32Array(a.length), out = new Float32Array(a.length);
  for (let y = 0; y < h; y++) {
    let sum = 0; const row = y * w;
    for (let x = -r; x <= r; x++) sum += a[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / (2 * r + 1);
      sum -= a[row + Math.min(w - 1, Math.max(0, x - r))];
      sum += a[row + Math.min(w - 1, Math.max(0, x + r + 1))];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / (2 * r + 1);
      sum -= tmp[Math.min(h - 1, Math.max(0, y - r)) * w + x];
      sum += tmp[Math.min(h - 1, Math.max(0, y + r + 1)) * w + x];
    }
  }
  return out;
};

const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

mkdirSync(args.out, { recursive: true });
const made = [];

for (const v of VARIANTS) {
  // 大きい方の出力の2倍で下ごしらえしてから、各幅へ縮める
  const workW = Math.max(...v.widths) * 2;
  const workH = Math.round(workW * v.height / v.width);
  const { data, info } = await sharp(args.src)
    .extract({ left: v.left, top: v.top, width: v.width, height: v.height })
    .resize(workW, workH, { fit: 'fill' })
    .removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });

  const w = info.width, h = info.height, ch = info.channels;
  // 被写体の面（明るさから作り、ぼかして境目をなめらかにする）
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += ch) {
    lum[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
  }
  const rough = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) rough[i] = smooth((lum[i] - SUBJECT_LO) / (SUBJECT_HI - SUBJECT_LO));
  const subject = blur(rough, w, h, Math.round(Math.min(w, h) * 0.012));

  const ew = Math.round(Math.min(w, h) * EDGE);
  for (let y = 0; y < h; y++) {
    const ry = Math.min(smooth(y / ew), smooth((h - 1 - y) / ew));
    for (let x = 0; x < w; x++) {
      const rx = Math.min(smooth(x / ew), smooth((w - 1 - x) / ew));
      // 被写体はそのまま。地だけを、外側ほどページの地色へ寄せる
      const a = Math.min(1, Math.max(rx * ry, Math.min(1, subject[y * w + x] * 1.15)));
      if (a >= 0.999) continue;
      const p = (y * w + x) * ch;
      for (let c = 0; c < 3; c++) data[p + c] = Math.round(PAGE[c] + (data[p + c] - PAGE[c]) * a);
    }
  }

  const base = sharp(data, { raw: { width: w, height: h, channels: ch } });
  for (const width of v.widths) {
    const height = Math.round(width * v.height / v.width);
    for (const fmt of ['avif', 'webp', 'jpg']) {
      const file = path.join(args.out, `hero-${v.key}-${width}.${fmt}`);
      let pipe = base.clone().resize(width, height, { fit: 'fill' });
      if (fmt === 'avif') pipe = pipe.avif({ quality: 52 });
      else if (fmt === 'webp') pipe = pipe.webp({ quality: 78 });
      else pipe = pipe.jpeg({ quality: 82, mozjpeg: true });
      const out = await pipe.toFile(file);
      made.push(`${file}  ${width}×${height}  ${(out.size / 1024).toFixed(0)}KB`);
    }
  }
}
made.forEach(m => console.log(m));
