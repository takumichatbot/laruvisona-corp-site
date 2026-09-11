# 本番へ出す実行案（2026-09-11 / rev2）

**これは承認をもらうための案であって、実行記録ではない。**
この文書の時点で、push・本番設定・本番SQL・権限変更・DNS・デプロイ・本番再生成はどれも行っていない。

前提は 2026-09-11 の読み取り確認（`docs/prod-readonly-check-2026-09-11.md`）で
**実際に測った値**だけ。推測で埋めた欄は無い。

> rev2 で直したところ（Codex の独立レビュー指摘）
> 1. 再生成を**本当に1件へ**限定する（`slug` + `limit: 1` + 事前・直前の照合）
> 2. 成功判定を**実際の応答**（`total` / `updated` / `conflicts` / `failed` / `undo`）に合わせる
> 3. **復元 → そのあとコードを戻す**という順番にする（復元APIは新版にしかない）
> 4. 「旧版では独自ドメイン機能が動いていない」という前提を**取り消す**
> 5. push と自動デプロイを**1つの承認**にまとめ、コミット数を現在の値に直す

---

## 1. 承認をもらう単位（この4つ）

| | 承認する対象 | 本番に何が起きるか | 戻し方 |
|---|---|---|---|
| **A** | Render に設定を2つ足す | サービスが同じコミットで再起動する。挙動は変わらない | 設定を消す |
| **B** | `main` へ取り込んで push **＋ それに続く自動デプロイ** | GitHub の `main` が進み、**続けて Render が新しいコードに切り替わる**。この2つは分けて承認できない | Render を前のデプロイへロールバック＋`git revert` |
| **C** | `supabase/site_domains.sql` を本番DBへ適用 | 表2つ・関数11本・トリガ3本が入る。`custom_domain` がある行が `legacy` として取り込まれる（**データが増える**） | 下の「戻し方」C |
| **D** | 公開HTMLの作り直し **1件（slug指定）** | `sites.published_html` が 1行だけ書き換わる | 応答の `undo` を書き戻す（**新版が動いているうちに**） |

**B は1つの承認。** push すると Render の自動デプロイがそのまま走るので、
「push だけ先に」はできない。自動デプロイを止めてから push したい場合は、
先に Render 側で自動デプロイを切る必要がある（この案では切らない前提）。

push で進むコミット数は **`origin/main`（`0d00dfe`）から 70**。
push 直前に `git rev-list --count origin/main..HEAD` で必ず数え直す。

**DNS の変更と、新しい独自ドメインの追加・所有確認は、この案には入っていない。**

---

## 2. 前提にした実測（2026-09-11、読み取りのみ）

| | 実測 | この案での意味 |
|---|---|---|
| GitHub `main` の先端 | `0d00dfe` | B の push はここから進む |
| Render の Live | `0d00dfe`（一致） | **旧版が動いている。`dryRun` を読まない版**なので、B が終わるまで `/api/admin/republish-all` は叩かない |
| 公開中のサイト | 1件。`lhpv:3` が1件 | D の対象は1件。ただし**件数ではなく `slug` で限定する**（後述） |
| `site_domains` の適用 | **未適用**（98=false / 99=false。2表なし・11関数なし） | C が必要 |
| `DOMAIN_PROBE_SECRET` | **無** | A で足す |
| `RENDER_APEX_IP` | **無**（コード側に既定値 `216.24.57.1`。**旧版もこの変数を読む**） | A で明示的に入れる |
| `RENDER_API_KEY` / `RENDER_SERVICE_ID` / `RENDER_SERVICE_SLUG` / `ADMIN_SECRET` | 有 | 追加不要 |
| `REPUBLISH_ON_BOOT` | 無 | そのまま。**足さない** |

値そのものは取得していない。この案でも取得しない。

---

## 3. 旧版のドメイン機能について（前の版の記述を取り消す）

前の版に「独自ドメイン機能はまだ一度も動いていない」と書いたが、**これは誤り**。
2表と署名鍵が無いのは「**新しい方式が未適用**」という意味でしかない。
`0d00dfe` にも次がある（実際に確認した）:

