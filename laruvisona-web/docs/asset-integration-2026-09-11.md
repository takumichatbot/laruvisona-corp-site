# 素材が届いたら、どこに何を置くか（2026-09-11）

素材が無い状態でも画面は成立している。届いたら、この手順で入れ替える。
**置き場所とコードの受け口は、実ブラウザで先に通してある**（下の「確かめ済み」）。

素材の条件は `docs/asset-requirements-2026-09-11.md`。

---

## 1. 会社トップの主役ビジュアル ＝ **2026-09-11 実施済み**

Nano Banana Pro 側の原画を採用して組み込んだ。詳細は
`docs/change-2026-09-11-demo-and-brand.md`。手順は下のとおりだが、
**いまは原画をそのまま置くのではなく `scripts/brand-hero.mjs` を通す**。

```bash
node scripts/brand-hero.mjs --src <原画.png>   # public/brand/hero-{pc,sp}-*.{avif,webp,jpg}
node tests/browser/brand-visual-check.mjs --port 3300
```

原画は `LARU-Brain/atelier-comparison-20260911-8e2c7e9b/` にある（リポジトリには入れない）。
動画はまだ採用していないので `BRAND_VISUAL.video` は空のまま。

### （もとの手順）

| 何 | どこへ |
|---|---|
| 静止画 | `public/brand/hero.jpg`（無ければ `public/brand/` を作る） |
| 動画 | `public/brand/hero.mp4`（あれば `hero.webm` も） |

`components/BrandVisual.tsx` の末尾を書き換える。

```ts
export const BRAND_VISUAL = {
  poster: '/brand/hero.jpg',
  video: '/brand/hero.mp4',   // 動画がまだなら空のまま
  alt: '',                    // 装飾として置くので空でよい
};
```

確かめる:

```bash
node tests/browser/brand-visual-check.mjs --port 3300
```

**静止画だけ先に入れてよい。** 動画は空のままでも成立する
（Codex の指示どおり、静止画の完成を確認してから動画へ進む）。

## 2. 結い庵のスタイル写真 4枚

`public/salon/style-1.jpg` 〜 `style-4.jpg` を置き換える。
いまは灰色のプレースホルダが入っている。コードの変更は要らない。

## 3. 結い庵の架空スタッフ写真 3枚

`public/salon/staff-1.jpg` 〜 `staff-3.jpg` を置き換える。
**円形に切り抜かれる。** 頭頂と肩の余白を確かめる。コードの変更は要らない。

## 4. 結い庵のヒーロー動画

| 何 | どこへ |
|---|---|
| 動画 | `public/salon/hero.mp4`（あれば `hero.webm` も） |
| 写真（poster） | `public/salon/hero-1600.jpg`（すでにあるものをそのまま使う） |

`docs/reference-sites/salon/site.json` の最初の画面のブロックに足す。

```json
"heroVideo": "/salon/hero.mp4",
"heroVideoWebm": "/salon/hero.webm"
```

ビルダー／制作画面から入れる場合は「最初の画面 → 動く背景（mp4のURL）」。

確かめる:

```bash
ADMIN_SECRET=test-admin-secret node docs/reference-sites/salon/hero-video-check.mjs --port 3300
```

---

## 入れたあとに、必ず通すもの

```bash
# 1. 作品を作り直して、公開URLで見る
ADMIN_SECRET=test-admin-secret node docs/reference-sites/salon/publish-check.mjs --port 3300
ADMIN_SECRET=test-admin-secret node docs/reference-sites/salon/delivery-check.mjs --port 3300

# 2. 見た目の検査
node docs/reference-sites/salon/heading-check.mjs --url http://127.0.0.1:3300/hp/yuian
node docs/reference-sites/salon/demo-check.mjs --port 3300
node tests/browser/pages-check.mjs --port 3300

# 3. 性能を、顧客の選択書体を含む条件で測り直す（素材が入ると重くなるため）
node docs/reference-sites/salon/perf-check.mjs --url http://127.0.0.1:3300/ --slow yes --font-css ... --font-dir ...
node docs/reference-sites/salon/perf-check.mjs --url http://127.0.0.1:3300/laruHP --slow yes --font-css ... --font-dir ...
node docs/reference-sites/salon/perf-check.mjs --url http://127.0.0.1:3300/hp/yuian --slow yes --font-css ... --font-dir ...
node docs/reference-sites/salon/demo-timing-check.mjs --url http://127.0.0.1:3300/laruHP --slow yes --font-css ... --font-dir ...
```

測った値は `docs/perf-2026-09-11.md` に追記する。
**親ページのLCP・デモの写真が出るまで・デモが触れるまでを分けて書く。**

## 画像の作り方（写真を差し替えるとき）

配信用は avif / webp / jpg の3形式をそろえる。どれか欠けると、端末によっては
大きい画像しか落とせない。原本は `docs/reference-sites/salon/images/original/`。

```bash
# 例: 1600px の3形式
for ext in avif webp jpg; do
  npx sharp-cli -i <原本> -o public/salon/hero-1600.$ext resize 1600
done
```

そろっているかは `delivery-check.mjs` が見る（欠けると落ちる）。

---

## 確かめ済み（素材が来る前に、道だけ通してある）

| 何 | どうやって |
|---|---|
| 会社トップの動画（写真が先・音なし・画面の中・止められる・動きを減らす設定では読まない） | `BRAND_VISUAL` に試験用の映像を入れてビルドし、実ブラウザで15件通した。確認後もとに戻してある |
| 結い庵の動く背景（同上＋落とせないときは写真のまま） | `hero-video-check.mjs` 30件 |
| 画像の3形式がそろっていること | `delivery-check.mjs` 12件 |

**まだできていないのは、実物の素材を入れて見ることだけ。**
