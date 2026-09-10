# フォント配布の比較と、採用した実装

計測日: 2026-09-10
対象: `app/layout.tsx` / `app/globals.css` / `components/BrandFonts.tsx` /
`components/PublishedSite.tsx` / `lib/html-export.ts`

このファイルは「再検証できること」を目的にしている。
数値の出どころ、除外したもの、代用したものをすべて書く。

## 訂正（2026-09-10・集計のみ）

初回の集計スクリプトは、フォント用CSSを `css` と `appFontCss` の**両方で合計に足していた**。
1リクエストを2回数えていたので、フォント用CSSを読み込むページの合計が
**約101KB多く出ていた**。

`docs/font-measurement/recount.mjs` で、保存済みのデータから合計だけを数え直した。
**これは再計算であり、再測定ではない**（ブラウザは開いていない。各リクエストのバイト数は初回のまま）。
訂正前の値は各行の `totalBeforeCorrection` に残してある。

合計は既存の `total` から引き算せず、**重複しない内訳から毎回組み立て直す**
（`html + appFont + customerFont + customerFontCss + css + js + img + other`。
`appFontCss` は `css` の内訳なので足さない）。
`totalBeforeCorrection` はまだ無いときにだけ書き、`summary` は訂正後の `samples` からのみ作る。
そのため**何度実行しても値は変わらない**。確かめ方:

```bash
node docs/font-measurement/recount.mjs --in ./docs/font-measurement --variants now,b
node docs/font-measurement/recount.mjs --in ./docs/font-measurement --variants now,b --check yes
# → すべて「OK 変化なし」になる（旧データ・訂正済みデータ・新しく測ったデータのいずれでも）
```

| 画面 | 案 | 訂正前 | 訂正後 |
|---|---|---|---|
| 顧客サイト | now | 1,506 | **1,405** |
| 顧客サイト | b | 1,056 | 1,056（変わらず） |
| 会社トップ | now | 1,487 | **1,387** |
| 会社トップ | b | 1,487 | **1,386** |
| 新LP | now | 407 | **306** |
| 新LP | b | 205 | 205（変わらず） |

以前「HTML等の差」と書いた約101KBも、この二重計上分だった。
集計スクリプトは修正済み（`appFontCss` は `css` の内訳として扱い、合計には一度だけ入る）。

---

## 1. 何が問題だったか

`app/layout.tsx` は全ページ共通のレイアウトで、そこで `next/font/google` の
`Noto_Sans_JP()` を呼んでいた。共通レイアウトにあるため、生成される
**@font-face 373件・生283KB（転送101KB）の CSS が、管理画面にも顧客の公開ページにも配られていた。**

さらに `app/globals.css` の

```css
h1, h2, h3, h4 { font-family: var(--font-noto-sans-jp), ...; }
```

が、顧客の公開ページの見出しにも当たっていた。
顧客の書き出しHTMLは `body` に顧客が選んだ書体を当てるが、CSSでは
「継承した値」より「直接当たった宣言」が勝つため、**顧客が別の書体を選んでも
見出しだけアプリ側の書体で上書きされていた**。そのために追加のサブセットも落ちていた。

実測でも確認している（下の「見出しの書体」）。

---

## 2. 採用した実装（案B）

方針: **会社のブランド書体と、顧客が選んだ書体は維持する。不要な共通配布と強制指定だけ外す。**

