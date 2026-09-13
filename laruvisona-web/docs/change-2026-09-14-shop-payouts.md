# ショップ売上の入金先（2026-09-14）

## 決めたこと

LARU HP の月額利用料と、各店舗のショップ売上を分離する。店舗は自分の Stripe Standard 口座を接続し、購入者のカード決済はその接続口座で直接処理する。LaruVisona のプラットフォーム口座へ店舗売上を集めず、`application_fee_amount` も設定しない。ドメイン料金と同様、LARU HP の月額料金とは別の取引として扱う。

## 実装

- ショップ管理に「売上の入金先」を追加した。未接続、Stripe 側の確認待ち、利用可能を区別する。
- 接続は予約の事前決済と同じ `hp_payment_accounts` と Stripe-hosted onboarding を使う。同じ利用者が予約とショップで別口座を重複作成しない。
- ショップは `HP_SHOP_PAYMENTS_ENABLED=1` のときだけ接続と購入を受け付ける。予約の `HP_BOOKING_PREPAY_ENABLED` とは別のため、一方を有効にしても他方は有効にならない。
- Checkout は公開サイト、サイト所有者、接続口座、charges/payouts、テスト・本番モードを照合し、接続口座上でカード決済を作る。
- Connect webhook はイベントの接続口座とサイト所有者の保存済み口座を照合する。支払済み、通貨、合計、Stripe 確定明細、metadata のカートが一致したときだけ、注文保存と在庫減算を原子的に行う。
- 旧コードで作成済みのプラットフォーム口座上の Checkout Session は、既存 webhook で引き続き注文へ反映できる。新規の Checkout は接続口座に限定する。

## 検証

- 接続口座の所有者不一致と未払い Session は、Stripe 明細取得と DB 更新の前に拒否する単体回帰を追加した。
- ショップ用フラグだけを有効にした状態で、予約事前決済が利用可能にならず DB/Stripe にも触れない回帰を追加した。この条件を旧判定へ戻すと回帰が失敗することを確認した。
- 商品価格、接続口座、カード限定、プラットフォーム手数料を加えないこと、両 webhook が共通の注文確定処理を使うことを固定した。

## 本番へ出す条件

1. `hp_scheduling_payments.sql` と `hp_orders.sql` の適用状態を確認する。
2. Connect webhook `https://laruvisona.jp/api/stripe/scheduling-webhook` に `checkout.session.completed` と `account.updated` が含まれることを確認する。署名シークレットは既存の `STRIPE_CONNECT_WEBHOOK_SECRET` を使い、値を記録しない。
3. コードをデプロイし、`HP_SHOP_PAYMENTS_ENABLED` はまだ設定しない。
4. テストモードで、店舗口座の接続、購入、注文1件、在庫1回減算、Webhook再送で重複しないことを確認する。
5. 実店舗の本番口座と少額商品で、入金先、購入者メール、注文通知、返金手順を確認する。
6. 確認後に `HP_SHOP_PAYMENTS_ENABLED=1` を設定する。

機能フラグを外せば新しい購入開始と口座接続を止められる。決済済みイベントを受け取る webhook と注文表は残し、未処理の支払いがある間はコードや DB を先に戻さない。

## 未確認

本番の店舗口座接続、実カード決済、実入金、実返金、通知受信は未確認。

## 追補: 注文の全額返金

- 注文管理から全額返金を開始できる。Stripe Session のサイト、金額、通貨、接続口座、PaymentIntentを再照合する。
- 返金要求は注文ID由来の固定 idempotency key を使う。応答が失われても二重返金しない。
- Stripe が成功を返すまでは `refund_pending`、失敗・取消は `refund_review`、全額返金を確認したときだけ `refunded` にする。
- Connect webhook と従来のプラットフォーム webhook の両方で返金状態を同期する。
- 一般利用者がDBを直接 `refund_pending` / `refunded` に変えることはトリガで拒否する。
- 在庫は自動で戻さない。発送前・発送後、返品の有無を画面だけでは判断できないため、再入荷は店舗が商品管理で判断する。
