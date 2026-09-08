// 業種ショーケース用ループ動画（Veo）の安全側の性質を固定する。
//
// 動画は画像より一桁高く、生成も遅い。事故で全業種ぶんが走ると費用がそのまま出るので、
// 「1リクエスト1業種」「既にあるなら作らない」「公開エンドポイントからは生成しない」
// の3点はテストで固定しておく。

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const { buildShowcaseVideoPrompt, videoStoragePath } = await import('../lib/veo-prompt.ts');

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const adminRoute = read('../app/api/admin/generate-video-library/route.ts');
const publicRoute = read('../app/api/library-video/route.ts');
const veoLib = read('../lib/veo.ts');
const veoPrompt = read('../lib/veo-prompt.ts');
void veoPrompt;

test('保存先は業種ごとに1本だけ（上書き前提で増殖しない）', () => {
  assert.equal(videoStoragePath('beauty'), 'videos/beauty.mp4');
  assert.equal(videoStoragePath('clinic'), 'videos/clinic.mp4');
});

test('動画プロンプトは文字を出さず、場面転換もさせない', () => {
  const p = buildShowcaseVideoPrompt('restaurant');
  assert.match(p, /No text, no letters, no logos, no watermark/);
  assert.match(p, /No cuts, no scene change/);
  assert.match(p, /steam rising gently/, '業種ごとの動きが反映されていない');
  // 業種が違えば動きも違う
  assert.notEqual(buildShowcaseVideoPrompt('legal'), p);
  // 未知の業種でも落ちない
  assert.ok(buildShowcaseVideoPrompt('unknown-industry').length > 50);
});

