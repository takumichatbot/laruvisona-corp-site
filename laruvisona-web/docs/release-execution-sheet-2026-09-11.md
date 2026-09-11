# 本番反映の実行シート（2026-09-11）

承認済み。基準は `docs/release-plan-2026-09-11.md`（rev2）。
**この作業環境からは本番に一切届かないため、A〜D は齋藤さんの手元で実行します。**

| 相手 | この環境から届くか | 実測 |
|---|---|---|
| GitHub（読み取り） | **届く**（クラウド側のみ） | `main` = `0d00dfe82b3688dfafb03058cca0e1e560ce4165` |
| GitHub（push） | 届かない | 連携中のPCのシェルからは proxy が 403。書き込み用の資格情報も持っていない |
| Render（管理画面・API） | 届かない | `api.render.com` / `dashboard.render.com` とも接続不可 |
| 本番 Supabase | 届かない | 接続情報を持たない（鍵は取得しない） |
| 本番サイトの管理API | 届かない | `ADMIN_SECRET` を持たない |

さらに、連携フォルダ上では **git のブランチ切り替えができません**（ファイルを置き換えられない）。
`git merge --ff-only` は**通常のローカル作業ディレクトリで**実行してください。

---

## S0. 実行直前の再確認（読むだけ）

### S0-1. SHA とコミット数（PCのターミナル）

```bash
cd <laruvisona_site のパス>
git ls-remote origin refs/heads/main          # 0d00dfe… であること
git rev-parse rebuild-2026-09                 # 押す先端SHA。控える
git rev-list --count origin/main..rebuild-2026-09   # 70 のはず
```

Render の Deploys で **Live が `0d00dfe`** であること。
Environment に **`REPUBLISH_ON_BOOT` が無い**こと。

| 控える | 値 |
|---|---|
| GitHub main | `0d00dfe82b3688dfafb03058cca0e1e560ce4165`（この環境で確認済み。実行時に再確認） |
| 押す先端SHA | ______________________ |
| コミット数 | ______________________ |
| Render Live | ______________________ |

### S0-2. Supabase（SQL Editor・読むだけ）

```sql
-- ① 既存の独自ドメインの割当（C のあとに legacy と照合する）
select id, slug, custom_domain
from public.sites
where custom_domain is not null and length(trim(custom_domain)) > 0
order by slug;

-- ② 作り直しの対象。id と slug を控える
select id, slug, name, updated_at
from public.sites
where published is true
  and (published_html is null or published_html not like '%<!--lhpv:11-->%')
order by slug;

-- ③ 公開中の総数
select count(*) from public.sites where published is true;
```

| 控える | 値 |
|---|---|
| ①のホスト一覧 | ______________________ |
| ②の `id` | ______________________ |
| ②の `slug` | ______________________ |
| ③公開中の総数 | ______________________ |

**止める条件**: Live が `0d00dfe` でない／`REPUBLISH_ON_BOOT` がある／
**②が2件以上**／**②の `slug` が空**

---

## A. Render に設定を2つ足す

1. 鍵を**齋藤さんの手元で**作る。**値は画面・チャット・ログのどこにも残さない**。

   ```bash
   openssl rand -hex 32          # 出力をそのままコピー（履歴に残したくなければ pbcopy へ）
   openssl rand -hex 32 | pbcopy # macOS。画面に出さずクリップボードへ
   ```

2. Render → 対象サービス → Environment → Add Environment Variable

   | キー | 値 |
   |---|---|
   | `DOMAIN_PROBE_SECRET` | 上でコピーしたもの（32文字以上）を**貼り付け**。貼ったら画面を閉じる |
   | `RENDER_APEX_IP` | Render の管理画面／公式ドキュメントで **いまの apex 用 IP** を確認して入力（コード既定は `216.24.57.1`。既定値頼みにしない） |

3. 保存 → 同じコミット（`0d00dfe`）で再起動。**Live が `0d00dfe` のまま**であること。
   自社トップ・制作画面、既存の独自ドメインがあればそのURLも開いて表示を確認。

**戻し方**: 追加した2キーを消す。
**止める条件**: 再起動が失敗／ページが開かない。

---

## B. main へ取り込んで push（＋自動デプロイ）

**通常のローカル作業ディレクトリで**実行（連携フォルダ上では切り替えができません）。

```bash
cd <laruvisona_site のパス>
git status                                  # 作業ツリーがきれいなこと
git checkout main
git merge --ff-only rebuild-2026-09         # 入らなければ止めて相談
git rev-parse HEAD                          # S0-1 で控えたSHAと一致すること
git push origin main
```

push すると Render のデプロイが始まる。Deploys で **Live が控えたSHAになる**まで待つ。
そのあと自社の2ページ・制作画面を **PCとスマホ**で開き、公開中サイトのURLも開く
（まだ作り直していないので見え方は変わらないのが正しい）。
ドメイン設定画面で、既存の割当が見えること（`migrationPending` の表示）。

**戻し方**: Render の Deploys から `0d00dfe` へロールバック＋`git revert`。
**止める条件**: `--ff-only` で入らない／push が弾かれる／ビルド失敗／Live が控えたSHAにならない。

### B のあと：新版であることの確認（書きません）

