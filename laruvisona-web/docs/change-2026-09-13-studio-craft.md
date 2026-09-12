# LARU HP：選んだ場所から、完成まで

対象は案内ページ `/laruHP`、制作画面 `/laruHP/studio`、新しく指定した見せ方の公開HTML。
会社トップ・決済・独自ドメイン・DBスキーマは変更していない。本番への反映は未実施。

## 実装した5項目

1. **スマホで直接編集**：完成像の写真・文字を押して、その節の「内容／見せ方／AIに相談」を開く。編集欄を拡大・縮小できる。編集中の対象をフレーム内に保つ。320／390／1440pxを確認。
2. **写真・動画・動きの設定**：節単位で写真の配置3種、スマホの焦点、上下の余白、登場アニメーション4種。背景動画は既存のMP4／WebM配信を使い、静止画を残す。ギャラリーは整列／スクロールで重ねるを選べる。端末の動きを減らす設定では動画を取得せず、重ねる写真は通常の配置になる。
3. **選んだ節だけのAI提案**：新API `/api/ai/section-proposal`。利用者・契約・指定サイトの所有者を確認し、1利用者12回／時（プロセス内）まで。対象は2,000文字以内の見出し・説明等の許可した文章欄。URL・写真・CSS・別の節は提案に渡さない。変更前／後を比較し、チェックした欄だけ採用する。待機中の手編集を採用時にも照合する。長文を途中で切って送らない。未確認の例文表示をAIで消さない。APIには保存処理がない。
4. **業種ごとの構成**：美容・飲食・工事・物販・整体の新規サイトに、写真・メニュー・流れ・アクセス・相談を業種に応じた順番で配置。新しい実績・体験談・料金は創作しない。入力が必要な節は「入力してください」「【例】」を残す。既存サイトの並びを変更しない。
5. **案内ページから同じ内容で制作**：4業種、写真、書体を含む見せ方、店名、見出し、説明、配置を変更できる CreationLab。`makeStarterSite` と `exportToHTML` を共用する。完成像をCSSの3Dで眺められる。近くまでスクロールしてからフレームを生成する。「このまま制作を続ける」で同じ選択と文章を引き継ぐ。

引き継ぎは同じタブの sessionStorage、ID一致・2時間以内・値の許可リストで検査する。既存サイトを開く `siteId` があれば読まない。前回の下書きがあれば優先し、上書きしなかった旨を表示する。案内ページのフレームは同一オリジンを許可せず、CSPで通信・フォーム送信を遮断する。

`EXPORT_VERSION` は12→13。新しい節設定を使わないサイトには新しい配置を適用しない。保存済み公開HTMLを自動で書き換える操作は実施していない。

## 検証条件

- `npm test`：実関数で提案の範囲、選択採用、競合、長文、例文表示、引き継ぎ、業種構成、公開HTMLを確認。
- `next build` → `next start`：ローカルで本番用ビルドを配信。Supabaseは `tests/http/fixture.cjs`。実際の保存・公開APIを通すが、書き込み先は隔離した仮データのみ。
- `tests/browser/studio-craft-check.mjs`：320／390／1440px。写真・文章・書体を案内ページから引き継ぎ、配置変更→AI比較→選択採用→取り消し→競合拒否→保存→再表示。AIの生成応答だけは差し替え。
- `tests/browser/studio-craft-media-check.mjs`：ローカル動画ファイル、写真アップロード、重ねる配置の実スクロール、保存→公開URL、動きを減らす設定、既存下書き・サイトの保護。前のスクリプトが作った `/tmp/laruhp-five/results.json` の対象IDを使用。
- 既存 `landing-polish-check.mjs` と `studio-editor-check.mjs`：案内・スマホ編集・画像アップロード・並べ替え・保存の回帰。

書体は `_local-fonts.mjs` でローカルの同じ配布書体に置換。外部計測タグとチャットの通信は遮断。AI応答の差し替えを正しく観測するため、新しいブラウザ検査ではサービスワーカー登録を検査内だけで抑止する。製品のPWAコードは変えていない。

**実モデルの生成品質・実契約の課金・実機・本番速度・外部通知は検証していない。** 検査サーバは `ANTHROPIC_API_KEY=''` を明示し、実AI生成をしない。APIの認証拒否・他サイト拒否・不正入力・プロバイダー未設定の応答は実ルートで検査する。実画像・動画の有料生成も実施していない。

## 再実行

アプリディレクトリから、仮DBサーバを起動する。

```sh
node tests/http/fixture.cjs
```

別の端末でローカル検証用のビルド・サーバを用意する。

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54999 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-stub SUPABASE_SERVICE_ROLE_KEY=service-stub NEXT_PUBLIC_APP_URL=https://laruvisona.jp npm run build
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54999 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-stub SUPABASE_SERVICE_ROLE_KEY=service-stub NEXT_PUBLIC_APP_URL=https://laruvisona.jp ANTHROPIC_API_KEY='' node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3319
```

Playwrightが別の場所にある場合は `PLAYWRIGHT_FROM` に `node_modules` の絶対パスを指定する。

```sh
npm test
node tests/browser/studio-craft-check.mjs
node tests/browser/studio-craft-media-check.mjs
node tests/browser/landing-polish-check.mjs
node tests/browser/studio-editor-check.mjs
```

検証用の動画・写真・サイト名は検査データであり、公開する作例ではない。写真・動画の新しい素材をHiggsfield等で制作した際も、同じ公開機能に差し替えられる。

## 実行結果

単体514／新しい制作フロー77／動画・公開・引き継ぎ保護25／既存案内91／既存編集65、すべて通過。合計258項目の実ブラウザ確認。ビルド（型検査込み）成功、変更したTS/TSXのeslint指摘0。別途、初期表示時の完成像フレーム0→接近後1を確認。詳細は `docs/review-evidence/laruhp-five-20260913/results.json`。
