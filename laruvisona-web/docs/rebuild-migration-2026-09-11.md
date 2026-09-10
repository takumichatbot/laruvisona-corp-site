# 刷新の移行と、戻し方 — 2026-09-11

作業ブランチ: `rebuild-2026-09`（`main` から分岐）。
`main` の28コミットはそのまま。書き換え・まとめ直し・強制の押し込みはしていない。
push・本番SQL・DNS変更・デプロイは行っていない。

## この刷新で変わるもの／変わらないもの

| | 変わる | 変わらない |
|---|---|---|
| 既存の顧客サイトの見え方 | 変わらない（`settings.design` が無ければCSSを足さない） | サイトID・公開URL・独自ドメイン・契約 |
| 保存されているデータ | 変わらない（列の追加も削除もしない） | `blocks_json` / `seo_json` / `settings_json` の形 |
| 編集画面 | 新しい制作画面 `/laruHP/studio` が増える | これまでの `/laruHP/builder` はそのまま動く |
| 公開HTML | `EXPORT_VERSION` 7 → 8 | 生成の入口（`exportToHTML`）は同じ |
| 自社の2ページ | 作り直し（`/` と `/laruHP`） | メタ情報・canonical・OGPの設定（layout側）はそのまま |

### データベースの変更

**ありません。** 追加した設定（`design` / `designPreset` / `heroVideo` /
`bgImagePositionSp`）は、すでにある `settings_json` と `blocks_json` の中に入る。
移行のSQLも、列の追加も不要。

### 公開HTMLの再生成

`EXPORT_VERSION` を 8 に上げてある。デプロイ後の起動時に `server.js` が、
版の古い `published_html` だけを `/api/admin/republish-all` で作り直す。
既存の運用と同じで、追加の手当ては要らない。

再生成で見え方が変わるのは次の3つ。いずれも既存サイトには影響しない
（`design` を持たないサイトには何も足さないため）。

1. `data-lhp-block` の付与（見た目に影響しない目印）
2. `.lhp-hero-img` クラスと写真の見せ場のCSS変数（未設定なら中央のまま）
3. 動く背景の仕掛け（`heroVideo` が無ければ何も出ない）

## 段階的に出す手順（案）

1. **自社の2ページだけ先に出す。** 顧客サイトの生成には触れない。
   戻すのは `git revert` 1回（下記）。
2. **新しい制作画面を、URLを知っている人だけに開ける。** 既存の編集画面は
   そのまま。ダッシュボードから導線を張るのは、実際の顧客で1件通してから。
3. **顧客サイトの再生成。** `EXPORT_VERSION` は上げてあるので、デプロイすれば
   自動で走る。走らせたくない場合は、デプロイ前に 7 へ戻す。
4. **結い庵を実データとして登録。** いまは検証用の fixture にしか無い。
   本番へ入れる場合は `docs/reference-sites/salon/site.json` を
   `sites` の同名カラムへ入れて公開する（README の手順のとおり）。

## 戻し方

### 全部戻す

```bash
git checkout main          # 作業ブランチを取り込まなければ、それだけで元の状態
```

### 取り込んだあとに、一部だけ戻す

変更単位を分けてあるので、コミット単位で戻せる。

| 戻したいもの | コマンド |
|---|---|
| 会社トップ | `git revert f756572` |
| LARU HP 案内ページ | `git revert d80593d` |
| 顧客向けの新機能（動く背景・写真の見せ場） | `git revert 88446ff` |
| 新しい制作画面と「サイト全体」の設定 | `git revert 46918f8` |
| 保存まわりの修正 | `git revert 3d03669` |
| 取り込み文字のエスケープ | `git revert 9e687dc` |

（`git log --oneline main..rebuild-2026-09` で一覧が出る）

### 個別の画面だけ、以前のものへ戻す

```bash
# 会社トップだけ以前のものへ
git checkout f9a49ee -- laruvisona-web/app/page.tsx
# LARU HP 案内ページだけ以前のものへ
git checkout f9a49ee -- laruvisona-web/app/laruHP/page.tsx
```

以前のページが使っていた部品（`components/Canvas/`・`Estimator`・`VoiceUI`・
`Intro`・GSAP）は消していないので、戻すのはファイル1つで足りる。
ただし、そのとき `tests/landing-page.test.ts` 等は新しいページ向けなので、
同じコミットから一緒に戻す。

### 公開HTMLの版だけ戻す

```bash
# lib/html-export.ts の EXPORT_VERSION を 7 に戻すと、一括再生成が走らない
```

## いま本番に出すために残っている作業

1. **押し込み（push）とデプロイの判断**（齋藤さんの判断事項）
2. **結い庵を本番の `sites` に入れるかどうか**。入れる場合、公開URLは
   `/hp/yuian`。案内ページからは画面写真で見せているので、入れなくても成立する。
3. **素材の差し替え**（`docs/asset-requirements-2026-09-11.md` の一覧）
4. **`lib/stripe.ts` の `PLAN` 定数の扱い**。`amount: 999` / `firstMonthAmount: 1`
   と書いてあるが、決済ルートから参照されていない。料金の正は
   `lib/laruhp-facts.ts` と Stripe の価格ID。消してよいか確認したい。
5. **自社2ページの初回表示**。回線とCPUを絞った条件で 3.9〜4.0秒（目安2.5秒）。
   原因は共通CSS 127KB が描画をせき止めること。ルートごとの分割が要る。
   顧客サイト側は同じ条件で 1.9〜2.1秒で目安の内側。
