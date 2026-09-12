# 会社トップ再設計 — 創造を、実装する。

基点: main / 0189fc081efdc794296f685033cc10069f145f29。
作業ブランチ: codex/company-immersive-20260912。LARU HP制作体験ブランチは取り込まない。

## 事業の整理

LaruVisonaの開発プロダクト（LARU HP / LARUbot / LARUSEO / FLASTAL）と、オーダーメイドのWeb制作・AI／システム開発を一つの会社として見せる。FLASTALはクライアントのサービス開発として区別する。LARUSEOは既存のAIブログ連携・記事制作という記録の範囲で説明し、未確認の単独サービスURLを作らない。

会社トップからLARU HPの長い制作デモを外した。LARU HPの案内ページ・制作体験自体は変更しない。会社サイトの制作相談は /contact、詳細と料金は既存 /services に接続する。問い合わせ・LARUbotウィジェットは既存実装を維持する。

## 画面と実装

- 冒頭: 日本語の大きな文字と水の輪郭。輪はThree.jsのTorusGeometry、周囲の滴と最後のロゴはSphereGeometry。独自GLSLによる頂点変形、滑らかな法線、屈折方向・反射方向を使った手続き的な光。写真・動画の再生ではない。
- 材質は美術的な水の表現。物理的な流体シミュレーションや正確な光学シミュレーションとは称さない。
- 一つの固定Canvasを冒頭と終盤で共有。冒頭は時間・ポインター・スクロールで変化し、終盤は正式ロゴの10個の座標へ収束する。
- ロゴの座標は既存 components/company/mark.ts（正式SVG由来）。短い区画にも連続した0〜1の進行値を使用する。
- Canvasは画面外・タブ非表示では継続描画しない。DPR上限はスマホ1.4／PC1.7。GPUコンテキスト喪失時は代替表示、復帰イベントで再描画。
- 手動停止は描画の時間・進捗を保持。端末の動きを減らす設定では静止画面と完成ロゴ。WebGLが無い場合も、見出し・サービス・相談導線はHTMLで表示する。
- 会社ページにのみ data-lenis-prevent を付け、既存Lenisがホイール／タッチを補間しないようにする。共通SmoothScroll・他ルートは変更しない。
- プロダクトは4択。矢印・Home・Endに対応。上部の製品名からも対象が選択される。
- 業種は建築・宿泊・製造業。ブランド・写真は制作イメージと明示し、実績とは分ける。個別デザインの文字・ナビゲーションはHTML。
- 初期の安定した高さを維持。画像はNext Imageのサイズ別配信、画面下は遅延取得。CSSは会社専用セレクターに限定する。

## 新規写真

内蔵ChatGPT image_genを使用。生成PNGは元の保存先に残し、サイト向けWebPをpublic/company/conceptsへ保存。

1. architecture.webp: exec-5d888ac8-3e6d-4041-af10-3214caeebd57.png
2. retreat.webp: exec-50da804a-62cf-4ac9-9da2-d2a462c76913.png
3. ceramics.webp: exec-89e7652c-e998-4941-92cf-68a51eb3b1f5.png

原画ディレクトリ: /Users/saitoutakumi/.codex/generated_images/01a0874e-9a1d-79c2-a3c5-198151f88d6e/
配信形式: 1440px WebP / quality 84。生成写真の顔・形状の追加修整なし。

### 使用したプロンプト（生成条件）

Architecture: Generate one cinematic architectural photograph for an explicitly fictional premium Japanese architecture portfolio concept, not a real project. Landscape 3:2. A serene, extraordinarily elegant contemporary Japanese villa on a coastal hillside: low horizontal pale limestone volumes, warm wood soffits, a long reflecting pool catching late afternoon daylight, one solitary Japanese pine framing the left, floor-to-ceiling windows, distant muted blue ocean and hazy islands. Fine realistic details, sophisticated architectural editorial photography, precise perspective, restrained wabi-sabi warmth, beautiful soft shadows, no people. Camera low eye height, generous layered foreground and sky, composition balances the building toward the right with quiet space on left for HTML headline. No text, no letters, no logos, no UI, no watermarks. Full bleed, high photographic quality. It will be a background in a Japanese web design concept on LaruVisona's portfolio.

Retreat: Use case: photorealistic-natural. Create a landscape 3:2 editorial photograph for a fictional Japanese boutique retreat website concept. A profoundly calm forest onsen at early dawn in the Japanese mountains: long low pale stone bath in foreground, delicate steam drifting above perfectly still hot spring water, a dark timber pavilion along the left, large windows emitting a subtle warm glow, verdant forest fading into mist behind it. Precise architecture, intimate luxury, natural fine material textures, beautiful cinematic composition with several layers of depth. Moss green, charcoal timber, ivory mist, restrained warmth. No people, text, logos, signage, watermarks, or UI. Full-bleed photographic image, not a website screenshot.

