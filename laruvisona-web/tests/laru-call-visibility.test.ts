// LARU CALL（AI電話受付）を会社サイトのトップ・サービス一覧から見つけられること（2026-10-09・オーナー指摘）。
// ⚠️ 正本は larubot.tokyo/laru-call。会社サイトに料金表や詳細を複製しない。LARUbot とは別サービスと書く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('トップのプロダクトに LARU CALL があり、LARUbot の隣・正本へリンク', () => {
  const top = read('components/immersive/CompanyExperience.tsx');
  const ids = Array.from(top.matchAll(/^\s{4}id: "([a-z]+)",$/gm)).map(m => m[1]);
  assert.deepEqual(ids.slice(0, 5), ['hp', 'bot', 'call', 'seo', 'flastal']);
  assert.match(top, /name: "LARU CALL",/);
  assert.match(top, /href: "https:\/\/larubot\.tokyo\/laru-call",/);
  assert.match(top, /LARU CALL（ラルコール）は、会社の電話にAIが出て/);
  assert.match(top, /LARUbotとは別のサービスです/);
  assert.match(top, /<strong>\{products\.length\}つのプロダクト<\/strong>/);
  assert.doesNotMatch(top, /% 4;|n = 3;/, 'タブのキー操作は件数に合わせる');
  for (const bad of ['予約を自動確定', '必ず', '導入社', '社が導入']) assert.ok(!top.includes(bad), bad);
});

test('LARU CALL の画面の画像が置いてあり、タブは 5 列', () => {
  for (const f of ['larucall.jpg', 'larucall-sp.jpg']) {
    assert.ok(existsSync(new URL(`../public/company/products/${f}`, import.meta.url)), f);
  }
  const css = read('components/immersive/company.css');
  assert.match(css, /\.lv-product-tabs \{\n  display: grid;\n  grid-template-columns: repeat\(5, 1fr\);/);
  assert.match(css, /\.lv-call-art \{/);
  assert.match(css, /button:nth-child\(5\) \{\n    grid-column: 1 \/ -1;/);
});

test('サービス一覧の自社サービスの行き先に LARU CALL（読み・別サービス）', () => {
  const svc = read('app/services/page.tsx');
  assert.match(svc, /name: 'LARU CALL（ラルコール）・AI電話受付・LARUbotとは別サービス', href: 'https:\/\/larubot\.tokyo\/laru-call'/);
});
