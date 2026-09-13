# 同じ写真・文章から構成を選ぶ

前提: `b7d235a` の制作体験を継続。会社トップ・本番設定・DB移行・決済・独自ドメインは変更していない。

## 今回使えるもの

- 案内ページ `/laruHP#experience`: 「言葉で伝える」「写真で惹きつける」「内容で選んでもらう」。写真とコピーは同じまま、ヒーロー配置、写真の並び、サービスを見せる順番を変える。
- スタジオの「サイト全体」（スマホの「色・書体」）: 同じ3案を、いまの写真・文章・リンクから作る。比較は全画面のダイアログ。スマホ／パソコンを切り替えて、実際の公開HTMLを見られる。
- 採用するまで編集中の内容は変更しない。採用は履歴の1操作で、取り消し可能。保存・公開は従来のボタンから行う。
- 「選んだ場所 → 見せ方」: 長い見出しを全文折り返し、文章量に応じて高さを取る。スマホの写真は焦点基準の切り抜き／全体を残す、を選べる。全体を残す設定では、背景写真型もスマホで写真と文字を分ける。
- 業種の見本は美容・飲食・工事・物販・整体。美容・建築は既存の配信素材、飲食・物販・整体は新しく生成した3枚を利用し、初期の構成・書体・メニュー案・相談や来店への順番を分けた。すべて架空例であり、未入力の情報は公開前チェックに残る。

## 実装の範囲

`studio-direction.ts` が公開HTMLと制作画面に共通の配置変換。AIモデルの呼び出しではない。写真の被写体認識や、文章の事実確認も行わない。既存の写真アップロードを通した画像でも同じ比較ができる。

色・写真・コピーの別体系は追加しない。比較のカードは配置の見取り図と明示し、その下／ダイアログの中は `exportToHTML` の出力。`Composition` の既存 `presentation` と3構成を対応させ、引き継ぎも同じデータを使う。

変換はトップページのブロックだけ。ID、本文、写真URL、画像の焦点、CTA先、フォーム設定は維持する。見出し・区切りは次の節と一組で移す。未対応の自由配置などが含まれるページは順番を変えない。元の節が少ない場合は、2案で同じ順番になることもある（写真と文字の配置は異なる）。存在しない説明や実績を足して差を作らない。

公開HTMLの版は13→14。`compositionStyle` が既知の3値であるブロックだけにCSSを適用。未選択の既存サイトには調整を追加しない。既存の保存済みHTMLの作り直しは行っていない。`customCss` がある場合は従来どおり最後の上書きになる。

「写真全体」の背景型はスマホで静止画を見せ、背景動画は表示しない。対応ブラウザのIntersectionObserverでは非表示の動画を読み始めない。縦写真の全体表示は、被写体を認識して自動で切り抜く機能ではない。

## 確認時に直した点

同じ業種をもう一度押すと、完成像HTMLは変わらないのに準備中へ戻り、次の完了通知が来なかった。出力HTMLが変わるときだけ準備状態を更新するよう修正。ブラウザで同じ業種を再選択して確認する。

小さい編集欄に比較を収めるとスマホでは見づらいため、ネイティブdialogへ変更。背景への入力を遮断し、Escapeと閉じる操作で元の編集に戻る。

## 検証条件と再現

本番用 `next build → next start`。DBは `tests/http/fixture.cjs` の隔離した代替。書体は `tests/browser/_local-fonts.mjs` で同じ選択書体をローカル配信。試験用の画像アップロード・保存・公開は実APIを通す。実アカウント、課金、外部通知、本番の速度は対象外。

```sh
# 別端末で fixture / next start を起動（接続先は隔離環境）
node tests/http/fixture.cjs

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54999 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-stub SUPABASE_SERVICE_ROLE_KEY=service-stub NEXT_PUBLIC_APP_URL=https://laruvisona.jp npm run build
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54999 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-stub SUPABASE_SERVICE_ROLE_KEY=service-stub NEXT_PUBLIC_APP_URL=https://laruvisona.jp ANTHROPIC_API_KEY='' node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3319
```

Playwrightの場所は `PLAYWRIGHT_FROM` で指定可能。検査は順番に実行する（共通fixtureを使う）。mediaチェックは直前のcraftチェックのresults.jsonを読むため、OUTPUT_DIRを同じにする。ブラウザ試験内だけServiceWorker登録を止め、検証ルートの横取りを防ぐ。製品のPWAコードは変更していない。

```sh
npm test
node tests/browser/studio-direction-check.mjs
node tests/browser/studio-craft-check.mjs
node tests/browser/studio-craft-media-check.mjs
node tests/browser/landing-polish-check.mjs
node tests/browser/studio-editor-check.mjs
node --import ./tests/_resolve-ts.mjs docs/reference-sites/collection/build.mjs
node tests/browser/studio-reference-capture.mjs
```

写真・見出しの長文は境界条件の試験用。業種に合うデザインの見本は `references` に別で書き出す。どちらも実データの事例として公開しない。

## 生成した見本写真

内蔵 image_gen でカフェ・生活雑貨（うつわ）・整体院を各1枚生成。生成された原画1448×1086を保存し、構図や肌・物の形状は変更せずWebP（quality 82）へ配信用に変換した。HiggsfieldのAPIは使っていない。

- `public/studio/references/cafe-v1.webp`: 179,594 B
- `public/studio/references/tableware-v1.webp`: 107,564 B
- `public/studio/references/clinic-v1.webp`: 105,632 B

原画と最終プロンプトは `docs/asset-source/studio-references-20260913/`。manifest.json に生成方法・寸法・実バイト数を記録。元のC2PA付きPNGもここに残す。見本の写真・名称を実在事業者の実績として扱わず、公開前の差し替え対象として残す。

## 最終検証結果

- 本番用ビルド成功（型検査を含む）、変更したTS/TSXのeslint指摘0、単体526/526。
- 実ブラウザ: 構成比較104、既存編集77、画像・動画25、案内ページ91、編集画面65（計362、失敗0）。
- 5業種×390/1440pxの10画面を撮影。横はみ出しなし。
- 写真3枚の差し替え後にビルド・単体・構成比較104・見本10画面を再実行。既存編集／画像動画／案内／編集画面は差し替え前の同じ実装で通過。
- 長文とアップロードした縦写真を使い、採用前は元データが変わらない、採用→取り消し→保存→読み直し→公開で内容と表示設定が残ることを確認。

結果JSON: `docs/review-evidence/laruhp-directions-20260913/`。操作・見本プレビュー: `~/Documents/LARUVisona/laruhp-directions-20260913/index.html`。本番へpush・デプロイ・既存公開HTMLの再生成は行っていない。
