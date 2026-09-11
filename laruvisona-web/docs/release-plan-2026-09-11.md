# 本番へ出す実行案（2026-09-11）

**これは承認をもらうための案であって、実行記録ではない。**
この文書の時点で、push・本番SQL・権限変更・DNS・デプロイ・本番再生成はどれも行っていない。

前提は、2026-09-11 の読み取り確認（`docs/prod-readonly-check-2026-09-11.md`）で
**実際に測った値**だけ。推測で埋めた欄は無い。

---

## 1. 承認をもらう単位（この5つ）

順番に意味がある。上から順に、前が終わってから次へ進む。

| | 承認する対象 | 本番に何が起きるか | 戻し方 |
|---|---|---|---|
| **A** | Render に設定を2つ足す | サービスが同じコミットで再起動する。挙動は変わらない | 設定を消す |
| **B** | `rebuild-2026-09` を `main` へ取り込んで push | GitHub の `main` が 67コミット進む | `git revert`（履歴は残す） |
| **C** | Render のデプロイ（B に続いて自動で走る） | 公開中のサービスが新しいコードになる | 前のデプロイへロールバック |
| **D** | `supabase/site_domains.sql` を本番DBへ適用 | 表2つ・関数11本・トリガ3本が入る。`custom_domain` がある行が `legacy` として取り込まれる（**データが増える**） | 下の「戻し方」D |
| **E** | 公開HTMLの作り直し **1件** | `sites.published_html` が 1行だけ書き換わる | 応答の `undo` を書き戻す |

**DNS の変更と、実際の独自ドメインの有効化は、この案には入っていない。**
D と A で「独自ドメイン機能が動く状態」までは作るが、どのドメインを繋ぐかは別の判断。

---

## 2. 前提にした実測（2026-09-11、読み取りのみ）

| | 実測 | この案での意味 |
|---|---|---|
| GitHub `main` の先端 | `0d00dfe` | B の push はここから 67コミット進む |
| Render の Live | `0d00dfe`（一致） | **旧版が動いている。`dryRun` を読まない版**なので、C が終わるまで `/api/admin/republish-all` は叩かない |
| 公開中のサイト | 1件。`lhpv:3` が1件 | E の対象は **1件だけ**。段階的に増やす必要がない |
| `site_domains` の適用 | **未適用**（98=false / 99=false。2表なし・11関数なし） | D が必要。積み残しの実測ではなく「まだ何も無い」状態 |
| `DOMAIN_PROBE_SECRET` | **無** | A で足す。無いとどのドメインも「SSL準備中」から進まない |
| `RENDER_APEX_IP` | **無**（コード側に既定値 `216.24.57.1` あり） | A で明示的に入れる（既定値頼みにしない） |
| `RENDER_API_KEY` / `RENDER_SERVICE_ID` / `RENDER_SERVICE_SLUG` / `ADMIN_SECRET` | 有 | 追加不要 |
| `REPUBLISH_ON_BOOT` | 無 | そのまま。**足さない** |

値そのものは取得していない。この案でも取得しない。

---

## 3. 今回コードに入れた是正（残っていた権限の件）

読み取り確認の前に「移行SQLを当てても `anon` / `authenticated` に
`TRUNCATE` / `REFERENCES` / `TRIGGER` が残る」ことが分かっていた。
**例外承認を前提にせず、移行SQL側で塞いだ。**

`supabase/site_domains.sql`（`site_domains` の権限のところ）:

```
revoke truncate, references, trigger on public.site_domains from authenticated, anon;
```

`domain_release_queue` には元から `revoke all` がある。これで2つの表とも塞がる。

あわせて確認SQL（`supabase/site_domains_state_check.sql`）の 27・28行を
「積み残し」から通常の権限検査へ移した。**当てた直後から `98` も `99` も true** が期待値になる。
回帰（`supabase/run-state-check-regression.sh`）も、基準状態を
「落ちる行なし」に直し、逆向きのケース（`grant truncate` / `grant references(host)` で
27・28が落ちること）を足した。**検出26 + 空振り24 = 50/50 通過。**

あわせて、既存のSQL回帰（`supabase/run-sql-regression.sh`、シナリオA〜R）を
一時PostgreSQLで通し直した。**全シナリオ通過。** 今回の変更は権限を減らす方向だけなので、
`supabase/site_domains_permission_check.sql` の期待（利用者からの操作がすべて失敗すること）は変わらない。

→ **D のあとに `99=false` が出たら、それは想定外。例外では通さず止める。**

### 順番を runbook と変えている点（意識して変えている）

`supabase/site_domains_runbook.md` は「SQL適用 → デプロイ」を勧めている。
この案は逆の「**デプロイ → SQL適用**」にした。理由は2つ。

