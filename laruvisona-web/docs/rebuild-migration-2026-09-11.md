# 刷新の移行と、戻し方 — 2026-09-11（2026-09-11 改訂）

作業ブランチ: `rebuild-2026-09`（`main` から分岐）。
`main` の28コミットはそのまま。書き換え・まとめ直し・強制の押し込みはしていない。
push・本番SQL・DNS変更・デプロイは行っていない。

> **改訂の理由**
> 初版は「SQLの移行が無い＝データベースは変わらない＝コードを戻せば戻る」と
> 書いていた。これは誤り。一括再生成は `sites.published_html` を上書きするので、
> **生成物はデータベースに残る**。コードを戻しても表示は戻らない。
> この版では、再生成を自社ページの公開から切り離し、控えと戻し方を手順にした。

## この刷新で変わるもの／変わらないもの

| | 変わる | 変わらない |
|---|---|---|
| 既存の顧客サイトの見え方 | **再生成したときだけ**変わりうる（下記） | サイトID・公開URL・独自ドメイン・契約 |
| 保存されているデータの形 | 変わらない（列の追加も削除もしない） | `blocks_json` / `seo_json` / `settings_json` の形 |
| `sites.published_html` | 一括再生成を走らせたときに上書きされる | 走らせなければそのまま |
| 編集画面 | 新しい制作画面 `/laruHP/studio` が増える | これまでの `/laruHP/builder` はそのまま動く |
| 公開HTML | `EXPORT_VERSION` 7 → 10（GitHub main のコードは 3。下記） | 生成の入口（`exportToHTML`）は同じ |
| 自社の2ページ | 作り直し（`/` と `/laruHP`） | メタ情報・canonical・OGPの設定はそのまま |

### データベースの列

**追加も削除もしない。** 追加した設定（`design` / `designPreset` / `heroVideo` /
`bgImagePositionSp`）は、すでにある `settings_json` と `blocks_json` の中に入る。
移行のSQLは不要。

ただし「列を変えない」ことと「データを書かない」ことは別。
一括再生成は `published_html` を書く。ここが戻しの対象になる。

> **注意: この文書の「7 → 10」は、今回の刷新ぶんだけの数字。**
> GitHub `main`（`0d00dfe`）のコードの `EXPORT_VERSION` は **3**。
> ただし「コードが3」と「全顧客の保存済みHTMLが v3」は別のことで、後者は未確認。
> 保存済みの版は、その行を最後に公開したときのコードで決まるので混ざりうる。
> 数え方と、3 → 7 で何が変わるかは `docs/ship-plan-2026-09-11.md`（4-2 と B）。

### 再生成で見え方が変わりうる点（7 → 10 のぶん）

1. `data-lhp-block` の付与（見た目に影響しない目印）
2. `.lhp-hero-img` と写真の見せ場のCSS変数（未設定なら中央のまま）
3. 動く背景の仕掛け（`heroVideo` が無ければ何も出ない）
4. 入力文字の直列化を直したこと（`</script>` などが文字として出る）
5. 追加CSS（`customCss`）の中の `</style>` `<script` が、文字として出る
6. 「動く背景」を置いた作品で、作品側の「動き」の設定が「なし」でも背景が動く
   （端末の「動きを減らす」設定のときは、これまでどおり動かない）

`design` を持たないサイトには全体CSSを足さない（studio が既定値を補完しない）。
これは `studio-check.mjs` の「以前からある作品」で毎回確かめている。

## 起動しただけでは再生成しない

以前は `ADMIN_SECRET` があるだけで、起動60秒後に古い版の全公開サイトを
作り直していた。自社ページだけ先に出したくても、デプロイした時点で
顧客サイトの再生成が始まってしまう。

いまは **`REPUBLISH_ON_BOOT=1` を明示したときだけ** 走る（`server.js`）。
設定しなければ、起動時のログに「起動時の一括再生成はしない」とだけ出る。

## 出す順（この順で、途中で止められる）

### 段階1 — 自社の2ページだけ

