import test from 'node:test';
import assert from 'node:assert/strict';
import { LARUHP_INDUSTRIES } from '../lib/laruhp-public.ts';
import { INDUSTRY_CHOICES } from '../lib/studio-schema.ts';
import { STARTER_EXAMPLES, exampleFor } from '../lib/studio-start.ts';
import { getTemplateForIndustry } from '../lib/templates.ts';
import { INDUSTRY_DETAIL } from '../lib/laruhp-industry-detail.ts';

const choices = INDUSTRY_CHOICES.map(c => c.value);

test('公開している業種は、すべて制作画面でも選べる', () => {
  // ここが食い違うと、その業種ページの「この業種で試す」が
  // 黙って既定値（美容室）になる。hotel・wedding・accounting が実際にそうだった。
  const missing = LARUHP_INDUSTRIES.filter(id => !choices.includes(id));
  assert.deepEqual(missing, [], `制作画面に無い業種: ${missing.join(', ')}`);
});

test('制作画面で選べる業種には、必ずたたき台がある', () => {
  for (const id of choices) {
    assert.ok(getTemplateForIndustry(id), `${id}: テンプレートが無い`);
  }
});

test('公開している業種には、見本の文章がある', () => {
  // 無いと「あなたの屋号／活動している地域」の汎用文が出る。
  // 業種ページから入ってきた人に、それを見せない。
  for (const id of LARUHP_INDUSTRIES) {
    assert.ok(STARTER_EXAMPLES[id], `${id}: 見本が無い`);
    const ex = exampleFor(id);
    assert.notEqual(ex.name, 'あなたの屋号', `${id}: 汎用の見本に落ちている`);
    assert.ok(ex.photo.startsWith('/'), `${id}: 写真のパスが変`);
  }
});

test('見本の写真が、実際に置いてある', async () => {
  const { existsSync } = await import('node:fs');
  for (const id of Object.keys(STARTER_EXAMPLES)) {
    const file = new URL(`../public${STARTER_EXAMPLES[id].photo}`, import.meta.url);
    assert.ok(existsSync(file), `${id}: public${STARTER_EXAMPLES[id].photo} が無い`);
  }
});

test('見本の屋号が業種どうしで重複していない', () => {
  const names = Object.values(STARTER_EXAMPLES).map(e => e.name);
  assert.equal(new Set(names).size, names.length);
});

test('業種の3つの一覧が、同じ集合を指している', () => {
  // 公開ページ / 制作画面の選択肢 / 業種ページの中身
  for (const id of LARUHP_INDUSTRIES) {
    assert.ok(INDUSTRY_DETAIL[id], `${id}: 業種ページの中身が無い`);
  }
  assert.equal(LARUHP_INDUSTRIES.length, 15);
  assert.equal(choices.length, 15);
});