- `app/api/sites/[id]/domain/route.ts` ―― 旧方式のドメイン設定。`RENDER_APEX_IP` も読む
- `app/api/sites/[id]/route.ts` の `custom_domain` 更新経路
- Render への登録・解除の経路

したがって **既存の割当がある前提で進める**。S0 で必ず一覧を控える。

**既存の配信は止まらない。** 主な公開URLの解決は `proxy.ts` の
`slugForCustomDomain()` が `sites.custom_domain` を引いており、`site_domains` は使わない。
表が無くても、あっても、配信経路は変わらない。
別名（apex/www のもう一方・旧ドメイン）からの308転送だけが `site_domains` を引くが、
**いまは表が無いので転送対象そのものが存在しない**（新しく増える機能であって、失われる機能ではない）。

**B から C までのあいだ、止まる管理操作。** 新版は表が無い状態を想定していて、
ドメイン設定画面は `migrationPending` として**既存の割当を `legacy` 表示する**
（`app/api/sites/[id]/domain/route.ts`）。ただし次は C まで使えない:

- 新しいドメインの追加・所有確認
- apex / www の主従の切り替え
- 解除（Render からの登録解除）

**この時間帯に顧客からドメインの依頼が来たら、C が終わるまで待ってもらう。**
B と C は同じ作業時間内に続けて行い、あいだを空けない。

**C が途中で失敗した場合。** 配信は上のとおり止まらない。
`site_domains.sql` は表・列・索引が `if not exists`、関数・ポリシー・トリガは作り直しなので、
**途中まで入った状態**になりうる。その場合は確認SQL（S7）を流して
false の行番号と項目を控え、**そこで止めて報告する**。追加で当て直さない。
なお `guard_sites_custom_domain_trg` が先に入っていると、
**旧コードからの `custom_domain` の更新が拒否される**（戻し方Cを参照）。

---

## 4. 今回コードに入れた是正（残っていた権限の件）

例外承認を前提にせず、移行SQL側で塞いだ。`supabase/site_domains.sql`:

```
revoke truncate, references, trigger on public.site_domains from authenticated, anon;
```

`domain_release_queue` には元から `revoke all` がある。これで2つの表とも塞がる。
確認SQL（`supabase/site_domains_state_check.sql`）の 27・28行は
「積み残し」から通常の権限検査へ移した。**当てた直後から `98` も `99` も true** が期待値。
回帰は 検出26 + 空振り24 = **50/50 通過**、既存のSQL回帰A〜Rも通過。
権限は減る方向だけの変更なので、`site_domains_permission_check.sql` の期待は変わらない。

→ **C のあとに `99=false` が出たら想定外。例外では通さず止める。**

### 順番を runbook と変えている点

runbook は「SQL適用 → デプロイ」を勧めているが、この案は「**デプロイ → SQL適用**」。
理由は、先にSQLを当てると `guard_sites_custom_domain_trg` が `sites` に付き、
**デプロイまでの間だけ旧コードからの `custom_domain` 更新が拒否される**ため。
デプロイが失敗して旧コードに留まると、その状態が続いてしまう。
逆順なら、デプロイが失敗してもロールバックするだけでDBは一切触っていない状態に戻せる。
代わりに、上に書いた「B から C までドメインの管理操作が止まる」時間ができる。
**この時間を短くするため、B と C は続けて行う。**

---

## 5. 手順

「本番に書く」が **はい** の行だけが承認の対象。

### S0. 直前の再確認と、対象の確定（読むだけ・承認不要）

```bash
git ls-remote origin refs/heads/main
git rev-list --count origin/main..HEAD     # push で進むコミット数
git rev-parse HEAD                          # push する先端SHA。控える
```

Render の Deploys で Live のコミットを見る。**両方 `0d00dfe` のままであること。**
Environment に `REPUBLISH_ON_BOOT` が無いことも、もう一度見る。

Supabase の SQL Editor（読むだけ）。**3つとも結果を控える。**

```sql
-- ① 既存の独自ドメインの割当（C のあとに legacy と照合する）
select id, slug, custom_domain
from public.sites
where custom_domain is not null and length(trim(custom_domain)) > 0
order by slug;

-- ② 作り直しの対象。id と slug を控える（D で slug 指定に使う）
select id, slug, name, updated_at
from public.sites
where published is true
  and (published_html is null or published_html not like '%<!--lhpv:11-->%')
order by slug;

-- ③ 公開中の総数
select count(*) from public.sites where published is true;
```

