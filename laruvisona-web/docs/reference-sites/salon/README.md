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

## builder に入れる

`site.json` の `blocks_json` / `seo_json` / `settings_json` を、
`sites` の同名カラムに入れて公開すれば同じものになる。

## 写真

`images/` は**差し替え用のプレースホルダ**。実寸・実比率で作ってあるので、
同じ名前・同じ比率の写真に置き換えれば、トリミングも余白もそのまま合う。

| ファイル | 寸法 | 比率 | 何を写すか |
|---|---|---|---|
| hero.jpg | 1600×1200 | 4:3 | 外観または店内。人物は入れず、光と素材が分かるもの |
| style-1〜4.jpg | 1200×1500 | 4:5 | 仕上がりのスタイル。顔が分かりすぎない角度 |
| staff-1〜3.jpg | 600×600 | 1:1 | スタイリストの顔。中央に寄せる（円形に切られる） |
| before.jpg | 1280×960 | 4:3 | 来店時。after と同じ画角・同じ明るさで |
| after.jpg | 1280×960 | 4:3 | 施術後。before と揃えないと比較が成立しない |
