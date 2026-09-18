import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * プランが変わったら LARUbot に伝える。同じプランでの叩き直しは見送る。
 *
 * ── 直した所 ──
 *
 * 以前は `if (isBotPlan(prevPlan)) return null;` として、bot から bot への
 * プラン変更では register を叩いていなかった。そのため
 * **lite（SEOなし）→ hp-bot-seo（SEOあり）に上がった人の SEOオプションが、
 * あちらで有効にならなかった。**
 *
 * さらに 2026-09-17 にこちらが入れた二重登録の抑止が、同じ穴を作り直していた。
 * 「public_id を持っていれば叩かない」としたので、プラン変更まで止まる。
 *
 * LARUbot 側の回答（2026-09-18）:
 *   register は email 単位で冪等。public_id は再発行されない。
 *   再呼び出しで SEOオプションは有効になる。記事・キーワード・顧客データ・
 *   人が選んだ曜日と時刻・既に買った枠は一切触らない。
 *
 * なので「プランが変わったら叩く／同じプランなら見送る」に直した。
 * 見送りの判断に使うのは、登録したときのプラン（larubotRegisteredPlan）。
 *
 * ── 生成はこちらに持たない ──
 *
 * 自動運転の開始・キーワード処理・記事生成・状態取得は、すべて LARUbot 側。
 * こちらは呼ぶだけで、**まだ実装されていないAPIは呼ばない。**
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const prov = () => read('lib/larubot-provision.ts');

test('プランが変わったら、叩く', () => {
  const s = prov();
  assert.doesNotMatch(s, /if \(isBotPlan\(prevPlan\)\) return null;/,
    'bot → bot を門前払いしている（SEOが有効にならない）');
});

test('同じプランでの叩き直しだけ、見送る', () => {
  // webhook の再送はここで止める。プラン変更は止めない。
  const s = prov();
  assert.match(s, /if \(\(held\.publicId \|\| held\.seoPublicId\) && held\.registeredPlan === plan\) \{/,
    'プランを見ずに見送っている、または見送っていない');
  assert.match(s, /status: 'already_linked'/);
});

test('登録したときのプランを控える', () => {
  // 控えないと、次に来たときプランが変わったのか分からない。
  const s = prov();
  assert.match(s, /\.\.\.\(plan \? \{ larubotRegisteredPlan: plan \} : \{\}\),/, '控えていない');
  assert.match(s, /await linkLarubotIds\(\{ userId, siteId, publicId, seoPublicId, plan \}\);/,
    '登録成功時に渡していない');
  assert.match(s, /settings\.larubotRegisteredPlan/, '読み出していない');
});

test('public_id は上書きしない（同じ値を保つ）', () => {
  /*
    あちらは冪等で同じ public_id を返すが、こちらが勝手に別の値で
    塗り替えないことも要る。書き込みは settings_json への合成だけで、
    消す処理はどこにも無いこと。
  */
  const s = prov();
  assert.doesNotMatch(s, /larubotPublicId: null/, 'null で消している');
  assert.doesNotMatch(s, /laruseoPublicId: null/, 'null で消している');
  assert.match(s, /settings_json: \{ \.\.\.\(site\.settings_json as Record<string, unknown>\), \.\.\.patch \}/,
    '既存の設定ごと置き換えている');
});

test('分からないときは、登録しない', () => {
  const s = prov();
  assert.match(s, /if \(held\.unknown\) \{/);
  assert.match(s, /status: 'link_check_failed'/);
});

test('管理画面からのプラン付与も、LARUbot に伝える', () => {
  /*
    ここは profiles.plan を書き換えるだけで、登録を呼んでいなかった。
    決済経路には前からあるのに、手で付けたときだけ抜けていた。
  */
  const admin = read('app/api/admin/users/[id]/route.ts');
  assert.match(admin, /import \{ provisionLarubotOnPlan \} from '@\/lib\/larubot-provision';/);
  // 文の頭であること。`if (false) await ...` のように潰されても気づけるように
  // （最初 /await provisionLarubotOnPlan\(\{/ だけを見ていて、変異が素通りした）。
  assert.match(admin, /^\s*await provisionLarubotOnPlan\(\{$/m, '呼んでいない、または条件で潰されている');
  assert.match(admin, /^\s*try \{$[\s\S]{0,200}^\s*await provisionLarubotOnPlan\(\{$/m,
    'try で囲っていない（失敗すると管理操作ごと落ちる）');
  assert.match(admin, /prevPlan: profileResult\.data\?\.plan \?\? null,/, '前のプランを渡していない');
  assert.match(admin, /\.select\('stripe_subscription_id,stripe_customer_id,plan'\)/, '前のプランを読んでいない');
  // 失敗しても管理操作は止めない。ただし黙らない
  assert.match(admin, /\[admin\/plan\] LARUbot への登録に失敗:/, '失敗を握りつぶしている');
});

test('未実装のAPIを、本番から呼んでいない', () => {
  /*
    自動運転（/api/hp/seo/autopilot）と状態取得の public_id 対応は、
    LARUbot 側で実装中。存在する前提で呼ばない。
  */
  const dir = new URL('../', import.meta.url);
  const hits: string[] = [];
  const walk = (rel: string) => {
    for (const entry of fs.readdirSync(new URL(rel, dir), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const next = `${rel}${entry.name}${entry.isDirectory() ? '/' : ''}`;
      if (entry.isDirectory()) { walk(next); continue; }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const body = fs.readFileSync(new URL(next, dir), 'utf8');
      if (/\/api\/hp\/seo\/autopilot|\/api\/seo\/generate_now|\/api\/seo\/autopilot_setting/.test(body)) {
        hits.push(next);
      }
    }
  };
  for (const root of ['app/', 'lib/', 'components/']) walk(root);
  assert.deepEqual(hits, [], `未実装のAPIを呼んでいる: ${hits.join(', ')}`);
});

test('記事生成も定期実行も、こちらに無いまま', () => {
  const jobs = fs.readdirSync(new URL('../app/api/cron/', import.meta.url)).filter(n => !n.startsWith('.'));
  for (const job of jobs) assert.ok(!/seo|blog|article/i.test(job), `SEOの定期実行を作っている: ${job}`);
});