| 控える項目 | 値 |
|---|---|
| 押す先端SHA | ______________________ |
| 進むコミット数 | ______________________ |
| ①の件数とホスト一覧 | ______________________ |
| ②の対象 `id` | ______________________ |
| ②の対象 `slug` | ______________________ |
| ③公開中の総数 | ______________________ |

- 止める条件: Live が `0d00dfe` でない／`REPUBLISH_ON_BOOT` がある／
  **②が2件以上ある**（この案は1件を前提にしている。2件以上なら計画から作り直す）／
  **②の `slug` が空**（`slug` で限定できないので D に進めない）

### S1.【承認A】Render に設定を2つ足す ― 本番に書く: **はい（設定）**

| キー | 値 |
|---|---|
| `DOMAIN_PROBE_SECRET` | 32文字以上のランダム文字列。**齋藤さんの手元で作って、Render の入力欄へ直接貼る**（例: `openssl rand -hex 32`）。チャット・この文書・シェル履歴のどこにも残さない |
| `RENDER_APEX_IP` | Render の管理画面／公式ドキュメントで、いまの apex 用 IP を確認して入れる。コード側の既定値は `216.24.57.1` だが、**既定値頼みにしない**。旧版もこの変数を読むので、入れた時点から旧版の判定にも効く |

保存すると Render が同じコミット（`0d00dfe`）で再起動する。

- 戻し方: 追加した2キーを消す
- 止める条件: 再起動が失敗する／自社ページが開かなくなる

### S2. 再起動の確認（読むだけ）

Live が **`0d00dfe` のまま**であること。自社トップと制作画面が開くこと。
既存の独自ドメインがあれば、そのURLも開いて表示を確認する。

### S3.【承認B】push と、続けて走る自動デプロイ ― 本番に書く: **はい（稼働コード）**

```bash
git checkout main
git merge --ff-only rebuild-2026-09      # ff-only で入らなければ、そこで止めて相談
git rev-parse HEAD                       # S0 で控えたSHAと一致すること
git push origin main
```

push した時点で Render のデプロイが始まる。Deploys で
**Live が S0 で控えたSHAになる**まで待つ。

- 戻し方: Render の Deploys から前のデプロイ（`0d00dfe`）へロールバック。GitHub 側は `git revert`
- 止める条件: `--ff-only` で入らない／push が弾かれる／ビルド失敗／
  Live が控えたSHAにならない

### S4. 見た目の確認（読むだけ）

自社の2ページと制作画面を、PCとスマホの両方で開く。
公開中のサイトのURLも開く（**まだ作り直していないので、見え方は変わらないのが正しい**）。
既存の独自ドメインがあれば、そこからも開いて**配信が続いていること**を確認する。
ドメイン設定画面を開き、`migrationPending` の表示で既存の割当が見えることを確認する。

### S5. 新版であることの確認（`dryRun`）― 本番に書く: **いいえ（新版なら書かない）**

S0 ②で控えた `slug` を使う。**`slug` と `limit` を必ず付ける。**

```
POST /api/admin/republish-all
{ "dryRun": true, "slug": "<S0②のslug>", "limit": 1 }
```

確認すること:

| 項目 | 期待 |
|---|---|
| HTTP | 200 |
| `dryRun` | `true` ―― **これが無ければ旧版。そこで止める** |
| `version` | `11` |
| `total` | `1` |
| `targets[0].id` | S0②で控えた `id` と一致 |
| `targets[0].outdated` | `true` |
| `targets[0].current_sha256` | 控える（S8 の直前照合で使う） |

- 止める条件: 上のどれかが違う

### S6.【承認C】`site_domains.sql` を適用 ― 本番に書く: **はい（DB）**

`supabase/site_domains.sql` を**そのまま1本**流す。分割しない。
**「足りない分だけが入る」わけではない**ことを承知のうえで実行する:

- 関数11本は `create or replace` で**置き換わる**、旧シグネチャは `drop function`
- 権限・ポリシー・トリガは**作り直す**
- 末尾で `sites.custom_domain` の行を `site_domains` へ
  `insert ... on conflict (host) do nothing` で**取り込む（データが増える）**

