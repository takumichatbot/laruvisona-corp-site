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

test('案内ページは動画を読み込まない', () => {
  // 以前は業種ショーケースと背景で動画を配っていた。作り直した案内ページは
  // 動画を使わない。素材と配信経路（/api/library-video）は残してある。
  const lp = read('../app/laruHP/page.tsx');
  assert.equal(/<video|library-video|\.mp4/.test(lp), false, '案内ページに動画が戻っている');
});

test('動画は自社LP専用で、顧客サイト生成には使わない', () => {
  const adminUi = read('../app/admin/page.tsx');
  assert.match(adminRoute, /顧客サイトの生成では使わない/);
  assert.match(adminUi, /顧客サイトには使いません/);
  const siteImages = read('../app/api/library-image/route.ts');
  assert.ok(!/veo|library-video/i.test(siteImages), '顧客向けの画像経路に動画が混ざっている');
});

/* ── 案内ページから動画を外した ──────────────────────────────────
   作り直した /laruHP は動画を使わない。以前ここにあった条件
   （静止画が先／動きを減らす設定では読まない／画面に入ってから読む／
     止める手段がある／タブが裏では再生しない）は、動画が実際に置かれる場所
   ＝顧客サイトのヒーローへ移した。tests/published-html.test.ts の
   「動きのあるヒーローは、写真を先に出して動画をあとから重ねる」を参照。
   素材と配信経路（lib/veo-prompt.ts / /api/library-video）は残してある。 */

test('LP用動画の素材と配信経路は残す（内容を決め直したら戻せるように）', () => {
  assert.match(read('../lib/veo-prompt.ts'), /HERO_VIDEO_PATH = 'videos\/lp-hero\.mp4'/);
  assert.match(publicRoute, /target === 'lp-hero'/);
});

test('ヒーロー映像も公開側では生成しない', () => {
  assert.ok(!/generateVeo/.test(publicRoute));
  assert.match(publicRoute, /target === 'lp-hero'/);
});

// ── LPファーストビュー映像の候補（3案から選ぶ） ──────────────────
test('候補はそれぞれ別ファイルに保存される', async () => {
  const m = await import('../lib/veo-prompt.ts');
  const keys = Object.keys(m.HERO_VARIANTS);
  assert.deepEqual(keys.sort(), ['blueprint', 'build', 'desk', 'glass', 'paper']);
  for (const k of keys) {
    assert.equal(m.heroVariantPath(k as never), `videos/lp-hero-${k}.mp4`);
  }
  // 決定版とは別枠。候補を作っても本番の1本は上書きされない
  assert.notEqual(m.heroVariantPath('paper' as never), m.HERO_VIDEO_PATH);
});

test('どの案も「浮いているだけ」で終わらない', async () => {
  const m = await import('../lib/veo-prompt.ts');
  // 3Dの浮遊オブジェクトを外したのと同じ失敗を繰り返さないための固定。
  // 満たし方は2通りある:
  //   組み上がる動きがある（paper / blueprint / glass / build）か、
  //   商品そのもの＝完成したサイトが写っている（desk）か。
  // どちらも無いものは、意味のない抽象なので通さない。
  const assembly = /(settle|align|form|stack|layer|meet|draw themselves|into place|builds itself)/i;
  const product = /(website|web page|layout on both|the page)/i;
  for (const k of Object.keys(m.HERO_VARIANTS)) {
    const p = m.buildHeroVariantPrompt(k as never);
    assert.ok(assembly.test(p) || product.test(p),
      `${k}: 組み上がる動きも、完成した商品の姿も無い。ただの抽象になっている`);
  }
});

