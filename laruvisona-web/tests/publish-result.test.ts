import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publishCompletion } from '../lib/publish-result.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('公開と版履歴が成功したときは通常の完了表示にする', () => {
  assert.deepEqual(publishCompletion({ versionSaved: true }, '再公開しました'), {
    message: '再公開しました',
    warning: false,
  });
});

test('公開後に版履歴だけ失敗したときは成功表示で隠さない', () => {
  assert.deepEqual(publishCompletion({
    versionSaved: false,
    warning: '公開は完了しましたが、履歴を保存できませんでした',
  }), {
    message: '公開は完了しましたが、履歴を保存できませんでした',
    warning: true,
  });
});

test('壊れた警告文でも安全な既定文を表示する', () => {
  assert.equal(publishCompletion({ versionSaved: false, warning: null }).warning, true);
  assert.match(publishCompletion({ versionSaved: false }).message, /公開は完了.*版履歴/);
});

test('すべての公開画面が版履歴の警告を共通処理へ渡す', () => {
  for (const path of [
    'app/laruHP/builder/page.tsx',
    'app/laruHP/studio/page.tsx',
    'app/laruHP/edit/page.tsx',
    'app/laruHP/seo/page.tsx',
    'app/laruHP/dashboard/DashboardClient.tsx',
  ]) {
    assert.match(read(path), /publishCompletion\(/, path);
  }
});

test('ダッシュボードはAPI失敗時に公開状態を更新しない', () => {
  const source = read('app/laruHP/dashboard/DashboardClient.tsx');
  assert.match(source, /if \(!res\.ok \|\| !data\.success\)[\s\S]*return;[\s\S]*setSites/);
  assert.match(source, /method: 'DELETE'[\s\S]*if \(!res\.ok \|\| !data\.success\)[\s\S]*return;[\s\S]*published: false/);
});
