# 表示と違う額を請求しない（2026-09-17）

## 本番で一周して見つけたこと

管理者のログインで、実際の本番に対して作成→保存→公開まで通した。

| 確かめたこと | 結果 |
|---|---|
| v2ドキュメント（`{v:2,pages:[]}`）でのサイト作成 | **201**。本番DBに `laruhp_create_site` が入っており、2026-09-16の修正が効いている |
| 最初の保存（PUT） | 200 |
| 公開 | 200。`versionSaved: true` |
| 公開URLの表示 | 表示される |
| **はじめての公開のお知らせメール** | **届いた**（URL入り、宛先は本人） |
| 本番Stripeでの Checkout Session 作成 | **成功**（`cs_live_…`）。価格IDの解決も初月無料クーポンも通る |

作った確認用サイトは、非公開にしてから削除済み。

## 見つかった食い違い

`/api/admin/price-check`（今回足した読み取り専用の口）で10通りを突き合わせた。

```
hp/monthly        画面 999      Stripe 999      ok
hp/annual         画面 9,990    Stripe 9,999    ← 食い違い
lite/monthly      画面 2,980    Stripe 2,980    ok
lite/annual       画面 29,800   Stripe 29,800   ok
hp-bot/monthly    画面 4,980    Stripe 4,980    ok
hp-bot/annual     画面 49,800   Stripe 49,800   ok
hp-bot-seo/…      画面どおり                     ok
agency/…          画面どおり                     ok
```

LARU HP の年払いだけ、**画面は 9,990円、Stripeは 9,999円**だった。
9,990 は「999円×10ヶ月（実質2ヶ月無料）」で、他のプランの年額も
すべて下2桁が00である。9,999 は打ち間違いと見てよい。

誰も買っていないので実害は出ていないが、買われていれば
**広告と違う額を請求していた**ことになる。出荷手順にも
「画面の料金とStripe Priceの金額が一致しない」は停止条件として
書いてあるが、目で照らし合わせる前提では必ず抜ける。

## やったこと

### 1. 正しい価格をStripeに作った

LARU HP に `¥9,990 / 毎年` を追加した（説明: 年払い（画面表示と同額・999円×10ヶ月））。

```
price_1UGLItDJPpSSYYh87wjGRJSs   ← 新しい（9,990円）
price_1TlFhjDJPpSSYYh8VkeCjDdx   ← いま使われている（9,999円）
```

**Render の `STRIPE_HP_ANNUAL_PRICE_ID` を新しいIDへ差し替える作業が残っている。**
環境変数の変更は自動では行えないため、ここは人の手が要る。

### 2. 食い違ったまま売らないようにした

決済を作る直前に、Stripeの価格を読んで画面の額と突き合わせる。
違えば**売らない**（503）。安いほうへの食い違いも止める。
「表示と違う額を請求する」ことに変わりはないため。

```
lib/price-integrity.ts            判断だけ（Stripeにも DBにも触らない）
app/api/stripe/checkout/route.ts  新規契約の直前
app/api/stripe/upgrade/route.ts   プラン変更の直前
```

照合する額は `lib/laruhp-facts.ts`（画面が使う定数）から直接読む。
書き写すと、写し間違いを照合できなくなるため。検査でもそれを見ている。

**この結果、環境変数を直すまで LARU HP の年払いは申し込めない。**
広告と違う額を請求するよりは、売れないほうがましだと判断した。
月払いと他のプランは影響を受けない。

### 3. 突き合わせを機械にやらせる口を足した

```
GET /api/admin/price-check     管理者でログインしていれば開ける。読むだけ
```

5プラン×月払い/年払いの10通りについて、画面の額・Stripeの額・通貨・
請求間隔を返す。初月無料クーポンの有無も返す。出荷前に一度開けばよい。

## 確認したこと

- `tsc` / `eslint`: エラーなし
- `npm test`: 865 passed（新規11件）
- `next build`: 成功

## 残っていること

1. **Render の `STRIPE_HP_ANNUAL_PRICE_ID` を `price_1UGLItDJPpSSYYh87wjGRJSs` へ**
   （差し替えたら `/api/admin/price-check` が `ok: true` になる）
2. 古い 9,999円 の価格をStripeでアーカイブする
3. `HP_SHOP_PAYMENTS_ENABLED` 未設定のため、ショップ決済は停止中
4. 実際のカード決済そのもの（課金の発生）は、まだ一度も通っていない
