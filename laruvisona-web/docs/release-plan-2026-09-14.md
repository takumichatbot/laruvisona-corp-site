# LARU HP 2026-09-14 出荷準備

このブランチは、制作・公開・独自ドメイン・問い合わせ・CRM・本格予約・ショップ決済・会員・配信・分析を一つの運用へつなぐローカル変更である。本番変更はこの文書の順序で、各停止条件を満たしたときだけ進める。

## 現在の固定点

- ブランチ: `codex/domain-onboarding-20260914`
- `origin/main` からのコミット数と先端SHAはpush直前に数え直して固定する
- 全単体テスト: 783件通過
- 実HTTP回帰: 28件通過
- 全体eslint: 終了コード0（0 errors、既存warning 106件）
- `tsc --noEmit`: exit 0
- `next build`: exit 0
- `npm audit --omit=dev`: 既知の本番依存脆弱性 0件
- SQL回帰: ネットワークを切った使い捨てPostgreSQL 16で全移行と170項目が通過。状態確認の最終行もtrue
- 公開HTML生成版: 18（A/B計測の署名付き経路を含む。本番の保存済み版は未確認）
- push、本番SQL、DNS、Render設定、デプロイ、公開HTML再生成は未実施
- 公開面のSEOは `laruhp.com` の正規URLに統一し、管理画面と未検証の旧比較ページは `noindex`。料金表示は共通定数から生成し、月払いの初月無料クーポンが無ければ申込みを停止する
- 制作画面と既定テンプレートの絵文字は、日本語の機能ラベルに置き換え済み

## SQLの適用順

本番に書く操作である。各ファイルを一つずつ実行し、失敗したら次へ進まない。

1. `hp_sites.sql`
2. `contacts_crm.sql`
3. `hp_orders.sql`
4. `hp_loyalty.sql`
5. `hp_newsletter.sql`
6. `hp_sequences.sql`
7. `hp_members.sql`
8. `site_members.sql`
9. `hp_analytics.sql`
10. `hp_ai_usage.sql`
11. `hp_public_rate_limits.sql`
12. `hp_reservations.sql`
13. `hp_reservations_reminded.sql`
14. `hp_scheduling.sql`
15. `hp_scheduling_notifications.sql`
16. `hp_scheduling_reminders.sql`
17. `hp_scheduled_emails.sql`
18. `hp_push_subscriptions.sql`

適用後に `release_state_check_20260914.sql` を読み取り実行する。最終行 `ALL_REQUIRED_STATE` が `true` でなければコードを有効化しない。この確認は関数本体の業務動作や実データを保証しないため、機能ごとの試験も必要である。

`hp_sites.sql` はサイト作成数をDB内で原子的に確定し、複製も同じ上限へ含める。また、所有者が下書きを保存する権限は保ったまま、`slug`・`published`・`published_html`・`custom_domain`・`user_id` のブラウザからの直接更新を拒否する。URL変更と公開・非公開は所有確認後のサーバー経路だけで行う。

## Render設定

値はチャット、画面記録、ログへ写さない。