デプロイする。`REPUBLISH_ON_BOOT` は設定しない。
顧客サイトの `published_html` は一切書かれない。

- 見るところ: `/` と `/laruHP` が開くか、初回表示の時間、問い合わせが届くか
- 止めるとき: `git revert`（下表）してデプロイし直す。DBは触っていないので、これで戻る

### 段階2 — 新しい制作画面を、知っている人だけに開ける

`/laruHP/studio` はURLを知っていれば開ける。ダッシュボードからの導線は張らない。
既存の `/laruHP/builder` はそのまま動く。

- 見るところ: 実際の顧客1件を開いて、直して、保存して、公開できるか
- 止めるとき: 導線を張っていないので、案内をやめるだけ

### 段階3 — 顧客サイトの再生成（ここだけDBを書く）

**作り直しの応答を、必ずファイルに残す。** その応答が、そのまま戻すための道具になる。

```bash
# 1. いまの姿を控える（読むため。これは戻す道具ではない）
curl -H "Authorization: Bearer $ADMIN_SECRET" \
  https://laruvisona.jp/api/admin/published-html-backup \
  > backup-$(date +%Y%m%d-%H%M).json

# 2. 何が対象になるかだけ見る（書かない）
#    ※ここに来る前に、Render で**新版が Live になっている**ことを確かめること。
#      旧版（0d00dfe）は dryRun を読まず、そのまま全件作り直してしまう。
#      応答に "dryRun": true が入らなければ旧版なので、すぐ手を止める。
curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" -H 'content-type: application/json' \
  -d '{"onlyOutdated":true,"dryRun":true}' \
  https://laruvisona.jp/api/admin/republish-all
#    → 対象ごとに、いまの中身の指紋（current_sha256）と版の古さ（outdated）が返る

# 3. まず1件だけ。応答を必ず保存する
curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" -H 'content-type: application/json' \
  -d '{"onlyOutdated":true,"slug":"<確かめる1件>"}' \
  https://laruvisona.jp/api/admin/republish-all \
  > run-$(date +%Y%m%d-%H%M)-01.json
#    → その公開URLを開いて、見え方・問い合わせ・予約を確かめる

# 4. 少しずつ広げる。**回ごとに応答を別ファイルへ保存する**
curl -X POST ... -d '{"onlyOutdated":true,"limit":5}'  ... > run-...-02.json
curl -X POST ... -d '{"onlyOutdated":true,"limit":25}' ... > run-...-03.json
curl -X POST ... -d '{"onlyOutdated":true}'            ... > run-...-04.json
```

応答の読み方:

| 欄 | 意味 |
|---|---|
| `updated` | 実際に書けた件数。**`error` が無いことではなく、行が1件更新できたことを数えている** |
| `conflicts` | 読んでから書くまでに、利用者が公開し直していた件数。書いていない |
| `failed` | 生成や書き込みで落ちた件数 |
| `undo` | **この回が書いた分だけ**を戻すための記録。前の中身と、この回が書いた中身の指紋が対で入っている |

**止める条件**（ひとつでも当てはまったら、そこで広げるのをやめて戻す）

- 対象の公開URLで、再生成の前後で見え方が変わった（余白・色・写真の切れ方）
- 問い合わせ・予約が届かなくなった
- 画面の例外が出た、初回表示が目に見えて遅くなった
- `failed` が1件でもある、または `conflicts` が想定より多い

### 段階4 — 結い庵を本番へ入れるか

**今回は入れない**（Codexの判断）。いまは検証用の fixture にしかない。
案内ページは画面写真と、その場で作る組立デモで成立している。

## 戻し方

### 表示を戻す（再生成したあと）

**戻すのは「その回が書いた分」だけ。** 保存した応答をそのまま送り返す。

