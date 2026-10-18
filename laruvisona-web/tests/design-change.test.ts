import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStarterSite } from '../lib/studio-start';
import { exportToHTML } from '../lib/html-export';
import { editStudioBlock } from '../lib/studio-image';
import { applyDesignPlan, makePlan, validOp, scopeText, type DesignChangePlan } from '../lib/design-change';
import { planFromWords, readIntents, readInstruction, INTENT_IDS } from '../lib/design-words';
import { planFromReference, referenceStats, statsKey } from '../lib/reference-style';
import { directorChecks, findingsFromReview, reviewSummary, contrast } from '../lib/design-director';
import type { Page } from '../types/laruHP';

const intake = { industry: 'construction', name: '足立ホーム工房', area: '東京都足立区', audience: '足立区で住まいを考えている方',
  description: '暮らしの話を伺うところから、住まいづくりを始めます。', goal: 'contact', phone: '03-1234-5678' } as never;
function site() {
  const s = makeStarterSite(intake, 'calm');
  const second: Page = { id: 'page-2', name: '会社案内', path: '/about', seo: s.pages[0].seo!, blocks: [{ id: 'p2', type: 'paragraph', data: { text: '2ページ目の本文', align: 'center' } }] };
  return { ...s, pages: [...s.pages, second], settings: { ...s.settings, notifyEmail: 'owner@example.com', customCss: '.x{color:red}', gaTrackingId: 'G-TEST' } };
}
type Site = ReturnType<typeof site>;
// 最初の画面の文字の色は、配置に合わせて計算で変わる（下の専用の確認で見る）
const STYLE_KEYS = new Set(['align', 'paddingTop', 'paddingBottom', 'animation', 'heroLayout', 'mobilePhotoFit', 'galleryLayout', 'columns']);
const content = (pages: Page[]) => JSON.stringify(pages.map((p) => ({ id: p.id, path: p.path, seo: p.seo, blocks: p.blocks.map((b) => ({ id: b.id, type: b.type, data: Object.fromEntries(Object.entries(b.data).filter(([k]) => !STYLE_KEYS.has(k) && !(b.type === 'hero' && (k === 'textColor' || k === 'colorRoles'))).sort()) })) })));
const render = (s: Site) => exportToHTML(s.pages, s.pages[0].seo!, s.settings as never, s.name);
const adopt = (s: Site, plan: DesignChangePlan): Site => { const r = applyDesignPlan(s, plan); assert.ok(r, plan.title); return { ...s, pages: r.pages, settings: r.settings }; };

test('許可リストの外（文章・連絡先・CSS・HTML・知らない値）は計画に入らない', () => {
  const s = site();
  const hero = s.pages[0].blocks.find((b) => b.type === 'hero')!;
  const bad = [
    { t: 'block', blockId: hero.id, key: 'heading', value: '書き換え' },
    { t: 'block', blockId: hero.id, key: 'ctaLink', value: 'https://evil.example' },
    { t: 'setting', key: 'customCss', value: 'body{display:none}' },
    { t: 'setting', key: 'notifyEmail', value: 'x@example.com' },
    { t: 'setting', key: 'fontFamily', value: '"><script>' },
    { t: 'design', key: 'accent', value: 'red;background:url(x)' },
    { t: 'design', key: 'unknown', value: 1 },
    { t: 'block', blockId: 'no-such-block', key: 'align', value: 'left' },
    { t: 'block', blockId: hero.id, key: 'align', value: 'left' }, // hero には寄せの欄が無い
    { t: 'block', blockId: hero.id, key: 'animation', value: 'spin' },
  ];
  for (const op of bad) assert.equal(validOp(op, s.pages), false, JSON.stringify(op));
  const plan = makePlan(s, { source: 'words', title: 't', reason: '', scope: { kind: 'site' }, ops: bad });
  assert.equal(plan.ops.length, 0);
});

test('計画を作るだけ・比べるだけでは、元のデータは変わらない', () => {
  const s = site();
  const snap = structuredClone(s);
  for (const id of INTENT_IDS) {
    const plan = planFromWords(s, '', { intents: [id] });
    applyDesignPlan(s, plan);
  }
  assert.deepEqual(s, snap);
});

