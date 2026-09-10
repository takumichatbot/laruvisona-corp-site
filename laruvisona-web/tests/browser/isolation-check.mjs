// 実ブラウザで確かめる、2つのこと。
//
//  A. 入力欄に書いた文字が、公開HTMLの中で「動くスクリプト」にならないこと。
//     いちばん条件の甘い置き方（sandbox なしの srcdoc）に入れても動かない。
//  B. 編集画面のプレビューが、親の画面から切り離されていること。
//     中で本当にスクリプトが動いても、親の window には届かない。
//
// 実行: node --import ./tests/_resolve-ts.mjs tests/browser/isolation-check.mjs
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');
import { exportToHTML } from '../../lib/html-export.ts';
import { withPreviewBridge } from '../../lib/preview-frame.ts';

const PROBE = 'parent.__laruProbe=1';
const BREAKOUT = `</script><script>${PROBE}</script>`;

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const cases = [
  ['カウントダウンの日時', [{ id: 'b1', type: 'countdown', data: { heading: 'x', targetDate: BREAKOUT } }], {}, {}],
  ['問い合わせの転送先', [{ id: 'b1', type: 'contact', data: { heading: 'x', redirectUrl: BREAKOUT } }], {}, {}],
  ['選択肢の値', [{ id: 'b1', type: 'contact', data: { heading: 'x', typeOptions: [BREAKOUT] } }], {}, {}],
  ['サイトのパスワード', [{ id: 'b1', type: 'hero', data: { heading: 'x' } }], { sitePassword: BREAKOUT }, {}],
  ['追加CSS', [{ id: 'b1', type: 'hero', data: { heading: 'x' } }], { customCss: `</style><script>${PROBE}</script>` }, {}],
  ['アクセント色', [{ id: 'b1', type: 'hero', data: { heading: 'x' } }], { accentColor: `red;}</style><script>${PROBE}</script>` }, {}],
  ['構造化データの会社名', [{ id: 'b1', type: 'hero', data: { heading: 'x' } }], {}, { name: BREAKOUT, phone: '03-0000-0000' }],
  ['サイトID', [{ id: 'b1', type: 'hero', data: { heading: 'x' } }], {}, { siteId: BREAKOUT }],
  ['外部サービスのID', [{ id: 'b1', type: 'hero', data: { heading: 'x' } }], { gaTrackingId: BREAKOUT, clarityId: BREAKOUT }, {}],
];

const browser = await chromium.launch();
const ctx = await browser.newContext();
// 外に出ない
await ctx.route('**://**', r => (/^https?:\/\/127\.0\.0\.1|^https?:\/\/localhost/.test(r.request().url()) ? r.continue() : r.abort()));
const page = await ctx.newPage();

async function probeAfterMount(frameHtml, sandbox) {
  await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
  await page.evaluate(({ html, sandbox }) => {
    window.__laruProbe = 0;
    const f = document.createElement('iframe');
    if (sandbox !== null) f.setAttribute('sandbox', sandbox);
    f.style.cssText = 'width:800px;height:600px';
    f.srcdoc = html;
    document.body.appendChild(f);
  }, { html: frameHtml, sandbox });
  await page.waitForTimeout(450);
  return page.evaluate(() => window.__laruProbe);
}

// 対照: この確かめ方そのものが効いていること。
// 以前の書き方（JSON.stringify だけで <script> に入れる）を手で作り、
// ちゃんと「動いてしまう」と出ることを見る。出ないなら確認の仕方が壊れている。
{
  const old = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
  var t=new Date(${JSON.stringify(BREAKOUT)}).getTime();
  </` + `script></body></html>`;
  const v = await probeAfterMount(old, null);
  check('対照: 以前の書き方なら動いてしまう', v === 1, `親の印が ${v}（1 になるはず）`);
}

console.log('A. 公開HTMLそのもの（sandbox なしの srcdoc に入れる＝いちばん甘い条件）');
for (const [name, blocks, settings, bi] of cases) {
  const html = exportToHTML([{ id: 'p1', name: 'top', path: '/', blocks }], {}, settings, 'テスト', bi);
  const v = await probeAfterMount(html, null);
  check(name, v === 0, `親の印が ${v} になった`);
}

console.log('B. 編集画面のプレビュー（sandbox="allow-scripts"）');
{
  // 中で「確実に動く」スクリプトを置いても、親には届かないこと
  const hostile = `<!doctype html><html><head><title>t</title></head><body>
<script>try{parent.__laruProbe=1}catch(e){}</script>
<script>try{parent.document.title='のっとり'}catch(e){}</script>
<div data-lhp-block="b1">中身</div>
</body></html>`;
  const v = await probeAfterMount(withPreviewBridge(hostile), 'allow-scripts');
  check('中で動いたスクリプトが親の window に書けない', v === 0, `親の印が ${v} になった`);
  const title = await page.evaluate(() => document.title);
  check('中で動いたスクリプトが親の document を書き換えない', title !== 'のっとり', `題名が ${title}`);
}
{
  // 橋渡しそのものは動くこと（節を選んだ通知が親へ届く）
  const html = exportToHTML(
    [{ id: 'p1', name: 'top', path: '/', blocks: [{ id: 'b1', type: 'hero', data: { heading: 'みだし' } }] }],
    {}, {}, 'テスト', {},
  );
  await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
  await page.evaluate((src) => {
    window.__got = [];
    window.addEventListener('message', e => {
      if (e.data && e.data.source === 'lhp-studio-preview') window.__got.push(e.data.type);
    });
    const f = document.createElement('iframe');
    f.id = 'pv';
    f.setAttribute('sandbox', 'allow-scripts');
    f.style.cssText = 'width:1000px;height:700px';
    f.srcdoc = src;
    document.body.appendChild(f);
  }, withPreviewBridge(html));
  await page.waitForTimeout(500);
  const ready = await page.evaluate(() => window.__got.includes('ready'));
  check('プレビューから「用意ができた」が親へ届く', ready);
  await page.locator('#pv').contentFrame().locator('[data-lhp-block]').first().click({ position: { x: 20, y: 20 } });
  await page.waitForTimeout(250);
  const got = await page.evaluate(() => window.__got.includes('select'));
  check('節を押すと、どの節かが親へ届く', got);
  const origin = await page.evaluate(() => window.__origins || null);
  void origin;
}

await browser.close();
console.log(`\n${pass} / ${pass + fail} 件`);
process.exit(fail ? 1 : 0);