- 基本: `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`ADMIN_SECRET`、`RESEND_API_KEY`
- 公開フォームの共有制限: 任意の `PUBLIC_RATE_LIMIT_SECRET`（未設定時は `ADMIN_SECRET` を使用し、生のIPは保存しない）
- LARUbot連携: `LARU_HP_API_SECRET`、任意の `LARUBOT_API_URL`（未設定時は `https://larubot.tokyo`）
- 独自ドメイン: `DOMAIN_PROBE_SECRET`、`RENDER_API_KEY`、`RENDER_SERVICE_ID`、`RENDER_SERVICE_SLUG`、`RENDER_APEX_IP`
- LARU HP契約: `STRIPE_PRICE_ID`、`STRIPE_LITE_PRICE_ID`、`STRIPE_BUNDLE_BOT_PRICE_ID`、`STRIPE_BUNDLE_FULL_PRICE_ID`、`STRIPE_AGENCY_PRICE_ID`、`STRIPE_FIRST_MONTH_COUPON_ID`
- 年払いを出す場合: `STRIPE_HP_ANNUAL_PRICE_ID`、`STRIPE_LITE_ANNUAL_PRICE_ID`、`STRIPE_BOT_ANNUAL_PRICE_ID`、`STRIPE_FULL_ANNUAL_PRICE_ID`、`STRIPE_AGENCY_ANNUAL_PRICE_ID`
- ショップ: `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_CONNECT_WEBHOOK_SECRET`、`HP_SHOP_PAYMENTS_ENABLED=1`
- 旧購入ボタン（既存の運営商品を残す場合のみ）: `STRIPE_PUBLIC_BUY_PRICE_IDS`
- 予約事前決済: 上記Stripe設定、`HP_BOOKING_PREPAY_ENABLED=1`
- 定期配信: `RETENTION_SECRET`
- 定期処理: `CRON_SECRET`
- アクセス解析署名: `ANALYTICS_SIGNING_SECRET`
- 端末通知（任意）: 同じ組の `NEXT_PUBLIC_VAPID_PUBLIC_KEY` と `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、任意の `VAPID_EMAIL`
- ドメイン取得案内（任意）: 審査後の `NEXT_PUBLIC_MUUMUU_DOMAIN_URL`、`NEXT_PUBLIC_ONAMAE_DOMAIN_URL`
- `REPUBLISH_ON_BOOT` は設定しない。公開HTMLの再生成は対象を確認して手動で行う。

## 出荷の順番

1. GitHub main、Render Live SHA、公開HTML版分布、既存独自ドメイン割当、必要な環境変数の有無を読み取りで再確認する。
   旧 `settings_json.payment_links` の保有サイトと件数も控え、該当者にはショップ移行前に個別案内する。
2. 本番DBの控えを取得する。
3. SQLを上記順で適用し、状態確認の最終行とfalse行を保存する。
   `hp_public_rate_limits.sql` が未適用のまま新コードを出すと、問い合わせ・予約・ログイン・決済・分析・管理者認証は安全側に停止するため、SQL確認前にデプロイしない。
4. 必要なRender設定を追加する。再起動後に旧コードの基本画面が正常か確認する。
5. ブランチ先端SHAとコミット数を固定し、mainへ通常マージしてpushする。force pushしない。
6. Render Liveが固定SHAになったことを確認する。
7. ログイン、制作、保存、公開、問い合わせを最小1件ずつ確認する。
8. Stripeテストモードで新規契約→支払方法変更→プラン変更→解約同期を確認する。有効契約を残した退会と、二重Checkoutが拒否されることも確認する。
9. 予約は空き枠取得→確定→通知、ショップはテスト決済→注文→返金、端末通知は登録→受信→解除を各1件確認する。
   旧決済リンクは新規作成が410で拒否され、既存リンクをStripe側で停止した場合だけ一覧から外れることをテストモードで確認する。
10. 独自ドメインはテスト用ドメインだけで所有確認・接続・主従308・解除を確認する。
11. 公開HTMLは `dryRun:true, slug, limit:1` で対象IDと指紋を確認してから1件だけ再生成する。応答のundoを保存する。

## 停止条件

- 読み取り時点のmainまたはRender Liveが想定SHAと違う
- `REPUBLISH_ON_BOOT` が存在する
- SQL状態確認の最終行がfalse
- Render Liveが固定SHAにならない
- 保存・公開・問い合わせのいずれかが失敗する
- Stripeの環境（test/live）と接続口座の環境が一致しない
- 月払いを出すのに `STRIPE_FIRST_MONTH_COUPON_ID` が無い、または画面の料金とStripe Priceの金額が一致しない
- dryRunの対象が1件でない、IDや指紋が変わる、`dryRun:true` が返らない
- 再生成が `updated=1, conflicts=0, failed=[]` にならない

## 公開後に確認する指標

初週は、公開成功率、問い合わせ保存成功率、通知経路別の失敗、予約確定・リマインド失敗、注文の `review` 件数、決済・返金の未確定、独自ドメインの失敗理由、404、Web Vitalsを毎日確認する。集客施策は問い合わせ・予約・決済の本番試験が通ってから開始する。
