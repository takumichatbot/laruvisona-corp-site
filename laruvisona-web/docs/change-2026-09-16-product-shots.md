# 会社トップのプロダクト紹介を、実際の画面に差し替える（2026-09-16）

対象: `components/immersive/CompanyExperience.tsx` / `components/immersive/company.css`
基準: `origin/main` = `64e3f6e`
ブランチ: `company-product-shots-2026-09-16`

## なぜ

4つのうち LARU HP だけが実際の制作画面（`/lp/studio-edit.jpg`）で、
LARUbot・LARUSEO・FLASTAL は手で描いた紹介イメージだった。
注記にも「機能の紹介イメージ」「記事制作の紹介イメージ」「プロダクトの紹介イメージ」と
書いてあり、見る人には「まだ画面が無いのだろうか」と読めてしまう。
3つとも実際に動いているので、実物を見せるほうが速いし、正確でもある。

## やったこと

### 1. 3枚の実画面を撮って、資産に加えた

| ファイル | 撮影元 | 元の解像度 |
| --- | --- | --- |
| `public/company/products/larubot.jpg` | https://larubot.tokyo/ | 1376×868 → 1200×750 |
| `public/company/products/laruseo.jpg` | https://larubot.tokyo/laru-seo | 1568×777 → 中央 1243×777 を切り出して 1200×750 |
| `public/company/products/flastal.jpg` | https://www.flastal.com/ | 1568×777 → 切り出さず 1200×595 |

- 既にある `/lp/studio-edit.jpg` が 1200×750 なので、LARUbot・LARUSEO はそれに合わせて 8:5 に揃えた。
- FLASTAL だけは横幅を切らずに入れている。8:5 に合わせると右端（ログイン・登録と写真の右側）が落ちるため、
  撮ったままの比率で置いた。カードの高さは `lv-product-art` の `min-height` で決まるので、
  タブを切り替えてもページの高さは動かない。
- JPEG 品質82・プログレッシブ。66〜129KB。画像の寸法は `shots` の表に持たせている。
- 撮影は実ブラウザの表示そのままで、合成・加筆はしていない。
- LARUbot は、チャットの窓を閉じた素の状態で撮っている
  （前の会話が残った窓を写さないため。会話の削除はしていない）。

### 2. `ProductVisual` を1つの形に統一した

4つ別々の描画関数をやめ、`shots` の表から
「ブラウザ枠 + 画面 + URL + 注記 + 背景の言葉」を組み立てる1つの部品にした。
枠・傾き・ホバー・`prefers-reduced-motion` の扱いは LARU HP で使っていたものを
そのまま4つに広げているので、挙動の差は無い。

注記は事実に合わせて書き換えた。

| | 変更前 | 変更後 |
| --- | --- | --- |
| LARUbot | 機能の紹介イメージ・実際のチャットは画面右下から | 実際の画面・チャットは画面右下から試せます |
| LARUSEO | 記事制作の紹介イメージ | 実際の画面・LARUbotに追加して使います |
| FLASTAL | プロダクトの紹介イメージ | 実際の画面 |

背景の大きな言葉（`lv-art-word`）も4つに広げた（つくる。／こたえる。／とどく。／あつまる。）。
色は各カードの地の色から取り、読むものではなく地の濃淡として置いている。

### 3. LARUSEO の位置づけを直した

LARUSEO は独立した開発中の製品ではなく、LARUbot のチャットボット・OSプランに
後から足すオプション。larubot.tokyo/laru-seo にも
「LARU SEOは、LARUbotに含まれるSEO記事制作支援機能です」と書かれている。

- 肩書き: `開発プロダクト` → `LARUbotのオプション`
- 説明文: 「LARUbotに追加して使うオプションとして」を明記
- タグ: `情報発信` → `LARUbotに追加`
- 行き先: `/contact` → `https://larubot.tokyo/laru-seo`（実物のページができているため）
- リンク文: `LARUSEOについて相談する` → `LARUSEOを見る`

呼び名は `LARUSEO` のまま置いた。LARU HP 側（プラン表・記事・ビルダー）が
すべて `LARUSEO` で書かれており、ここだけ `LARU SEO` にすると社内で二つの名前ができる。

### 4. 使われなくなったCSSを消した

`lv-dialog*` `lv-bubble*` `lv-bot-icon` `lv-paper*` `lv-text-lines`
`lv-flower` `lv-flower-title` と、それぞれのスマホ用の指定。
`lv-flower-art` は背景色だけが残るので `lv-flastal-art` に改名した。
company.css は 88行 減った。

## 確認したこと

- `npx tsc --noEmit`: エラーなし
- `npx eslint components/immersive/CompanyExperience.tsx`: エラーなし
- `npm test`: 828 passed
- `next build`: 成功
- `tests/browser/company-immersive-check.mjs`（320 / 390 / 1440px）: 88 passed
- 4枚のカードを PC 1440px・スマホ 390px で目視。画面が枠から出ない、
  注記が画面に重ならない、タブ切り替えで高さが飛ばないことを確認した。

## やっていないこと

push、本番設定、デプロイ、実送信、有料生成は含まない。