| 変更 | 内容 |
|---|---|
| `app/layout.tsx` | `next/font/google` の呼び出しを削除。共通レイアウトはフォントを配らない |
| `app/globals.css` | `--font-jp-system`（端末フォント）を追加し、`--font-noto-sans-jp` の**既定値**にした。ブランド書体を置かない画面はこれになる |
| `components/BrandFonts.tsx`（新規） | 会社の2書体（Space Grotesk / Noto Sans JP）を読み込み、`:root` の変数を実際の書体に差し替える |
| 会社サイト・LP | `BrandFonts` を置く。`app/page.tsx`、`app/laruHP/page.tsx`、`services` / `works` / `contact` / `blog` / `privacy` / `terms` の各 `layout.tsx` |
| `/lp-next` | 置かない。すでに `.font-system-jp` で端末フォントに組んであり、読み込んでも使われないため |
| `components/PublishedSite.tsx` | 顧客の公開HTMLを包む要素に `laru-published` を付与 |
| `app/globals.css` | `.laru-published :is(h1,h2,h3,h4,h5,h6) { font-family: inherit; }` を追加 |
| `lib/html-export.ts` | **変更なし。** 顧客が選んだ書体（noto / zen / mincho / rounded / biz / kaisei）は今までどおり Google Fonts から読む |

顧客の見出しは**端末フォントに変えていない**。アプリ側の指定をやめて継承に戻しただけで、
顧客が明朝を選べば見出しも明朝になる。

固定しているテスト: `tests/domain-api.test.ts` の
「共通レイアウトは日本語Webフォントを配らない」「ブランド書体は、ブランドを見せる画面だけが読み込む」
「顧客の公開ページの見出しに、アプリ側から書体を指定しない」「顧客が選んだ書体は、これまでどおり読み込む」ほか。

---

## 3. 計測の条件

再現手順と道具は `docs/font-measurement/` に置いてある。

| 項目 | 内容 |
|---|---|
| 比較対象 | **now**（この変更前）と **b**（採用実装そのもの）の2つだけ。案Cは採らないので計測していない |
| ビルド | Next.js 16.3.4 本番用ビルド（`next build`）→ `next start`。変種ごとに `.next/cache` を消してビルドし直す |
| ブラウザ | Chromium（Playwright）ヘッドレス |
| 端末 | PC 1440×900 dpr1 ／ スマホ 390×844 dpr2（iPhone の UA） |
| 回線 | CDP で固定。下り 1500KB/s（約12Mbps）／上り 750KB/s／遅延 70ms。両案で同一 |
| **測定回数** | 各（案 × 画面 × 端末）を **3回**。表の値は**中央値**。各回の値は `*.samples.json` に全部入っている |
| **キャッシュ条件** | 毎回まっさらな browser context で開く（キャッシュ空・ストレージ空・Service Worker なし）。2回目・3回目も新しい context なので、すべて初回訪問（コールド）の値 |
| 転送量の数え方 | ブラウザ自身の集計（CDP `Network.loadingFinished` の `encodedDataLength`）。Resource Timing は別オリジンの一部を数え落とし、顧客の書体が 0 件に見えたため使わない |
| 合計の作り方 | **1リクエストを1区分にだけ数える。** `appFontCss`（会社書体の@font-face宣言のCSS）は `css` の**内訳**であって、合計には `css` として一度だけ入る |
| データ | `tests/http/fixture.cjs`（PostgREST の応答を模した読み取り専用サーバ）。顧客サイトの本文は実際のヘアサロンのページに近い日本語量で、両案で完全に同一 |

### 代用・除外したもの（重要）

計測環境（Anthropic のクラウドコンテナ）から外部ホストへは出られない。
そのため次を代用・遮断した。**両案でまったく同じ条件**にしてある。

1. **会社のブランド書体**
   `next/font/google` はビルド時に Google からフォントを取りに行くため、この環境では動かない。
   齋藤さんの Mac で作られた本番ビルド（`.next/static/media/*.woff2` と生成済みCSS）から
   **実ファイルをそのまま取り出して** `/fonts/` に置き、`BrandFonts` はそれを読む差し替え版にした。
   **どの画面が読み込むかという配線は採用実装と同一**（`make-variant.py` を参照）。

