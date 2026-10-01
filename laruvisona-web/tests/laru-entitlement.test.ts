import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { laruEntitlement, isBotPlan } from '../lib/laru-entitlement.ts';
import { chatPublicId, blogPublicId } from '../lib/larubot-public-id.ts';

/* 2026-09-27 LARU HP の契約を正として、公開ページに出すものを決める。 */

const ID = '3f2b8c1e-8d4a-4c1b-9a77-0c1d2e3f4a5b';
const settings = { larubotPublicId: ID, laruseoPublicId: ID, larubot: true, laruseo: true };

/** 公開ページと同じ組み立て（app/hp/[slug]/page.tsx）。 */
function embeds(plan: string | null, status: string | null) {
  const laru = laruEntitlement(plan, status);
  const chatId = !laru.bot || settings.larubot === false ? '' : chatPublicId(settings);
  const blogId = !laru.seo || settings.laruseo === false ? '' : blogPublicId(settings);
  return { bot: chatId ? 1 : 0, seo: blogId ? 1 : 0 };
}

test('プラン別: 出るもの（識別子は全員に残っている前提）', () => {
  assert.deepEqual(embeds('hp', 'active'), { bot: 0, seo: 0 });
  assert.deepEqual(embeds('lite', 'active'), { bot: 1, seo: 0 });
  assert.deepEqual(embeds('hp-bot', 'active'), { bot: 1, seo: 0 });
  assert.deepEqual(embeds('hp-bot-seo', 'active'), { bot: 1, seo: 1 });
  assert.deepEqual(embeds('agency', 'active'), { bot: 1, seo: 1 });
  assert.deepEqual(embeds('hp-bot-seo', 'trialing'), { bot: 1, seo: 1 });
});

test('ダウングレード: Bot付き→HP単体でチャットが消え、SEO付き→SEOなしで記事が消える', () => {
  assert.deepEqual(embeds('hp-bot-seo', 'active'), { bot: 1, seo: 1 });
  assert.deepEqual(embeds('hp-bot', 'active'), { bot: 1, seo: 0 }, 'SEOなしへ下げても記事が出る');
  assert.deepEqual(embeds('hp', 'active'), { bot: 0, seo: 0 }, 'HP単体へ下げてもチャットが出る');
  // 識別子は消していない（再契約で同じテナントに戻す）
  assert.equal(chatPublicId(settings), ID);
  assert.deepEqual(embeds('hp-bot-seo', 'active'), { bot: 1, seo: 1 }, '再契約で戻らない');
});

test('契約が有効でなければ、どのプランでも出さない', () => {
  for (const status of ['canceled', 'past_due', 'unpaid', 'incomplete', null, '']) {
    assert.deepEqual(embeds('hp-bot-seo', status), { bot: 0, seo: 0 }, String(status));
  }
  assert.deepEqual(embeds(null, 'active'), { bot: 0, seo: 0 });
  assert.deepEqual(laruEntitlement(null, null, true), { bot: true, seo: true }, '運営の確認用');
  assert.equal(isBotPlan('hp'), false);
});

test('公開ページが契約で絞っている・契約が変わったら作り置きを捨てている', () => {
  const page = readFileSync('app/hp/[slug]/page.tsx', 'utf8');
  assert.match(page, /const chatId = !laru\.bot \|\| settings\.larubot === false \? '' : chatPublicId\(settings\);/);
  assert.match(page, /const blogId = !laru\.seo \|\| settings\.laruseo === false \? '' : blogPublicId\(settings\);/);
  // 持ち主（user_id）を引いて今の契約で絞る。head・構造化データは公開時点の値（published_html 等）から
  assert.match(page, /select\('id, published_html, name, settings_json, seo_json, blocks_json, slug, custom_domain, industry, user_id'\)/);
  for (const p of ['app/api/stripe/webhook/route.ts', 'app/api/stripe/upgrade/route.ts', 'app/api/stripe/checkout/route.ts',
    'app/api/cron/subscription-sync/route.ts', 'app/api/admin/users/[id]/route.ts']) {
    assert.match(readFileSync(p, 'utf8'), /await revalidateOwnerSites\(/, p);
  }
  // 識別子は消さない
  assert.doesNotMatch(readFileSync('app/api/stripe/webhook/route.ts', 'utf8'), /larubotPublicId: null|laruseoPublicId: null/);
});
