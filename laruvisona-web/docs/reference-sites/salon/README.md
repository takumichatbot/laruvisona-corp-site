# 基準作品 — 美容室「結い庵」（架空）

実在の店ではない。店名・住所・電話は架空のもの。写真はすべて生成素材で、
施術実績としては扱わない。

## これは何か

builder で作って「保存 → 公開」を押した結果と**同じHTML**が出るように、
`site.json` に `blocks_json` / `seo_json` / `settings_json` をそのまま置いてある。
手書きのHTMLは1行も無い。

`build.mjs` は公開API（`app/api/sites/[id]/publish/route.ts`）と同じことをする:

```
blocks_json → pages → exportToHTML(pages, seo, settings, name, businessInfo)
```

## 手元で見る

```bash
node --import ./tests/_resolve-ts.mjs docs/reference-sites/salon/build.mjs \
  --app-root . --out ./tmp/salon
cd tmp/salon && python3 -m http.server 8099
# → http://127.0.0.1:8099/
```

配信用の画像は `public/salon/` にある（アプリが普通に配る場所）。
build.mjs は書き出し先にも同じものを写し、avif / webp / jpg がそろっているかを見る。
`images/original/` は原本置き場で、配信には使わない。

顧客が選んだ書体（Shippori Mincho）は Google Fonts から読む。
外に出られる環境で開けば、本物の明朝で表示される。

## 隔離環境を立てる

以下の検証はすべて、この環境の上で動かす。

画像を置く手順は要らない。`public/salon/` に入っているので、
取得してビルドして起動すれば、そのまま配信される。

```bash
# 1. ビルド
npx next build

# 2. 偽のSupabase（読み書きできる）とアプリを立てる
node tests/http/fixture.cjs &
ADMIN_SECRET=test-admin-secret \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54999 \
NEXT_PUBLIC_APP_URL=https://laruvisona.jp \
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-stub SUPABASE_SERVICE_ROLE_KEY=service-stub \
ADMIN_EMAIL=owner@example.com \
npx next start -p 3300 &
```

`*.jpg` だけを写すのでは足りない。公開HTMLは `<picture>` で avif / webp を先に
選ぶので、jpg しか置かないと、置いていない形式を要求して画像が出ない。

## 検証の道具（範囲が違うので分けてある）

| ファイル | 何を確かめるか | 通っている範囲 |
|---|---|---|
| `build.mjs` | 同じ `exportToHTML` を通っていること | 関数の出力だけ。DBもサイトIDも仮 |
| `publish-check.mjs` | **管理者による一括再生成** → 公開 → 表示 | `/api/admin/republish-all`。利用者の保存は通らない |
| `owner-publish-check.mjs` | **利用者の 読み込み → 保存API → 公開 → 表示 → 更新 → 再公開** | `GET/PUT /api/sites/<id>`・`POST …/publish`。fixture への直接書き込みはしない。キャッシュも消さない |
| `builder-save-check.mjs` | **ビルダーの画面で触って保存し、開き直しても残るか** | 実ブラウザ。保存は実際の `PUT /api/sites/<id>` |
| `api-contract-check.mjs` | **実サーバ・実APIが受け取るか**（必須項目・拒否・受信内容） | 応答の差し替えなし。`/api/contact` が実際に受ける |
| `booking-check.mjs` | 予約フォームの**画面側**（Cookie表示中・キーボード・失敗時の戻り） | 応答は `route.fulfill` で差し替え。サーバは通らない |
| `heading-check.mjs` | ヒーロー見出しが**意味の切れ目で折り返しているか**（390px / 1440px） | 実ブラウザ。文字ごとの座標から行を数える |
| `img-measure.mjs` | ヒーロー画像が**どれを何バイト落としたか** | 実ブラウザ。CDPの転送量で測る |
| `delivery-check.mjs` | **普通に起動しただけで画像が配信されるか**（srcset で実際に選ばれた1枚まで） | 追跡されているファイルだけの取得から `next build` → `next start` |
| `concurrent-save-check.mjs` | 設定の一部保存が、**あいだに入った別の更新を消さないか** | 実API。偽DB側で読み取りと書き込みの隙間に更新を差し込む |
| `studio-check.mjs` | 制作画面の通し（きく→えらぶ→編集→保存→読み直し→公開）と、保存失敗時に公開させないこと | 実ブラウザ。保存失敗は保存先を実際に失敗させる |
| `republish-safety-check.mjs` | 一括再生成を**絞れる・その回の分だけ戻せる**こと。「Aだけ作り直す→Bを新しく公開→Aだけ戻す」でBが残ること。更新0件を成功と数えないこと | 実API。`server.js` の起動条件も見る |
| `demo-check.mjs` | 案内ページの組立デモが**幅に合い、本当に触れる**こと | 実ブラウザ。中の入力・送信・キーボードまで。送信先が呼ばれていないことも見る |
| `demo-timing-check.mjs` | デモが**見えるまで・触れるまで**の時刻 | 実ブラウザ。入れ物の中から知らせて、親の時計で測る |
| `hero-video-check.mjs` | 最初の画面の**動く背景**（写真が先・音なし・止められる・動きを減らす設定では読まない） | 実ブラウザ。試験用の映像をその場で配る。配信物には何も置かない |