Ceramics: Photorealistic landscape 3:2 photograph for a fictional advanced Japanese ceramics manufacturing company website concept. Close-up study of exquisite precision-engineered white ceramic components: a large off-white porous honeycomb ceramic cylinder on its side at right and thin circular ceramic wafers stacked on left, one elegant corrugated ceramic element. Placed on matte midnight cobalt laboratory surface. Directional soft blue daylight and warm white rim light revealing thousands of fine perfectly regular details, shallow depth of field, medium-format macro editorial industrial photography. Technical but beautifully restrained, confident craftsmanship, quiet high-end visual. Clear space at upper left for HTML text overlay. No metal chrome, no text, no lettering, no logos, no people, no UI, no numbers, no watermark.

## 再現手順

`npm ci` 後、`FIXTURE_PORT=54399 node tests/http/fixture.cjs` を別ターミナルで起動し、公開ページのローカル検証用として下記を指定する。実際の接続先・鍵を必要としない。既存APIの実DB検証ではない。

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-stub \
SUPABASE_SERVICE_ROLE_KEY=service-stub \
NEXT_PUBLIC_APP_URL=https://laruvisona.jp \
npx next build --webpack

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-stub \
SUPABASE_SERVICE_ROLE_KEY=service-stub \
NEXT_PUBLIC_APP_URL=https://laruvisona.jp \
npx next start --hostname 127.0.0.1 --port 3218
```

Google Fontsは既存BrandFontsのSpace Groteskをそのまま取得する。日本語は既存の端末書体。画像や材質にリモートの実行時素材依存はない。

`tests/browser/company-immersive-check.mjs` はPlaywrightのモジュールパスをPLAYWRIGHT_MODULEで指定できる。BASE_URLはlocalhost／127.0.0.1限定。外部リクエスト・書き込みリクエストを遮断する。スクリーンショットと結果をOUTPUT_DIRへ保存。

検証結果は実行終了後に追記。本番公開、実チャット応答、フォーム実送信、DNS・SQL・公開HTML再生成はこの作業で行わない。

### 初回表示の代替

public/company/water-desktop.webp / water-mobile.webp は同じWebGLの初期状態から書き出した透過ポスター。3D初期化後に切り替える。未対応端末ではそのまま表示する。原画生成AIはこの立体には使用していない。

## 検証結果

- Next.js 16.3.4 / `next build --webpack`: 成功。製品コードの書体差し替えなし。
- `npm test`: 449 / 449。
- TypeScript: 指摘なし。変更TSXのESLint: 指摘なし。
- 新設 company-immersive-check: **88 / 88**。320 / 390 / 1440px、4製品選択・キーボード、3業種、サービス開閉、連続したロゴ進捗、停止と復帰、端末の動きを減らす設定、WebGLなし、GPUコンテキスト喪失と復帰。
- 既存HTTPルーティング: **28 / 28**。公開サイト・独自ドメイン・別名転送・テナント境界・404。
- 初回の開発サーバ検査は実装変更に伴う再読み込み中に停止判定が失敗。ソースを固定した本番用ビルドで再実行し、86項目通過。その後ポスター・コンテキスト喪失の対応を加え、最終版88項目通過。
- 初回の本番ビルドはローカル用service_roleダミーキー不足で既存sitemapの事前描画が失敗。既存fixtureに向け、ダミーキーを揃えて成功。
- HTTPの初回3件失敗はNEXT_PUBLIC_APP_URLをlocalhostにしていたため、検査が想定する会社ホストを未知ホストと判定したもの。https://laruvisona.jpでビルドし直して全28件通過。ルーティングコードは変更なし。

### 出力

Mac上のプレビュー: http://127.0.0.1:3218/
プレビューと証跡: /Users/saitoutakumi/Documents/LARUVisona/immersive-preview-20260912/

PC／スマホの操作動画は、この本番用ビルドをPlaywrightで開いて録画。操作のスクロールは録画スクリプトによるもので、製品が勝手にスクロールを進めるものではない。実際のiPhoneでの録画ではない。

外部リクエスト・実送信は検査で遮断。LARUbot埋め込みの既存コードは変更していないが、この検査では実テナントの応答・通知受信を確認していない。公開設定のIDを持たないローカルプレビューではチャット・問い合わせの実フォームは表示されない。

本番用ビルドの警告は既存Sentry設定・Edge runtimeに関するもの。型検査の無効化、独自ドメイン・保存・公開・決済コードへの変更はない。

## 性能のローカル測定

1.6Mbps / 150ms / CPU 4倍遅く / コールド / 各3回中央値。外部タグ・APIは遮断、本番用ビルドのローカル配信。実機スマホや本番全体の性能値ではない。

| 幅 | LCP | 3D初回描画 | CLS | リソース＋HTML転送 |
| --- | --- | --- | --- | --- |
| 1440px | 1.18秒 | 4.65秒 | 0.0000 | 795.4KiB |
| 390px | 1.17秒 | 4.15秒 | 0.0000 | 626.0KiB |

Canvasの描画開始はLCPとは別の観測値。3D準備中は同じ形の軽量ポスターを表示する。数字でデザインの採否を代用しない。
