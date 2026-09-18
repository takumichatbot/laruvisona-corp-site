import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initialSeoKeywords, isSeoPlan, seoDisplayState, SEO_STATE_LABEL } from '../lib/larubot-seo.ts';
import { bareSource } from './helpers/bare-source';

/**
 * 「連携は成功しているのに記事が永久に出ない」を終わらせる。
 *
 * register だけでは、あちらでは SEOオプションが有効になり月の枠も入るが、
 * **自動運転はOFF・キーワード0**のまま。だから記事が1本も出なかった
 * （LARUbot 側の実コード調査 2026-09-18）。
 *
 * 契約が通ったら「自動運転を始めてください」と伝える。
 *
 * ⚠️ **こちらに記事を作る処理は無い。** 生成も定期実行も LARUbot 側だけ
 * （毎時07分の seo_autopilot_hourly）。こちらに持つと二重生成になる。
 *
 * 決まりごと（仕様: LARUbot 側 3efcbc0）:
 *   ・曜日は 0=日曜 … 6=土曜、7=毎日
 *   ・時刻は JST の「時」だけ。分は指定できない（毎時07分に走るため）
 *   ・generate_first はテナントにつき1度だけ。2回目は枠を消費しない
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('SEOが付くプランだけ、自動運転を頼む', () => {
  // 409 seo_not_enabled を踏みに行かない。権限を配るのは契約側の仕事。
  for (const plan of ['hp-bot-seo', 'agency']) assert.equal(isSeoPlan(plan), true, plan);
  for (const plan of ['hp', 'lite', 'hp-bot', null, undefined, '']) assert.equal(isSeoPlan(plan), false, String(plan));
  // lib/plan-limits.ts の PLAN_FEATURES と揃っていること
  const limits = fs.readFileSync(new URL('../lib/plan-limits.ts', import.meta.url), 'utf8');
  for (const plan of ['hp-bot-seo', 'agency']) {
    // 表の該当行だけを取り出して見る（行を素朴に探すと、別の表の行を拾う）
    const m = limits.match(new RegExp(`(?:'${plan}'|\\b${plan}):\\s*\\[([^\\]]*)\\]`));
    assert.ok(m, `${plan} が PLAN_FEATURES に無い`);
    assert.ok(m![1].includes("'seo'"), `${plan} に seo が無い（表と実装が食い違う）`);
  }
  for (const plan of ['hp', 'lite', 'hp-bot']) {
    const m = limits.match(new RegExp(`(?:'${plan}'|\\b${plan}):\\s*\\[([^\\]]*)\\]`));
    assert.ok(m && !m[1].includes("'seo'"), `${plan} に seo が付いている（表と実装が食い違う）`);
  }
});

test('契約が通ったら、自動運転を頼む', () => {
  const src = read('lib/larubot-provision.ts');
  assert.match(src, /if \(isSeoPlan\(plan\) && \(seoPublicId \|\| publicId\)\) \{/, '頼んでいない');
  assert.match(src, /await startLarubotAutopilot\(\{/);
  assert.match(src, /generateFirst: keywords\.length > 0,/, 'キーワードが無いのに初回生成を頼んでいる');
});

test('頼めなくても、契約処理は止めない', () => {
  const src = read('lib/larubot-provision.ts');
  const at = src.indexOf('if (isSeoPlan(plan) && (seoPublicId || publicId)) {');
  const block = src.slice(at, src.indexOf('return registration;', at));
  assert.doesNotMatch(block, /throw /, '失敗で投げている');
  // 2026-09-18: ログだけでは誰も見ないので、運営へ届ける形に変えた。
  assert.match(block, /await alertLarubotFailure\(\{/, '失敗を黙っている');
  assert.match(block, /kind: 'autopilot'/);
  assert.match(block, /console\.info\('\[larubot\] 自動運転を開始しました:'/, '成功も残す');
});

test('サイトが無い状態で契約した人には、あとで材料を渡す', () => {
  /*
    料金ページから契約した人は site_id なしで register が通る。
    そのとき店名も業種もエリアも無いので、キーワードが作れない。
    最初のサイトを作ったところで渡す。
  */
  const src = read('app/api/sites/route.ts');
  assert.match(src, /if \(seoId && isSeoPlan\(plan\)\) \{/, '最初のサイトで渡していない');
  assert.match(src, /await startLarubotAutopilot\(\{ publicId: seoId, keywords, generateFirst: true \}\);/);
  assert.match(src, /if \(keywords\.length\) \{/, '材料が無いのに頼んでいる');
});

