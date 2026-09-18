import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * 同じサイトで LARUbot 登録が複数回走らないこと。
 *
 * 2026-09-18、LARUbot 側の実コード調査から確認を求められた点。
 *
 * 通常の経路は1回で済んでいた。
 *   新規契約       … Stripe の checkout.session.completed から1回
 *   既存の差し替え … app/api/stripe/checkout から1回（prevPlan で弾く）
 *
 * ただし **Stripe の webhook は再送される。** 2xx を返せなかった回は
 * もう一度同じ event が来るので、そのたびに register を叩いていた。
 * さらに、解約してから入り直した人は prevPlan が bot でなくなるので、
 * そこでも走る。LARUbot 側はメールでテナントを引くので、
 * **登録メールが変わっていれば別テナントになる。**
 * そのとき新しい public_id で上書きすると、記事が入っている
 * 元のテナントを見失う。
 *
 * 生成そのものは LARUbot 側に統一する（こちらに cron も生成処理も作らない）。
 * こちら側の責任は、連携情報を失わないことと、二重に登録しないこと。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const src = () => read('lib/larubot-provision.ts');

test('すでに連携情報があれば、登録し直さない', () => {
  const s = src();
  assert.match(s, /const held = await existingLarubotIds\(userId, siteId\);/, '持っているか確かめていない');
  // 条件そのものを見る。ここを見ないと、条件を false に潰されても気づけない
  // （最初そう書いて、変異が素通りした）。
  assert.match(s, /if \(held\.publicId \|\| held\.seoPublicId\) \{/, '持っているかを見ていない');
  assert.match(s, /return \{ publicId: held\.publicId, seoPublicId: held\.seoPublicId, status: 'already_linked' \};/,
    '持っていても登録に進んでいる');
  // register を叩く前に確かめること
  const checkAt = s.indexOf('const held = await existingLarubotIds');
  const fetchAt = s.indexOf("fetch(`${base}/api/hp/register`");
  assert.ok(checkAt > 0 && fetchAt > 0 && checkAt < fetchAt, '登録したあとに確かめている');
});

test('サイト・預かり先の両方を見る', () => {
  // 料金ページから契約した人は、サイトが出来る前に public_id を受け取る。
  // その分は profiles に預けてある（supabase/profiles_pending_larubot.sql）。
  const s = src();
  assert.match(s, /settings\.larubotPublicId/, 'サイト側を見ていない');
  assert.match(s, /settings\.laruseoPublicId/);
  assert.match(s, /pending_larubot_public_id, pending_laruseo_public_id/, '預かり分を見ていない');
});

test('分からないときは、登録しない', () => {
  /*
    読めなかったのを「持っていない」と扱うと、持っているのに登録し直して
    **記事が入っているテナントを見失う。** 分からないときは止める。
  */
  const s = src();
  assert.match(s, /return \{ publicId: null, seoPublicId: null, unknown: true \};/);
  assert.match(s, /if \(held\.unknown\) \{/, '分からない場合を区別していない');
  assert.match(s, /status: 'link_check_failed'/);
  assert.match(s, /連携情報を確認できないため登録を見送ります/, '黙って見送っている');
});

test('bot → bot のプラン変更では、これまでどおり叩かない', () => {
  const s = src();
  assert.match(s, /if \(isBotPlan\(prevPlan\)\) return null;/);
});

test('こちらに記事生成も定期実行も持たない', () => {
  /*
    生成主体は LARUbot 側に統一する（2026-09-18 の取り決め）。
    こちらに cron を足すと、あちらの内蔵スケジューラと二重生成になる。
  */
  const cronDir = new URL('../app/api/cron/', import.meta.url);
  const jobs = fs.readdirSync(cronDir).filter(name => !name.startsWith('.'));
  for (const job of jobs) {
    assert.ok(!/seo|blog|article/i.test(job), `SEO記事の定期実行を作っている: ${job}`);
  }
  // 生成APIを定期実行から呼んでいないこと
  for (const job of jobs) {
    const file = new URL(`../app/api/cron/${job}/route.ts`, import.meta.url);
    if (!fs.existsSync(file)) continue;
    const body = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(body, /blog-generate/, `${job} から記事生成を呼んでいる`);
  }
});

test('設置タグは1ページに1回だけ', () => {
  // LARUbot 側の調査: 同一ページで2回読むと laru-seo-app が2個になる。
  const page = read('app/hp/[slug]/page.tsx');
  assert.equal((page.match(/larubot\.tokyo\/embed\/blog\.js/g) || []).length, 1, '出し口が1つでない');
  // 公開HTMLに焼き込まれた古いタグは、配信時に落とす
  assert.match(page, /static\\\/embed\|embed\\\/blog/, '焼き込み分を落としていない');
  // 書き出し側は出さない
  const exporter = read('lib/html-export.ts');
  assert.match(exporter, /const laruSeoScript = '';/, '書き出し側が出し直している');
});
