# 新規サイトの最初の保存が必ず失敗していた（2026-09-16）

## 症状

制作スタジオで新しいサイトを作り、「保存」を押すと必ず失敗する。

```
保存できませんでした: サイトの内容を確認してください
POST /api/sites → 400 {"error":"サイトの内容を確認してください"}
```

ログインしていてもプランがあっても失敗する。**サイトは1件も作られない。**

## 原因

`lib/site-write-contract.ts` の作成側が、配列しか受け付けていなかった。

```ts
const blocksDocument = (value: unknown) => Array.isArray(value)
  || (object(value) && value.v === 2 && Array.isArray(value.pages));

// 更新側 — 両方の形を受ける
if (!blocksDocument(body.blocks_json)) throw Error('サイトの内容を確認してください');

// 作成側 — 配列しか受けない ← ここ
if (!Array.isArray(blocks) || ...) throw Error('サイトの内容を確認してください');
```

制作スタジオは複数ページの文書を送る。

```
app/laruHP/studio/page.tsx:776
  blocks_json: { v: 2, pages: s.pages }
```

実際に流れている本文を確認した。

```
POST body keys: [ 'name', 'blocks_json', 'seo_json', 'settings_json', 'industry' ]
blocks_json type: object | v: 2 | pages: 1
```

つまり **作成が、更新では通る形を拒否していた。**

## いつから壊れていたか

- スタジオが `{ v: 2, pages }` を送るようになったのは `46918f8`（2026-09-10）
- `blocksDocument` が入ったのは `8d8a2f4`（2026-09-14）。このとき更新側だけに適用され、
  作成側は `Array.isArray` のまま取り残された

したがって、少なくとも **2026-09-10 から今日まで、新規サイトを1件も作れない状態**だった。

## 直したこと

作成側も `blocksDocument` を使うようにした。作成と更新で受ける形が揃う。

## なぜ828件のテストを通り抜けたか

`tests/site-write-contract.test.ts` の作成の検査が、配列しか渡していなかった。

```ts
readSiteCreate(request({ name: ' 店 ', industry: ' 美容 ', blocks_json: [], ... }))
```

スタジオが実際に送る形（`{ v: 2, pages }`）を一度も通していない。
テストが、壊れているほうの経路を見ていなかった。

作成の検査に、v2文書で通ること・不正な文書は断ることの2件を足した。

## まだ確認できていないこと

ローカルの検査環境（`tests/http/fixture.cjs`）は `laruhp_create_site` のRPCを
実装していないため、契約を通過したあとのDB書き込みまでは確認できていない。
契約の400が消えて503（RPC未実装）に変わるところまでが、ここで見える限界。

**本番反映後、実際に1件作れるかを確認する必要がある。**

## 通しで歩いて分かった、もう一つのこと

`tests/browser/first-run-check.mjs`（はじめての人の通し検査）は、いまの main に対して
冒頭で落ちる。`/laruHP` の見せ方デモの `[role="radio"]:has-text("やわらかい")` が
見つからず30秒で時間切れになる。

```
locator.click: Timeout 30000ms exceeded.
  - waiting for locator('[role="radio"]:has-text("やわらかい")')
```

**通しの検査が動いていないので、今回のような「経路が丸ごと止まる」不具合を
誰も検知できない状態になっている。** 今回の件は、その結果として起きている。

## 追補（同日）: 未契約の人が「公開」を押すと、通信エラーだと言われていた

`app/laruHP/builder/page.tsx` の公開処理は、サイトがまだDBに無いとき
`POST /api/sites` を呼ぶ。この応答のうち **401（未ログイン）しか見ていなかった。**

プラン未契約のときサーバは **403 `no_plan`** を返す。

```ts
// app/api/sites/route.ts:44-49
return NextResponse.json(
  { error: 'サブスクリプションが必要です。プランを選択してください。', code: 'no_plan' },
  { status: 403 });
```

403は素通りするので `site` が返らず `id` が undefined のまま、次の行に落ちる。

```
公開の準備に失敗しました。通信環境を確認してもう一度お試しください。
```

**初めての人が、作り終えて「公開」を押した瞬間に、
「あなたの回線がおかしい」と言われる。** 料金にたどり着けない。

既存サイトの公開では、同じ状況で料金の画面（`showPlanModal`「プランを選択して公開」）
が出る。新規のときだけ、その経路が無かった。

403でも同じ料金の画面を出すようにした。作業内容は従来どおり端末に残す。