- 先にSQLを当てると `guard_sites_custom_domain_trg` が `sites` に付く。
  旧コードはこのトリガを想定していないので、**デプロイまでの間だけ
  旧コードからの `custom_domain` の更新が拒否される**。
  デプロイが失敗して旧コードに留まると、その状態が続いてしまう
- 独自ドメイン機能は**まだ一度も動いていない**（2表が未適用で、`DOMAIN_PROBE_SECRET` も未設定）。
  デプロイを先にしても失われる機能が無く、デプロイが失敗した場合は
  ロールバックするだけでDBは一切触っていない状態に戻せる

新コードは2表が無い状態でも壊れない（`custom_domain` を `legacy` として表示する）ことが
runbook に明記されている。S4〜S6 のあいだ、ドメインの追加・確認だけが使えない
――これは**いまと同じ状態**で、悪化しない。

---

## 4. 手順

「本番に書く」の列が **はい** の行だけが、承認の対象。

### S0. 直前の再確認（読むだけ・承認不要）

```bash
git ls-remote origin refs/heads/main
```

Render の Deploys で Live のコミットも見る。**両方 `0d00dfe` のままであること。**
Environment に `REPUBLISH_ON_BOOT` が無いことも、もう一度見る。

Supabase の SQL Editor（読むだけ）:

```sql
select count(*) as published from public.sites where published is true;
select count(*) as with_custom_domain from public.sites
 where custom_domain is not null and length(trim(custom_domain)) > 0;
```

`with_custom_domain` の件数を控える。**D のあとに `legacy` の件数と一致するか照合する。**

- 止める条件: Live が `0d00dfe` でない／`REPUBLISH_ON_BOOT` がある

### S1.【承認A】Render に設定を2つ足す ― 本番に書く: **はい（設定）**

| キー | 値 |
|---|---|
| `DOMAIN_PROBE_SECRET` | 32文字以上のランダム文字列。**齋藤さんの手元で作って、Render の入力欄へ直接貼る**（例: `openssl rand -hex 32`）。チャット・この文書・シェル履歴のどこにも残さない |
| `RENDER_APEX_IP` | Render の管理画面／公式ドキュメントで、いまの apex 用 IP を確認して入れる。コード側の既定値は `216.24.57.1` だが、**既定値頼みにしない** |

保存すると Render が同じコミット（`0d00dfe`）で再起動する。

- 戻し方: 追加した2キーを消す
- 止める条件: 再起動が失敗する／自社ページが開かなくなる

### S2. 再起動の確認（読むだけ）

Live が **`0d00dfe` のまま**であること。自社トップと制作画面が開くこと。
旧コードはこの2キーを使わないので、見た目も挙動も変わらないのが正しい。

### S3.【承認B】`main` へ取り込んで push ― 本番に書く: **いいえ（コードのみ）**

```bash
git checkout main
git merge --ff-only rebuild-2026-09      # ff-only で入らなければ、そこで止めて相談
git rev-parse HEAD                       # ← この値を控える（あとで Live と照合する）
git push origin main
```

- 戻し方: `git revert`（履歴は移行の記録なので消さない）
- 止める条件: `--ff-only` で入らない／push が弾かれる

### S4.【承認C】Render のデプロイ ― 本番に書く: **はい（稼働コード）**

B の push で自動的に走る。Deploys で **Live が S3 で控えたSHAになる**まで待つ。

- 戻し方: Render の Deploys から前のデプロイ（`0d00dfe`）へロールバック
- 止める条件: ビルド失敗／Live が控えたSHAにならない

### S5. 見た目の確認（読むだけ）

自社の2ページと制作画面を、PCとスマホの両方で開く。
公開中の1件の公開URLも開く（**まだ作り直していないので、見え方は変わらないのが正しい**）。

### S6. 新版の `dryRun` を1回 ― 本番に書く: **いいえ（新版なら書かない）**

```
POST /api/admin/republish-all
{ "dryRun": true, "onlyOutdated": true }
```

期待する応答: `dryRun: true` / `version: 11` / `total: 1` / `targets[0].outdated: true`。

- **`dryRun: true` が返らなければ、そこで止める。** 旧版が動いている証拠になる
- 止める条件: 上記のいずれかが違う／`total` が 1 でない

### S7.【承認D】`site_domains.sql` を適用 ― 本番に書く: **はい（DB）**

`supabase/site_domains.sql` を**そのまま1本**流す。分割しない。
**「足りない分だけが入る」わけではない**ことを承知のうえで実行する:

- 関数11本は `create or replace` で**置き換わる**、旧シグネチャは `drop function`
- 権限・ポリシー・トリガは**作り直す**
- 末尾で `sites.custom_domain` の行を `site_domains` へ
  `insert ... on conflict (host) do nothing` で**取り込む（データが増える）**

- 戻し方: 下の「戻し方」D
- 止める条件: SQLがエラーで止まる（途中まで入った状態になるので、そこで報告）

### S8. 適用の確認（読むだけ）

