# LARU HP 販売開始前の最後の作業（Stripe / Render）

最終更新: 2026-09-27 / 本番の基準コミット: この文書を含むコミット（/api/health の commit）

秘密の値（鍵・トークン）はここに書かない。Price ID は秘密ではないが、実際の値は作業時に画面で確認する。

## 前提（コードは対応済み）

- 画面・記事・特商法・照合は HP単体 **月1,980円／年19,800円**（税別）
- 決済の直前に「表示額＝Stripe の額」を照合している（lib/price-integrity.ts）。違えば 503 で止まり、請求しない
- 初月無料のクーポンは**月払いだけ**に付く（年払いには付かない）
- 有料契約は0件（2026-09-27 の管理画面の集計）

## 手順（ログイン後、Claude に「Stripe/Renderにログインした。最後の作業をして」と送れば実行する）

1. **Stripe（live）で月払いPriceを作る**
   - 既存の月払いPrice（`price_1Tj2Og…`、999円）の Product・通貨 JPY・請求間隔「毎月」・税の扱いをそのまま使う
   - 金額 1,980円。既存Priceは変更しない
2. **Stripe（live）で年払いPriceを作る**
   - 既存の年払いPrice（`price_1UGLIt…`、9,990円）と同じ設定で、金額 19,800円・請求間隔「毎年」
3. 月払いの新Price ID → Render の **`STRIPE_PRICE_ID`**
4. 年払いの新Price ID → Render の **`STRIPE_HP_ANNUAL_PRICE_ID`**
5. Render の本番サービスで上の2つだけを変更して保存する。他プランの変数は触らない
6. 再デプロイの完了を待ち、`https://laruvisona.jp/api/health` の `commit` が基準と同じことを確認する
7. **price-check**（運営でログインして `GET /api/admin/price-check`）
   - `ok: true`
   - hp の monthly が 1980・annual が 19800、`livemode: true`
   - 他プランは変化なし
   - クーポンは percentOff 100・duration once
8. **月払いCheckoutの表示確認**（支払わない）
   - HP単体・月払いで開く
   - 1,980円/月、初回の支払額が 0円（初月無料）と表示されること
9. **年払いCheckoutの表示確認**（支払わない）
   - HP単体・年払いで開く
   - 19,800円/年で、初月無料のクーポンが付いていないこと
10. **旧Priceが使われない確認**
    - 7 の照合結果の priceId が新しいIDであること
    - Checkout 画面の金額が新しい額であること
11. （任意）旧Price（999円・9,990円）を archive する
    - 有料契約0件なら既存契約への影響なし。archive の前に契約件数を再確認する
12. **最終判定**: 1〜10 がすべて通れば「営業開始OK」
    - 最初の5社への連絡へ進む（営業準備報告の1・2・3・7・8番）

## 止める条件

- price-check が ok でない
- Checkout の金額・初月0円・年払いのクーポン有無のどれかが違う

→ 営業を始めず、原因を直してから 7 に戻る。