2. **顧客が選んだ書体**
   Playwright で `fonts.googleapis.com` / `fonts.gstatic.com` を横取りし、ローカルから返した。
   顧客の選択は **Zen Kaku Gothic New** を想定。手元にその実ファイルが無いため、
   **Noto Sans JP のサブセット群を同じ名前で配って代用**している
   （分割数・1ファイルのサイズ・unicode-range の構造はCJKのGoogle Fontsとしてほぼ同等）。
   別名にしたのは、会社側とファミリ名が衝突すると「顧客の書体が読み込まれない」という
   実態と違う結果になるため（実際、両方 Noto Sans JP にすると顧客側は0件になる）。
   なお本番は 400;500;700;900 の4ウェイト、手元は 400/500/700 の3ウェイトなので、
   **顧客書体の分は実際よりやや小さく出ている。**

3. **顧客書体のCSSは非圧縮で計測している（293KB）。**
   Playwright の応答差し替えで `content-encoding: gzip` を付けると Chromium が中身を解釈できず、
   フォントが1件も読み込まれなくなったため。同じ内容を gzip したサイズは **100KB**
   （`customerFontCssGzipRef` に記録）。実際の Google Fonts は圧縮して配るので、
   顧客サイトの実際の合計は表より約 193KB 小さい。**両案で同じだけ差し引かれる。**

4. **遮断したもの**（両案とも）: `larubot.tokyo`、`cdnjs.cloudflare.com`、
   `googletagmanager.com`、`clarity.ms`。到達できないまま放置すると待ち時間が回ごとにばらつくため。

5. **測っていないもの**: 実際の独自ドメインでの表示、本番の回線・端末、
   顧客が noto 以外を選んだときのファイル数の違い、2回目以降の訪問（キャッシュあり）。

---

## 4. 実測値（中央値・3回・二重計上を除いた集計）

転送量は KB。「会社書体」＝会社のブランド書体、「顧客書体」＝顧客が選んだ書体。
**会社CSS は「CSS計」の内訳**で、合計には CSS計 として一度だけ入っている。

### スマホ（390×844 dpr2）

| 画面 | 案 | 合計 | 会社書体 | 件数 | CSS計 | （うち会社CSS） | 顧客書体 | 件数 | 顧客CSS | LCP | CLS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 顧客サイト | now | 1,405 | 248 | 11 | 130 | 101 | 573 | 30 | 293 | 496 ms | 0.0035 |
| 顧客サイト | **b** | **1,056** | **0** | **0** | **29** | **0** | 573 | 30 | 293 | 356 ms | 0.0033 |
| 会社トップ | now | 1,387 | 736 | 38 | 130 | 101 | 0 | 0 | 0 | 1,656 ms | 0.0057 |
| 会社トップ | **b** | 1,386 | 736 | 38 | 130 | 101 | 0 | 0 | 0 | 1,780 ms | 0.0057 |
| 新LP | now | 306 | 0 | 0 | 130 | 101 | 0 | 0 | 0 | 452 ms | 0 |
| 新LP | **b** | **205** | 0 | 0 | **29** | **0** | 0 | 0 | 0 | 360 ms | 0 |

### PC（1440×900）

| 画面 | 案 | 合計 | 会社書体 | 件数 | CSS計 | （うち会社CSS） | 顧客書体 | 件数 | 顧客CSS | LCP | CLS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 顧客サイト | now | 1,405 | 248 | 11 | 130 | 101 | 573 | 30 | 293 | 512 ms | 0.0011 |
| 顧客サイト | **b** | **1,056** | **0** | **0** | **29** | **0** | 573 | 30 | 293 | 380 ms | 0.0011 |
| 会社トップ | now | 1,387 | 736 | 38 | 130 | 101 | 0 | 0 | 0 | 2,080 ms | 0.0066 |
| 会社トップ | **b** | 1,386 | 736 | 38 | 130 | 101 | 0 | 0 | 0 | 1,584 ms | 0.0066 |
| 新LP | now | 306 | 0 | 0 | 130 | 101 | 0 | 0 | 0 | 480 ms | 0 |
| 新LP | **b** | **205** | 0 | 0 | **29** | **0** | 0 | 0 | 0 | 388 ms | 0 |

### 差

