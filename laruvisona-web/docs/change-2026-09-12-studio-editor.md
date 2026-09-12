# 完成像から直す、LARU HPの編集体験

基点 `26da464`、ブランチ `codex/laruhp-studio-20260912`。会社トップの変更なし。

## 変更

- スマホの編集画面を作り直した。固定幅の3列をやめ、完成像と下部の編集パネルに分けた。完成像／ページの中身／選んだ場所／色・書体を切り替える。保存と公開準備は上部に残す。
- 320/390pxでも完成像が縮んで消えないよう、PC/スマホのプレビューを実際の空間に合わせて拡縮。スマホ端末では最初からスマホの組み方を出す。
- プレビューの写真・文字を押すと、対応する入力欄まで開く。写真の編集ではプレビューもその写真を中心に表示する。HTMLを更新しても内部のスクロール位置を戻す。
- 端末から写真を選べるようにした。既存の `/api/images/upload` を使い、認証・形式検査・WebP変換は既存APIを通る。URL指定も残す。
- ヒーローだけでなく写真ブロック、スタッフ写真、ギャラリーでも同じアップロード部品を使う。
- 画像の保存に失敗したらエラーを出し、元の写真は維持する。項目の切り替え時は進行中の要求を中断。アップロード中、配列の追加・削除・並べ替えと別画像の変更を無効にし、戻ってきた写真を別の項目に入れない。保存完了には最新の変更コールバックを使用する。
- ヒーロー写真を変えたときは旧写真のpicture source、寸法、sizesを解除。写真位置や利用者自身が書いたaltは維持する。見本用altだけ解除する。
- PC／スマホの切り抜き位置を3×3の選択にした。既存の `bgImagePosition` / `bgImagePositionSp` を使う。
- 「商品・サービス」「お客様の声」「3つの特徴」を日本語の設定項目として編集可能にした。公開HTMLの描画仕様に合わせたもので、新たな公開描画方式は追加していない。
- 節の一覧とプレビュー内の節をキーボードでも選べる。プレビューのsandboxと送信元windowの確認は維持。

## 検証

本番用ビルド `npm run build`、型検査、変更TS/TSXのeslint、単体475件。

`tests/browser/studio-editor-check.mjs` は実ブラウザの320/390/1440pxで65項目。文字を押して編集、写真の実アップロードAPI、取得したWebPのバイト列、保存先の500、元画像の維持、PC/SPの位置指定、実際の保存APIと開き直し、キーボード操作、他業種の項目編集、ギャラリーのアップロード中の操作制限を確認した。

画像保存先は `tests/http/fixture.cjs` のメモリ上のストレージ。アプリのAPIは差し替えず、実認証・実Supabaseストレージを検証したとは扱わない。選択書体は同一書体のローカル配布ファイルに読み込み先を代用した。

継続確認: 初回作成→保存→公開→再公開24項目、保存失敗からの復帰23項目。

実行例（localhost54999のfixtureへ向けてビルドし、3319でnext start）:

```sh
PLAYWRIGHT_FROM=<Playwrightのnode_modules> node tests/browser/studio-editor-check.mjs
PLAYWRIGHT_FROM=<Playwrightのnode_modules> node tests/browser/first-run-check.mjs --port 3319
PLAYWRIGHT_FROM=<Playwrightのnode_modules> node tests/browser/studio-recovery-check.mjs --port 3319
```

画面とログ: `~/Documents/LARUVisona/laruhp-editor-20260912/`。
`*-photo-edit.png` は保存先エラーの検査後の画面も含む。通常状態の見本は `390-editor.png` と `1440-editor.png`。

## 公開範囲

ローカル実装・検証のみ。本番へのpush、デプロイ、SQL、DNS、設定変更、顧客HTML再生成、実送信、有料素材生成は未実施。EXPORT_VERSIONは前段の12のまま。この変更では公開HTML生成側は変更していない。
