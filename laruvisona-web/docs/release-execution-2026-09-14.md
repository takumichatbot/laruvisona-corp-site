# LARU HP 本番反映記録 2026-09-14

## コード

- GitHub `main`: `43666b9994ae87a3e8ef4476409bf32a89b42625`
- Renderで確認した根拠: `laruhp.com` が同じ本番ビルドのCSS資産を返し、今回追加した料金文言と比較ページの `noindex` を返した
- `laruhp.com`、`www.laruhp.com`、料金、規約、特商法、問い合わせ、業種ページ、robots、sitemapをHTTPで確認。`www` はapexへ301
- 公開ホストへHSTS（顧客の別サブドメインへ広げない）、MIME sniffing防止、参照元制御を追加

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

## 残る外部確認

- Renderの環境変数は管理画面へ接続できず、有無を独立確認できていない
- 実ログイン、保存、公開、問い合わせ、通知、Stripeテスト決済、予約、ショップ返金、独自ドメイン接続の本番試験は未実施
- 公開中の1件だけを、ID・`updated_at`・変更前SHA-256の3条件が一致するときだけ更新した。変更前はv11、変更後はv18。変更前HTMLと前後の指紋は `~/Documents/LARUVisona/LARU-Brain/release-backups/2026-09-14-laruhp-v18/` に保存した
- 管理APIの秘密値を端末に保持していないため、再生成APIは使わず、同じ `exportToHTML` と競合検査を使って本番DBへ反映した。公開URLが200でv18を返すことを確認した
