# 課金されているのに使えない、を作らない（2026-09-16）

## 何が起きうるか

契約状態（`profiles.plan` / `subscription_status`）を書いているのは、
Stripeのwebhookだけだった。

```
app/api/stripe/webhook/route.ts:181-194   ここでしか書かれない
```

webhookは落ちる。デプロイ中、Renderの再起動中、DBが一瞬読めないとき。
Stripeは再送してくれるが、再送にも期限がある。1回取りこぼすと、

- Stripeでは毎月課金されている
- DBでは `subscription_status = 'inactive'`
- ダッシュボードで公開できない
- 契約し直そうとすると、`app/api/stripe/checkout/route.ts` の
  「既存の契約が見つかりました。」（409）で**永久に**弾かれる

つまり、**お金だけ取って何も使えない人**ができる。しかも本人からは
直しようがない。問い合わせを受けて手で直すまで、ずっとそのまま。

逆向きもある。Stripeで解約・失効したのにDBが `active` のままなら、
そのまま無料で使い続けられる。

## 直したこと

Stripeを正として、profiles を合わせる定期処理を作った。

```
lib/subscription-reconcile.ts          判断だけ（Stripeにも DBにも触らない）
app/api/cron/subscription-sync/route.ts  実際に読んで書く
tests/subscription-reconcile.test.ts     12件
```

やること。

1. Stripeの契約を全部読む（100件ずつ、最大1000件）
2. `stripe_customer_id` で profiles を引き、食い違っていれば直す
3. Stripeを**読み切れたときだけ**、逆向きも見る。
   DBだけが有効だと思っている人（Stripeに生きた契約が無い）を `canceled` にする

## 勝手に決めないこと

- 生きた契約が2本ある人 → `conflict` として返すだけ。書き換えない
- Stripeに顧客が居るのにDBに紐づく人が居ない → `unlinked` として返すだけ
- 知らないStripe状態 → `active` にしない（`inactive` へ倒す）
- 契約のmetadataにプランが無い → DBのプランを消さない
- Stripeを読み切れなかった回は、逆向きの停止をしない（読み残しを解約と誤認しない）

`conflict` と `unlinked` はログにも `console.error` で出す。人が見る前提。

## contract_starts_at の扱い

同期は `start_date`（契約が始まった日）を正とする。
`current_period_start` を使うと請求のたびに未来へ動き、
最低利用期間の判定（`lib/billing-portal-mode.ts`）が永久に明けない。
これは 2026-09-16 に直したばかりの不具合なので、再発させない。

あわせて webhook 側も `start_date` を優先するようにした
（`app/api/stripe/webhook/route.ts`）。同じ列を2か所から違う意味で
書かないため。

## 使い方

```
POST /api/cron/subscription-sync
Authorization: Bearer <CRON_SECRET または ADMIN_SECRET>
Content-Type: application/json

{"dryRun": true}     書かずに差分だけ見る
{}                   実際に直す
```

返り値。

```json
{ "dryRun": false, "scanned": 3, "complete": true, "inSync": 2,
  "fixed": [{"profileId": "...", "changed": ["subscription_status"]}],
  "stopped": [], "conflicts": [], "unlinked": [] }
```

**初回は必ず `dryRun: true` で実行し、`fixed` と `stopped` の中身を見てから
本番実行する。**

定期実行は1日1回で足りる。Render の Cron Job から叩く。

## 確認したこと

- `tsc` / `eslint`: エラーなし
- `npm test`: 845 passed（新規12件）
  - webhookが落ちて未契約のままの人を課金どおりに戻す
  - 解約済みならDBも解約にして契約IDを外す
  - 生きた契約が2本あるときは人へ回す
  - 書き込む状態が `profiles.subscription_status` のcheck制約に収まる
  - `contract_starts_at` を請求のたびに動かさない（再発防止）
- `next build`: 成功（`ƒ /api/cron/subscription-sync`）

## まだ確認していないこと

本番のDBに対しては動かしていない。`dryRun` の1回目は人が見る必要がある。