test('曜日と時刻は、受け取る形だけ通す', () => {
  // 0=日曜 … 6=土曜、7=毎日。ここがずれると静かに1日ずれる。
  const lib = fs.readFileSync(new URL('../lib/larubot-seo.ts', import.meta.url), 'utf8');
  assert.match(lib, /value >= 0 && value <= 7 \? value : undefined/, '曜日の範囲が違う（7=毎日）');
  assert.match(lib, /value >= 0 && value <= 23 \? value : undefined/, '時の範囲が違う');
  assert.match(lib, /分は指定できない/, '分を送ろうとしていないか');
});

test('キーワードは材料を渡すだけ。こちらで作り込まない', () => {
  const k = initialSeoKeywords({ name: '結い庵', industry: 'beauty', city: '東京都足立区1-2-3' });
  assert.ok(k.includes('東京都足立区 美容室・サロン'), 'エリア×業種が無い');
  // 店名は「エリア＋店名」の形で入る。1語だけの語は作らない（競合が強すぎる）。
  assert.ok(k.some(w => w.includes('結い庵')), '店名が無い');
  assert.ok(!k.includes('結い庵'), '1語だけの店名を送っている');
  assert.ok(k.every(w => !/\d/.test(w)), '番地が混ざっている');
  assert.ok(k.length <= 10, '多すぎる');
  assert.equal(new Set(k).size, k.length, '重複している');
  // 材料が無ければ空。無理に作らない
  assert.deepEqual(initialSeoKeywords({}), []);
});

test('画面の状態は、あちらの値だけで決める', () => {
  const q = (used: number, limit: number) => ({ used, limit });
  assert.equal(seoDisplayState(null), 'unknown');
  assert.equal(seoDisplayState({ last_result: 'failed' }), 'failed');
  /*
    2026-09-18（本番疎通のあと）に決めたこと:
    **「公開済み」は現在の状態ではなく履歴**なので、状態としては返さない。
    記事が1本でもあると判定の先頭で勝ってしまい、枠切れ・キーワード切れ・
    生成失敗を隠していた。公開本数は articles.published として
    画面が別枠で出す（tests/seo-status-card.test.ts）。
  */
  assert.notEqual(seoDisplayState({ articles: { published: 1 }, last_result: 'published' }), 'published');
  assert.equal(seoDisplayState({ last_result: 'draft' }), 'draft');
  assert.equal(seoDisplayState({ autopilot_active: false }), 'stopped');
  assert.equal(seoDisplayState({ autopilot_active: true, quota: q(5, 5), unused_keywords: 3 }), 'quota_reached');
  assert.equal(seoDisplayState({ autopilot_active: true, quota: q(1, 5), unused_keywords: 0 }), 'no_keywords');
  assert.equal(seoDisplayState({ autopilot_active: true, quota: q(1, 5), unused_keywords: 3 }), 'waiting');
  // 状態すべてに、画面に出す言葉があること
  for (const state of ['waiting','no_keywords','quota_reached','stopped','failed','draft','unknown'] as const) {
    assert.ok(SEO_STATE_LABEL[state], `${state} の表示名が無い`);
  }
});

test('状態は自分のサイトのぶんだけ返す', () => {
  const route = read('app/api/sites/[id]/seo-status/route.ts');
  assert.match(route, /\.eq\('id', id\)\.eq\('user_id', user\.id\)/, '他人のサイトの状態を返しうる');
  assert.match(route, /if \(!user\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);/);
  // 届かなかったことと、届いて0件だったことを混ぜない
  assert.match(route, /reachable: false/, '届かなかった場合を区別していない');
});

