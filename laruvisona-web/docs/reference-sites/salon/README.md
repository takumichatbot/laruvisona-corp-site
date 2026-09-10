# 基準作品 — 美容室「結い庵」（架空）

実在の店ではない。店名・住所・電話は架空のもの。

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

顧客が選んだ書体（Shippori Mincho）は Google Fonts から読む。
外に出られる環境で開けば、本物の明朝で表示される。

## 「同じ関数を使っている」と「保存→公開を完走した」は別

- `build.mjs` … `exportToHTML` を直接呼ぶだけ。**同じ関数を通っていること**の確認。
  出力はローカルの書き出し先にしか無く、サイトIDも仮の値。
- `publish-check.mjs` … 隔離環境で**保存→公開→表示まで通す**。
  `tests/http/fixture.cjs`（読み書きできる偽PostgREST）に保存済みの状態を置き、
  実際の公開ルート `/api/admin/republish-all` を `ADMIN_SECRET` で叩いて
  `published_html` を書かせ、公開URL `/hp/<slug>` が返す中身を確認する。
  画像はアプリの `public/salon/` から配信され、サイトIDはDB上の uuid が入る。

```bash
# 画像をアプリから配信できる場所へ置く
mkdir -p public/salon && cp docs/reference-sites/salon/images/*.jpg public/salon/

npx next build
node tests/http/fixture.cjs &
ADMIN_SECRET=test-admin-secret \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54999 \
NEXT_PUBLIC_APP_URL=https://laruvisona.jp \
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-stub SUPABASE_SERVICE_ROLE_KEY=service-stub \
npx next start -p 3300 &

ADMIN_SECRET=test-admin-secret \
node docs/reference-sites/salon/publish-check.mjs --app-root . --port 3300
```

確認する21項目: 保存済みブロックがある / 公開前は空 / サイトIDが uuid /
公開ルートが成功 / published_html が書かれた / 公開フラグ / 公開URLが200 /
中身（店名・料金・予約フォーム・入力の目印・メニュー引き継ぎ・固定ボタン・見本の明示）/
DBのHTMLがそのまま出る / 実際のサイトIDが入る / 仮IDが残っていない / 画像3枚の配信。

## builder に入れる

`site.json` の `blocks_json` / `seo_json` / `settings_json` を、
`sites` の同名カラムに入れて公開すれば同じものになる。

## 検証の道具（範囲が違うので分けてある）

| ファイル | 何を確かめるか | 範囲 |
|---|---|---|
| `build.mjs` | 同じ `exportToHTML` を通っていること | 関数の出力だけ。DBもサイトIDも仮 |
| `publish-check.mjs` | **管理者による一括再生成** → 保存 → 公開表示 | `/api/admin/republish-all`。利用者のビルダー保存は通っていない |
| `owner-publish-check.mjs` | **通常の利用者の保存 → 公開 → 表示 → 更新 → 再公開** | `/api/sites/<id>/publish`。認可（未ログインは401）も見る |
| `booking-check.mjs` | 予約導線（Cookie表示中・キーボード・実送信） | 実ブラウザ・実POST |

```bash
# 隔離環境を立てる（fixture + next start）
node tests/http/fixture.cjs &
ADMIN_SECRET=test-admin-secret NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54999 \
NEXT_PUBLIC_APP_URL=https://laruvisona.jp NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-stub \
SUPABASE_SERVICE_ROLE_KEY=service-stub npx next start -p 3300 &

ADMIN_SECRET=test-admin-secret node docs/reference-sites/salon/publish-check.mjs --port 3300
node docs/reference-sites/salon/owner-publish-check.mjs --port 3300
node docs/reference-sites/salon/booking-check.mjs --url http://127.0.0.1:3300/hp/yuian
```

## 写真

`images/` は**差し替え用のプレースホルダ**。実寸・実比率で作ってあるので、
同じ名前・同じ比率の写真に置き換えれば、トリミングも余白もそのまま合う。

### ヒーロー（B案・用意済み）

原本は `images/original/yuian-hero-B-original.png`（2400×1792）。**捨てない。**
配信用は原本から作る。作り直す手順は下の通り。

| 用途 | 比率 | 幅 | 形式 |
|---|---|---|---|
| PC | 4:3 | 800 / 900 / 1200 / 1600 | avif / webp / jpg |
| スマホ | 3:4（椅子と鏡が残る切り取り） | 780 / 1170 | avif / webp / jpg |

スマホは原本の (470, 20)-(1790, 1780) を切り出している。
16:9 や 4:3 だと椅子の脚元か鏡の上端が切れる。

実測（隔離環境・公開URL）:

| 端末 | 表示 | 実際に落ちたファイル | 転送量 |
|---|---|---|---|
| PC 1440px | 660×495 | `hero-900.avif` | **22 KB** |
| スマホ 390px dpr2 | 358×477 | `hero-sp-780.avif` | **30 KB** |

`loading="eager" fetchpriority="high"`、`width`/`height` 付き。

### まだ届いていない写真

`style-1〜4.jpg` と `staff-1〜3.jpg` は**差し替え用のプレースホルダ**。
生成済み・完成済みとして扱わないこと。B案と同じ方向（自然光・木・石）で
用意して差し替える。

| ファイル | 寸法 | 比率 | 何を写すか |
|---|---|---|---|
| style-1〜4.jpg | 1200×1500 | 4:5 | 仕上がりのスタイル。顔が分かりすぎない角度。背景は木か白壁で統一 |
| staff-1〜3.jpg | 600×600 | 1:1 | スタイリストの顔。中央に寄せる（円形に切られる） |

施術前後の比較は**外した**。生成画像を施術実績や効果の証明として扱わないため。