- 戻し方: 下の「戻し方」C
- 止める条件: SQLがエラーで止まる（途中まで入った状態になるので、S7 を流して結果を控え、そこで報告）

### S7. 適用の確認（読むだけ）

`supabase/site_domains_state_check.sql` を1本流す。

| | 期待 |
|---|---|
| `98 適用の判定` | **true** |
| `99 望ましい状態` | **true** |
| false の行 | **無し** |

```sql
select status, count(*) from public.site_domains group by status;
select host from public.site_domains where status = 'legacy' order by host;
```

`legacy` のホスト一覧が、**S0 ①で控えたホスト一覧と完全に一致すること**（件数だけでなく中身）。

- 止める条件: `98` か `99` が false（**例外で通さない**）／`legacy` が ① と一致しない

### S8. 作り直しの前に、控えと直前照合（読むだけ）

**① 対象1件の控えを取って保存する**（`undo` とは別に、独立した控えを持つ）:

```
GET /api/admin/published-html-backup?slug=<S0②のslug>
```

応答をファイルに保存する。`count: 1` であること、`sites[0].id` が S0②の `id` と一致すること。

**② 実行の直前に、対象をもう一度照合する**:

```
POST /api/admin/republish-all
{ "dryRun": true, "slug": "<S0②のslug>", "limit": 1 }
```

`total: 1`、`targets[0].id` が S0②の `id` と一致、
`targets[0].current_sha256` が S5 と同じであること。

- 止める条件: `total` が 1 でない／`id` が違う／`current_sha256` が S5 から変わっている
  （＝そのあいだに誰かが公開し直した。**その場合は再生成しない**）

### S9.【承認D】公開HTMLの作り直し 1件 ― 本番に書く: **はい（DB）**

**`slug` と `limit: 1` で限定する。** `onlyOutdated` だけでは全件が対象になる。

```
POST /api/admin/republish-all
{ "slug": "<S0②のslug>", "limit": 1, "includeBefore": true }
```

**応答をそのままファイルに保存する。** 中に `undo` が入っており、これが戻すための記録になる。

確認すること（このAPIは `results` を返さない。返すのは次の項目）:

| 項目 | 期待 |
|---|---|
| HTTP | 200 |
| `version` | `11` |
| `total` | `1` |
| `updated` | `1` |
| `conflicts` | `0` |
| `failed` | `[]`（空配列） |
| `undo.sites` | **1件だけ**。その `id` が S0②の `id` と一致 |
| `undo.sites[0].published_html` | 空でない（戻すための中身が入っている） |
| `undo.sites[0].before_sha256` | 64桁。S8②の `current_sha256` と一致 |
| `undo.sites[0].expected_sha256` | 64桁（この回が書いた中身の指紋） |

- 止める条件: 上のどれかが欠けている／`updated` が 0／`conflicts` が 1 以上／
  `failed` が空でない／**応答を受け取れなかった（通信が切れた等）**
- **応答が無い・不明なときに、再送しない。** まず S10 の状態確認で
  「書かれたのかどうか」を確かめてから決める。二重に走らせない

### S10. 仕上げの確認（読むだけ）

```sql
select coalesce(substring(published_html from '<!--lhpv:([0-9]+)-->'), '（版の印なし）') as version,
       count(*) from public.sites where published is true group by 1;
```

`11` が 1件。S0③の総数と合計が合うこと。
公開URLを開いて、見え方・問い合わせ・予約が通ること。

- 止める条件: 版が `11` にならない／見え方が変わった／問い合わせ・予約が届かない

---

## 6. 止める条件（まとめ）

- S0: Live が `0d00dfe` でない／`REPUBLISH_ON_BOOT` がある／作り直し対象が2件以上／対象の `slug` が空
- S3: Live が控えたSHAにならない
- S5: `dryRun: true` が返らない ― **ここが旧版・新版の分かれ目**／`targets[0].id` が違う
- S7: `98` か `99` が false ― **例外で通さない**／`legacy` のホストが ① と一致しない
- S8: 対象の `id` か `current_sha256` が変わっている
- S9: `updated` が 1 でない／`conflicts` が 1 以上／`failed` が空でない／`undo.sites` が1件でない
- S10: 版が `11` にならない／見え方・問い合わせ・予約に変化