test('どの意図でも、文章・写真・リンク・電話・フォーム・ページ・連携の設定は変わらない', () => {
  for (const id of INTENT_IDS) {
    const s = site();
    const plan = planFromWords(s, '', { intents: [id] });
    const r = applyDesignPlan(s, plan);
    assert.ok(r, id);
    assert.equal(content(r.pages), content(s.pages), id);
    for (const k of ['notifyEmail', 'customCss', 'gaTrackingId', 'seo', 'businessInfo'] as const) assert.deepEqual((r.settings as Record<string, unknown>)[k], (s.settings as Record<string, unknown>)[k], `${id} ${k}`);
    const html = render({ ...s, pages: r.pages, settings: r.settings });
    assert.ok(html.includes('href="tel:0312345678"'), id);
    assert.ok(!html.includes('<script>alert'), id);
  }
});

test('古い計画は、あとで同じ欄が変わっていたら当てない（上書きしない）', () => {
  const s = site();
  const plan = planFromWords(s, '余白を増やす');
  assert.ok(plan.ops.length);
  const changed = adopt(s, planFromWords(s, '余白を詰める'));
  assert.equal(applyDesignPlan(changed, plan), null);
  // 関係のない欄が変わっただけなら当てられる
  const other = adopt(s, planFromWords(s, '左寄せにそろえて'));
  assert.ok(applyDesignPlan(other, plan));
});

test('「この節」の計画は、選んだ節の見せ方だけを変える（サイト全体の設定・ほかの節は変えない）', () => {
  const s = site();
  const para = s.pages[0].blocks.find((b) => b.type === 'paragraph')!;
  const plan = planFromWords(s, 'この節をもう少し落ち着いた感じに', { selectedId: para.id });
  assert.equal(plan.scope.kind, 'section');
  assert.match(scopeText(plan), /選んだ節/);
  assert.ok(plan.ops.length && plan.ops.every((op) => op.t === 'block' && op.blockId === para.id));
  const r = applyDesignPlan(s, plan)!;
  assert.deepEqual(r.settings, s.settings);
  r.pages[0].blocks.forEach((b, i) => { if (b.id !== para.id) assert.deepEqual(b, s.pages[0].blocks[i]); });
  // 2ページ目の節も選べる
  const p2 = planFromWords(s, 'ここだけ左寄せ', { selectedId: 'p2' });
  assert.equal(p2.scope.kind, 'section');
  const r2 = applyDesignPlan(s, p2)!;
  assert.equal((r2.pages[1].blocks[0].data as Record<string, unknown>).align, 'left');
  assert.deepEqual(r2.pages[0], s.pages[0]);
  // 節を選んでいないのに「この節」と言われたら、勝手にサイト全体にしない
  const none = planFromWords(s, 'この節の余白を増やす');
  assert.equal(none.ops.length, 0);
  assert.match(none.note ?? '', /節を選んで/);
});

test('あいまいな指示は、案を並べず小さな1つの計画にする。読めない指示は例を返す', () => {
  const s = site();
  const p = planFromWords(s, 'もう少し落ち着いた感じにして');
  assert.deepEqual(readIntents('もう少し落ち着いた感じにして'), ['calm']);
  assert.ok(p.ops.length > 0 && p.ops.length <= 8);
  const unknown = planFromWords(s, 'いい感じに');
  assert.equal(unknown.ops.length, 0);
  assert.match(unknown.note ?? '', /落ち着いた印象/);
  // 今の値から一段だけ：2回採用しても極端にならない
  let cur = s;
  for (let i = 0; i < 6; i++) cur = adopt(cur, planFromWords(cur, '余白を増やす'));
  assert.equal(planFromWords(cur, '余白を増やす').ops.length, 0);
});

