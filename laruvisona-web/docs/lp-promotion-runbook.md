# 新LPを /laruHP に昇格させる手順と戻し方

状態: **未適用**。切替は必要な検証と齋藤の確認後。

適用するパッチ: `docs/lp-promotion.patch`（リポジトリに追跡させてある。
適用しただけでは本番に反映されない）。
適用した状態で `npm test` 256/256 pass、`tsc --noEmit` clean、
オフライン描画でプレビュー帯が消えていることを確認済み。

```
git apply docs/lp-promotion.patch
npm test && npx tsc --noEmit
```

## 何をするか

`app/laruHP/page.tsx`（旧LP）は**消さない・改名しない**。
`next.config.ts` の `rewrites.beforeFiles` で `/laruHP` → `/lp-next` を差し込む。

導入版 Next.js のローカル資料
（`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/rewrites.md`）で
評価順を確認した:

```
1. headers → 2. redirects → 3. proxy → 4. beforeFiles rewrites
→ 5. ファイル/静的ページ → 6. afterFiles rewrites → 7. fallback
```

- `beforeFiles` はファイルより先に評価されるので、`app/laruHP/page.tsx` を
  残したまま `/laruHP` を新LPに差し替えられる。
  （前回の `afterFiles` では実ファイルが勝つので差し替えできない）
- `redirects` は `beforeFiles` より**前**に評価される。
  `/laruHP` → `/lp-next` は内部の書き換えなので、redirects に戻ってループしない。

同時に、実体URLと旧プレビューURLを正式URLへ集約する:

- `/lp-next` → `/laruHP`
- `/laruHP/lp-next` → `/laruHP`

`permanent: true` の実応答は **308**（301ではない）。
ローカル資料 `redirects.md` で確認した。手順書の期待値も308で書く。

`/lp-next` は rewrite の宛先として内部では使われ続けるが、
外から直接開かれたときは301で正式URLへ寄せる。プレビューURLの重複公開は残らない。

## メタデータ

- 「これは新しいLPのプレビューです。検索には出ません。」の帯と
  「今のLPを見る」リンクを取り除く。正式LPに残ると表示とrobotsが矛盾し、
  リンクが正式URLへの自己リンクになる
- `robots` の noindex を外す（正式LPだけが index 対象）
- タイトルの「【プレビュー】」を外す
- `canonical` を `https://laruvisona.jp/laruHP` にする
- JSON-LD は**旧LPのものを戻さない**。`facts.ts` の `PLANS` から生成するので、
  画面の価格と構造化データがずれない。旧LPのJSON-LDは4プラン・999〜19,800円を
  直書きしていたが、新LPの掲載内容と一致しないため使わない。

## 切替後に確認すること

| 確認項目 | 期待 |
|---|---|
| `curl -sI https://laruvisona.jp/laruHP` | 200、`cache-control: s-maxage=...`（静的） |
| `/laruHP` のHTML | `<meta name="robots">` に noindex が無い、canonical が `/laruHP` |
| `curl -sI https://laruvisona.jp/lp-next` | **308** → `/laruHP` |
| `curl -sI https://laruvisona.jp/laruHP/lp-next` | **308** → `/laruHP` |
| `/laruHP` の画面 | プレビューの帯が出ていない |
| `/laruHP/plans` `/laruHP/auth/login` など配下 | 従来どおり（beforeFiles は `/laruHP` 完全一致のみ） |
| `/sitemap.xml` | `/laruHP` を含み、`/lp-next` を含まない |
| Search Console | `/laruHP` のインデックス状況、`/laruHP/lp-next` の除外 |

## 戻し方

**標準は昇格コミット全体の revert。**

```
git revert <昇格コミット>
```

`next.config.ts` だけを戻す方法は取らない。設定だけ戻すと、
`/laruHP` は旧LPに戻る一方で、実体ページ `app/lp-next/page.tsx` の
公開向け metadata（noindex を外した状態、canonical、JSON-LD）が残る。
その結果 `/lp-next` が索引可能なまま公開され、canonical だけが
`/laruHP` を指す矛盾した状態になる。

昇格は1コミットにまとめる（`page.tsx` の metadata と帯の除去、
`next.config.ts` の rewrites と redirects、`tests/lp-next.test.ts`）。
revert すれば3ファイルとも同時に戻る。旧LPのファイルは触っていないので、
復元作業は要らない。DB・DNS・外部サービスにも触れない。

### 戻したあとに確認する3つのURL

| URL | revert後の期待 |
|---|---|
| `/laruHP` | 200、旧LP（`app/laruHP/page.tsx`）が表示される |
| `/laruHP/lp-next` | 200、プレビュー（noindex, canonical=`/laruHP/lp-next`） |
| `/lp-next` | 200、rewriteの実体。noindex に戻っている |

昇格中に `/lp-next` や `/laruHP/lp-next` が検索に載っていた場合は、
戻したあとに Search Console でインデックス状況を確認する。
308 を外すことで、それらのURLが再び直接開ける状態に戻る点に注意する。

## 未了

- LCP / CLS / INP の実測。前景ブラウザまたはPageSpeed Insightsのキーが要る。
- 実機での Tab / Shift+Tab / Enter / Escape。