| 画面 | 減った転送量 | 減少率 | 内訳 |
|---|---|---|---|
| 顧客サイト | **−349 KB** | **−25%** | 会社書体 248KB ＋ 会社書体のCSS 101KB |
| 新LP | **−101 KB** | **−33%** | 会社書体のCSS 101KB（フォント本体は元から0件） |
| 会社トップ | ±0（1KBは回ごとのばらつき） | 0% | ブランド書体を維持 |

減った分は、**会社のブランド書体とそのCSSだけ**。
顧客が選んだ書体（573KB＋CSS）は両案とも同じだけ読み込まれている。

**CLS は変わっていない**（顧客サイト スマホ 0.0035 → 0.0033、PC 0.0011 → 0.0011）。
顧客が選んだ書体は両案とも読み込まれるので、書体差し替えによるズレは残る。

> 2026-09-10 初版レポートの「顧客サイト 854KB→184KB（−78%）」「CLS .031→0」は、
> **顧客が選んだ書体を読み込まない条件での値だった**。顧客サイト全体の削減率でも、
> CLSが0になるという結果でもない。上の表が正しい。

## 5. 見出しの書体（この変更のもう一つの効果）

顧客が「Zen Kaku Gothic New」を選んでいる顧客サイトで、`getComputedStyle` を実測した。

| 案 | `body` | `h1` | 読み込まれた書体 |
|---|---|---|---|
| now | Zen Kaku Gothic New | **Noto Sans JP**（アプリ側の指定） | Noto Sans JP 11件 ＋ Zen 30件 |
| **b** | Zen Kaku Gothic New | **Zen Kaku Gothic New** | Zen 30件のみ |

顧客が選んだ書体が見出しにも効くようになった。
アプリ側の書体が余分に11ファイル落ちていたのも同時に消えている。

代用した書体は実体が Noto Sans JP のサブセットなので、**スクリーンショットでは字形の違いが出ない**。
根拠は上の計算後スタイルと読み込み件数。実際の見え方は、顧客が明朝（Shippori Mincho）等を
選んだ本物の顧客サイトで確認すること。

---

## 6. 再現手順

### 必要な資産（先に用意する）

計測は、外部へ出られない環境でも動くように、2つの資産をローカルに置いて行う。
`run.sh` はどちらも無ければ止まる。

**(a) 会社のブランド書体** — 既定の置き場: `public/fonts/`

Google Fonts へ出られる環境（齋藤さんの Mac など）で一度 `next build` すると、
`next/font/google` が実ファイルを落としてくる。そこから取り出す。

```bash
# 会社のブランド書体を読み込む版（＝いまの main）でビルドする
npx next build

# 生成物: .next/static/media/*.woff2 と、@font-face だけのCSSチャンク2つ
#   Noto Sans JP  … @font-face が 300件以上ある大きい方
#   Space Grotesk … @font-face が数件の小さい方
grep -l "font-family:Noto Sans JP"  .next/static/chunks/*.css   # → noto 用
grep -l "font-family:Space Grotesk" .next/static/chunks/*.css   # → space 用

# public/fonts/ に置き、CSS内の url(../media/x.woff2) を /fonts/x.woff2 に直す
mkdir -p public/fonts
cp .next/static/media/*.woff2 public/fonts/
sed 's|\.\./media/|/fonts/|g' <上のnoto用CSS>  > public/fonts/noto.css
sed 's|\.\./media/|/fonts/|g' <上のspace用CSS> > public/fonts/space.css
```

**(b) 顧客が選んだ書体のCSS** — 既定の置き場: `tmp/customer-font.css`

顧客サイトが `fonts.googleapis.com` へ出す要求に、これを返す。
本物を使えるならそれが最善（`https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap`
の中身を保存する）。外部へ出られない場合は (a) の noto 用CSSから作る。

```bash
mkdir -p tmp
sed -e 's|/fonts/|https://fonts.gstatic.com/s/zenkakugothicnew/|g' \
    -e 's|font-family:Noto Sans JP|font-family:Zen Kaku Gothic New|g' \
    public/fonts/noto.css > tmp/customer-font.css
```

