import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readContactBody } from '../lib/contact-contract';

/**
 * お客様が書いた内容が、どこにも届いていなかった。
 *
 * お店の人は問い合わせフォームに項目を足せる。
 *   会社名 / ご希望日時 / ご予算 / ご連絡方法 / お問い合わせ種別
 * 欄は公開ページに出る。お客様はそこに記入して送る。送信も成功する。
 *
 * ところが公開ページが送っていたのは name / email / phone / message の
 * **4つだけ。** それ以外は受信メールにも保存データにも入らない。
 *
 * 受け口（/api/contact）は extraFields を受け取り、メールに行を足す仕掛けを
 * **もとから持っていた。** 公開ページだけが送っていなかった。
 *
 * お店の人から見ると「お客様が希望日時を書いてくれない」。
 * 実際には書いている。毎回。
 */

const exporter = fs.readFileSync(new URL('../lib/html-export.ts', import.meta.url), 'utf8');

test('追加項目を、拾って送っている', () => {
  // 単一フォームと複数ステップ、どちらも
  assert.equal((exporter.match(/extraFields:lhpExtra\(/g) || []).length, 2, '送っていない経路がある');
  assert.equal((exporter.match(/function lhpExtra\(scope\)/g) || []).length, 2, '拾う仕掛けが足りない');
});

test('拾う目印が、全部の追加項目に付いている', () => {
  // 目印が無い欄は、拾われずに消える。
  for (const name of ['company', 'date', 'budget', 'prefer_contact', 'inquiry_type', 'cond_date', 'cond_budget', 'cond_company']) {
    const re = new RegExp(`name="${name}"[^>]*data-lhp-label=`);
    assert.match(exporter, re, `${name} に目印が無い`);
  }
});

test('送る名前は、必ず半角になる', () => {
  // 受け口は鍵に [a-zA-Z0-9_-] しか許さない。日本語の名前を送ると
  // **400で全部弾かれ、本文まで含めて何も届かなくなる。**
  assert.doesNotMatch(exporter, /name="cond_\$\{escapeHtml\(f\)\}"/, '日本語がそのまま名前になる');
  assert.match(exporter, /replace\(\/\[\^a-zA-Z0-9_-\]\/g, ''\)/, '半角へ落としていない');
});

test('受け口の決まりを、送る側が越えない', () => {
  // 20件・1000文字。越えると400で全部落ちる。
  assert.match(exporter, /n>=20/, '件数を見ていない');
  assert.match(exporter, /slice\(0,1000\)/, '長さを見ていない');
  assert.match(exporter, /slice\(0,64\)/, '鍵の長さを見ていない');
});

test('実際に、受け口を通る形になっている', async () => {
  // 送る側が作る形を、受け口にそのまま食わせる。
  const body = {
    siteId: '3f4a1b2c-1111-4222-8333-444455556666',
    name: '山田', email: 'a@example.com', message: '相談です',
    extraFields: {
      company: '会社名: 山田商店',
      cond_date: '希望日時: 2026-10-01T10:00',
      inquiry_type: 'お問い合わせ種別: 見積もり',
    },
  };
  const req = new Request('https://x/api/contact', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const parsed = await readContactBody(req, 100000);
  assert.equal(typeof parsed, 'object');
});

test('日本語の項目名は、値の頭に残す', () => {
  // 鍵は半角しか使えないので、そのままでは項目名が失われる。
  assert.match(exporter, /label&&label!==key\?label\+': ':''/);
});

test('受け取った側が、読める見出しで出す', () => {
  const api = fs.readFileSync(new URL('../app/api/contact/route.ts', import.meta.url), 'utf8');
  for (const k of ['inquiry_type', 'cond_date', 'cond_budget', 'cond_company']) {
    assert.match(api, new RegExp(`${k}:`), `${k} の見出しが無い`);
  }
  assert.match(api, /k\.replace\(\/\^cond_\/, ''\)/, '知らない鍵の接頭辞を落としていない');
});
