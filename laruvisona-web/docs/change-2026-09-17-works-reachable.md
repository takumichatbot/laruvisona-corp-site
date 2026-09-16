# 書いてあるのに、誰にも読まれていなかった実績ページ（2026-09-17）

## 見つけ方

本番の公開URLを一通り叩いて、sitemap と突き合わせた。

```
sitemap: 21件 — すべて 200、canonical も正しい
sitemap に無い: /works, /works/larubot, /works/laruhp, /works/flastal
```

`/works/<slug>` の3ページは **200 で開くのに**、

- **sitemap に入っていない**（検索側が存在を知らない）
- **サイト内のどこからもリンクされていない**（人もたどり着けない）
- `/works` は `redirect('/#works')`。ところが会社トップに `#works` という
  目印は無く（あるのは `/lp-next` と LP の Showcase）、**ただトップが開くだけ**

受託を探している人がいちばん読みたいのは実績である。それが書いてあるのに、
人にも検索にも届いていなかった。

## 直したこと

### 1. `/works` を実体のある一覧にした

転送をやめ、3件を並べる一覧ページにした。各カードに分類・名前・一言・
概要・技術スタック・実際の画面を出し、下に相談と料金への導線を置いた。

### 2. sitemap に入れた（21件 → 25件）

```
/works                 priority 0.8
/works/larubot         priority 0.7
/works/laruhp          priority 0.7
/works/flastal         priority 0.7
```

### 3. サイトの中から行けるようにした

- 会社トップの「私たちがつくるもの」の下に
  「つくったものを、技術と画面つきで見る」
- フッターに「開発実績」「サービスと料金」
- 詳細ページの戻り先を `/#works`（存在しない）から `/works` へ

### 4. 空のスクリーンショット枠をやめ、実際の画面を入れた

これまで詳細ページには、破線の枠に

```
🖼 スクリーンショット 1
推奨 1600×1000px（16:10）
/images/works/larubot-1.png
```

と出ていた。**実績を見に来た人に空の枠を見せるのは、何も無いのと同じか、
それ以下である**（作りかけに見える）。

すでに撮ってある実画面に差し替えた。

| | PC | スマートフォン |
|---|---|---|
| LARUbot | `/company/products/larubot.jpg` | `larubot-sp.jpg` |
| LARU HP | `/lp/studio-edit.jpg`（制作画面） | `laruhp-sp.jpg` |
| FLASTAL | `/company/products/flastal.jpg` | `flastal-sp.jpg` |

FLASTAL の「紹介コンテンツ準備中」と `placeholder: true` も外した。
実際の画面が載ったので、準備中ではない。

## 検査

画像の差し替えは、抜けても誰も気づかない類なので、検査で縛った。

- 実績ページが sitemap に入っている
- 実績ページへの入口がサイトの中にある（リンクされていないページは書いていないのと同じ）
- 一覧が転送ではなく実体である／詳細の戻り先が実在する
- 空のスクリーンショット枠を出していない
- **載せる画面の画像が `public/` に実際に置いてある**（パスだけ書いて画像が無い事故を防ぐ）

## 確認したこと

- `tsc` / `eslint`: エラーなし
- `npm test`: 870 passed（新規5件）
- `next build`: 成功（`○ /works`、`/works/[slug]` は3件のSSG）

## あわせて確認した本番の状態

- laruvisona.jp の sitemap 21件すべて 200、canonical も一致
- `/index.html` `/terms.html` `/privacy.html` の転送は効いている
- `robots.txt` は制作画面・管理画面・APIを除外できている
- 存在しないURLは 404
- **料金の照合は10通りすべて `ok`**（年払いの価格IDを直した結果）