test('禁止するのは文字・UI・人・カット割りの4つだけ', async () => {
  const m = await import('../lib/veo-prompt.ts');
  for (const k of Object.keys(m.HERO_VARIANTS)) {
    const p = m.buildHeroVariantPrompt(k as never);
    // Veoは読める文字やUIを描けない。頼むと崩れた偽の文字になる
    assert.match(p, /No text, no letters/, `${k}: 文字禁止が無い`);
    // 画面を写す案（build/desk）はUIが主役なので、代わりに
    // 「文字は最後まで解像しない」ことを条件として書き込む
    if (k === 'build' || k === 'desk') {
      assert.match(p, /never resolves into readable text/, `${k}: 文字が解像しない指定が無い`);
      assert.match(p, /unreadable by design/, `${k}: 崩れた偽文字への備えが無い`);
    } else {
      assert.match(p, /No user interface/, `${k}: UI禁止が無い`);
    }
    // 人は視線を持っていくし、安全フィルタにも落ちやすい
    assert.match(p, /No people, no faces/, `${k}: 人物禁止が無い`);
    // カットが割れるとループにならない
    assert.match(p, /One continuous take/, `${k}: 1カット指定が無い`);
  }
});

test('映像を退屈にする指示を入れない', async () => {
  const m = await import('../lib/veo-prompt.ts');
  // 最初の版は「暗部を作るな」「情景を変えるな」「カメラを止めろ」と
  // 映画的な質感を作る要素を全部潰していた。結果、平坦で安い絵しか出なかった。
  // 可読性は映像ではなくCSS（不透明度・膜・ぼかし・彩度）で解く。
  const banned = [/Nothing dark/, /no heavy shadows/, /no vignette/, /The scene never changes/, /almost still/, /locked off/];
  for (const k of Object.keys(m.HERO_VARIANTS)) {
    const p = m.buildHeroVariantPrompt(k as never);
    for (const b of banned) {
      assert.equal(b.test(p), false, `${k}: 「${b.source}」が残っている。映像の自由を奪う指示`);
    }
  }
});

test('どの案にも撮影の指示が入っている（これが「映画みたい」の実体）', async () => {
  const m = await import('../lib/veo-prompt.ts');
  for (const k of Object.keys(m.HERO_VARIANTS)) {
    const p = m.buildHeroVariantPrompt(k as never);
    assert.match(p, /shallow depth of field/i, `${k}: 被写界深度の指示が無い`);
    assert.match(p, /motion blur/i, `${k}: モーションブラーの指示が無い`);
    assert.match(p, /Volumetric light/i, `${k}: 空気中の光の指示が無い`);
    assert.match(p, /Camera: /, `${k}: カメラワークの指示が無い`);
    assert.match(p, /texture/i, `${k}: 素材の質感の指示が無い`);
  }
});

test('可読性はCSS側で調整できる', () => {
  const preview = read('../app/laruHP/hero-preview/page.tsx');
  assert.match(preview, /setBlur/, 'ぼかしで調整できない');
  assert.match(preview, /setGray/, '彩度で調整できない');
  assert.match(preview, /blur\(\$\{blur\}px\) grayscale\(\$\{gray\}%\)/);
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

// ── 解像度 ──────────────────────────────────────────────────────
// 指定しないと Veo は 720p を返す。LPのファーストビューは横幅いっぱいに
// 引き伸ばすので、細い線やグラデーションの粗が出る。既定を1080pにする。
const veoSrc = read('../lib/veo.ts');

test('解像度を指定しないまま投げない（既定1080p）', () => {
  assert.match(veoSrc, /const wantResolution = opts\.resolution \|\| '1080p';/);
  assert.match(veoSrc, /resolution: wantResolution/);
});

test('解像度が拒否されたら指定を外して作り直す', () => {
  // モデルやプランによっては resolution を受け付けない。
  // そこで諦めるのではなく、720pで1本作ることを優先する。
  assert.match(veoSrc, /\/resolution\/i\.test\(body\)/);
  assert.match(veoSrc, /startOnce\(true, false\)/);
});

test('実際に使われた解像度を呼び出し元に返す', () => {
  // 「1080pのつもりが720pだった」を黙って通さないため
  assert.match(veoSrc, /usedResolution/);
  assert.match(adminRoute, /resolution: r\.usedResolution/);
});
