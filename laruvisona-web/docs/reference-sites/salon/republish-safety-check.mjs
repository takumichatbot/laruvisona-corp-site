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

/* ── 5. 控えを取って、作り直して、その回の分だけ戻せる ── */
{
  const backup = await (await fetch(`${BASE}/api/admin/published-html-backup?slug=${args.slug}`, { headers: auth })).json();
  check('控えが取れる', backup.count === 1 && typeof backup.sites[0].published_html === 'string', `${backup.count}件`);
  check('控えの中身が、いまの公開HTMLと同じ', backup.sites[0].published_html === before);

  // 中身を変えてから作り直す（作り直しが本当に書いていることを確かめるため）
  const marker = '<html>ここは古い姿 ' + Date.now() + '</html>';
  await fetch(`${FIX}/rest/v1/sites?slug=eq.${args.slug}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ published_html: marker }),
  });
  const r = await fetch(`${BASE}/api/admin/republish-all`, { method: 'POST', headers: auth, body: JSON.stringify({ onlyOutdated: false, slug: args.slug }) });
  const d = await r.json();
  check('1件だけ作り直せる', r.ok && d.total === 1 && d.updated === 1, JSON.stringify({ total: d.total, updated: d.updated }));
  const made = await readHtml(args.slug);
  check('作り直すと中身が変わる', made !== marker && made.length > 1000, `${made.length}文字`);

  // 作り直しの応答（undo つき）を、そのまま送り返すだけで戻る
  const back = await fetch(`${BASE}/api/admin/published-html-backup`, {
    method: 'POST', headers: auth, body: JSON.stringify(d),
  });
  const bd = await back.json();
  check('作り直しの記録を送り返すと戻る', back.ok && bd.restored === 1, JSON.stringify(bd.counts || {}));
  check('戻すと、作り直す前の姿になる', (await readHtml(args.slug)) === marker);
}

/* ── 6. 形の違う控えは受け取らない ── */
{
  const r = await fetch(`${BASE}/api/admin/published-html-backup`, { method: 'POST', headers: auth, body: JSON.stringify({ sites: [{ id: 1 }] }) });
  check('形が違う控えは断る', r.status === 400, `HTTP ${r.status}`);
}

/* ── 7. 戻すのは「作り直した対象」だけ。他のサイトの新しい公開を巻き戻さない ──
   これが今回いちばん大事なところ。
   全件の控えをそのまま流し込むと、作り直していないサイトが、控えを取ったあとに
   公開した内容まで古い姿へ戻ってしまう。 */
{
  const A = args.slug;            // 作り直す対象
  const B = 'kyuu-site';          // 作り直さない。途中で利用者が公開し直す
  const readB = async () => await readHtml(B);
  const originalB = await readB();

  // (1) 全件の控えを取る
  const backup = await (await fetch(`${BASE}/api/admin/published-html-backup`, { headers: auth })).json();
  check('控えに指紋が付いている', backup.sites.every(s => typeof s.sha256 === 'string' && s.sha256.length === 64));
  check('控えに「そのままでは戻らない」と書いてある', typeof backup.note === 'string' && backup.note.includes('戻りません'));

  // (2) Aだけ作り直す。戻すための記録（undo）を受け取る
  //     戻ったことが目で分かるよう、作り直す前の姿に印を入れておく
  const markA = '<html>Aの作り直し前 ' + Date.now() + '</html>';
  await fetch(`${FIX}/rest/v1/sites?slug=eq.${A}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ published_html: markA }),
  });
  const run = await (await fetch(`${BASE}/api/admin/republish-all`, {
    method: 'POST', headers: auth, body: JSON.stringify({ onlyOutdated: false, slug: A }),
  })).json();
  check('作り直すと、戻すための記録が付いてくる',
    !!run.undo && Array.isArray(run.undo.sites) && run.undo.sites.length === 1, JSON.stringify(run.counts || {}));
  check('記録に「この回が書いた中身の指紋」が入っている',
    typeof run.undo.sites[0].expected_sha256 === 'string' && run.undo.sites[0].expected_sha256.length === 64);
  const aAfter = await readHtml(A);

  // (3) そのあいだに、利用者がBを新しく公開する
  const newB = '<html>Bの新しい公開 ' + Date.now() + '</html>';
  await fetch(`${FIX}/rest/v1/sites?slug=eq.${B}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ published_html: newB }),
  });
  check('前提: Bは新しく公開された', (await readB()) === newB);

  // (4) 全件の控えをそのままPOSTしても、戻らない（ここが前回の穴）
  const blanket = await fetch(`${BASE}/api/admin/published-html-backup`, {
    method: 'POST', headers: auth, body: JSON.stringify({ sites: backup.sites }),
  });
  const bd = await blanket.json();
  check('全件の控えをそのまま送っても、1件も書かない', bd.restored === 0, JSON.stringify(bd.counts || {}));
  check('理由が「指紋が無い」と返る', (bd.counts || {}).needs_expected === backup.sites.length, JSON.stringify(bd.counts || {}));
  check('Bの新しい公開が残っている', (await readB()) === newB);

  // (5) 作り直した記録を送ると、Aだけが戻る
  const undoRes = await fetch(`${BASE}/api/admin/published-html-backup`, {
    method: 'POST', headers: auth, body: JSON.stringify(run),
  });
  const ud = await undoRes.json();
  check('記録を送ると、対象だけ戻る', ud.restored === 1 && ud.total === 1, JSON.stringify(ud.counts || {}));
  const aBack = await readHtml(A);
  check('Aは作り直す前の姿に戻っている', aBack === markA && aBack !== aAfter, `${aBack.length}文字`);
  check('Bは触られていない', (await readB()) === newB);

  // (6) 対照: 指紋を確かめない道（force）を通すと、確かにBまで巻き戻る。
  //     この確かめ方が効いていることの裏取りで、標準の手順では使わない。
  const forced = await (await fetch(`${BASE}/api/admin/published-html-backup`, {
    method: 'POST', headers: auth, body: JSON.stringify({ sites: backup.sites, force: true }),
  })).json();
  check('対照: force を付ければ巻き戻る（だから標準では使わない）',
    forced.restored === backup.sites.length && (await readB()) !== newB, JSON.stringify(forced.counts || {}));

  await fetch(`${FIX}/rest/v1/sites?slug=eq.${B}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ published_html: originalB }),
  });
}

