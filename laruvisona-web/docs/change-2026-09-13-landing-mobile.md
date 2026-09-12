# LARU HP 案内ページとスマホの節編集

目的: LARU HPの完成例・制作体験・料金を伝わる順に整え、「ページの中身」を指で操作できる画面にする。

## 変更

- `/laruHP`: 白とコバルト、余白、日本語のコピーを基準に再構成。冒頭から完成例が見える構成。美容・飲食・工務店・物販の4業種を切り替え、選んだ業種で制作を開始できる。
- 作例は `makeStarterSite → exportToHTML` の画面写真。架空店・生成写真である旨を近くに明示。操作できる実HTMLデモは別の節で継続利用。会社トップの内容は扱わない。
- 完成例をCSSの立体配置で重ね、選択時の短い切り替えとスクロールに応じた奥行きを加えた。端末の「動きを減らす」設定では動きを省く。新しい動画素材、WebGLシーン、編集可能な3Dモデルの機能は今回追加していない。
- 料金・最低利用期間などは既存 `laruhp-facts` から表示。LPはServer Componentにし、作例切り替えと実物デモをクライアント側に限定。
- スタジオ: 絵文字の節アイコンをLucideの線アイコンに置換。「ページの中身」は選択ボタンと操作ボタンを分離。スマホの操作ボタン幅48px、並べ替えは46px高。ホバーに頼らず、メニューから上へ・下へ・削除を実行。取り消しは既存の編集履歴を使う。
- 節を足した直後に、スマホの編集パネルへ移る。写真の焦点位置ボタンも44px角へ。
- 写真の背景動画設定（既存のmp4/webm入力）に見出しと説明を追加。新しい動画生成・アップロード処理は追加していない。
- 新規サイトのサービス・特徴から既定の絵文字を外す。既存顧客が入力した文章やアイコンは変更しない。HTML生成器・EXPORT_VERSIONは変更しない。

## 素材と再撮影

- 4作例の元写真: 採用済みの結い庵B、および既存の `public/company/concepts/`。
- `scripts/capture-lp-showcase.mjs`: 公開HTMLを1100×830で開き、Cookieの帯を実際の「拒否」操作で閉じ、撮影してWebP化。公開HTMLを描き直して写真のように捏造するものではない。
- `scripts/capture-lp-studio.mjs`: スタジオで物販の試作を作り、コピーを編集した画面を1200×780で撮影。保存・公開は呼ばない。
- 作例は `public/lp/showcase-*-v1.webp`、制作画面は `public/lp/studio-live.webp`。更新時は配信ファイルの版も変え、画像最適化キャッシュの古い表示を避ける。
- 再撮影はリポジトリ直下で `PLAYWRIGHT_FROM=<playwrightのあるnode_modules> node --import ./tests/_resolve-ts.mjs scripts/capture-lp-showcase.mjs`。スタジオ撮影は同変数で `node scripts/capture-lp-studio.mjs`。

## 検証

- `npm test`: 494件通過。
- 本番用ビルド `next build`: 通過。型検査を無効化していない。
- 変更したTS/TSXのeslint: 指摘なし。
- `tests/browser/landing-polish-check.mjs`: 320/390/1440pxの91項目。横はみ出し、最初の画面の完成例、CTA寸法、4業種切り替え、キーボード、業種の引き継ぎ、実HTMLデモ、FAQ、節の並べ替え・削除・取り消し・追加、絵文字なし、端末の動き設定。
- 既存 `studio-editor-check.mjs`: 65件通過。写真・焦点位置・文字の編集、キーボードでの節選択、保存API経由の保存、開き直した際の保持まで。
- 実ブラウザ検査はローカルの `next build → next start` と `tests/http/fixture.cjs`。選択書体は同じ書体のローカル配布物を利用。実ログイン・本番DB・決済・通知・独自ドメインは検証していない。本番性能の測定値ではない。

スクリーンショットと結果: `~/Documents/LARUVisona/laruhp-polish-20260913/`。
本番反映・push・SQL・DNS変更・有料生成は実施していない。
