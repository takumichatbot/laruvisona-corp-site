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

// 実際に <video> を描いている共通部品（業種ショーケースが使う）
const loopComp = lpSrc.slice(lpSrc.indexOf('function LoopVideo'), lpSrc.indexOf('// ショーケースのヒーロー領域'));

// ── LPのファーストビューには映像を敷かない ────────────────────
// Veoで作った lp-hero.mp4 は「開店前の無人の店内」で、業種ショーケース用の
// 6本と同じジャンルだった。「HPを作るサービス」のファーストビューで
// 「お客さんのお店」を流しても、商品の説明にならない。3Dを外したのと
// 同じ理由で外している。素材と配信経路は残してあるので復帰は数行。
test('LPのファーストビューに背景映像を敷かない', () => {
  assert.equal(/HeroBackgroundVideo/.test(lpSrc), false, 'ヒーロー映像が戻っている');
  // コメント中の説明は許す。実際に取りに行く文字列リテラルが無いことを見る
  assert.equal(/['\`"][^'\`"\n]*library-video\?target=lp-hero/.test(lpSrc), false,
    'LPからLP用動画を読みに行っている');
});

test('業種ショーケース側の映像は残す（あちらは意味が合っている）', () => {
  assert.match(lpSrc, /function ShowcaseHeroMedia/);
  assert.match(lpSrc, /\/api\/library-video\?industry=/);
  assert.match(lpSrc, /<LoopVideo/);
});

test('LP用動画の素材と配信経路は残す（内容を決め直したら戻せるように）', () => {
  assert.match(read('../lib/veo-prompt.ts'), /HERO_VIDEO_PATH = 'videos\/lp-hero\.mp4'/);
  assert.match(publicRoute2, /target === 'lp-hero'/);
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

// ショーケース側（業種別の映像）の条件。ここは残っている。
const showComp = lpSrc.slice(lpSrc.indexOf('function ShowcaseHeroMedia'), lpSrc.indexOf('export default function LaruHPLandingPage'));

test('ショーケース映像は動きを減らす設定・スマホでは読まない', () => {
  assert.match(showComp, /prefers-reduced-motion: reduce/);
  assert.match(showComp, /min-width: 768px/, 'スマホに通信量を使わせない条件が無い');
  assert.match(showComp, /IntersectionObserver/, '画面に入る前から読み込んでいる');
});

test('映像が取れなくても静止画は消えない', () => {
  assert.match(showComp, /backgroundImage: `url\(\$\{libHero\(industry\)\}\)`/, '下地の静止画が無い');
  assert.match(showComp, /onFail=\{\(\) => setVideoSrc\(null\)\}/, '再生失敗で黒い箱が残る');
  assert.match(loopComp, /onError=\{onFail\}/, '再生失敗が上に伝わっていない');
});

test('ヒーロー映像も公開側では生成しない', () => {
  assert.ok(!/generateVeo/.test(publicRoute2));
  assert.match(publicRoute2, /target === 'lp-hero'/);
});

// ── LPファーストビュー映像の候補（3案から選ぶ） ──────────────────
test('候補は3案あり、それぞれ別ファイルに保存される', async () => {
  const m = await import('../lib/veo-prompt.ts');
  const keys = Object.keys(m.HERO_VARIANTS);
  assert.deepEqual(keys.sort(), ['blueprint', 'glass', 'paper']);
  for (const k of keys) {
    assert.equal(m.heroVariantPath(k as never), `videos/lp-hero-${k}.mp4`);
  }
  // 決定版とは別枠。候補を作っても本番の1本は上書きされない
  assert.notEqual(m.heroVariantPath('paper' as never), m.HERO_VIDEO_PATH);
});

test('どの案も「浮いているだけ」ではなく組み上がる動きを持つ', async () => {
  const m = await import('../lib/veo-prompt.ts');
  // 3Dの浮遊オブジェクトを外したのと同じ失敗を繰り返さないための固定。
  const assembly = /(settle|align|form|stack|layer|meet|draw themselves|into place)/i;
  for (const k of Object.keys(m.HERO_VARIANTS)) {
    const p = m.buildHeroVariantPrompt(k as never);
    assert.match(p, assembly, `${k}: 整列・構築の動きが指示されていない`);
  }
});

test('どの案も文字・UI・人・暗部を禁止している', async () => {
  const m = await import('../lib/veo-prompt.ts');
  for (const k of Object.keys(m.HERO_VARIANTS)) {
    const p = m.buildHeroVariantPrompt(k as never);
    // Veoは読める文字やUIを描けない。頼むと崩れた偽の文字になる
    assert.match(p, /No text, no letters/, `${k}: 文字禁止が無い`);
    assert.match(p, /no user interface/, `${k}: UI禁止が無い`);
    assert.match(p, /No people, no faces/, `${k}: 人物禁止が無い`);
    // 見出しは濃い色。映像に暗部があると文字が読みにくくなる
    assert.match(p, /Nothing dark/, `${k}: 暗部の禁止が無い`);
    assert.match(p, /High-key/, `${k}: 高キー指定が無い`);
  }
});

test('未知のvariantは受け付けない', async () => {
  const m = await import('../lib/veo-prompt.ts');
  assert.equal(m.isHeroVariant('paper'), true);
  assert.equal(m.isHeroVariant('__proto__'), false, 'プロトタイプ汚染で通らないこと');
  assert.equal(m.isHeroVariant('toString'), false);
  assert.equal(m.isHeroVariant('shop'), false);
});

test('候補の一覧と採用は生成を伴わない（叩いても費用が出ない）', () => {
  const listBlock = adminRoute.slice(adminRoute.indexOf("action === 'list-hero-variants'"), adminRoute.indexOf("action === 'promote-hero'"));
  assert.equal(/generateVeoToStorage/.test(listBlock), false, '一覧で生成している');
  const promoteBlock = adminRoute.slice(adminRoute.indexOf("action === 'promote-hero'"), adminRoute.indexOf("if (target === 'lp-hero')"));
  assert.equal(/generateVeoToStorage/.test(promoteBlock), false, '採用で生成し直している');
  assert.match(promoteBlock, /\.copy\(from, HERO_VIDEO_PATH\)/, 'ストレージ内コピーで済ませていない');
});

test('候補の生成は決定版を上書きしない', () => {
  const heroBlock = adminRoute.slice(adminRoute.indexOf("if (target === 'lp-hero')"));
  assert.match(heroBlock, /const path = variant \? heroVariantPath\(variant\) : HERO_VIDEO_PATH;/);
  assert.match(heroBlock, /!isHeroVariant\(variant\)/, 'variantの検証が無い');
});

// ── 候補を見比べる管理者ページ ──────────────────────────────────
const preview = read('../app/laruHP/hero-preview/page.tsx');

test('見比べページは本番と同じ条件で重ねて見せる', () => {
  // 動画を単体で開いても、見出しの可読性は判断できない。
  // 前回はそこを確かめずに1本に決めて、趣旨と違う映像を本番に載せた。
  assert.match(preview, /最短5分で。/, '実際の見出しを再現していない');
  assert.match(preview, /bg-gradient-to-b from-sky-50\//, '本番と同じ膜が無い');
  assert.match(preview, /radial-gradient\(ellipse_at_top/, '本番と同じ下地が無い');
  assert.match(preview, /opacity: opacity \/ 100/, '濃さを変えて限界を探れない');
});

test('見比べページは管理者以外に何も見せない', () => {
  assert.match(preview, /r\.status === 403/);
  assert.match(preview, /if \(denied\)/);
  assert.equal(/lp-hero-(paper|glass|blueprint)\.mp4/.test(preview), false,
    '候補URLをページに直書きしている（管理APIから受け取ること）');
});

test('見比べページ自体は動画を生成しない', () => {
  assert.equal(/target: *'lp-hero'/.test(preview), false, 'ページから生成できてしまう');
  assert.match(preview, /action: 'list-hero-variants'/);
  assert.match(preview, /action: 'promote-hero'/);
});