test('こちらで数えない・持たない', () => {
  /*
    記事数も未使用キーワードも枠も、あちらが返す値をそのまま渡す。
    こちらにSEO用のテーブルや集計を作らない（2026-09-18 の取り決め）。
  */
  const route = read('app/api/sites/[id]/seo-status/route.ts');
  assert.match(route, /const body = await fetchLarubotStatus\(publicId\);/);
  assert.doesNotMatch(route, /from\('(seo|articles|keywords)/, '独自のSEOテーブルを読んでいる');
  // status は public_id で引く（email は後方互換であって、こちらは使わない）
  const lib = fs.readFileSync(new URL('../lib/larubot-seo.ts', import.meta.url), 'utf8');
  assert.match(lib, /\/api\/hp\/status\?public_id=\$\{encodeURIComponent\(publicId\)\}/);
  assert.doesNotMatch(lib, /status\?email=/, 'email で引いている');
});

test('鍵を、応答にも記録にも出さない', () => {
  for (const p of ['lib/larubot-seo.ts', 'app/api/admin/larubot-smoke/route.ts']) {
    const src = fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
    // 小文字の変数 secret だけを見る。環境変数名 LARU_HP_API_SECRET を
    // 文面に書いているだけの行に反応しないように（最初 /i を付けて誤検知した）。
    assert.doesNotMatch(src, /console\.[a-z]+\([^)]*\bsecret\b/, `${p}: 記録に鍵を流している`);
    assert.doesNotMatch(src, /NextResponse\.json\(\{[^}]*\bsecret\b/, `${p}: 応答に鍵を入れている`);
    // 送信ヘッダーにだけ入っていること
    assert.match(src, /'x-laru-secret': secret/, `${p}: 鍵を送っていない`);
  }
});

test('疎通の口は、運営しか叩けない', () => {
  const route = read('app/api/admin/larubot-smoke/route.ts');
  assert.match(route, /isAdminEmail\(user\.email\)/, '誰でも叩けると、外部からテナントを作られる');
  assert.match(route, /status: 403/);
  assert.match(route, /claimPublicRate\(createServiceClient\(\), 'larubot-smoke'/, '回数制限が無い');
  // 識別子を全部は返さない
  assert.match(route, /const short = \(v: unknown\) => \(typeof v === 'string' && v \? `\$\{v\.slice\(0, 8\)\}…` : null\);/);
});

test('こちらに記事生成も定期実行も無いまま', () => {
  const jobs = fs.readdirSync(new URL('../app/api/cron/', import.meta.url)).filter(n => !n.startsWith('.'));
  for (const job of jobs) assert.ok(!/seo|blog|article/i.test(job), `SEOの定期実行を作っている: ${job}`);
  const lib = fs.readFileSync(new URL('../lib/larubot-seo.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(lib, /generate_now|autopilot_setting/, '画面用の内部APIを叩いている');
});

test('状態の項目名を、最新の仕様に合わせる', () => {
  /*
    LARUbot `7fe6a3b` で名前が揃った。
      status 側 unused_keywords → keywords_unused
      status 側 total_keywords  → keywords_total
    autopilot の応答と同じ名前になった。**古い名前で読むと、
    キーワードが何本あっても常に「不足」と出る。**
  */
  const active = { autopilot_active: true, quota: { used: 1, limit: 5 } };
  assert.equal(seoDisplayState({ ...active, keywords_unused: 3 }), 'waiting');
  assert.equal(seoDisplayState({ ...active, keywords_unused: 0 }), 'no_keywords');
  // 古い名前も一応見る（向こうを戻されたときに黙って0扱いしないため）
  assert.equal(seoDisplayState({ ...active, unused_keywords: 3 }), 'waiting');
});

test('飛ばした理由を、数より先に見る', () => {
  // `skipped` は 7fe6a3b で入った。理由が取れるなら、そのまま出す。
  const base = { autopilot_active: true, last_result: 'skipped' };
  assert.equal(seoDisplayState({ ...base, last_skip: { reason: 'quota_reached' }, keywords_unused: 6, quota: { used: 1, limit: 5 } }), 'quota_reached');
  assert.equal(seoDisplayState({ ...base, last_skip: { reason: 'no_unused_keywords' }, keywords_unused: 6, quota: { used: 1, limit: 5 } }), 'no_keywords');
  // 理由が取れないときだけ、数から推し量る
  assert.equal(seoDisplayState({ autopilot_active: true, quota: { used: 5, limit: 5 }, keywords_unused: 3 }), 'quota_reached');
});

test('キーワードは2〜4語のロングテールにする', () => {
  // 「美容室」のような1語は競合が強すぎて取れない（LARUbot 側の推奨）。
  const k = initialSeoKeywords({ name: '結い庵', industry: 'beauty', city: '東京都足立区1-2-3' });
  assert.ok(k.length >= 4 && k.length <= 10, `件数が想定外: ${k.length}`);
  for (const w of k) {
    assert.ok(w.split(/\s+/).length >= 2, `1語だけの語がある: ${w}`);
    assert.ok(w.length <= 255, '255字を超えている');
  }
  assert.ok(k.some(w => w.includes('東京都足立区')), 'エリアを使っていない');
  assert.ok(k.some(w => !w.includes('東京都足立区')), 'エリア無しの語が無い');
});

test('連携の失敗を、運営に届ける', () => {
  /*
    これまでは console.error だけ。ログは誰も見ないので、
    「契約は通ったのにボットもSEOも付いていない」が起きても、
    **お客様が連絡してくるまで誰も知らない。**
    LARUbot 側からも同じ指摘を受けている。

    ⚠️ 決済の流れは変えない。止めるかどうかは別の判断で、ここではしない。
  */
  const alert = fs.readFileSync(new URL('../lib/larubot-alert.ts', import.meta.url), 'utf8');
  assert.match(alert, /process\.env\.ADMIN_EMAIL/, '運営宛てに送っていない');
  assert.match(alert, /console\.error\('\[larubot\] 連携に失敗:'/, 'メールが出せないときに記録が残らない');
  assert.doesNotMatch(alert, /throw /, '通知で例外を投げている（契約処理を巻き込む）');
  assert.match(alert, /idempotencyKey: `larubot-fail-/, '同じ失敗で何通も送りうる');

  // 4つの入口すべてから届くこと
  const callers: Array<[string, string]> = [
    ['app/api/stripe/webhook/route.ts', 'register'],
    ['app/api/stripe/checkout/route.ts', 'register'],
    ['app/api/stripe/upgrade/route.ts', 'register'],
    ['app/api/admin/users/[id]/route.ts', 'register'],
  ];
  for (const [file, kind] of callers) {
    const src = read(file);
    // 文の頭であること。`if (false) await ...` で潰されても気づけるように
    // （同じ書き方で一度、変異が素通りした）。
    assert.match(src, /^\s*await alertLarubotFailure\(\{$/m, `${file}: 失敗を届けていない、または条件で潰されている`);
    assert.match(src, new RegExp(`kind: '${kind}'`), `${file}: 種類が違う`);
  }
  // 自動運転と預かりの失敗も
  const prov = read('lib/larubot-provision.ts');
  assert.match(prov, /kind: 'autopilot'/, '自動運転の失敗を届けていない');
  assert.match(prov, /kind: 'held'/, '預かりの失敗を届けていない');
});

test('決済の流れは変えていない', () => {
  // 失敗しても契約処理は進む（既存仕様のまま）。通知を足しただけ。
  const webhook = read('app/api/stripe/webhook/route.ts');
  const at = webhook.indexOf("kind: 'register', userId, plan: plan || 'hp'");
  assert.ok(at > 0);
  const around = webhook.slice(Math.max(0, at - 500), at + 300);
  assert.match(around, /\} catch \(err\) \{/, 'try/catch の外で呼んでいる');
  assert.doesNotMatch(around, /return NextResponse\.json\([^)]*status: 5/, '失敗で決済処理を落としている');
});