```bash
# まず、いま戻すと何が起きるかを見る（書かない）
jq '. + {dryRun:true}' run-YYYYmmdd-HHMM-01.json | curl -X POST \
  -H "Authorization: Bearer $ADMIN_SECRET" -H 'content-type: application/json' \
  --data-binary @- https://laruvisona.jp/api/admin/published-html-backup

# 戻す
curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" -H 'content-type: application/json' \
  --data-binary @run-YYYYmmdd-HHMM-01.json \
  https://laruvisona.jp/api/admin/published-html-backup
```

応答の `counts` に、1件ごとの結果が入る。

| 結果 | 意味 | どうするか |
|---|---|---|
| `restored` | 書く前の姿へ戻した | — |
| `conflict` | **作り直したあとに、利用者が公開し直していた。** 戻すとその内容が消えるので書いていない | そのままでよい。利用者の新しい内容が生きている |
| `not_found` | その行が無い（消された・idが違う） | 消えたサイトなら、そのままでよい |
| `failed` | 書き込みに失敗した | 応答の `detail` を見る |
| `needs_expected` | 指紋が無い入力だった | 全件の控えを流し込もうとしている。作り直しの応答を使う |

**全件の控え（`backup-*.json`）をそのまま送っても戻りません。**
1件ごとに「いま置かれているはずの中身の指紋」が要ります。
控えを取ったあとに公開し直したサイトまで巻き戻さないための作りです。
どうしても中身を問わず上書きしたいときだけ `{"sites":[...],"force":true}` を使います
（標準の手順では使いません）。

**`EXPORT_VERSION` を 7 に戻すだけでは表示は戻りません。**
版を戻すと「起動時に作り直さない」だけで、すでに書かれた `published_html` は残ります。

### コードを戻す

```bash
git checkout main          # 作業ブランチを取り込まなければ、それだけで元の状態
```

取り込んだあとは、変更単位で戻せる。

| 戻したいもの | コマンド |
|---|---|
| 会社トップ | `git revert f756572` |
| LARU HP 案内ページ | `git revert d80593d` |
| 顧客向けの新機能（動く背景・写真の見せ場） | `git revert 88446ff` |
| 新しい制作画面と「サイト全体」の設定 | `git revert 46918f8` |
| 保存まわりの修正 | `git revert 3d03669` |
| 取り込み文字のエスケープ（第1版） | `git revert 9e687dc` |
| script/style への埋め込みとプレビューの隔離 | `git revert 84da3fe` |
| 公開の条件・旧サイトのdesign・同時保存 | `git revert 70ac8f9` |
| 画像の置き場所 | `git revert 48d3396` |
| 自社公開と顧客HTML再生成の切り離し | `git revert 9750813` |
| 案内ページの最初の画面と、触れるデモ | `git revert 2188124` |
| 会社トップの組み直し・雰囲気の見本 | `git revert efa342d` |
| 初回表示（和文webフォントを外した） | `git revert 490a141` |
| 戻す範囲の限定・更新0件の判定 | `git revert a7d22b8` |
| 冒頭のデモをコンパクトにした | `git revert 9741d90` |

（`git log --oneline main..rebuild-2026-09` で一覧が出る）

### 個別の画面だけ、以前のものへ戻す

```bash
git checkout f9a49ee -- laruvisona-web/app/page.tsx        # 会社トップ
git checkout f9a49ee -- laruvisona-web/app/laruHP/page.tsx  # LARU HP 案内ページ
```

以前のページが使っていた部品（`components/Canvas/`・`Estimator`・`VoiceUI`・
`Intro`・GSAP）は消していないので、戻すのはファイル1つで足りる。
ただし `tests/landing-page.test.ts` 等は新しいページ向けなので、一緒に戻す。

## いま本番に出すために残っている作業

1. **押し込み（push）とデプロイの判断**（齋藤さんの判断事項）
2. **素材の差し替え**（`docs/asset-requirements-2026-09-11.md`）
3. **和文の書体をどうするか**。初回表示を優先して、いまは端末の書体で組んでいる
   （`docs/perf-2026-09-11.md` の最後）。Windows の游ゴシックは細めなので、
   揃えたい場合は、使う文字だけを切り出した1ファイルを自分で持つ形になる。
