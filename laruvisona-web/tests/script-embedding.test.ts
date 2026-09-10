// 「文字」として渡したものが、HTMLの中で「札」になってしまわないこと。
//
// JSON.stringify は JavaScript の文字列としては正しいものを返すが、
// HTMLの <script> は中身の JavaScript を見ていない。</script> という並びが
// 出た時点でそこが終わりになる。だから JSON.stringify だけでは、
// 入力欄に </script><script>… と書くだけで新しいスクリプトを置ける。
//
// ここでは「入力を入れても、script と style の札の数が増えない」ことを見る。
// 数が増えないなら、入力は札の外に出ていない。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exportToHTML } from '../lib/html-export';
import { jsonForScript, safeStyleText, safeToken, safeCssColor } from '../lib/safe-markup';

/** 札を閉じて外へ出ようとする入力。無害な印を付けるだけ */
const BREAKOUT = '</script><script>parent.__laruProbe=1</script>';
const STYLE_BREAKOUT = '</style><script>parent.__laruProbe=1</script>';

function tagCounts(html: string) {
  return {
    scriptOpen: (html.match(/<script\b/gi) || []).length,
    scriptClose: (html.match(/<\/script\s*>/gi) || []).length,
    styleOpen: (html.match(/<style\b/gi) || []).length,
    styleClose: (html.match(/<\/style\s*>/gi) || []).length,
  };
}

type Blk = { id: string; type: string; data: Record<string, unknown> };
function build(blocks: Blk[], settings: Record<string, unknown> = {}, seo: Record<string, unknown> = {}, bi: Record<string, unknown> = {}) {
  return exportToHTML(
    [{ id: 'p1', name: 'top', path: '/', blocks } as never],
    seo as never, settings as never, 'テスト', bi as never,
  );
}

/** 素の状態と、入力に細工をした状態で、札の数が同じであること */
function assertNoNewTags(name: string, clean: string, dirty: string) {
  const a = tagCounts(clean);
  const b = tagCounts(dirty);
  assert.deepEqual(b, a, `${name}: 入力で script/style の札の数が変わった`);
  assert.ok(!/<script>parent\.__laruProbe/.test(dirty), `${name}: 新しい script が置かれた`);
}

test('カウントダウンの日時に </script> を入れても script が増えない', () => {
  const clean = build([{ id: 'b1', type: 'countdown', data: { heading: 'x', targetDate: '2030-01-01' } }]);
  const dirty = build([{ id: 'b1', type: 'countdown', data: { heading: 'x', targetDate: BREAKOUT } }]);
  assertNoNewTags('countdown.targetDate', clean, dirty);
});

test('送信後の転送先に </script> を入れても script が増えない', () => {
  const mk = (v: string) => build([{ id: 'b1', type: 'contact', data: { heading: 'x', redirectUrl: v } }]);
  assertNoNewTags('contact.redirectUrl', mk('/thanks'), mk(BREAKOUT));
});

test('選択肢の値に </script> を入れても script が増えない', () => {
  const mk = (v: string) => build([{ id: 'b1', type: 'contact', data: { heading: 'x', typeOptions: [v] } }]);
  assertNoNewTags('contact.typeOptions', mk('相談'), mk(BREAKOUT));
});

test('サイトのパスワードに </script> を入れても script が増えない', () => {
  const mk = (v: string) => build([{ id: 'b1', type: 'hero', data: { heading: 'x' } }], { sitePassword: v });
  assertNoNewTags('settings.sitePassword', mk('abc'), mk(BREAKOUT));
});

test('ページ名（SEOの表）に </script> を入れても script が増えない', () => {
  const mk = (v: string) => exportToHTML(
    [{ id: 'p1', name: v, path: '/', blocks: [{ id: 'b1', type: 'hero', data: { heading: 'x' } }] } as never],
    {} as never, {} as never, 'テスト', {} as never,
  );
  assertNoNewTags('page.name', mk('トップ'), mk(BREAKOUT));
});

test('構造化データ（JSON-LD）の会社名に </script> を入れても script が増えない', () => {
  const mk = (v: string) => build([{ id: 'b1', type: 'hero', data: { heading: 'x' } }], {}, {}, { name: v, phone: '03-0000-0000' });
  assertNoNewTags('businessInfo.name', mk('結い庵'), mk(BREAKOUT));
});