```bash
ADMIN_SECRET=test-admin-secret node docs/reference-sites/salon/publish-check.mjs --port 3300
node docs/reference-sites/salon/owner-publish-check.mjs --port 3300
node docs/reference-sites/salon/builder-save-check.mjs --port 3300
node docs/reference-sites/salon/api-contract-check.mjs --port 3300
node docs/reference-sites/salon/booking-check.mjs --url http://127.0.0.1:3300/hp/yuian
node docs/reference-sites/salon/heading-check.mjs --url http://127.0.0.1:3300/hp/yuian
node docs/reference-sites/salon/concurrent-save-check.mjs --port 3300
node docs/reference-sites/salon/studio-check.mjs --port 3300
ADMIN_SECRET=test-admin-secret node docs/reference-sites/salon/delivery-check.mjs --port 3300
ADMIN_SECRET=test-admin-secret node docs/reference-sites/salon/republish-safety-check.mjs --port 3300
node docs/reference-sites/salon/demo-check.mjs --port 3300
ADMIN_SECRET=test-admin-secret node docs/reference-sites/salon/hero-video-check.mjs --port 3300
node tests/browser/brand-visual-check.mjs --port 3300
node docs/reference-sites/salon/demo-timing-check.mjs --url http://127.0.0.1:3300/laruHP --slow yes
# 顧客が選んだ書体（結い庵は明朝）も落として測るとき
#   perf-check / demo-timing-check とも --font-css と --font-dir を足す
```

### 取得したままの状態で確かめる

`delivery-check.mjs` は「手順を踏んだ人の手元でだけ映る」状態を防ぐためのもの。
追跡されているファイルだけを別の場所へ取り出し（`git archive HEAD | tar -x -C <dir>`）、
`npm ci` → `npx next build` → `npx next start` と普通に動かしてから当てる。

`booking-check.mjs` の「送った中身がPOSTに載っている」は、**受信できたこと**では
ない。実サーバが受け取ったかどうかは `api-contract-check.mjs` で見る。

### 外に出られない環境について

閉じた環境では `npx next build` が Google Fonts に届かず、
`next/font: Failed to fetch ...` で止まる（自社ページの同梱書体を取りに行くため）。
公開サイト側の書体は実行時にブラウザが読むので、この失敗とは関係ない。
その環境で通すには、`fonts.googleapis.com` / `fonts.gstatic.com` を通す
（許可するか、手元に控えたCSSとwoff2を返すものを立てる）。

## builder に入れる

`site.json` の `blocks_json` / `seo_json` / `settings_json` を、
`sites` の同名カラムに入れて公開すれば同じものになる。

## 見出しの折り返し

和文の見出しは語の途中でも折り返せてしまう。
「朝、鏡の前でうまくいく髪を。」は、PC 1440px でもスマホ 390px でも
**「朝、鏡の前でう / まくいく髪を。」**と切れていた（実測）。
`text-wrap:balance` も `word-break:auto-phrase` も、和文の語の切れ目までは
見てくれない（同じ環境で計り直して確認済み）。

そのため、折り返す位置は書き手が決める。見出しに入れた改行が `<br>` になる。
ビルダーでは、予約ブロックと同じ右の設定欄に「見出し（改行できます）」がある。

この作品では「朝、鏡の前で / うまくいく髪を。」で切っている。
`heading-check.mjs` が、390px と 1440px の両方で実際の行を数えて確かめる。

## 写真

`public/salon/` が**差し替え先**。実寸・実比率で作ってあるので、
同じ名前・同じ比率の写真に置き換えれば、トリミングも余白もそのまま合う。

以前はここを `docs/reference-sites/salon/images/` に置き、build.mjs で
public へ写していた。手順を踏まないと画像が出ない状態だったので、
置き場所そのものを `public/salon/` へ移した（`git mv`。中身は同じ）。

### ヒーロー（B案・用意済み）

原本は `docs/reference-sites/salon/images/original/yuian-hero-B-original.png`
（2400×1792）。**捨てない。** 配信用は原本から作り、`public/salon/` に置く。
配信用は原本から作る。

| 用途 | 比率 | 幅 | 形式 |
|---|---|---|---|
| PC | 4:3 | 800 / 900 / 1200 / 1600 | avif / webp / jpg |
| スマホ | 3:4（椅子と鏡が残る切り取り） | 780 / 1170 | avif / webp / jpg |

スマホは原本の (470, 20)-(1790, 1780) を切り出している。
16:9 や 4:3 だと椅子の脚元か鏡の上端が切れる。

実測（隔離環境・公開URL）:

| 端末 | 表示 | 実際に落ちたファイル | ヒーロー転送 | ページ合計 |
|---|---|---|---|---|
| PC 1440px | 660×495 | `hero-900.avif` | **28.0 KB** | 434 KB |
| スマホ 390px dpr2 | 358×477 | `hero-sp-780.avif` | **35.3 KB** | 308 KB |

`img-measure.mjs` で測り直した値。ページ合計は、この環境で Google Fonts を
遮断したときの数字（顧客の選択書体の分は入っていない）。

`loading="eager" fetchpriority="high"`、`width`/`height` 付き。
OGP画像は `/salon/hero-1200.jpg`（`hero.jpg` は無くなったので差し替え済み）。

### まだ届いていない写真

`style-1〜4.jpg` と `staff-1〜3.jpg` は**差し替え用のプレースホルダ**。
生成済み・完成済みとして扱わないこと。B案と同じ方向（自然光・木・石）で
用意して差し替える。

| ファイル | 寸法 | 比率 | 何を写すか |
|---|---|---|---|
| style-1〜4.jpg | 1200×1500 | 4:5 | 仕上がりのスタイル。顔が分かりすぎない角度。背景は木か白壁で統一 |
| staff-1〜3.jpg | 600×600 | 1:1 | スタイリストの顔。中央に寄せる（円形に切られる） |

施術前後の比較は**外した**。生成画像を施術実績や効果の証明として扱わないため。
