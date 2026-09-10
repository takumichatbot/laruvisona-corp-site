// 一括再生成を、範囲を絞って・戻せる形で行えること。
//
//   ADMIN_SECRET=test-admin-secret \
//   node docs/reference-sites/salon/republish-safety-check.mjs --port 3300
//
// 一括再生成はデータベースの published_html を上書きする。生成物は行に残るので、
// コードを戻しただけでは表示は戻らない。だから
//   ・起動しただけでは走らない
//   ・走らせる前に控えが取れる
//   ・控えから元の姿へ書き戻せる
//   ・対象を1件・件数で絞れる／書かずに対象だけ見られる
// を確かめる。
import fs from 'node:fs';
import path from 'node:path';

const args = { port: '3300', 'fixture-port': '54999', slug: 'yuian', 'app-root': '.' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
const BASE = `http://127.0.0.1:${args.port}`;
const FIX = `http://127.0.0.1:${args['fixture-port']}`;
const SECRET = process.env.ADMIN_SECRET || 'test-admin-secret';
const auth = { 'content-type': 'application/json', authorization: `Bearer ${SECRET}` };

const ok = [], ng = [];
const check = (n, p, d = '') => { (p ? ok : ng).push(n); console.log(`${p ? 'OK  ' : 'NG  '}${n}${d ? ` … ${d}` : ''}`); };

const readHtml = async (slug) => ((await (await fetch(`${FIX}/rest/v1/sites?slug=eq.${slug}&select=published_html`)).json())[0] || {}).published_html || '';

/* ── 1. 起動しただけでは走らない ── */
{
  const src = fs.readFileSync(path.join(path.resolve(args['app-root']), 'server.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function triggerRepublishOutdated'), src.indexOf('setTimeout(triggerRepublishOutdated'));
  check('起動時の一括再生成に、明示の切り替えがある', /REPUBLISH_ON_BOOT/.test(fn));
  check('切り替えが無ければ、何もせず戻る', /REPUBLISH_ON_BOOT !== '1'[\s\S]{0,200}return;/.test(fn));
}

/* ── 2. 誰でも叩けるわけではない ── */
{
  const r1 = await fetch(`${BASE}/api/admin/republish-all`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  check('合言葉なしでは再生成できない', r1.status === 403, `HTTP ${r1.status}`);
  const r2 = await fetch(`${BASE}/api/admin/published-html-backup`);
  check('合言葉なしでは控えを取れない', r2.status === 403, `HTTP ${r2.status}`);
  const r3 = await fetch(`${BASE}/api/admin/published-html-backup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"sites":[]}' });
  check('合言葉なしでは書き戻せない', r3.status === 403, `HTTP ${r3.status}`);
}

/* ── 3. 書かずに、対象だけ見られる ── */
let before = '';
{
  before = await readHtml(args.slug);
  const r = await fetch(`${BASE}/api/admin/republish-all`, { method: 'POST', headers: auth, body: JSON.stringify({ dryRun: true }) });
  const d = await r.json();
  check('対象だけ返す（書かない）', r.ok && d.dryRun === true && Array.isArray(d.targets), JSON.stringify(d).slice(0, 80));
  check('対象に作品が入っている', (d.targets || []).some(t => t.slug === args.slug));
  check('見ただけでは中身が変わらない', (await readHtml(args.slug)) === before);
}

/* ── 4. 件数を絞れる ── */
{
  const r = await fetch(`${BASE}/api/admin/republish-all`, { method: 'POST', headers: auth, body: JSON.stringify({ dryRun: true, limit: 1 }) });
  const d = await r.json();
  check('件数を絞れる', d.total === 1, `${d.total}件`);
}

/* ── 5. 控えを取って、作り直して、書き戻せる ── */
{
  const backup = await (await fetch(`${BASE}/api/admin/published-html-backup?slug=${args.slug}`, { headers: auth })).json();
  check('控えが取れる', backup.count === 1 && typeof backup.sites[0].published_html === 'string', `${backup.count}件`);
  check('控えの中身が、いまの公開HTMLと同じ', backup.sites[0].published_html === before);

  // 中身を変えてから作り直す（作り直しが本当に書いていることを確かめるため）
  await fetch(`${FIX}/rest/v1/sites?slug=eq.${args.slug}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ published_html: '<html>ここは古い姿</html>' }),
  });
  const r = await fetch(`${BASE}/api/admin/republish-all`, { method: 'POST', headers: auth, body: JSON.stringify({ onlyOutdated: false, slug: args.slug }) });
  const d = await r.json();
  check('1件だけ作り直せる', r.ok && d.total === 1 && d.updated === 1, JSON.stringify({ total: d.total, updated: d.updated }));
  const made = await readHtml(args.slug);
  check('作り直すと中身が変わる', made !== '<html>ここは古い姿</html>' && made.length > 1000, `${made.length}文字`);

  const back = await fetch(`${BASE}/api/admin/published-html-backup`, {
    method: 'POST', headers: auth, body: JSON.stringify({ sites: backup.sites }),
  });
  const bd = await back.json();
  check('控えから書き戻せる', back.ok && bd.restored === 1, JSON.stringify(bd).slice(0, 80));
  check('書き戻すと、控えと同じ姿に戻る', (await readHtml(args.slug)) === before);
}

/* ── 6. 形の違う控えは受け取らない ── */
{
  const r = await fetch(`${BASE}/api/admin/published-html-backup`, { method: 'POST', headers: auth, body: JSON.stringify({ sites: [{ id: 1 }] }) });
  check('形が違う控えは断る', r.status === 400, `HTTP ${r.status}`);
}

console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('一括再生成を、絞って・戻せる形で行えることを確認しました');