test('生成は1リクエストにつき1業種（一括生成の口を作らない）', () => {
  assert.match(adminRoute, /industry が必要です（1リクエストにつき1業種）/);
  assert.ok(!/for \(const ind of/.test(adminRoute), '業種ループがある＝一括生成できてしまう');
  assert.ok(!/\[\.\.\.IMAGE_INDUSTRIES\]/.test(adminRoute), '全業種を展開している');
});

test('既に生成済みなら作り直さない（overwrite 指定時のみ）', () => {
  assert.match(adminRoute, /if \(exists && !overwrite\)/);
  assert.match(adminRoute, /skipped: true/);
});

test('管理者以外は生成できない', () => {
  assert.match(adminRoute, /process\.env\.ADMIN_SECRET && bearer === process\.env\.ADMIN_SECRET/);
  assert.match(adminRoute, /adminEmails\.includes/);
  assert.match(adminRoute, /\{ error: 'Forbidden' \}, \{ status: 403 \}/);
});

test('公開エンドポイントは生成しない（画像側の自己修復方式を持ち込まない）', () => {
  assert.ok(!/generateVeoToStorage/.test(publicRoute), '公開URLから生成が走ると費用が青天井になる');
  assert.match(publicRoute, /status: 404/, '未生成時に404を返していない');
});

test('生成物は必ず自前のストレージに保存する（Google側は2日で消える）', () => {
  assert.match(veoLib, /x-goog-api-key/, '生成物のダウンロードに鍵を渡していない');
  assert.match(veoLib, /\.upload\(path, mp4, \{ contentType: 'video\/mp4', upsert: true \}\)/);
});

test('生成の待ち時間に上限がある（無限に待たない）', () => {
  assert.match(veoLib, /maxWaitMs \?\? 4 \* 60 \* 1000/);
  assert.match(veoLib, /while \(Date\.now\(\) < deadline\)/);
  assert.match(veoLib, /reason: 'timeout_or_no_uri'/);
});

test('LPショーケースの動画は条件が揃った時だけ読み込む', () => {
  const lp = read('../app/laruHP/page.tsx');
  assert.match(lp, /function ShowcaseHeroMedia/, '静止画＋動画の切り替えコンポーネントが無い');
  assert.match(lp, /prefers-reduced-motion: reduce/);
  assert.match(lp, /min-width: 768px/, 'スマホにも動画を読ませてしまう');
  assert.match(lp, /new IntersectionObserver/, '画面外でも読み込んでしまう');
  assert.match(lp, /preload="none"/);
  // 静止画は常に背景として残る＝動画が無い/失敗しても絵が消えない
  assert.match(lp, /backgroundImage: `url\(\$\{libHero\(industry\)\}\)`/);
  assert.ok(!/\{libHero\('\w+'\) && <div className="absolute inset-0 z-\[1\] bg-cover/.test(lp),
    '差し替え漏れのショーケースがある');
});

test('動画は自社LP専用で、顧客サイト生成には使わない', () => {
  const adminUi = read('../app/admin/page.tsx');
  assert.match(adminRoute, /顧客サイトの生成では使わない/);
  assert.match(adminUi, /顧客サイトには使いません/);
  const siteImages = read('../app/api/library-image/route.ts');
  assert.ok(!/veo|library-video/i.test(siteImages), '顧客向けの画像経路に動画が混ざっている');
});

// ── LPファーストビューの背景映像 ────────────────────────────────
const lpSrc = read('../app/laruHP/page.tsx');
const publicRoute2 = read('../app/api/library-video/route.ts');

// HeroBackgroundVideo 本体だけを切り出す（後ろに続く LoopVideo は含めない）
const heroComp = lpSrc.slice(lpSrc.indexOf('function HeroBackgroundVideo'), lpSrc.indexOf('// 背景ループ映像の共通部品'));
// 実際に <video> を描いている共通部品
const loopComp = lpSrc.slice(lpSrc.indexOf('function LoopVideo'), lpSrc.indexOf('// ショーケースのヒーロー領域'));

test('ヒーロー映像は先頭の描画を邪魔しない', () => {
  assert.match(heroComp, /document\.readyState === 'complete'/, '描画完了を待たずに読み込んでいる');
  assert.match(heroComp, /addEventListener\('load', start/, 'load を待っていない');
});

test('背景ループ映像は preload="none" にしない（本番で再生されなくなる）', () => {
  // Chrome は preload="none" を尊重して1バイトも読まないため、autoPlay が
  // あっても readyState が 0 のまま止まり、canplay が来ず永久に opacity:0 に
  // なる。本番のLPで実際にこれが起きていた。
  // ここに来る時点で「動きを減らす設定でない・省データでない・2gでない・
  // 動画が存在する」ことは確認済みなので preload は auto でよい。
  assert.equal(/preload="none"/.test(loopComp), false, 'preload="none" だと読み込みが始まらない');
  assert.match(loopComp, /preload="auto"/);
  assert.match(loopComp, /\.play\(\)/, 'autoPlay 属性だけに頼らず play() も呼ぶこと');
  assert.match(loopComp, /catch\(/, 'play() が拒否されたときに握りつぶすこと');
  assert.match(loopComp, /el\.muted = true/, 'ミュートを属性だけに頼らないこと');
});

test('タブが裏のときは再生しない（読み込みが止まるため）', () => {
  // ブラウザは非表示タブの映像読み込みを止めるので、その状態で play() を
  // 呼んでも readyState 0 のまま進まない。見えているときだけ再生し、
  // 隠れたら止める。通信量とバッテリーの節約にもなる。
  assert.match(loopComp, /document\.visibilityState !== 'visible'/);
  assert.match(loopComp, /addEventListener\('visibilitychange'/);
  assert.match(loopComp, /el\.pause\(\)/);
  assert.match(loopComp, /removeEventListener\('visibilitychange'/, '後片付けをしていない');
});

test('表示の合図は canplay だけに頼らない', () => {
  assert.match(loopComp, /onLoadedData=\{onReady\}/);
  assert.match(loopComp, /onPlaying=\{onReady\}/);
  assert.match(loopComp, /onCanPlay=\{onReady\}/);
});

test('動きを減らす設定・通信量節約・低速回線では読まない', () => {
  const comp = heroComp;
  assert.match(comp, /prefers-reduced-motion: reduce/);
  assert.match(comp, /conn\?\.saveData/);
  assert.match(comp, /2g\$\/\.test\(conn\.effectiveType\)/);
});

test('映像が無くても失敗しても、絵は消えない', () => {
  assert.match(heroComp, /if \(!src\) return null;/, '取得できないときに何か描いてしまう');
  assert.match(heroComp, /onFail=\{\(\) => setSrc\(null\)\}/, '再生失敗で黒い箱が残る');
  assert.match(loopComp, /onError=\{onFail\}/, '再生失敗が上に伝わっていない');
});

test('見出しの可読性を映像より優先する', () => {
  const comp = heroComp;
  assert.match(comp, /opacity-30/, '映像が濃すぎて文字が読みにくい');
  assert.match(comp, /bg-gradient-to-b from-sky-50\//, '文字を守る膜が無い');
  assert.match(comp, /aria-hidden="true"/, '装飾が読み上げ対象になっている');
});

test('ヒーロー映像も公開側では生成しない', () => {
  assert.ok(!/generateVeo/.test(publicRoute2));
  assert.match(publicRoute2, /target === 'lp-hero'/);
});