どこで止まっても、**その先へは進まず、結果だけ共有する。**

---

## 7. 戻し方

### 順番が重要（D を戻すときは、コードより先）

**`0d00dfe` には `/api/admin/published-html-backup` が無い。**
先にコードを戻すと `undo` を送る相手がいなくなる。必ずこの順で行う:

1. **新版が動いているうちに**、復元できるかを確かめる（書かない）:

   ```
   POST /api/admin/published-html-backup
   { ...S9で保存した応答そのまま..., "dryRun": true }
   ```

   `results[0].status` が `restored`（＝戻せる）であること。
   `conflict` なら**そのあと利用者が公開し直している**。戻すとその内容が消えるので、
   **そこで止めて相談する。`force` で押し通さない。**

2. 実際に復元する（`dryRun` を外して同じものを送る）:

   ```
   POST /api/admin/published-html-backup
   { ...S9で保存した応答そのまま... }
   ```

3. 結果を確認する。`restored` が1件、`conflict` / `not_found` / `failed` / `needs_expected` が0件。
   SQLでも版が `3`（元の版）に戻っていることを見る。

4. **そのうえで**、必要ならコードを戻す（下の B）。

S8①で取った控えは、`undo` が使えなかったときの最後の手段として残しておく。
ただし全件の控えを無条件に流し込む道は塞いである（`expected_sha256` が要る）。

### 段階ごと

| | 状況 | 手順 |
|---|---|---|
| **A** | 設定を戻す | Render の Environment から追加した2キーを消す |
| **B** | コードを戻す | Render の Deploys から `0d00dfe` のデプロイへロールバック。GitHub 側は `git revert`。**D を戻す必要があるなら、先に上の1〜3を済ませてから** |
| **C** | DBを戻す（標準） | **`drop table` はしない。** コードだけ戻し、2つの表は残す。旧コードは読まないので害は無い。ただし `guard_sites_custom_domain_trg` はテーブル側に残るため、**旧コードのままだと `custom_domain` の更新が拒否される**。完全に旧コードへ戻すなら `drop trigger if exists guard_sites_custom_domain_trg on public.sites;` も併せて実行する（外した瞬間に所有確認を飛ばす旧経路が復活することを承知のうえで） |
| **C'** | スキーマごと戻す必要がある場合 | 先に `site_domains` と `domain_release_queue` を別名の表へ退避してから落とす。退避した表は、Render 側の後始末が終わるまで消さない（`supabase/site_domains_runbook.md`） |
| **D** | 公開HTMLを戻す | 上の1〜4 |

**C を戻すときの照合**（runbook のとおり）:

```sql
select host, status, render_domain_id from public.site_domains
 where status in ('release_pending','ssl_pending','connected');
select host from public.domain_release_queue where resolved_at is null;
```

Render の custom domains 一覧と突き合わせ、DBに無いのに Render に残っているホストが無いか見る。

---

## 8. この案に入っていないもの

- **DNS の変更**、および新しい独自ドメインの追加・所有確認
- 結い庵を本番の `sites` へ入れること
- `REPUBLISH_ON_BOOT` を立てること（作り直しは手で、`slug` で限定して行う）
- 既定CSSに残る青（スタイリストの肩書き・タブ・おすすめの札の影）の生成側の修正
- 結い庵と会社トップのヒーロー動画（任意。受け口は空のまま）

---

## 9. この案の時点で未確認のまま残るもの

- **Render の apex 用 IP の現在値。** コードの既定値は `216.24.57.1` だが、
  この環境から Render へ接続していないので、いまも同じかは確認していない。S1 で目で見て入れる
- **既存の独自ドメインの割当の中身。** S0 ①で控える（この環境からは読めていない）
- **実際のDNS接続・到達確認の動作。** `DOMAIN_PROBE_SECRET` を入れてからでないと試せない
- **本番の関数・トリガの本体の挙動。** 確認SQLが見るのは名前・引数型・設定・定義文まで
- **本番で `authenticated` として接続して書き込みを試した結果**（カタログの照合であって実行結果ではない）
