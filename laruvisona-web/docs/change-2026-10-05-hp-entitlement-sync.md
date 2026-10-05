# 2026-10-05 HP バンドル権利の同期（/api/hp/entitlement）

LARUbot（49d8d8f 本番反映）の `docs/integrations/laru_hp_bundle_entitlement_lifecycle.md` に合わせ、
LARU HP の契約が変わるたびに「いまの権利」を丸ごと LARUbot へ送る。LARUbot 側は変更していない。

## 送るもの

`POST {LARUBOT_API_URL}/api/hp/entitlement`（ヘッダー `x-laru-secret`＝既存の `LARU_HP_API_SECRET`）

`public_id`（register の応答の値）・`site_id`・`user_id`・`plan`・`state`（active / cancelled / site_deleted）・`event_at`

- plan は HP のプラン ID をそのまま：`hp` / `lite`（Bot Lite → LARUbot lite）/ `hp-bot`（Bot Standard → starter）/ `hp-bot-seo` / `agency`。
  LARUbot の `BUNDLE_PLANS` と照合済み。lite と hp-bot は別の値。知らない値は送らない（運営へ）。
- 会社（public_id）ごとに 1 回。同じ public_id のサイトが複数あっても二重に送らない。

## いつ・どの時刻で

| 出来事 | 場所 | event_at |
|---|---|---|
| 新規・再契約 | Stripe `checkout.session.completed`（register → entitlement） | Stripe のイベント時刻 |
| 上げ下げ | `/api/stripe/upgrade`・`/api/stripe/checkout`（差し替え）・管理画面・`customer.subscription.updated` | Stripe の変更が確定した時刻／イベント時刻 |
| 解約 | `customer.subscription.deleted`・定期同期 | 契約が実際に終わった時刻（`ended_at`）。解約予約では送らない |
| サイト削除 | `DELETE /api/sites/[id]` | 削除の時刻（その場で送る） |
| サイトが無いまま契約した人の紐付け | `POST /api/sites`（預かった public_id を移したとき） | 紐付けた時刻 |
| 定期同期での補正 | `/api/cron/subscription-sync` | HP の記録を直した時刻 |

- register にも同じ `event_at` を付ける（同期済みの会社で、遅れて届いた古い register が権利を戻さないように）。
- 支払い遅延（past_due）・回復・同じプランのままの更新では送らない（利用期間中の権利を止めない）。
- 時刻が分からない呼び出しでは送らない（作らない）。

## 失敗したとき

- 決済・プラン変更は止めない。
- 5xx・通信エラー：その場で 3 回（0.3 / 0.9 / 2.7 秒）。届かなければ控え（`sites.settings_json.larubotEntitlement`）に
  `pending` で残し、`server.js` の 5 分ごとの再送（`/api/cron/hp-entitlement-retry`）が 1 分 → 5 分 → 30 分 → 2 時間 … で送り直す。
  event_at は控えた値のまま。24 時間届かなければ `failed` にして運営へ知らせる。
- 4xx：再送しない。`failed` で控え、運営へ知らせる（`alertLarubotFailure` kind=entitlement）。
- `duplicate` / `stale` は正常応答。同じ時刻で内容が違うときは LARUbot 側で applied（実コード apply_event で確認）。
- サイト削除だけは控えを置けないので、5xx・通信エラーなら削除を保留（503 `entitlement_pending`）。

## 公開先（M03）

- SEO の再追加・再契約は、entitlement が成功してから `publication-target` に `action: reactivate`（いまの canonical_base）。
  未登録（409 `not_registered`）は register で作る。entitlement が再送待ちになったら、再送が成功したときに reactivate する。
- SEO を外す・解約・削除は従来どおり先に deactivate / retire（M03）。

## 守るもの

- 控え・public_id は編集画面の保存・履歴の復元で上書きしない（`SERVER_OWNED_SETTING_KEYS`）。
- 直接契約・記事・会話履歴・枠・料金・Stripe Price には触らない（LARUbot 側が max(直接, HP) で決める）。

## 照合（運営）

`GET /api/admin/hp-entitlement`（運営ログイン・読むだけ）：紐付いたサイトごとに HP の契約・送るべき権利・控え・
LARUbot の `status.entitlement` を並べる。`POST {site_id, confirm:true, event_at?}` で 1 件だけ初回同期。
event_at は控えの値か、LARUbot 担当と決めた値だけ。持ち主が運営アカウント（契約なしで公開）なら送らない。
