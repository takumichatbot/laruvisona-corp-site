import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DOMAIN_BILLING_NOTE,
  HAS_SPONSORED_DOMAIN_LINK,
  DOMAIN_OWNERSHIP_NOTE,
  DOMAIN_REGISTRARS,
} from '../lib/domain-guidance';
import { LARUHP_PUBLIC_PATHS, internalLaruHpPath } from '../lib/laruhp-public';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('ドメイン未取得と取得済みの双方に公開導線がある', () => {
  const page = read('app/laruHP/domains/page.tsx');
  const settings = read('app/laruHP/settings/DomainSettings.tsx');
  for (const phrase of ['まだ持っていない場合', 'すでに持っている場合', '登録事業者の移管は必要ありません']) {
    assert.match(page, new RegExp(phrase));
  }
  assert.match(settings, /取得方法と注意点を見る/);
  assert.match(settings, /ドメインを持っている/);
  assert.match(settings, /href="https:\/\/laruhp\.com\/domains"/);
  assert.match(page, /href="https:\/\/laruvisona\.jp\/laruHP\/settings\?tab=domain"/);
});

test('取得・更新費と所有者を誤認させない', () => {
  assert.match(DOMAIN_BILLING_NOTE, /月額料金に含まれません/);
  assert.match(DOMAIN_OWNERSHIP_NOTE, /お客様自身/);
  assert.doesNotMatch(`${DOMAIN_BILLING_NOTE}\n${DOMAIN_OWNERSHIP_NOTE}`, /年 約|LaruVisona名義/);
  const page = read('app/laruHP/domains/page.tsx');
  assert.match(page, /現在は各社の通常ページへの案内/);
  assert.match(page, /初年度だけでなく更新時も確認/);
});

test('既存メールのレコードを消さないよう案内する', () => {
  const page = read('app/laruHP/domains/page.tsx');
  for (const record of ['MX', 'SPF', 'DKIM', 'DMARC']) assert.match(page, new RegExp(record));
  assert.match(page, /既存レコードは消さない/);
});

test('取得先はhttpsの通常URLで、提携URLへ環境変数だけで切り替えられる', () => {
  assert.equal(DOMAIN_REGISTRARS.length, 2);
  for (const registrar of DOMAIN_REGISTRARS) assert.match(registrar.url, /^https:\/\//);
  assert.equal(HAS_SPONSORED_DOMAIN_LINK, false);
  const source = read('lib/domain-guidance.ts');
  assert.match(source, /NEXT_PUBLIC_MUUMUU_DOMAIN_URL/);
  assert.match(source, /NEXT_PUBLIC_ONAMAE_DOMAIN_URL/);
  assert.match(source, /HTTPS_URL\.test/);
  const page = read('app/laruHP/domains/page.tsx');
  assert.match(page, /広告・紹介リンクを含みます/);
  assert.match(page, /noopener noreferrer sponsored/);
});

test('専用ドメインでdomainsページを公開しサイトマップへ含める', () => {
  assert.ok(LARUHP_PUBLIC_PATHS.includes('/domains'));
  assert.equal(internalLaruHpPath('/domains'), '/laruHP/domains');
  const page = read('app/laruHP/domains/page.tsx');
  assert.match(page, /canonical: 'https:\/\/laruhp\.com\/domains'/);
});

test('案内ページと料金表が本格予約の現在地を正しく示す', () => {
  const landing = read('app/laruHP/page.tsx');
  const plans = read('app/laruHP/plans/page.tsx');
  const facts = read('lib/laruhp-facts.ts');
  assert.doesNotMatch(landing, /予約確定型ではなく/);
  assert.match(landing, /営業時間・担当者・設備の空きを合わせた予約/);
  assert.match(landing, /事前決済は実取引の確認後に順次提供/);
  assert.match(plans, /空き枠・担当者・設備の予約/);
  assert.match(facts, /空き枠・担当者・設備の予約管理/);
  assert.match(facts, /予約管理は、すべてのHPプランで利用できます/);
  assert.doesNotMatch(facts, /顧客管理・メール配信・Web予約・決済まで含むフル版/);
});
