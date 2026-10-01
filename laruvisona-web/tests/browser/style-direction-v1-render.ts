// 見た目の3案を、公開と同じ exportToHTML で書き出す（ブラウザ確認用）。
//   node --import ./tests/_resolve-ts.mjs tests/browser/style-direction-v1-render.ts <出力先>
// 画像は public 内のものだけ。実写の代わりに自社素材 /company/concepts/architecture.webp を同条件で使う（見本写真としては使わない）。
import fs from 'node:fs';
import { makeStarterSite } from '../../lib/studio-start';
import { planStyleDirection } from '../../lib/style-direction-plan';
import { exportToHTML } from '../../lib/html-export';
import { editStudioBlock } from '../../lib/studio-image';
import type { Block } from '../../types/laruHP';

const out = process.argv[2] || '/tmp/laruhp-style-direction/render';
fs.mkdirSync(out, { recursive: true });
const PH = '/studio/placeholders/construction.webp', PHOTO = '/company/concepts/architecture.webp';
const make = (name = '足立ホーム工房') => {
  const s = makeStarterSite({ industry: 'construction', name, area: '東京都足立区', audience: '足立区で住まいを考えている方',
    description: '暮らしの話を伺うところから、住まいづくりを始めます。', goal: 'contact', phone: '03-1234-5678' } as never, 'refined');
  s.pages[0].blocks = s.pages[0].blocks.map(b => b.type === 'gallery' ? { ...b, data: { ...b.data, images: [PH, PH, PH] } } : b);
  return s;
};
type Site = ReturnType<typeof make>;
const mapHero = (s: Site, f: (b: Block) => Block) => ({ ...s, pages: [{ ...s.pages[0], blocks: s.pages[0].blocks.map(b => b.type === 'hero' ? f(b) : b) }] });
const write = (key: string, s: Site) => fs.writeFileSync(`${out}/${key}.html`, exportToHTML(s.pages, s.pages[0].seo!, s.settings as never, s.name));
const adopt = (s: Site, id: 'editorial' | 'immersive' | 'catalog', usePalette = true) => {
  const p = planStyleDirection(s, id, { usePalette, themeColors: true });
  return { ...s, pages: p.pages, settings: p.settings } as Site;
};
const IDS = { A: 'editorial', B: 'immersive', C: 'catalog' } as const;
for (const [k, id] of Object.entries(IDS)) {
  write(`${k}-sample`, adopt(make(), id));                       // 見本写真（画像未投入）
  write(`${k}-keep`, adopt(make(), id, false));                   // 今の配色のまま
  write(`${k}-photo`, mapHero(adopt(make(), id), b => editStudioBlock(b, 'bgImage', PHOTO)));   // 写真あり（差し替え後）
  write(`${k}-none`, mapHero(adopt(make(), id), b => ({ ...b, data: { ...b.data, bgImage: '' } })));  // 画像なし
  write(`${k}-broken`, mapHero(adopt(make(), id), b => editStudioBlock(b, 'bgImage', '/__missing__/house.webp'))); // 読み込み失敗
  write(`${k}-long`, mapHero(adopt(make('足立ホーム工房 新築・リフォーム・外構・小さな修理まで地域密着で承ります'), id),
    b => ({ ...b, data: { ...b.data, heading: '足立ホーム工房 新築・リフォーム・外構・小さな修理まで、地域密着で承ります' } })));
}
// 数字のカウントアップ：料金表を足した同じ内容で、案を採用した作品（控えめ）と採用していない作品（対照）
const priced = (s: Site): Site => ({ ...s, pages: [{ ...s.pages[0], blocks: [...s.pages[0].blocks, { id: 'price', type: 'price-table', data: { heading: '料金の目安（検証用）', plans: [
  { name: '外壁塗装', price: '13,200', period: '円〜', description: '施工実績120件', features: ['創業1998年'], highlighted: false, buttonText: '相談する', buttonLink: '#contact' },
] } } as Block] }] });
write('count-calm', priced(adopt(make(), 'immersive')));
write('count-control', priced({ ...make(), settings: { ...make().settings, designStyle: 'bold', animLevel: 'full' } } as never));
// 案を採用していない既存の作品（互換確認）
write('legacy', make());
console.log('written', fs.readdirSync(out).length);
