import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * 「毎週AIがSEO記事を自動公開」と売っているのに、記事が0件だった。
 *
 * 原因は一本道ではなく、3つが重なっていた。どれも黙って起きる。
 *
 * ── 1. 契約したときの識別子が、どこにも残らず消えていた ──
 *
 * 料金ページから契約すると、Stripe の metadata の site_id は空文字になる。
 * まだサイトを作っていないのだから当然。webhook はそれを渡すので、
 * linkLarubotIds は「その人の全サイト」を探す経路に入り、
 * **0件なので return して終わる。**
 *
 * LARUbot 側の応答に入っていた public_id は、そこで**どこにも残らない。**
 * 例外にもならず、ログも1行も出ない。画面は「契約済み」のまま。
 * あとから再登録する経路も無い。
 *
 * 「契約 → サイト作成」は標準の導線。**普通に契約した人が、この道を通る。**
 *
 * ── 2. 制作スタジオが、売っている機能を既定で切っていた ──
 *
 * 初期設定が laruseo: false で、新規作成のPOSTにそのまま乗る。
 * DBの既定値（"laruseo":true）が上書きされる。
 * 公開HTMLの判定は laruseo が真のときだけなので、識別子が正しく入っていても
 * **設置タグが1つも出ない。** しかも未連携のお知らせは laruseo が真のときだけ
 * 出るので、**まさにこの状態では警告すら出ない。**
 *
 * ── 3. 設置タグが、二重に動いていた ──
 *
 * 公開HTMLと配信するページの両方が同じタグを出していた。
 * 公開HTMLの中の script は配信時に本物へ作り直して実行されるので、両方動く。
 * 記事一覧が二重に描かれる。判定も食い違っていて、チャットの識別子しか
 * 入っていない人にはページ側から何も出ず、逆にLARUSEOを切っても出続けた。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('サイトがまだ無いときは、識別子を預かる', () => {
  const src = read('lib/larubot-provision.ts');
  const at = src.indexOf('if (!sites?.length)');
  assert.ok(at > 0, '0件のときの分岐が無い');
  const branch = src.slice(at, at + 700);
  assert.match(branch, /pending_larubot_public_id: publicId/, '預けていない');
  assert.match(branch, /pending_laruseo_public_id: seoPublicId/, '預けていない');
  // 黙って捨てる道が残っていないこと
  assert.doesNotMatch(branch, /^\s*if \(!sites\?\.length\) return;/m, '黙って捨てている');
});

test('預けられなかったら、記録に残す', () => {
  // 列がまだ無い状態（SQL未実行）も、ここで分かる。
  const src = read('lib/larubot-provision.ts');
  assert.match(src, /console\.error\('\[larubot\] public ids not held for later:'/);
});

test('最初のサイトを作るときに、預けた識別子を移す', () => {
  const src = read('app/api/sites/route.ts');
  assert.match(src, /pending_larubot_public_id, pending_laruseo_public_id/, '預けた分を読んでいない');
  assert.match(src, /larubotPublicId: bot, larubot: true/);
  assert.match(src, /laruseoPublicId: seoId, laruseo: true/);
  // 移したら空にする（残すと2件目のサイトにも同じ識別子が入る）
  assert.match(src, /pending_larubot_public_id: null, pending_laruseo_public_id: null/);
});

test('移せなくても、サイトの作成は成功として返す', () => {
  // サイトはもう出来ている。ここで失敗を返すと「作れなかった」と思わせる。
  const src = read('app/api/sites/route.ts');
  const at = src.indexOf('pending_larubot_public_id, pending_laruseo_public_id');
  // 窓の広さは、あいだに処理を足すと足りなくなる。囲いと記録の両方が
  // 入る所までを見る（2026-09-18、自動運転の依頼を足したときに足りなくなった）。
  const around = src.slice(Math.max(0, at - 400), at + 2600);
  assert.match(around, /try \{/, '投げうる処理を囲っていない');
  assert.match(around, /console\.error\('\[larubot\] held public ids not applied/, '黙っている');
});

test('制作スタジオが、売っている機能を既定で切らない', () => {
  const src = read('app/laruHP/studio/page.tsx');
  assert.match(src, /larubot: true, laruseo: true, notifyEmail: ''/, '既定で切っている');
  assert.doesNotMatch(src, /larubot: false, laruseo: false, notifyEmail: ''/, '古い既定が残っている');
});

test('設置タグを出すのは、配信するページだけ', () => {
  // 両方が出すと、記事一覧が二重に描かれる。
  const exporter = read('lib/html-export.ts');
  assert.match(exporter, /const laruBotScript = '';/, '公開HTMLがまだ出している');
  assert.match(exporter, /const laruSeoScript = '';/, '公開HTMLがまだ出している');
  assert.doesNotMatch(exporter, /larubot\.tokyo\/embed\/blog\.js"/, '焼き込みが残っている');
  assert.doesNotMatch(exporter, /larubot\.tokyo\/static\/embed\.js"/, '焼き込みが残っている');
});

test('配信するページの判定が、書き出し側と同じ規則になっている', () => {
  const page = read('app/hp/[slug]/page.tsx');
  // 片方が空なら、もう片方から補う
  assert.match(page, /chatPublicId\(settings\)/, '補う規則を使っていない');
  assert.match(page, /blogPublicId\(settings\)/, '補う規則を使っていない');
  // 入切を見る（切にしても出し続けていた）
  assert.match(page, /settings\.larubot === false \? '' :/);
  assert.match(page, /settings\.laruseo === false \? '' :/);
  // 生の値を直に見る古い形が残っていないこと
  assert.doesNotMatch(page, /\{laruseoPublicId && \(/, '古い判定が残っている');
});

test('公開済みHTMLに焼き込まれた古いタグを、配信時に落とす', () => {
  // この直しより前に公開した人は、公開し直すまで焼き込みが残る。
  // 待たずに二重を止める。larubot の2本だけを名指しし、他の script には触らない。
  const page = read('app/hp/[slug]/page.tsx');
  assert.match(page, /withoutBakedEmbeds/);
  assert.match(page, /larubot\\\.tokyo\\\/\(\?:static\\\/embed\|embed\\\/blog\)\\\.js/);
});
