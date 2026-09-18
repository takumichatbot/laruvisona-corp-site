# 最初の本番Stripeイベントで確認すること

2026-09-19 時点で、本番の Stripe 送信先（LARUHP / `/api/stripe/webhook`）への
配信は **0件**。本番の `STRIPE_WEBHOOK_SECRET` が送信先と一致しているかは、
Stripe の仕様上、本番の実イベントが来るまで確かめられない。

**この確認のために本番決済は作らない。最初の通常契約で確認する。**

## 見るもの

| # | 項目 | どこで見るか |
|---|---|---|
| 1 | Stripe本番 endpoint への配信成功 | Stripe → Workbench → LARUHP → イベントの配信（HTTP 200） |
| 2 | HP側の署名検証成功 | 1 が 200 なら成立。400 なら署名不一致 |
| 3 | 「Invalid signature」の運営通知が**出ていない** | ADMIN_EMAIL の受信箱（件名「【要確認】Stripe webhook の署名検証に失敗しました」） |
| 4 | checkout完了なら正しい契約が profiles へ反映 | `/api/admin/users` → subscription_status=active / plan / contract_starts_at・contract_ends_at が **Stripe の実値**（推測の+6ヶ月ではない） |
| 5 | Stripe実契約と DB が一致 | `/api/admin/stats` → `stripe.unverified` が 0件 |
| 6 | 契約数 / MRR が正しい | `/api/admin/stats` → activeUsers=1 / mrr=そのプランの実請求額 |
| 7 | LARUbot付きプランなら register 成功 | 運営通知「LARUbotへの登録に失敗」が**出ていない** ＋ profiles.pending_*_public_id または site.settings_json.larubotPublicId |
| 8 | public_id 保存 | site.settings_json.larubotPublicId / laruseoPublicId |
| 9 | SEO付きなら autopilot 開始 | `/api/sites/<id>/seo-status` → linked=true / autopilot_active=true / next_run_at |
| 10 | 二重処理なし | Stripe が再送しても profiles の行が増えない・開始メールが2通出ない・LARUbot が `existing` を返す |
| 11 | `invoice.payment_failed` 発生時は past_due へ | profiles.subscription_status=past_due（該当イベントが来たときのみ） |

## 3 で通知が届いたら

Stripe → 本番モード → Webhook → LARUHP → 署名シークレットを表示し、
Render の `STRIPE_WEBHOOK_SECRET` と同じかを確かめる。違っていれば Render 側を
入れ替えて再デプロイ。**値をチャット・ログ・報告に出さない。**

## 関連

- 環境の門: `lib/stripe-mode.ts`（テストのイベントで本番DBを書かない）
- 契約の正: `lib/stripe-truth.ts`（Stripe に無い契約は数えない）
- 署名失敗の通知: `lib/stripe-signature-alert.ts`（受け口ごとに1時間1通）
