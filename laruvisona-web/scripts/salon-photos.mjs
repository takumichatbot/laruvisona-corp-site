// 結い庵のスタイル写真4枚・スタッフ写真3枚を、原画から配信用に作る。
//
//   node scripts/salon-photos.mjs --src <原画フォルダ>
//
// 原画（PNG・1枚あたり4〜7MB）はそのまま配信しない。
// この作品のギャラリーとスタッフの節は、公開HTMLでは素の <img src> で出る
// （srcset は持たない）。**既存の配信方式に合わせ**、JPEG 1枚ずつに書き出す。
//
//   スタイル … 4:5 の中央cover。表示は2列・1枚 約440×550px なので、
//               2倍の密度まで耐える 900×1125 にする
//   スタッフ … 直径148pxの円で出る。3倍の密度まで耐える 512×512 にする
//
// 明るさ・色温度:
//   4枚を並べたときに背景の段差が出る場合だけ、**控えめに**そろえる。
//   髪・肌・顔の形は触らない。かけるのは1枚ごとの一定の倍率だけで、
//   上限は ±4%。原画には手を入れない（ここで作るのは配信用のコピー）。
//
// staff-1 の白い四隅:
//   原画に円形の背景と白い四隅が焼き込まれている。円で出すぶんには
//   隠れるが、円のふちが背景と白の境目に重なるため、縮小すると薄い輪に見える。
//   配信用コピーでは、円の外側を**同じ角度の円の内側の色で埋めて**境目を消す。
//   人物には触れていない。
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = { src: '', out: 'public/salon', gain: '' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
if (!args.src) { console.error('--src <原画フォルダ> が要ります'); process.exit(2); }

const STYLE_W = 900, STYLE_H = 1125;   // 4:5
const STAFF_PX = 512;                  // 1:1
const GAIN_CAP = 0.04;                 // 明るさ・色をそろえる上限（±4%）

/** 1枚ごとの倍率。--gain 'style-1:1.01,1.00,0.99;...' の形で渡す */
const gains = {};
for (const part of (args.gain || '').split(';').filter(Boolean)) {
  const [k, v] = part.split(':');
  gains[k.trim()] = v.split(',').map(Number);
}
const clampGain = (g) => Math.min(1 + GAIN_CAP, Math.max(1 - GAIN_CAP, g));

mkdirSync(args.out, { recursive: true });
const made = [];

/* ── スタイル写真 ── */
for (let i = 1; i <= 4; i++) {
  const key = `style-${i}`;
  const src = path.join(args.src, `${key}.png`);
  const meta = await sharp(src).metadata();
  // 4:5 の中央cover
  const want = 4 / 5;
  let left = 0, top = 0, width = meta.width, height = meta.height;
  if (meta.width / meta.height > want) { width = Math.round(meta.height * want); left = Math.round((meta.width - width) / 2); }
  else { height = Math.round(meta.width / want); top = Math.round((meta.height - height) / 2); }

  let pipe = sharp(src).extract({ left, top, width, height }).resize(STYLE_W, STYLE_H, { fit: 'fill' });
  const g = gains[key];
  if (g) {
    const [r, gg, b] = g.map(clampGain);
    // 1枚ごとの一定の倍率だけ。階調の形は変えない
    pipe = pipe.linear([r, gg, b], [0, 0, 0]);
  }
  const file = path.join(args.out, `${key}.jpg`);
  const out = await pipe.jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(file);
  made.push(`${file}  ${out.width}×${out.height}  ${(out.size / 1024).toFixed(0)}KB${g ? `  倍率 ${g.map(clampGain).map(v => v.toFixed(3)).join('/')}` : ''}`);
}

/* ── スタッフ写真 ── */
for (let i = 1; i <= 3; i++) {
  const key = `staff-${i}`;
  const src = path.join(args.src, `${key}.png`);
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;

  if (i === 1) {
    /* 円の外側を、同じ角度の円の内側の色で埋める。
       円のふち（生成りと白の境目）が消えるので、縮小しても薄い輪が出ない。 */
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    const rEdge = Math.min(w, h) / 2 - 12;   // 境目より少し内側
    const rSample = rEdge - 14;
    let filled = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy;
        const r = Math.hypot(dx, dy);
        if (r <= rEdge) continue;
        const sx = Math.round(cx + dx / r * rSample);
        const sy = Math.round(cy + dy / r * rSample);
        const sp = (Math.min(h - 1, Math.max(0, sy)) * w + Math.min(w - 1, Math.max(0, sx))) * ch;
        const p = (y * w + x) * ch;
        data[p] = data[sp]; data[p + 1] = data[sp + 1]; data[p + 2] = data[sp + 2];
        filled++;
      }
    }
    made.push(`  （staff-1：円の外側 ${filled.toLocaleString()}画素を、円の内側の色で埋めた）`);
  }

  const file = path.join(args.out, `${key}.jpg`);
  const out = await sharp(data, { raw: { width: w, height: h, channels: ch } })
    .resize(STAFF_PX, STAFF_PX, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toFile(file);
  made.push(`${file}  ${out.width}×${out.height}  ${(out.size / 1024).toFixed(0)}KB`);
}

made.forEach(m => console.log(m));
