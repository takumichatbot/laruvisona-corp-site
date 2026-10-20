# 2026-10-20 LARU CALL・LARU OS の紹介／セット内容／企業サイトの導線

指示：「LARU HP担当Claudeへの指示 LARU CALL・LARU OSの紹介／セット内容／企業サイトの導線を仕上げる」（2026-10-21）。
基準：開始時 HEAD = main = 本番 `88a0330`。HP 側（takumichatbot/laruvisona-corp-site）だけを変更。LARUbot 側のコード・DB・設定は変更していない。

## 照合表（文言の根拠）

| HP のセット | 付く LARUbot（HP 表示 / LARUbot 側） | LARU OS（相談の続き・返信のお知らせ） | LARU CALL | 既存の申込・管理の行き先 |
|---|---|---|---|---|
| HP単体 | なし | なし（LARUbot が付かない） | 含まれない（別契約） | 申込 /laruHP/auth/signup・料金 /laruHP/plans・管理 /laruHP/dashboard |
| Lite | LARUbot Lite / `lite` | **確認中**（Lite は HP 専用プラン。公開資料に記載なし） | 含まれない（別契約） | 同上 |
| HP + Bot | LARUbot Standard / `starter` | 対象（公開の料金表で Starter に「有人対応と相談の継続」、「AIチャットボットを含む全有料プラン」） | 含まれない（別契約） | 同上 |
| HP + Bot + SEO | LARUbot Standard / `starter`（+ LARU SEO） | 対象（同上） | 含まれない（別契約） | 同上 |
| エージェンシー | LARUbot Lite / `lite`（+ LARU SEO） | **確認中**（同 Lite） | 含まれない（別契約） | 同上 |

根拠
- HP のセットと LARUbot の対応：`lib/laru-entitlement.ts` HP_PLAN_PRODUCTS（hp-bot / hp-bot-seo → starter、lite / agency → lite）。
- LARU OS：larubot.tokyo/pricing.md（最終更新 2026-07-22。2026-10-20 に読み取り）「有人対応・相談の継続: AIチャットボットを含む全有料プラン…返信のお知らせ（メール／LINE）は、お客様・担当者が各自で受け取りを選んだときだけ送る。LINEは1社あたり月20通…通数の約束ではない」。Starter の内容に「有人対応と相談の継続（担当者1名）」。
- LARU CALL：larubot.tokyo/laru-call（「LARU CALL だけで、電話の受付は完結します…ほかの契約は要りません」）・/laru-call/pricing（料金は正本に置く。HP 側には書かない）。
- LARU OS という名前・専用ページは larubot.tokyo にまだ無い（/laru-os・/os は 404、サイトマップにも無い。2026-10-20）。

## 変えたこと

- `lib/laruhp-facts.ts`
  - HP + Bot に付く LARUbot を「Lite」→「Standard」に直した（契約の正 HP_PLAN_PRODUCTS と食い違っていた）。HP + Bot に「相談の続き・返信のお知らせ（LARU OS）」を追加。
  - FAQ「LARUbot Lite とフル版の違いは？」の「HP + Bot以上に含まれるLite版」を「Bot付きのプランに含まれる LARUbot（Lite・Standard）」へ。
  - PLAN_FAQ に 2 問（相談の続き／電話の受付）。
  - `AFTER_LAUNCH`（公開後の問い合わせ・相談の続き・電話とプランの関係）、`SUITE_LINKS`（CALL の正本 URL、OS は null）、`OS_BY_BOT`（表示用。権利判定ではない）。
