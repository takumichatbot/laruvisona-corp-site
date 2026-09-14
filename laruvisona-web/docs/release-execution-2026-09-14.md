# LARU HP 本番反映記録 2026-09-14

## コード

- 本体反映の基準コミット: `43666b9994ae87a3e8ef4476409bf32a89b42625`
- 反映後の修正: 予約事前決済SQLの適用漏れ防止、公開ホストの基本セキュリティヘッダー、予約リマインドRPCの本番エラー修正、公開ページのOGP画像補完
- Renderで確認した根拠: `laruhp.com` が同じ本番ビルドのCSS資産を返し、今回追加した料金文言と比較ページの `noindex` を返した
- `laruhp.com`、`www.laruhp.com`、料金、規約、特商法、問い合わせ、業種ページ、robots、sitemapをHTTPで確認。`www` はapexへ301
- 公開ホストへHSTS（顧客の別サブドメインへ広げない）、MIME sniffing防止、参照元制御を追加
- sitemap掲載の28 URLをIndexNowへ送信し、HTTP 200で受理された
- 本番28ページと内部リンクを巡回し、リンク切れ・title・description・canonical・index設定を確認。ページ固有metadataで落ちていたOGP画像を補完した
- 同じ巡回を `npm run check:production` で再実行できるようにし、sitemap、内部リンク、metadata、OGP、基本セキュリティヘッダー、本文の絵文字、問い合わせフォーム、wwwと旧URLの転送・クエリ保持を一度に検査する
- LARU HP用のチャットは専用の `NEXT_PUBLIC_LARUHP_BOT_PUBLIC_ID` があるときだけ表示する。会社用の「LaruVisona コンシェルジュ」を流用するとブランドが混ざるため、フォールバックは行わない。問い合わせページのLARUbotフォームは継続する

## 本番DB

- Supabase project: `puomsbplrxgtmknyyphk`
- 適用前の `release_state_check_20260914.sql`: `ALL_REQUIRED_STATE=false`
- 出荷計画のSQLを順番に適用。既存データを削除する操作は行っていない
- 計画から漏れていた `hp_scheduling_payments.sql` も適用し、専用状態確認の最終行99がtrue
- 適用後の `release_state_check_20260914.sql`: 全42項目true
- `site_domains_state_check.sql`: 98/99ともtrue
- 計画の修正後に総合確認を再実行し、予約事前決済を含む全48項目true

## 適用中に見つけた計画の欠落

予約とショップのStripe Connectが参照する `hp_payment_accounts` / `hp_booking_payments` の移行が、2026-09-14の適用順と総合確認から漏れていた。本番へ適用し、適用順・総合確認・この記録を同じ変更で修正した。

毎分の既存Cronへ予約通知・リマインド・ショップ通知をまとめた最初の実行で、`hp_schedule_claim_reminders()` の `ON CONFLICT (appointment_id, ...)` がRETURNS TABLEの同名変数と曖昧になり503になることを確認した。競合対象を省略して表の一意制約に判定を任せる形へ修正し、本番SQLを再適用した。2026-09-14 02:05 UTCの実Cronで、予約決済・予約通知・予約リマインド・ショップ通知の4経路がすべて200となり、ジョブが正常終了した。

## 残る外部確認

- Renderの環境変数は管理画面へ接続できず、有無を独立確認できていない
- 実ログイン、保存、公開、問い合わせ、通知、Stripeテスト決済、予約、ショップ返金、独自ドメイン接続の本番試験は未実施
- 公開中の1件だけを、ID・`updated_at`・変更前SHA-256の3条件が一致するときだけ更新した。変更前はv11、変更後はv18。変更前HTMLと前後の指紋は `~/Documents/LARUVisona/LARU-Brain/release-backups/2026-09-14-laruhp-v18/` に保存した
- 管理APIの秘密値を端末に保持していないため、再生成APIは使わず、同じ `exportToHTML` と競合検査を使って本番DBへ反映した。公開URLが200でv18を返すことを確認した
