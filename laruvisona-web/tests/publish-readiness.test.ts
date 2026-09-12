// R3 の回帰テスト。
//
// 実APIの挙動（app/api/contact/route.ts:187, app/api/stripe/webhook/route.ts:126）:
//   toEmail = settings?.notifyEmail || 所有者のメール(auth.users)
//   toEmail が無い場合のみ 400（届け先が無い）。
//
// つまり「専用の届け先が空」は、所有者のメールが確認できれば実害にならない。
// 一方「専用の届け先はあるが形式が壊れている」場合、実APIは形式を検査せず
// そのまま送ろうとするので、実際には届かない（Resend側で失敗する）。
// ここでは画面側の事前チェックとして、形式が壊れている場合は must 不合格にする。

import assert from 'node:assert/strict';
import test from 'node:test';

import { checkPublishReadiness } from '../lib/publish-readiness.ts';
import type { Page } from '../types/laruHP.ts';

const pageWithForm: Page[] = [
  {
    id: 'p1',
    name: 'トップ',
    blocks: [{ id: 'b1', type: 'contact', data: {} }],
  } as unknown as Page,
];

const pageWithoutForm: Page[] = [
  {
    id: 'p1',
    name: 'トップ',
    blocks: [{ id: 'b1', type: 'hero', data: {} }],
  } as unknown as Page,
];

function notifyItem(items: ReturnType<typeof checkPublishReadiness>) {
  const item = items.find(i => i.id === 'notify');
  assert.ok(item, 'notify 項目が無い');
  return item!;
}

test('専用の届け先が空でも、所有者のメールがあれば不合格にしない', () => {
  const items = checkPublishReadiness({
    name: '店',
    pages: pageWithForm,
    notifyEmail: '',
    ownerEmail: 'owner@example.com',
  });
  const item = notifyItem(items);
  assert.equal(item.ok, true);
  assert.equal(item.level, 'must');
  assert.match(item.detail, /owner@example\.com/);
  // 送信を試していないことが分かる書き方であること
  assert.match(item.detail + item.label, /試していません/);
});

test('専用の届け先が空、所有者のメールも不明な画面では、断言せず案内だけ出す', () => {
  const items = checkPublishReadiness({
    name: '店',
    pages: pageWithForm,
    notifyEmail: '',
    // ownerEmail を渡さない = この画面では分からない
  });
  const item = notifyItem(items);
  assert.equal(item.ok, true);
  assert.match(item.detail, /アカウントのメールが使われます/);
  assert.match(item.detail, /確認できません/);
  // 「受信できます」のような断言をしていないこと
  assert.ok(!item.detail.includes('受信できます'));
});

test('専用の届け先が空、所有者のメールも無い/不正なら must 不合格', () => {
  const noOwner = notifyItem(checkPublishReadiness({
    name: '店',
    pages: pageWithForm,
    notifyEmail: '',
    ownerEmail: '',
  }));
  assert.equal(noOwner.ok, false);
  assert.equal(noOwner.level, 'must');
  assert.match(noOwner.detail, /届け先が決まっていません/);

  const badOwner = notifyItem(checkPublishReadiness({
    name: '店',
    pages: pageWithForm,
    notifyEmail: '',
    ownerEmail: 'not-an-email',
  }));
  assert.equal(badOwner.ok, false);
  assert.equal(badOwner.level, 'must');
});

for (const bad of ['abc', 'a@', 'a b@c.d']) {
  test(`専用の届け先の形式が不正 (${JSON.stringify(bad)}) なら must 不合格`, () => {
    const item = notifyItem(checkPublishReadiness({
      name: '店',
      pages: pageWithForm,
      notifyEmail: bad,
      ownerEmail: 'owner@example.com',
    }));
    assert.equal(item.ok, false);
    assert.equal(item.level, 'must');
    assert.match(item.detail, /メールアドレスの形になっていません/);
  });
}

test('正しい形式の専用の届け先は合格', () => {
  const item = notifyItem(checkPublishReadiness({
    name: '店',
    pages: pageWithForm,
    notifyEmail: 'contact@example.com',
  }));
  assert.equal(item.ok, true);
  assert.match(item.detail, /contact@example\.com/);
});

test('フォームが1つも無いサイトでは、通知先を問題にしない', () => {
  const item = notifyItem(checkPublishReadiness({
    name: '店',
    pages: pageWithoutForm,
    notifyEmail: '',
    ownerEmail: '',
  }));
  assert.equal(item.ok, true);
  assert.equal(item.level, 'must');
});