`supabase/site_domains_state_check.sql` を1本流す。

| | 期待 |
|---|---|
| `98 適用の判定` | **true** |
| `99 望ましい状態` | **true** |
| false の行 | **無し** |

```sql
select status, count(*) from public.site_domains group by status;
```

`legacy` の件数が、S0 で控えた `with_custom_domain` と**一致すること**。

- 止める条件: `98` か `99` が false／`legacy` の件数が合わない
  → **例外で通さない。** false だった行番号と項目を控えて報告し、そこで止める

### S9.【承認E】公開HTMLの作り直し 1件 ― 本番に書く: **はい（DB）**

対象は1件なので、段階的に増やす必要はない。

```
POST /api/admin/republish-all
{ "onlyOutdated": true, "includeBefore": true }
```

**応答をそのままファイルに保存する。** `undo` に、書く前の中身と
「この回が書いた中身の指紋」が入っている。これが戻すための記録になる。

- 戻し方: 保存した `undo` を `POST /api/admin/published-html-backup` へ送る。
  いまの中身の指紋が一致する行だけに書き戻すので、あとから利用者が公開し直していれば
  競合として止まる（巻き戻さない）
- 止める条件: `results` に `ok: false` が1件でもある

### S10. 仕上げの確認（読むだけ）

```sql
select coalesce(substring(published_html from '<!--lhpv:([0-9]+)-->'), '（版の印なし）') as version,
       count(*) from public.sites where published is true group by 1;
```

`11` が 1件。公開URLを開いて、見え方・問い合わせ・予約が通ること。

- 止める条件: 版が `11` にならない／見え方が変わった／問い合わせ・予約が届かない

---

## 5. 止める条件（まとめ）

- S0: Live が `0d00dfe` でない／`REPUBLISH_ON_BOOT` がある
- S4: Live が控えたSHAにならない
- S6: `dryRun: true` が返らない ― **ここが旧版・新版の分かれ目**
- S8: `98` か `99` が false ― **例外で通さない**／`legacy` の件数が合わない
- S9: `results` に `ok: false` がある
- S10: 版が `11` にならない／見え方・問い合わせ・予約に変化

どこで止まっても、**その先へは進まず、結果だけ共有する。**

---

## 6. 戻し方

| | 状況 | 手順 |
|---|---|---|
| **A** | 設定を戻す | Render の Environment から追加した2キーを消す |
| **C** | コードを戻す | Render の Deploys から `0d00dfe` のデプロイへロールバック。GitHub 側は `git revert` |
| **D** | DBを戻す（標準） | **`drop table` はしない。** コードだけ戻し、2つの表は残す。旧コードは読まないので害は無い。ただし `guard_sites_custom_domain_trg` はテーブル側に残るため、**旧コードのままだと `custom_domain` の更新が拒否される**。完全に旧コードへ戻すなら `drop trigger if exists guard_sites_custom_domain_trg on public.sites;` も併せて実行する（外した瞬間に所有確認を飛ばす旧経路が復活することを承知のうえで） |
| **D'** | スキーマごと戻す必要がある場合 | 先に `site_domains` と `domain_release_queue` を別名の表へ退避してから落とす。退避した表は、Render 側の後始末が終わるまで消さない（`supabase/site_domains_runbook.md`） |
| **E** | 公開HTMLを戻す | S9 で保存した `undo` を `POST /api/admin/published-html-backup` へ。全件の控えを流し込むやり方は使わない（対象外のサイトまで巻き戻す） |

**D を戻すときの照合**（runbook のとおり）:

```sql
select host, status, render_domain_id from public.site_domains
 where status in ('release_pending','ssl_pending','connected');
select host from public.domain_release_queue where resolved_at is null;
```

Render の custom domains 一覧と突き合わせ、DBに無いのに Render に残っているホストが無いか見る。

---

## 7. この案に入っていないもの

- **DNS の変更**、および実際の独自ドメインの有効化・所有確認
- 結い庵を本番の `sites` へ入れること
- `REPUBLISH_ON_BOOT` を立てること（作り直しは手で、範囲を絞って行う）
- 既定CSSに残る青（スタイリストの肩書き・タブ・おすすめの札の影）の生成側の修正
- 結い庵と会社トップのヒーロー動画（任意。受け口は空のまま）

---

## 8. この案の時点で未確認のまま残るもの

- **Render の apex 用 IP の現在値。** コードの既定値は `216.24.57.1` だが、
  この環境から Render へ接続していないので、いまも同じかは確認していない。S1 で目で見て入れる
- **実際のDNS接続・到達確認の動作。** `DOMAIN_PROBE_SECRET` を入れてからでないと試せない
- **本番の関数・トリガの本体の挙動。** 確認SQLが見るのは名前・引数型・設定・定義文まで
- **本番で `authenticated` として接続して書き込みを試した結果**（カタログの照合であって実行結果ではない）
