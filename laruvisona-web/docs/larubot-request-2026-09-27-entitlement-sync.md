# LARUbot 側への作業依頼: LARU HP 契約の「現在の状態」を同期する経路（ダウングレード・解除）

作成: 2026-09-27 / LARU HP（laruvisona.jp）側
対象: LARUbot（larubot.tokyo）の HP 連携 API

鍵やトークンの値は書いていません（環境変数名のみ）。

---

## 1. いま起きていること

LARU HP のプランを下げても、LARUbot 側の権限が下がりません。

| LARU HP の変更 | LARUbot 側の現状 |
|---|---|
| Bot付き → HP単体 | テナントの Bot 権限が残る（解除する経路が無い） |
| Bot Standard → Bot Lite | 内部 plan が starter のまま（register は plan を下げない安全策） |
| SEO付き → SEOなし | `seo_option_enabled` が残る（SEOなしの register では消さない安全策） |
| 契約終了 | 同上（LARU HP 側は公開サイトを非公開にするが、LARUbot 側の権限は残る） |

**LARU HP 側の対応（2eb8496 の次のコミットで本番反映）:**

- 公開ページは、持ち主の現在の契約で LARUbot / LARU SEO の設置タグを出し分ける
- HP単体へ下げた時点でチャットを出さない。SEOなしへ下げた時点で記事一覧を出さない
- public_id は消さない

残っているのは、**LARUbot 側で権限そのものが残ること**です。影響は2つあります。

- larubot.tokyo の管理画面や、自前の設置タグで使い続けられる
- SEO の自動運転が記事を作り続け、枠を消費し続ける

## 2. 求める最終状態（LARU HP の契約を正とする）

| LARU HP プラン | LARUbot | LARU SEO |
|---|---|---|
| HP単体（hp） | 無効 | 無効 |
| HP + Bot Lite（lite） | lite 相当で有効 | 無効 |
| HP + Bot Standard（hp-bot） | starter 相当で有効 | 無効 |
| HP + Bot + SEO（hp-bot-seo） | starter 相当で有効 | 有効 |
| Agency（agency） | lite 相当で有効 | 有効 |
| 契約なし・解約済み | 無効 | 無効 |

## 3. お願いしたいこと: 状態同期の入口を1本

`register` を下げる用途に流用する案は、とりません。

`register` の「下げない」安全策は、Stripe webhook の再送や順不同で、古い上位プランのイベントが後から届いたときに下げてしまわないためのものです。これは残してください。

代わりに、**「今の契約はこれ」を時刻つきで送る専用の入口**を1本お願いします。

### 案: `POST /api/hp/entitlement`

- 認証: register と同じ `x-laru-secret`（`LARU_HP_API_SECRET`）。定数時間比較
- 本文:

```json
{
  "public_id": "<既存の public_id>",
  "hp_user_id": "<LARU HP の user id>",
  "hp_site_id": "<任意>",
  "hp_plan": "hp | lite | hp-bot | hp-bot-seo | agency | null",
  "subscription_status": "active | trialing | past_due | canceled | ...",
  "bot": true,
  "bot_tier": "lite | starter | null",
  "seo": false,
  "state_at": "2026-09-27T09:00:00Z",
  "source": "stripe:customer.subscription.updated:evt_xxx"
}
```

- `bot` / `bot_tier` / `seo` は LARU HP 側で上の表から決めて送ります。LARUbot 側でプラン名から推測しなくて済むようにするためです
- `state_at` は、その状態が正しかった時刻です（Stripe のイベント時刻、または定期同期で Stripe から読み直した時刻）

### 期待する動作

1. **古い状態で上書きしない。** テナントごとに最後に反映した `state_at` を控えます。それ以下の `state_at` が来たら、何も変えずに 200 を返し、`{"applied": false, "reason": "stale"}` とします
   - これで、遅延・再送された上位プランのイベントによる再有効化を防げます
2. **public_id とテナントを変えない。** 新しいアカウントは作りません。`public_id` が見つからなければ 404（`code: not_found`）
3. **データは消さない**（すべての変更で共通）
   - Q&A、会話履歴、設定、SEO記事、キーワード、枠の履歴、人が選んだ曜日・時刻