- laruhp.com（`app/laruHP/page.tsx`・`landing.css`）：「04 公開してからも、育てていく。」の中に、問い合わせ→相談の続き→電話の 3 行と、「Bot付きのプランに含む／別契約」を追加。ファーストビュー・主 CTA は変えていない。CALL の「詳しく見る」だけ正本へ。OS は URL が確定するまで出さない。
- 料金ページ（`app/laruHP/plans/page.tsx`）：比較表の「LARUbot Lite AIチャットボット」を「AIチャットボット（LARUbot）Lite／Standard」に。「相談の続き（LARU OS）」「電話のAI受付（LARU CALL）＝別契約」の行と、表の外（スマホで横に送らない位置）に 2 つの説明を追加。
- 管理画面（`DashboardClient.tsx`）：契約カードに LARU OS（Standard は利用可・Lite は確認中→お問い合わせ）と LARU CALL（別契約。HP では契約状態が分からないので利用中／未契約とは書かない）を 1 行ずつ。新しい判定・API・テーブルは作っていない。
- 会話ログの空表示（`larubot-logs/page.tsx`）：利用者に出ていた内部の受け口と環境変数名を消し、設置の案内とお問い合わせへ。
- laruvisona.jp（`CompanyExperience.tsx`・`company.css`・`app/services/page.tsx`）：LARUbot の説明に相談の続き（LARU OS）を足し、製品タブの下に「目的から選ぶ」（HP／Webでの相談／電話受付）。サービス一覧の行き先表に LARU OS（LARUbot の機能）の行。
- 料金・税・契約期間・Stripe・権利付与・顧客サイト・通知同意は変更なし。

## 残っている依存

- LARU OS の正本ページの URL（LARUbot 側で作成中）。確定したら `SUITE_LINKS.os` に入れるだけで、LP と料金ページに「LARU OS を詳しく見る」が出る（企業サイトの行き先も同じ URL に差し替える）。
- Lite・エージェンシー（LARUbot `lite`）で LARU OS が使えるかの確認。確定したら `OS_BY_BOT['LARUbot Lite']` と料金表の「確認中」を直す。

## LARUbot 側への連絡文

```
LARU HP 側（laruvisona-corp-site）で、LARU CALL・LARU OS の掲載を反映しました。LARUbot 側のコード・設定には触れていません。

・laruhp.com（トップの「公開してからも、育てていく」・料金ページ）と管理画面に、次の関係を掲載
  - LARUbot：Bot付きプラン（Lite／Standard）に含む
  - LARU OS（相談の続き・返信のお知らせ）：LARUbot の機能。HP + Bot・HP + Bot + SEO（LARUbot 側 starter）は対象と記載
    根拠は larubot.tokyo/pricing.md の「AIチャットボットを含む全有料プラン」「Starter に有人対応と相談の継続」
  - LARU CALL：LARU HP のプランに含まれない別契約。詳しく見る → https://larubot.tokyo/laru-call
・laruvisona.jp：LARUbot の説明に LARU OS を追記、「目的から選ぶ」（HP／Webでの相談／電話受付）を追加

確認のお願い（2点）
1. LARU OS の正本ページの公開 URL（確定後、HP 側は 1 か所の設定でリンクを出します。未公開の先へはリンクしていません）
2. HP の Lite・エージェンシー（LARUbot 側 plan=lite）で、有人対応・相談の継続が使えるか（今は「確認中」と表示）
```

## 追記 2026-10-22：LARU OS の専用ページ公開と Lite の扱い

- LARUbot 側で LARU OS の専用ページ `https://larubot.tokyo/laru-os` を公開（LARUbot のトップ・料金・FAQ・機能ページ・サイトマップから辿れる）。
- `SUITE_LINKS.os` にこの URL を入れた。LARU HP のトップ（公開後の相談のカード）は「LARU OS を詳しく見る」を自動で出す。
- 会社サイトの「用途ごとの専用ページ」の LARU OS の行を `https://larubot.tokyo` → `https://larubot.tokyo/laru-os` に。
- Lite・エージェンシー（LARUbot 側 `lite`）も対象と確定：LARUbot の利用資格（`app/services/continuity.py` の `PAID_PLANS`）に `lite` が含まれ、
  有人対応・相談の継続を `is_lite_plan` で止める箇所は無い。公開の専用ページも「AIチャットボットを含む有料プラン・追加料金なし」。
  → `OS_BY_BOT['LARUbot Lite'] = 'yes'`、料金表の「確認中」を「○」に、表の外の説明を「Bot付きのプランで追加料金なし」とリンクに。
- 上の照合表の「確認中」（Lite・エージェンシー）と「残り」の 2 項目は、この追記で解消。料金・契約条件・権利の判定は変えていない。