> 会社側とファミリ名を分けるのが要点。同じ名前にすると、ブラウザが会社側の
> @font-face を使ってしまい「顧客の書体が1件も読み込まれない」という
> 実態と違う結果になる。

Playwright も要る（`npx playwright install chromium`、または導入済みのものを
`PLAYWRIGHT_FROM` で指す）。

### 計測

```bash
bash docs/font-measurement/run.sh now b
```

1つの案につき **変種を作る → ビルド → 起動 → 案が反映されているか確認 → 計測 → 終了**
を順に行い、それが終わってから次の案へ進む。
最後に作った変種を両方の案として測る事故を防ぐため、計測の直前に
「配信されているHTMLが、いま作った案と一致しているか」を確かめて、
違えばそこで止まる。

場所は環境変数で変えられる（既定はリポジトリ直下）:

| 変数 | 既定 | 用途 |
|---|---|---|
| `APP_ROOT` | スクリプトの2つ上 | アプリのルート |
| `OUT_DIR` | `$APP_ROOT/tmp/measure` | 出力先 |
| `BRAND_FONTS` | `$APP_ROOT/public/fonts` | (a) の置き場 |
| `CUSTOMER_CSS` | `$APP_ROOT/tmp/customer-font.css` | (b) の置き場 |
| `PORT` / `FIXTURE_PORT` | 3200 / 54999 | 待ち受けポート |
| `RUNS` | 3 | 1条件あたりの測定回数 |
| `PLAYWRIGHT_FROM` | （空） | playwright の解決基点 |

個別に動かすこともできる:

```bash
python3 docs/font-measurement/make-variant.py b --app-root .
rm -rf .next/cache && npx next build
node tests/http/fixture.cjs &
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54999 NEXT_PUBLIC_APP_URL=https://laruvisona.jp \
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-stub SUPABASE_SERVICE_ROLE_KEY=service-stub \
npx next start -p 3200 &
node docs/font-measurement/measure.mjs --variant b --port 3200 --runs 3 \
  --brand-fonts ./public/fonts --customer-css ./tmp/customer-font.css --out ./tmp/measure
```

計測が終わったら、書き換えたファイルを戻す:

```bash
git checkout -- app/layout.tsx app/globals.css components/BrandFonts.tsx
```

### 集計だけをやり直す

保存済みのデータから合計を数え直す（ブラウザは開かない）:

```bash
node docs/font-measurement/recount.mjs --in ./docs/font-measurement --variants now,b

# 書き換えずに、値が変わらないことだけ確かめる
node docs/font-measurement/recount.mjs --in ./docs/font-measurement --variants now,b --check yes
```

`--in` は `<dir>/<案>.samples.json` と `<dir>/<案>/samples.json` のどちらの置き方でも読める
（前者はこのリポジトリの記録、後者は `measure.mjs` の出力）。

### 生の記録

- `docs/font-measurement/now.samples.json` / `b.samples.json` … 各回の全数値（各18サンプル）
- `docs/font-measurement/now.summary.json` / `b.summary.json` … 中央値、各回のLCP・CLS、計算後の書体（訂正後samplesから毎回作り直す）
- どちらも `correction` に訂正の経緯、各行の `totalBeforeCorrection` に訂正前の合計が入っている

---

## 7. 残っている宿題

- 顧客が選んだ書体のウェイトは4種（400;500;700;900）読み込んでいる。
  実際に使うウェイトだけに絞れるかは**未計測**。顧客サイトの転送量の大半はここにある。
- 顧客サイトの CLS（スマホ 0.0033）は、顧客の書体が差し替わるときのズレ。
  `size-adjust` 付きのフォールバック指定で減らせる可能性があるが**未計測**。
- 会社トップの合計 1,386KB のうち 736KB＋CSS101KB がブランド書体。ここを削るかは事業判断。