4. **Bot Standard → Bot Lite**: plan だけ lite 相当へ。上位専用の機能は使えなくする。データはそのまま
5. **Bot付き → HP単体（bot:false）**: LARU HP 経由の Bot 権限（bundle entitlement）を止める
   - embed.js が応答しない、または非表示になる
   - データは保持し、`bot:true` が来たら同じ public_id で戻る
6. **SEO付き → SEOなし（seo:false）**
   - `seo_option_enabled` を false、`seo_autopilot_active` を false にする
   - 新しい記事は作らない
   - 既存記事・キーワード・枠の履歴は消さない
   - `seo:true` が来たら同じ状態から再開できる
7. **冪等。** 同じ本文を何度送っても結果は同じ
8. **応答で現在の状態を返す。** 例: `{"applied": true, "plan": "lite", "bot": true, "seo": false, "state_at": "..."}`

### HP経由の権利と直接契約の権利を分ける（最重要）

この入口が動かすのは、**LARU HP 経由で付けた権利だけ**です。
同じテナントに LARUbot / LARU SEO の直接契約がある場合、その権利は止めないでください。

```
実際に使える権利 = HP経由の権利 ∪ 直接契約の権利
```

| HP側 | 直接契約 | 実際 |
|---|---|---|
| Bot Lite | Professional | Professional のまま |
| SEOなし | LARU SEO あり | SEO は有効のまま |
| HP単体 | なし | Bot・SEO とも停止 |
| Bot Standard → Bot Lite | なし | lite へ |

**実装の前に、LARUbot 側で次を確認してください。**

- HP経由の権利と直接契約の権利を、既存の情報で安全に区別できるか
  - `is_hp_bundle`
  - `seo_price_id = hp_bundle`
  - LARUbot 側の Stripe subscription の有無と内容
  - `customer_data.plan`
  - その他の契約情報
- 区別できない場合は、**権利を下げる処理を本番へ出さず、LARU HP 側へ報告してください**。下げる処理を誤ると、直接契約の顧客のサービスを止めることになります

HP経由の SEO が無くなったときに止めるものは次のとおりです。直接契約の SEO があれば、どちらも有効のままです。

- HP経由で付けた `seo_option_enabled`
- HP経由で始めた自動運転（`seo_autopilot_active`）

### state_at の扱い（まとめ）

- 保存済みより古い `state_at` → 反映しない（`applied:false, reason:"stale"`）
- 同じ `state_at` の再送 → 同じ結果を返す（冪等）
- 新しい `state_at` → 反映する
- どの場合も public_id は変えず、データは消さない

### 状態の置き場所

新しい基盤は要りません。既存の `crm_settings` か、テナントの既存レコードに次の3つを足す程度を想定しています。
- `hp_entitlement_state_at`
- `hp_bot_enabled`
- `hp_seo_enabled`

別契約（LARUbot を直接契約しているテナント）の権限は、この入口では触らないでください。LARU HP 経由で付けた分だけが対象です。

## 4. LARU HP 側がすること（LARUbot 側の入口ができてから）

- 呼ぶ場所: Stripe webhook の `customer.subscription.updated` / `deleted`、定期同期（`/api/cron/subscription-sync`）、管理画面からのプラン変更
- `state_at`
  - webhook: Stripe のイベント時刻
  - 定期同期: Stripe から読み直した時刻（最新の正）
- 失敗したら、既存の `alertLarubotFailure` で運用へ知らせる。契約処理自体は止めない
- **入口ができるまでは呼びません**（存在しない API を本番から呼ばない方針）

## 5. 課金への影響の見立て

- 新規契約の直後には漏れは起きない（上げる方向は register で正しく付く）
- 漏れるのは、LARU HP で下げた・解約した人が LARUbot 側で使い続ける場合だけ
- 現在の有料契約は0件（2026-09-27 管理画面の集計）

---

確認したいこと（LARUbot 側で答えてください）

1. HP 経由テナントの Bot 権限を止めたとき、embed.js はどう振る舞いますか（何も出さない／「停止中」を出す）
2. `seo_autopilot_active` 以外に、記事生成を走らせる印はありますか
3. LARUbot を直接契約しているテナントと HP 経由のテナントは、区別できますか（`seo_price_id = hp_bundle` 等）