test('採用は1回で全部、取り消しは元の状態そのもの（1採用＝1取り消し）。保存・読み直しで同じ見た目', () => {
  const s = site();
  const plan = planFromWords(s, '高級感を出して、写真を大きく');
  const after = adopt(s, plan);
  assert.notDeepEqual(after.settings, s.settings);
  // 保存相当（JSON往復）で同じ HTML
  const reloaded = JSON.parse(JSON.stringify(after)) as Site;
  assert.equal(render(reloaded), render(after));
  // 再適用は同じ計画では照合が合わず、二重に当たらない
  assert.equal(applyDesignPlan(after, plan), null);
});

test('サイト全体の設定が無い以前のサイトでも当てられ、「使いはじめる」ことを示す', () => {
  const s = site();
  const legacy = { ...s, settings: { ...s.settings, design: null } } as unknown as Site;
  const plan = planFromWords(legacy, '余白を増やす');
  const r = applyDesignPlan(legacy, plan)!;
  assert.ok(r.changes.some((c) => /使いはじめます/.test(c.detail)));
  assert.ok(r.settings.design);
});

test('参考画像：数値だけを読み、同じ画像は同じ結果。文字・写真は計画に入らない', () => {
  const w = 64, h = 64, px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const x = i % w, y = Math.floor(i / w); const photo = y > 20 && y < 50 && x > 8 && x < 56; const v = photo ? 80 + ((x * 37 + y * 91) % 90) : 246; px.set([v, photo ? v - 20 : v, photo ? v - 40 : v, 255], i * 4); }
  const a = referenceStats(px, w, h), b = referenceStats(px, w, h);
  assert.deepEqual(a, b);
  assert.equal(statsKey(px), statsKey(px.slice()));
  const s = site();
  const plan = planFromReference(s, a, { usePalette: true });
  assert.equal(plan.source, 'reference');
  assert.ok(plan.traits.some((t) => t.label === '書体' && !t.used));
  const r = applyDesignPlan(s, plan)!;
  assert.equal(content(r.pages), content(s.pages));
  assert.ok(!JSON.stringify(r).includes('data:image'));
});

