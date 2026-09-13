# ブラウザの端末通知

管理画面で利用者が明示的に有効化した端末へ、問い合わせ・本格予約・ショップ注文の通知を送る。

- ページ表示時に通知許可を要求しない。管理画面のボタン操作からだけ要求する。
- 購読は `profiles` の存在しない列ではなく `hp_push_subscriptions` に保存し、利用者ごとに複数端末を持てる。
- endpoint、公開鍵、認証鍵の形と長さを検査し、HTTPSの購読先だけを受け付ける。
- 保存に失敗した場合は端末側の購読を解除し、画面でも有効扱いにしない。
- Pushサービスが404または410を返した購読は無効化する。
- Service WorkerはLARU HPの通知として表示し、問い合わせ・予約・注文の該当管理画面を開く。
- VAPID鍵が無い環境では配信処理を利用不可として扱う。必要な設定は `NEXT_PUBLIC_VAPID_PUBLIC_KEY`、`VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、任意の `VAPID_EMAIL`。

DBには `supabase/hp_push_subscriptions.sql` を適用する。通知はメールの代替ではなく、ログイン中の運営者へ早く気づかせる追加経路である。