test('サイトIDに </script> を入れても script が増えない', () => {
  const mk = (v: string) => build([{ id: 'b1', type: 'hero', data: { heading: 'x' } }], {}, {}, { siteId: v });
  assertNoNewTags('businessInfo.siteId', mk('site-1'), mk(BREAKOUT));
});

test('外部サービスのIDに細工をしても script が増えない', () => {
  const mk = (v: string) => build([{ id: 'b1', type: 'hero', data: { heading: 'x' } }], {
    gaTrackingId: v, clarityId: v, larubot: true, larubotPublicId: v, laruseo: true, laruseoPublicId: v,
  });
  assertNoNewTags('外部サービスID', mk('G-ABC123'), mk(BREAKOUT));
});

test('追加CSSに </style> を入れても style/script が増えない', () => {
  const mk = (v: string) => build([{ id: 'b1', type: 'hero', data: { heading: 'x' } }], { customCss: v });
  assertNoNewTags('settings.customCss', mk('.x{color:red}'), mk(STYLE_BREAKOUT));
});

test('アクセント色に </style> を入れても style/script が増えない', () => {
  const mk = (v: string) => build([{ id: 'b1', type: 'hero', data: { heading: 'x' } }], { accentColor: v });
  assertNoNewTags('settings.accentColor', mk('#f59e0b'), mk('red;}' + STYLE_BREAKOUT));
});

test('商品ブロックのボタン文言に </script> を入れても script が増えない', () => {
  const mk = (v: string) => build([{ id: 'b1', type: 'product', data: { name: '商品', buyText: v } }]);
  assertNoNewTags('product.buyText', mk('購入する'), mk(BREAKOUT));
});

/* ── 道具そのものの動き ───────────────────────────────────────────── */

test('jsonForScript は < > & と行区切りを逃がす', () => {
  assert.equal(jsonForScript('</script>'), '"\\u003c/script\\u003e"');
  assert.equal(jsonForScript('a&b'), '"a\\u0026b"');
  assert.equal(jsonForScript('a\u2028b'), '"a\\u2028b"');
  assert.equal(jsonForScript(undefined), 'null');
  // JSONとしての意味は変わらない
  assert.equal(JSON.parse(jsonForScript({ a: '</script>' })).a, '</script>');
});

test('safeStyleText は札を閉じられなくする', () => {
  assert.ok(!/<\/style>/i.test(safeStyleText('.a{}</style><script>x</script>')));
  assert.ok(!/<\/script>/i.test(safeStyleText('.a{}</style><script>x</script>')));
  // 普通のCSSはそのまま
  assert.equal(safeStyleText('.a{color:red}'), '.a{color:red}');
});

test('safeToken は英数字と - _ だけを通す', () => {
  assert.equal(safeToken('G-ABC123'), 'G-ABC123');
  assert.equal(safeToken("x');alert(1);//"), '');
  assert.equal(safeToken(''), '');
});

test('safeCssColor は色として読めるものだけを通す', () => {
  assert.equal(safeCssColor('#f59e0b', '#000'), '#f59e0b');
  assert.equal(safeCssColor('rgb(1,2,3)', '#000'), 'rgb(1,2,3)');
  assert.equal(safeCssColor('red;}</style>', '#000'), '#000');
});

/* ── プレビューの隔離 ─────────────────────────────────────────────── */

test('編集画面のプレビューは allow-same-origin を付けない', () => {
  for (const f of ['app/laruHP/studio/page.tsx', 'app/laruHP/builder/page.tsx']) {
    const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    const iframes = src.match(/<iframe[\s\S]{0,600}?\/>/g) || [];
    for (const withComments of iframes) {
      // 注釈の中に文字列が出るので、判定の前に落とす
      const tag = withComments.replace(/\/\*[\s\S]*?\*\//g, '');
      if (!/srcDoc/.test(tag)) continue;
      assert.ok(/sandbox="allow-scripts"/.test(tag), `${f}: srcDoc の iframe に sandbox="allow-scripts" が無い`);
      assert.ok(!/allow-same-origin/.test(tag), `${f}: srcDoc の iframe に allow-same-origin が付いている`);
    }
  }
});
