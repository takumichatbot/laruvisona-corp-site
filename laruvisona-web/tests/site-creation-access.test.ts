import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { siteCreationAccess, FREE_SITE_LIMIT } from '../lib/site-creation-access.ts';

/**
 * 登録した直後の人が、サイトを1つも作れなかった。
 *
 * 契約が無いと /api/sites が 403（no_plan）を返していた。
 * つまり4つの質問に答えて「保存」を押した、その瞬間に行き止まり。
 *
 * ところが、こちらが書いて売っていたのは:
 *   登録画面 「アカウントを作るところまでは無料です。決済は、公開するときで構いません。」
 *   登録画面 「まず作ってみて、気に入ってから決めてください。」
 *   一覧画面 「クレジットカード不要・今すぐ無料で試せます」
 *
 * 書いてあることと、動きが正反対だった。
 *
 * 本番の跡: 外部から登録した6人のうち**5人がサイトを1つも作っていない。**
 * 6人全員が登録した当日に消えている。
 *
 * 公開は publish 側が別に契約を見ているので、作らせても世には出ない。
 */

test('契約が無くても、1つは作れる', () => {
  /*
    ここを FREE_SITE_LIMIT と突き合わせてはいけない。
    定数を 0 に戻しても両側が一緒に動くので、**何も見ていないテストになる。**
    最初そう書いて、変異（1→0）が素通りした。実際の数で確かめる。
  */
  assert.ok(FREE_SITE_LIMIT >= 1, '無料で作れる数が0になっている（登録直後が行き止まり）');
  for (const status of [null, 'inactive', 'past_due', 'canceled', 'unpaid']) {
    const a = siteCreationAccess('customer@example.com', null, status, ['owner@example.com']);
    assert.ok(a.limit >= 1, `${status} で1つも作れない`);
    assert.equal(a.paying, false);
  }
});

test('契約が切れた人も、締め出さない', () => {
  // 一度も払っていない人より不利になるのはおかしい。数だけ無料と同じに戻す。
  for (const status of ['past_due', 'canceled', 'inactive']) {
    const a = siteCreationAccess('customer@example.com', 'hp-bot-seo', status, []);
    assert.equal(a.paying, false);
    assert.ok(a.limit >= 1, `${status} の人が1つも作れない`);
    assert.equal(a.limit, FREE_SITE_LIMIT, '無料の人と数が違う');
  }
});

test('契約している人は、プランの数だけ作れる', () => {
  for (const status of ['active', 'trialing']) {
    assert.deepEqual(siteCreationAccess('customer@example.com', 'hp', status, ['owner@example.com']),
      { paying: true, limit: 1 });
    assert.deepEqual(siteCreationAccess('customer@example.com', 'hp-bot-seo', status, []),
      { paying: true, limit: 3 });
  }
});

test('公開APIと同じ管理者は、契約記録なしでも検証できる', () => {
  assert.deepEqual(siteCreationAccess('Owner@example.com', null, 'inactive',
    ['support@example.com', ' owner@example.com, other@example.com ']),
  { paying: true, limit: 999 });
});

test('設定なし・空のメールを管理者として扱わない', () => {
  for (const email of [undefined, '', 'owner@example.com'])
    assert.equal(siteCreationAccess(email, null, 'inactive', [undefined, ' ']).paying, false);
});

test('ドメイン一致や部分一致では管理者にならない', () => {
  for (const email of ['other@example.com', 'owner@example.com.evil', 'xowner@example.com'])
    assert.equal(siteCreationAccess(email, null, 'inactive', ['owner@example.com']).paying, false);
});

test('作成APIが、契約の有無で門前払いをしない', () => {
  const route = readFileSync(new URL('../app/api/sites/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(route, /code: 'no_plan'/, '作る前に止めている');
  assert.doesNotMatch(route, /!access\.allowed/, '古い判定が残っている');
  const dup = readFileSync(new URL('../app/api/sites/[id]/duplicate/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(dup, /code: 'no_plan'/, '複製だけ止めている');
});

test('止めるのは公開のとき', () => {
  /*
    作らせても、契約なしで世に出ないこと。ここが外れたら只で配ることになる。
  */
  const publish = readFileSync(new URL('../app/api/sites/[id]/publish/route.ts', import.meta.url), 'utf8');
  assert.match(publish, /!isAdmin && !hasServiceAccess\(profile\?\.subscription_status\)/,
    '公開側の契約チェックが外れている');
});

test('上限に当たったとき、その人に通じる言葉で言う', () => {
  // 契約していない人に「プランをアップグレード」と言っても意味が通らない。
  const route = readFileSync(new URL('../app/api/sites/route.ts', import.meta.url), 'utf8');
  assert.match(route, /access\.paying\s*\n?\s*\?/, '言葉を出し分けていない');
  assert.match(route, /無料でお試しいただけるサイトは/);
  assert.match(route, /free: !access\.paying/, '画面側が見分けられない');
});
