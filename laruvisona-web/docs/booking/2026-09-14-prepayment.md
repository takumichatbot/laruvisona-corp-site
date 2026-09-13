# 予約の事前決済（Stripe Connect）

## 目的と範囲

LARU HP の各店舗が自分の Stripe 口座を接続し、有料メニューを予約時にカード決済できるようにする。売上は店舗の接続口座で直接決済し、LaruVisona の売上には混ぜない。無料メニューと「来店時に支払う」は従来どおり利用できる。

初期版は全額の事前決済だけを扱う。デポジット、分割払い、現地での差額精算、LaruVisona の決済手数料、クーポンは含めない。

## 状態の約束

- `pending_payment`: 60分だけ担当者・設備・時間を確保する。Stripe の支払い済み状態をサーバーが観測するまで予約確定通知を出さない。
- `confirmed / paid`: Stripe の Checkout Session、金額、通貨、接続口座、予約ID、サイトIDが一致したときだけ確定する。戻りURLのクエリは根拠にしない。
- `refund_pending`: 支払い済み予約のキャンセル要求。全額返金をStripeで確認するまで枠を解放せず、キャンセル通知も出さない。
- `canceled / refunded`: 全額返金を確認したあとに枠を解放し、返金完了通知を1件だけ作る。
- `review`: Stripeの結果が不明、失敗、または長時間確定できない状態。自動で枠を解放しない。

Checkout作成と返金要求は予約ID由来の固定 idempotency key を使う。Webhookと1分ごとの照合は同じDBロックと状態遷移へ集約する。

## Stripe側の準備

1. LaruVisona のStripeアカウントで Connect を有効にし、Stripe-hosted onboarding のブランド名・色・アイコンを設定する。LARU HPはStandard口座を作成し、一度限りのAccount Linkで本人確認へ送る。OAuth Client IDは使わない。
2. Connect webhookとして `https://laruvisona.jp/api/stripe/scheduling-webhook` を登録し、接続アカウントの次を購読する。
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `charge.refunded`
   - `refund.created`
   - `refund.updated`
   - `refund.failed`
   - `account.updated`
   - `account.application.deauthorized`
3. 本番とテストを混ぜない。接続口座の `livemode` とプラットフォーム鍵のモードが一致しない場合は有効化しない。

## 必要な環境変数

- `HP_BOOKING_PREPAY_ENABLED=1`: コード・DB・Webhookの確認が終わるまで設定しない。
- `STRIPE_CONNECT_WEBHOOK_SECRET`: 上記Connect webhook専用の署名シークレット。
- 既存の `STRIPE_SECRET_KEY` と `ADMIN_SECRET` を使う。値は文書・チャット・ログへ転記しない。

## 出す順番

1. コードレビューと全回帰を終える。
2. `supabase/hp_scheduling_payments.sql` を、すでに `hp_scheduling.sql` が適用されたDBへ1トランザクションで適用する。
   続けて読み取り専用の `supabase/hp_scheduling_payments_state_check.sql` を実行し、最終行99が `true` であることを確認する。falseなら機能を有効にせず、落ちた項目を記録して止める。
3. Stripe-hosted onboardingとConnect webhookをテストモードで設定する。
4. コードをデプロイする。機能フラグはまだ設定しない。
5. テスト口座で接続、予約、成功、Checkout中断、期限切れ、キャンセル、返金、Webhook再送を確認する。
6. `HP_BOOKING_PREPAY_ENABLED=1` を設定し、対象店舗自身が「予約時にStripeで支払う」を明示的に選ぶ。既存設定は `onsite` のまま。

SQLだけを戻すと新しいコードが参照する表・列を失うため、標準の戻し方は機能フラグを外し、全店舗を来店時払いへ戻して表を残す。決済中・返金中の行が1件でもあれば、コードや表を先に戻さない。

## ローカル検証

- `python3 tests/scheduling/run.py`: 使い捨てPostgreSQLで状態遷移、排他、権限、通知の重複を確認する。
- `npm test`: 戻り先とStripe応答の照合、Checkout応答消失時の冪等再試行、返金の重複防止を確認する。
- `tests/scheduling/run-local.sh`: 事前決済を有効にしない従来の予約・設定・公開導線が変わらないことを本番ビルドと実ブラウザで確認する。

実カード、実入金・実返金は未確認。これらを確認するまでは「実店舗で事前決済を完走した」とは扱わない。

## 本番への基盤反映（2026-09-14）

- GitHub `main` のマージコミット `380f9ccb13aea8d3c05d1e54c13d4cd5eeb7fe92` をRenderへデプロイした。
- `supabase/hp_scheduling_payments.sql` を本番へ適用し、`hp_scheduling_payments_state_check.sql` の最終行99が `true` であることを確認した。
- 本番StripeにConnect webhookを登録し、上記8イベントを購読した。署名付きの非更新プローブは本番URLからHTTP 200を返した。署名シークレットの値は記録していない。
- Render Cron `laru-hp-booking-payment-reconcile` を毎分実行に設定した。手動実行と自動実行はいずれも `checked: 0, failed: 0` で完了した。RenderのCronには月額最低1ドルの料金がかかる。
- `HP_BOOKING_PREPAY_ENABLED=1` を設定した。既存店舗の支払方法は `onsite` のままで、店舗がStripe接続と事前決済を明示的に選んだ場合だけ切り替わる。

ここまででコード、DB、Webhook、定期照合の本番基盤は稼働している。実店舗の接続口座、実カードでの支払い、Checkout中断・期限切れ、キャンセル、実返金、通知Webhook再送は未確認である。最初の店舗でこれらを通し、入金先と通知を確認するまで一般提供完了とは扱わない。
