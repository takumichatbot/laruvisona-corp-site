import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { popupButtonUrl, popupScript, sanitizePopup } from '../lib/popup-contract';

const valid = {
  id: 'offer-1', title: 'ご案内', body: '本文', buttonText: '見る', buttonUrl: '#contact',
  trigger: 'timer', triggerValue: 10, bgColor: '#112233', textColor: '#ffffff',
  enabled: true, maxShows: 2, hideForDays: 7,
};

test('危険なリンクを公開ボタンへ渡さない', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '//evil.example/x', 'http://example.com']) {
    assert.equal(popupButtonUrl(url), '#');
  }
  for (const url of ['#contact', '/shop', 'https://example.com/x', 'mailto:a@example.com', 'tel:0312345678']) {
    assert.equal(popupButtonUrl(url), url);
  }
});

test('公開設定を型・長さ・範囲で正規化する', () => {
  assert.equal(sanitizePopup({ ...valid, enabled: false }), null);
  assert.equal(sanitizePopup({ ...valid, id: '' }), null);
  const value = sanitizePopup({ ...valid, triggerValue: 1000, maxShows: -1, hideForDays: 999, bgColor: 'red' })!;
  assert.equal(value.triggerValue, 10);
  assert.equal(value.maxShows, 0);
  assert.equal(value.hideForDays, 7);
  assert.equal(value.bgColor, '#0c1a3a');
});

test('生成スクリプトは内容で抜けず、サイト別回数・休止・複数トリガ・ダイアログ操作を持つ', () => {
  const popup = sanitizePopup({ ...valid, title: '</script><script>alert(1)</script>' })!;
  const script = popupScript('site-a', [popup]);
  assert.doesNotThrow(() => new Function(script));
  assert.doesNotMatch(script, /<\/script>/);
  assert.match(script, /DATA\.siteId/);
  assert.match(script, /p\.maxShows/);
  assert.match(script, /p\.hideForDays/);
  assert.match(script, /DATA\.popups\.filter\(eligible\)\.forEach/);
  assert.match(script, /aria-modal/);
  assert.match(script, /e\.key==='Escape'/);
  assert.match(script, /previous\.focus/);
});

test('公開APIは公開済みサイトだけを解決し、DB失敗を空設定にしない', () => {
  const route = fs.readFileSync(new URL('../app/api/popup/route.ts', import.meta.url), 'utf8');
  assert.match(route, /\.eq\('published', true\)/);
  assert.match(route, /if \(siteResult\.error\)|if \(result\.error\)/);
  assert.match(route, /javascript\('\/\/ Temporarily unavailable', 503\)/);
  assert.match(route, /sanitizePopup/);
});

test('管理画面は未保存の変更を成功時だけ反映し、手動埋め込みを案内しない', () => {
  const page = fs.readFileSync(new URL('../app/laruHP/popups/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /if \(await savePopups\(next\)\) setForm/);
  assert.match(page, /setSites\(prev => prev\.map/);
  assert.doesNotMatch(page, /タグをコピー|カスタムHTML/);
  assert.doesNotMatch(page, /⚠|💬/u);
});
