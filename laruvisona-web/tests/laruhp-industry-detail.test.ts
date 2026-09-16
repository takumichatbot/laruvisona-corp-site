import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INDUSTRY_DETAIL } from '../lib/laruhp-industry-detail.ts';
import { LARUHP_INDUSTRIES } from '../lib/laruhp-public.ts';

const ids = Object.keys(INDUSTRY_DETAIL);

test('公開している業種すべてに中身がある', () => {
  for (const id of LARUHP_INDUSTRIES) {
    assert.ok(INDUSTRY_DETAIL[id], `${id} の中身が無い`);
  }
  assert.equal(ids.length, LARUHP_INDUSTRIES.length);
});

test('どの業種も、量がそろっている', () => {
  for (const [id, d] of Object.entries(INDUSTRY_DETAIL)) {
    assert.equal(d.problems.length, 3, `${id}: 困りごと`);
    assert.ok(d.musts.length >= 4, `${id}: 載せる情報`);
    assert.equal(d.rules.length, 3, `${id}: 決まりごと`);
    assert.equal(d.faq.length, 3, `${id}: FAQ`);
    assert.equal(d.firstStep.length, 3, `${id}: はじめの一歩`);
    assert.ok(d.inquiry.length >= 60, `${id}: 問い合わせの説明が短い`);
    for (const m of d.musts) assert.ok(m.why.length >= 10, `${id}: 理由が無い「${m.title}」`);
  }
});

test('業種ごとに、書いてあることが実際に違う', () => {
  // これが本題。以前は15ページが平均76%同じで、業種固有はおよそ150字しか
  // 無かった。同じ文を流用し始めたら、ここで気づけるようにする。
  const text = (id: string) => {
    const d = INDUSTRY_DETAIL[id];
    return [
      ...d.problems.flatMap(p => [p.q, p.a]),
      ...d.musts.flatMap(m => [m.title, m.why]),
      d.inquiry,
      ...d.rules.flatMap(r => [r.law, r.check]),
      ...d.firstStep,
      ...d.faq.flatMap(f => [f.q, f.a]),
    ].join('');
  };
  const grams = (s: string) => {
    const g = new Set<string>();
    for (let i = 0; i < s.length - 4; i++) g.add(s.slice(i, i + 4));
    return g;
  };
  const byId = Object.fromEntries(ids.map(id => [id, grams(text(id))]));

  for (const id of ids) {
    assert.ok(text(id).length >= 900, `${id}: 固有の文章が ${text(id).length} 字しかない`);
  }

  let worst = { pair: '', sim: 0 };
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = byId[ids[i]], b = byId[ids[j]];
      let n = 0;
      for (const x of a) if (b.has(x)) n++;
      const sim = n / Math.min(a.size, b.size);
      if (sim > worst.sim) worst = { pair: `${ids[i]}/${ids[j]}`, sim };
    }
  }
  assert.ok(worst.sim < 0.45, `似すぎている組がある: ${worst.pair} = ${worst.sim.toFixed(3)}`);
});

test('決まりごとは、根拠の名前つきで出す', () => {
  for (const [id, d] of Object.entries(INDUSTRY_DETAIL)) {
    for (const r of d.rules) {
      assert.ok(r.law.length >= 4, `${id}: 根拠の名前が無い`);
      // 「〜か。」か「〜確かめてください。」のどちらか。どちらも読み手への確認である。
      const isCheck = r.check.endsWith('か。') || /(確かめて|確認して)ください。$/.test(r.check);
      assert.ok(isCheck, `${id}: 確認の形になっていない「${r.check}」`);
    }
  }
});

test('法的な助言ではないと画面に書いてある', () => {
  const page = readFileSync(new URL('../app/laruHP/[industry]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /法的な助言ではなく/);
  assert.match(page, /専門家にご確認ください/);
});

test('FAQは構造化データにも出す', () => {
  const page = readFileSync(new URL('../app/laruHP/[industry]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /'@type': 'FAQPage'/);
  assert.match(page, /detail\.faq\.map/);
});

test('検索結果の説明文が、業種ごとに違う', () => {
  const page = readFileSync(new URL('../app/laruHP/[industry]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /detail\.problems\[0\]\.q/);
});