`<slug>` は S0-2 ②で控えたもの。**`slug` と `limit` を必ず付ける。**

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" -H 'content-type: application/json' \
  -d '{"dryRun":true,"slug":"<slug>","limit":1}' \
  https://laruvisona.jp/api/admin/republish-all
```

| 見るところ | 期待 |
|---|---|
| `dryRun` | `true` ―― **無ければ旧版。そこで止める** |
| `version` | `11` |
| `total` | `1` |
| `targets[0].id` | S0-2 ②の `id` と一致 |
| `targets[0].current_sha256` | 控える（D の直前照合で使う） |

---

## C. 独自ドメイン用DBの移行

Supabase の SQL Editor で `supabase/site_domains.sql` を**そのまま1本**流す。分割しない。
（関数11本は置き換え、旧シグネチャは削除、権限・ポリシー・トリガは作り直し、
末尾で `custom_domain` の行を `site_domains` へ取り込む＝**データが増える**）

続けて `supabase/site_domains_state_check.sql` を1本流す。

| | 期待 |
|---|---|
| `98 適用の判定` | **true** |
| `99 望ましい状態` | **true** |
| false の行 | **無し** |

```sql
select status, count(*) from public.site_domains group by status;
select host from public.site_domains where status = 'legacy' order by host;
```

`legacy` のホスト一覧が **S0-2 ①と完全に一致**すること（件数だけでなく中身）。

**止める条件**: SQLがエラーで止まる（途中まで入るので確認SQLを流して結果を控え、そこで報告。当て直さない）／
`98` か `99` が false（**例外で通さない**）／`legacy` が ① と一致しない。

---

## D. 指定した公開サイト1件の再生成

### D-1. 控えを取る（書きません）

```bash
curl -H "Authorization: Bearer $ADMIN_SECRET" \
  "https://laruvisona.jp/api/admin/published-html-backup?slug=<slug>" \
  > ~/laruhp-backup-<slug>-$(date +%Y%m%d-%H%M).json
```

`count: 1`、`sites[0].id` が S0-2 ②の `id` と一致すること。**保存先のパスを控える。**

### D-2. 直前照合（書きません）

B のあとと同じ `dryRun` をもう一度。`total: 1`、`id` 一致、
`current_sha256` が B のあとと**同じ**であること。
変わっていたら**そのあいだに誰かが公開し直した**ので、**再生成しない**。

### D-3. 再生成（**`slug` と `limit:1` を必ず付ける**）

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" -H 'content-type: application/json' \
  -d '{"slug":"<slug>","limit":1,"includeBefore":true}' \
  https://laruvisona.jp/api/admin/republish-all \
  > ~/laruhp-republish-<slug>-$(date +%Y%m%d-%H%M).json
```

**このファイルが復元用の記録です。保存先を控えてください。**

| 見るところ | 期待 |
|---|---|
| `version` | `11` |
| `total` | `1` |
| `updated` | `1` |
| `conflicts` | `0` |
| `failed` | `[]` |
| `undo.sites` | 1件だけ。`id` が対象と一致 |
| `undo.sites[0].published_html` | 空でない |
| `undo.sites[0].before_sha256` | 64桁。D-2 の `current_sha256` と一致 |
| `undo.sites[0].expected_sha256` | 64桁 |

**応答が受け取れなかった・不明なときは、再送しない。** 先に D-4 で「書かれたか」を確かめる。

### D-4. 仕上げの確認

```sql
select coalesce(substring(published_html from '<!--lhpv:([0-9]+)-->'), '（版の印なし）') as version,
       count(*) from public.sites where published is true group by 1;
```

`11` が 1件。公開URLを **PCとスマホ**で開き、見え方・問い合わせ・予約を確認。

**止める条件**: 版が `11` にならない／見え方が変わった／問い合わせ・予約が届かない。

---

## 戻すときの順番（重要）

`0d00dfe` に復元APIはありません。**復元 → そのあとコードを戻す**の順で。

```bash
# 1. 新版が動いているうちに、戻せるか確認（書きません）
jq '. + {dryRun:true}' ~/laruhp-republish-<slug>-*.json > /tmp/undo-dry.json
curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" -H 'content-type: application/json' \
  -d @/tmp/undo-dry.json https://laruvisona.jp/api/admin/published-html-backup

# results[0].status が restored であること。conflict なら止めて相談（force は使わない）

# 2. 実際に戻す
curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" -H 'content-type: application/json' \
  -d @~/laruhp-republish-<slug>-*.json https://laruvisona.jp/api/admin/published-html-backup

# 3. restored 1件・conflict/not_found/failed/needs_expected 0件。SQLでも版が 3 に戻ったこと
# 4. そのうえで、必要ならコードをロールバック
```

---

## 完了報告に入れるもの

| | 記入 |
|---|---|
| 稼働SHA（Render Live） | ______________________ |
| `98 適用の判定` | ______________________ |
| `99 望ましい状態` | ______________________ |
| 再生成した件数 | ______________________ |
| 再生成後の版数 | ______________________ |
| PC での確認結果 | ______________________ |
| スマホでの確認結果 | ______________________ |
| 復元用記録（再生成の応答）の保存場所 | ______________________ |
| 事前の控え（D-1）の保存場所 | ______________________ |

**鍵の値は書かないでください。** 設定は「有／無」だけで十分です。
