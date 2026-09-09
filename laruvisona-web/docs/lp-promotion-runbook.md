# 新LPを /laruHP に昇格させる手順と戻し方

状態: **未適用**。切替は必要な検証と齋藤の確認後。
適用するパッチ: `lp-promotion.patch`（別途受け渡し。適用後 `npm test` 235/235、`tsc --noEmit` clean を確認済み）

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

- `/lp-next` → `/laruHP`（301）
- `/laruHP/lp-next` → `/laruHP`（301）

`/lp-next` は rewrite の宛先として内部では使われ続けるが、
外から直接開かれたときは301で正式URLへ寄せる。プレビューURLの重複公開は残らない。

## メタデータ

- `robots` の noindex を外す（正式LPだけが index 対象）
- `canonical` を `https://laruvisona.jp/laruHP` にする
- JSON-LD は**旧LPのものを戻さない**。`facts.ts` の `PLANS` から生成するので、
  画面の価格と構造化データがずれない。旧LPのJSON-LDは4プラン・999〜19,800円を
  直書きしていたが、新LPの掲載内容と一致しないため使わない。

## 切替後に確認すること

| 確認項目 | 期待 |
|---|---|
| `curl -sI https://laruvisona.jp/laruHP` | 200、`cache-control: s-maxage=...`（静的） |
| `/laruHP` のHTML | `<meta name="robots">` に noindex が無い、canonical が `/laruHP` |
| `curl -sI https://laruvisona.jp/lp-next` | 301 → `/laruHP` |
| `curl -sI https://laruvisona.jp/laruHP/lp-next` | 301 → `/laruHP` |
| `/laruHP/plans` `/laruHP/auth/login` など配下 | 従来どおり（beforeFiles は `/laruHP` 完全一致のみ） |
| `/sitemap.xml` | `/laruHP` を含み、`/lp-next` を含まない |
| Search Console | `/laruHP` のインデックス状況、`/laruHP/lp-next` の除外 |

## 戻し方

**`next.config.ts` の変更（rewrites ブロックと2件の redirects）を戻すだけ。**
旧LPのファイルは触っていないので、復元作業は要らない。

単一コミットで入れる前提なので、実務上は:

```
git revert <昇格コミット>
```

これだけで `/laruHP` は `app/laruHP/page.tsx`（旧LP）に戻る。
DB・DNS・外部サービスには一切触れないので、他に戻すものは無い。

注意: 戻すと `/lp-next` の301も外れるため、実体URLが再び直接開ける状態になる。
昇格中に `/lp-next` が検索に載っていた場合は、戻したあとに noindex を付け直すか、
301を残す判断をする（`redirects` の2行だけ残しても rewrites 無しで矛盾はしない）。

## 未了

- LCP / CLS / INP の実測。前景ブラウザまたはPageSpeed Insightsのキーが要る。
- 実機での Tab / Shift+Tab / Enter / Escape。
