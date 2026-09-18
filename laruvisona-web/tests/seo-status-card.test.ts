import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  seoDisplayState, SEO_STATE_LABEL, seoNextAction, seoPublishedCount, seoQuota,
  formatSeoDateTime, formatSeoDate,
} from '../lib/larubot-seo';

/**
 * 「公開済み」は現在の状態ではなく履歴だった。
 *
 * 2026-09-18まで、記事が1本でもあると判定の先頭で「公開済み」が勝っていた。
 * 枠が切れても、キーワードが尽きても、生成が失敗していても「公開済み」のまま。
 * **いま何が起きているかを隠していた。**
 */

const base = {
  autopilot_active: true,
  keywords_unused: 2,
  keywords_total: 5,
  articles: { published: 3, draft: 0, wp_synced: 0 },
  quota: { used: 1, limit: 5, resets_at: '2026-10-01T00:00:00+00:00' },
  next_run_at: '2026-09-24T05:07:00+09:00',
  last_result: null as string | null,
};

test('記事が公開済みでも、いまの状態が隠れない', () => {
  // 過去に3本公開していても、いま起きていることが前に出る
  assert.equal(seoDisplayState({ ...base, last_result: 'failed' }), 'failed');
  assert.equal(seoDisplayState({ ...base, last_result: 'draft' }), 'draft');
  assert.equal(seoDisplayState({ ...base, autopilot_active: false }), 'stopped');
  assert.equal(seoDisplayState({ ...base, quota: { used: 5, limit: 5 } }), 'quota_reached');
  assert.equal(seoDisplayState({ ...base, keywords_unused: 0 }), 'no_keywords');
});

test('「公開済み」は状態として返らない', () => {
  const states = [
    seoDisplayState({ ...base, last_result: 'published' }),
    seoDisplayState({ ...base, articles: { published: 99 } }),
    seoDisplayState(base),
  ];
  for (const s of states) assert.notEqual(s, 'published');
  assert.ok(!Object.keys(SEO_STATE_LABEL).includes('published'), 'ラベルに残っている');
});

test('状態の並びは、失敗・下書き・停止・枠切れ・キーワード不足の順で強い', () => {
  // 全部同時に起きていても、いちばん手を打つべきものが出る
  const all = { ...base, last_result: 'failed', autopilot_active: false,
    quota: { used: 5, limit: 5 }, keywords_unused: 0 };
  assert.equal(seoDisplayState(all), 'failed');
  assert.equal(seoDisplayState({ ...all, last_result: 'draft' }), 'draft');
  assert.equal(seoDisplayState({ ...all, last_result: null }), 'stopped');
  assert.equal(seoDisplayState({ ...all, last_result: null, autopilot_active: true }), 'quota_reached');
});

test('公開本数は履歴として別に取れる', () => {
  assert.equal(seoPublishedCount(base), 3);
  assert.equal(seoPublishedCount({ articles: {} }), 0);
  assert.equal(seoPublishedCount(null), 0);
  assert.equal(seoPublishedCount({ articles: { published: 'x' } }), 0);
});

test('今月の枠は、数で取れないときは出さない', () => {
  assert.deepEqual(seoQuota(base), { used: 1, limit: 5 });
  assert.equal(seoQuota({ quota: { used: 1 } }), null);
  assert.equal(seoQuota(null), null);
});

test('日時は読めないときに空で返す（Invalid Date を画面に出さない）', () => {
  assert.equal(formatSeoDateTime('こわれた値'), '');
  assert.equal(formatSeoDateTime(null), '');
  assert.equal(formatSeoDateTime(12345), '');
  assert.equal(formatSeoDate('こわれた値'), '');
  assert.ok(formatSeoDateTime('2026-09-24T05:07:00+09:00').length > 0);
});

/**
 * 次の一手。顧客が読んで、次にすることが決まる言い方にする。
 */

test('状態ごとに、次にすることが1行で出る', () => {
  for (const s of ['waiting', 'no_keywords', 'quota_reached', 'stopped', 'failed', 'draft'] as const) {
    const a = seoNextAction(s, base);
    assert.ok(a.length > 0, `${s} の文言が無い`);
  }
  assert.match(seoNextAction('no_keywords', base), /キーワードを追加/);
  assert.match(seoNextAction('quota_reached', base), /10月1日/);
});

test('LARUbot が返した失敗理由を、そのまま顧客に見せない', () => {
  const nasty = {
    ...base,
    last_result: 'failed',
    last_error: {
      message: 'Traceback (most recent call last): File "/app/seo.py", line 88 '
        + 'openai.AuthenticationError sk-proj-XXXXXXXXXXXX https://internal.larubot.tokyo/debug',
    },
  };
  const text = seoNextAction(seoDisplayState(nasty), nasty);
  for (const leak of ['Traceback', '/app/', 'sk-proj', 'internal.larubot', 'AuthenticationError', 'line 88']) {
    assert.ok(!text.includes(leak), `${leak} が顧客向けの文言に混ざっている`);
  }
  assert.match(text, /ご連絡ください/);
});

test('カードが last_error を一切参照していない', () => {
  const card = readFileSync('components/SeoStatusCard.tsx', 'utf8');
  assert.ok(!/last_error/.test(card), 'カードが失敗理由を直接読んでいる');
  const lib = readFileSync('lib/larubot-seo.ts', 'utf8');
  const fn = lib.slice(lib.indexOf('export function seoNextAction'), lib.indexOf('export function formatSeoDateTime'));
  assert.ok(!/last_error/.test(fn), '文言づくりが失敗理由を読んでいる');
});

/** 置き場所と、未連携の人への配慮 */

test('SEO設定の画面に、サイト選択の直下で入っている', () => {
  const page = readFileSync('app/laruHP/seo/page.tsx', 'utf8');
  assert.match(page, /<SeoStatusCard siteId=\{selectedSite\?\.id \?\? null\} \/>/, 'カードを置いていない');
  const sel = page.indexOf('handleSiteChange(e.target.value)');
  const card = page.indexOf('<SeoStatusCard');
  assert.ok(sel > 0 && card > sel, 'サイト選択より前に置いている');
});

test('未連携・未契約の人には何も出さない', () => {
  const card = readFileSync('components/SeoStatusCard.tsx', 'utf8');
  assert.match(card, /if \(failed \|\| !status \|\| !status\.linked\) return null;/,
    '未連携でもカードを出している');
});

test('届かなかったときに「0本」と言わない', () => {
  const card = readFileSync('components/SeoStatusCard.tsx', 'utf8');
  assert.match(card, /status\.reachable === false/, '届かなかった場合を分けていない');
  assert.match(card, /確認できませんでした/);
});

test('開くたびに1回だけ聞く（ポーリングしない）', () => {
  const card = readFileSync('components/SeoStatusCard.tsx', 'utf8');
  assert.ok(!/setInterval|setTimeout/.test(card), '繰り返し聞いている');
  assert.match(card, /\}, \[siteId\]\);/, 'サイトごとに1回の作りになっていない');
});

test('新しいAPI・テーブル・cron を作っていない', () => {
  const card = readFileSync('components/SeoStatusCard.tsx', 'utf8');
  const urls = [...card.matchAll(/fetch\(`?([^`'")]+)/g)].map(m => m[1]);
  assert.deepEqual(urls, ['/api/sites/${siteId}/seo-status'], `想定外の問い合わせ先: ${urls.join(', ')}`);
});