/* ── 8. そのあと公開し直された行は、競合として止める ── */
{
  const A = args.slug;
  const run = await (await fetch(`${BASE}/api/admin/republish-all`, {
    method: 'POST', headers: auth, body: JSON.stringify({ onlyOutdated: false, slug: A }),
  })).json();
  // 利用者が、作り直したあとに公開し直す
  const mine = '<html>利用者が公開し直した ' + Date.now() + '</html>';
  await fetch(`${FIX}/rest/v1/sites?slug=eq.${A}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ published_html: mine }),
  });

  const dry = await (await fetch(`${BASE}/api/admin/published-html-backup`, {
    method: 'POST', headers: auth, body: JSON.stringify({ ...run, dryRun: true }),
  })).json();
  check('確かめるだけの実行で、競合だと分かる', (dry.counts || {}).conflict === 1, JSON.stringify(dry.counts || {}));
  check('確かめるだけの実行では書かない', (await readHtml(A)) === mine);

  const res = await (await fetch(`${BASE}/api/admin/published-html-backup`, {
    method: 'POST', headers: auth, body: JSON.stringify(run),
  })).json();
  check('競合する行は戻さない', res.restored === 0 && (res.counts || {}).conflict === 1, JSON.stringify(res.counts || {}));
  check('利用者の公開が残っている', (await readHtml(A)) === mine);
  check('戻せなかったものが、理由つきで返る', Array.isArray(res.notRestored) && res.notRestored.length === 1 && /公開し直/.test(res.notRestored[0].detail || ''));
}

/* ── 9. 無い行を「戻した」と数えない ── */
{
  const res = await (await fetch(`${BASE}/api/admin/published-html-backup`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ sites: [{ id: '00000000-0000-4000-8000-000000000000', published_html: '<html>x</html>', expected_sha256: 'a'.repeat(64) }] }),
  })).json();
  check('存在しないIDを成功と数えない', res.restored === 0, JSON.stringify(res.counts || {}));
  check('存在しないIDは not_found として返る', (res.counts || {}).not_found === 1, JSON.stringify(res.counts || {}));
}

/* ── 10. 作り直す側も、更新0件を成功と数えない ── */
{
  const A = args.slug;
  const site = (await (await fetch(`${FIX}/rest/v1/sites?slug=eq.${A}&select=id`)).json())[0];
  // 読んでから書くまでのあいだに、別の更新を差し込む
  await fetch(`${FIX}/__control`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ beforeUpdate: { id: site.id, settings_json: {} } }),
  });
  const before = await readHtml(A);
  const run = await (await fetch(`${BASE}/api/admin/republish-all`, {
    method: 'POST', headers: auth, body: JSON.stringify({ onlyOutdated: false, slug: A }),
  })).json();
  check('割り込まれた作り直しを、成功と数えない', run.updated === 0 && run.conflicts === 1, JSON.stringify({ updated: run.updated, conflicts: run.conflicts }));
  check('割り込まれたときは書いていない', (await readHtml(A)) === before);
  check('戻すための記録にも入れない', (run.undo.sites || []).length === 0);
  await fetch(`${FIX}/__control`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ beforeUpdate: null }) });
}

/* ── 11. 確かめるだけの実行で、いまの姿が分かる ── */
{
  const dry = await (await fetch(`${BASE}/api/admin/republish-all`, {
    method: 'POST', headers: auth, body: JSON.stringify({ dryRun: true }),
  })).json();
  check('対象ごとに、いまの指紋と版の古さが返る',
    (dry.targets || []).every(t => typeof t.current_sha256 === 'string' && typeof t.outdated === 'boolean'),
    JSON.stringify((dry.targets || [])[0] || {}).slice(0, 90));
}

/* 最後に、作品をいまの版へそろえ直しておく */
await fetch(`${BASE}/api/admin/republish-all`, {
  method: 'POST', headers: auth, body: JSON.stringify({ onlyOutdated: false, slug: args.slug }),
});

console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('一括再生成を、絞って・戻せる形で行えることを確認しました');
