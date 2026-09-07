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