test('公開前の見直し：決まった判定（AIなし）。点数を出さず、直し方は計画か欄を開く', () => {
  const s = site();
  const hero = s.pages[0].blocks.find((b) => b.type === 'hero')!;
  (hero.data as Record<string, unknown>).heading = 'とても長い見出しでスマホでは何行にもなってしまい写真が隠れてしまうのでもう少し短くしたほうが良いと思われる見出し';
  s.pages[0].blocks.push({ id: 'long-url', type: 'paragraph', data: { text: 'https://example.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } });
  s.pages[0].blocks.push({ id: 'tel2', type: 'paragraph', data: { text: 'お電話は 03-9999-0000 まで' } });
  (s.settings as Record<string, unknown>).animLevel = 'full';
  const r = directorChecks({ pages: s.pages, settings: s.settings, readiness: [] });
  const ids = r.findings.map((f) => f.id);
  for (const id of ['hero-long', 'overflow', 'phone', 'motion']) assert.ok(ids.includes(id), id);
  assert.ok(!JSON.stringify(r).match(/点|%|スコア/));
  const motion = r.findings.find((f) => f.id === 'motion')!;
  assert.equal(motion.action?.kind, 'plan');
  if (motion.action?.kind === 'plan') { assert.ok(applyDesignPlan(s, motion.action.plan)); assert.equal(motion.action.plan.source, 'director'); }
  // 今直す が先
  const firstBetter = r.findings.findIndex((f) => f.level === 'better');
  assert.ok(r.findings.slice(firstBetter).every((f) => f.level === 'better'));
  // 同じ入力なら同じ結果
  assert.deepEqual(directorChecks({ pages: s.pages, settings: s.settings, readiness: [] }), r);
});

test('公開前の見直し：色の差が小さいと「今直す」。AIの見立ては決まった種類だけ・本文や連絡先を渡さない', () => {
  const s = site();
  (s.settings as Record<string, unknown>).design = { ...(s.settings.design as object), ink: '#999999', bg: '#aaaaaa' };
  assert.ok((contrast('#999999', '#aaaaaa') ?? 9) < 4.5);
  const r = directorChecks({ pages: s.pages, settings: s.settings, readiness: [] });
  const c = r.findings.find((f) => f.id === 'contrast')!;
  assert.equal(c.level, 'now');
  assert.equal(findingsFromReview(s, ['too-dense', 'rm -rf', 'too-dense', { x: 1 }]).length, 1);
  const summary = JSON.stringify(reviewSummary(s));
  assert.ok(!summary.includes('足立ホーム工房') && !summary.includes('03-1234-5678') && !summary.includes('暮らしの話'));
});

test('最初の画面の配置を変えると、文字の色を配置に合わせる（写真の上は白・左右に分けると文字の色）', () => {
  const s0 = site();
  const hero0 = s0.pages[0].blocks.find((b) => b.type === 'hero')!;
  // 見本写真のままなら、写真の上に文字を重ねる組み方にはしない（見本の文字とぶつかる）
  const sample = planFromWords(s0, '写真を大きく見せる');
  assert.ok(!sample.ops.some((op) => op.t === 'block' && op.blockId === hero0.id));
  assert.match(sample.reason, /見本の写真のまま/);
  // 自分の写真
  const s = { ...s0, pages: s0.pages.map((p, i) => (i ? p : { ...p, blocks: p.blocks.map((b) => (b.id === hero0.id ? editStudioBlock(b, 'bgImage', '/company/concepts/architecture.webp') : b)) })) } as Site;
  const hero = s.pages[0].blocks.find((b) => b.type === 'hero')!;
  (hero.data as Record<string, unknown>).textColor = '#2a2724';
  (hero.data as Record<string, unknown>).heroLayout = 'split';
  const big = adopt(s, planFromWords(s, '写真を大きく見せる'));
  const h1 = big.pages[0].blocks.find((b) => b.id === hero.id)!.data as Record<string, unknown>;
  assert.equal(h1.heroLayout, 'center');
  assert.equal(h1.textColor, '#ffffff', '写真の上（暗い重ねあり）なので白');
  const r = applyDesignPlan(s, planFromWords(s, '写真を大きく見せる'))!;
  assert.ok(r.changes.some((c) => /文字の色/.test(c.label)), '文字の色が変わることも詳細に出す');
  // 左右に分けると、サイト全体の文字の色
  const back = adopt(big, makePlan(big, { source: 'words', title: 't', reason: '', scope: { kind: 'site' }, ops: [{ t: 'block', blockId: hero.id, key: 'heroLayout', value: 'split' }] }));
  const h2 = back.pages[0].blocks.find((b) => b.id === hero.id)!.data as Record<string, unknown>;
  assert.equal(h2.textColor, (back.settings.design as { ink: string }).ink);
  // 見た目の案を採用済み・見本写真のまま → 描画で上下に分かれるので、白にしない
  const dir = { ...s0, settings: { ...s0.settings, styleDirection: 'immersive' } } as Site;
  (dir.pages[0].blocks.find((b) => b.id === hero0.id)!.data as Record<string, unknown>).compositionStyle = 'immersive';
  const sep = adopt(dir, makePlan(dir, { source: 'words', title: 't', reason: '', scope: { kind: 'site' }, ops: [{ t: 'block', blockId: hero0.id, key: 'heroLayout', value: 'center' }] }));
  assert.notEqual((sep.pages[0].blocks.find((b) => b.id === hero0.id)!.data as Record<string, unknown>).textColor, '#ffffff');
});

test('複数の指示のうち、すでにその設定のものは「変えません」と伝える（黙って落とさない）', () => {
  let cur = site();
  for (let i = 0; i < 4; i++) cur = adopt(cur, planFromWords(cur, '余白を増やす'));
  const p = planFromWords(cur, '余白を増やして、見出しを少し強く');
  assert.ok(p.ops.length > 0);
  assert.match(p.reason, /「余白を増やす」は、すでにその方向の設定なので変えません/);
});

test('否定・元に戻す：「しないで」と言われた操作はしない。元に戻すは「取り消す」へ案内し、案を作らない（2026-10-18）', () => {
  const s = site();
  const a = readInstruction('写真は大きくしないで、余白だけ少し広く');
  assert.deepEqual([a.intents, a.negated], [['more-space'], ['bigger-photo']]);
  const pa = planFromWords(s, '写真は大きくしないで、余白だけ少し広く');
  assert.ok(pa.ops.length > 0 && pa.ops.every((o) => !/heroLayout|columns|photo/i.test(JSON.stringify(o))), '写真を大きくする操作が入っている');
  assert.match(pa.reason, /「写真を大きく見せる」は、指示どおり変えません/);
  const pb = planFromWords(s, '余白を広げたけど、やっぱり元に戻す');
  assert.equal(pb.ops.length, 0);
  assert.match(pb.note || '', /「取り消す」/);
  const c = readInstruction('写真を大きくして、文字は小さくしない');
  assert.deepEqual([c.intents, c.negated], [['bigger-photo'], []]);
  // AI が否定された意図を選んでも使わない
  const pd = planFromWords(s, '写真は大きくしないで', { intents: ['bigger-photo'] });
  assert.equal(pd.ops.length, 0);
  assert.match(pd.note || '', /指示どおり変えません/);
  // いまの状態への不満（「大きくない」「読みやすくない」）は否定ではない
  assert.deepEqual(readInstruction('写真が大きくない').intents, ['bigger-photo']);
  assert.deepEqual(readInstruction('文字が読みやすくない').intents, ['larger-text']);
  // 言い回し自体が否定の意図は裏返さない
  assert.deepEqual(readInstruction('動きはいらない').intents, ['less-motion']);
  // 既存の読み取りは変わらない
  assert.deepEqual(readIntents('もう少し落ち着いた感じにして'), ['calm']);
  assert.deepEqual(readIntents('余白を増やす'), ['more-space']);
});

test('否定した操作は、変えるものが無いときの案内にも出す', () => {
  const s = site();
  const plan = planFromWords(s, '写真は大きくしないで、見出しを少し強く', { intents: undefined });
  const keep = /「写真を大きく見せる」は、指示どおり変えません/;
  assert.ok(keep.test(plan.reason) || keep.test(plan.note || ''));
});

test('頼み方・不満は否定にしない（独立レビューの指摘）。はっきり「しないで」と言ったときだけ', () => {
  const pos: Array<[string, string]> = [
    ['写真、もう少し大きくしてくれない？', 'bigger-photo'], ['余白を広げてもらえないでしょうか', 'more-space'],
    ['写真をもっと大きくできない？', 'bigger-photo'], ['写真が目立たない', 'bigger-photo'], ['見出しが目立たない', 'bold-heading'],
    ['なんだか落ち着かない', 'calm'], ['高級感がない', 'luxury'], ['親しみがない', 'friendly'], ['写真を大きくして色はいらない', 'bigger-photo'],
  ];
  for (const [text, id] of pos) {
    const r = readInstruction(text);
    assert.ok(r.intents.includes(id as never) && !r.negated.includes(id as never), `${text} → ${JSON.stringify(r)}`);
  }
  for (const [text, id] of [['写真は大きくしないで', 'bigger-photo'], ['余白は増やさないでください', 'more-space'], ['動きは付けなくていい', 'more-motion'], ['見出しを強くするのはやめて', 'bold-heading'], ['写真を大きくするのは不要', 'bigger-photo']] as const) {
    assert.ok(readInstruction(text).negated.includes(id), text);
  }
  assert.equal(readInstruction('やっぱりいい感じに落ち着いた印象に').revert, false);
  assert.ok(readInstruction('シンプルにしないで').negated.includes('simple'));
  assert.ok(readInstruction('動きを止めないで').negated.includes('less-motion'));
  assert.ok(readInstruction('写真が大きくならないように').negated.includes('bigger-photo') || !readInstruction('写真が大きくならないように').intents.includes('bigger-photo'));
  assert.deepEqual(readInstruction('飾りを減らして').intents, ['simple']);
  assert.equal(readInstruction('やっぱりやめて、元に戻したい').revert, true);
});
