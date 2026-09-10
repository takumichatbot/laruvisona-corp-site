# 顧客サイトのURL対応表

更新: 2026-09-10（C2: apex/www の主従を追記）。**訂正あり**（初版に事実誤認があった。下の「初版の誤り」参照）。
対象: `proxy.ts` / `app/hp/[slug]/**` / `app/hp/post/[postId]` / `lib/public-site-url.ts`

## 初版の誤り（訂正）

| 初版の記述 | 実際 |
|---|---|
| 独自ドメインでクエリが落ちる | **誤り。クエリは保持される。** `proxy` は `nextUrl.clone()` のあと `pathname` だけを変える。失われるのはパスであってクエリではない |
| 記事は `/hp/[slug]/post/[postId]` | **誤り。** 実ルートは `/hp/post/[postId]` だった（slug配下には無かった）。プレビューも `/hp/preview/[token]` |
| 標準公開URLでは記事が開く | サブドメイン形式は `/post/x` → `/hp/<slug>/post/x` へ写るが、**そのルートが存在しなかった**ので開けなかった |

## 1. ホストの種類

| 種類 | 例 | 決まり方 | proxy の扱い |
|---|---|---|---|
| 独自ドメイン | `salon-a.example` | `sites.custom_domain`（確認済みのみ） | ホストから slug を引き `/hp/<slug><path>` へ。引けなければ **404** |
| 標準URL（サブドメイン） | `<slug>.laruvisona.jp` | `sites.slug` | `/hp/<slug><path>` |
| 標準URL（パス） | `laruvisona.jp/hp/<slug>` | 同上 | 実ルート（書き換えなし） |
| 別名ホスト | `www.salon-a.example` / 旧ドメイン | `site_domains` にあり、`sites.custom_domain` ではない確認済みホスト | パスとクエリを保ったまま、そのサイトの正規URLへ **308** |
| 代理店の管理画面 | `agency.example` | `profiles.agency_admin_domain` | `/` をダッシュボードへ |
| 自社ホスト | `laruvisona.jp` / `*.onrender.com` | `MAIN_HOST` 等 | 書き換えなし |

## 2. パスごとの対応（実装後）

3つの形すべてが**同じルート** `/hp/[slug]/**` に集まる。ページの複製は無い。

| 外から見えるパス | 内部のルート | 備考 |
|---|---|---|
| `/` | `/hp/<slug>` | トップ |
| `/shop` | `/hp/<slug>/shop` | ショップ |
| `/post/<id>` | `/hp/<slug>/post/<id>` | **新設。** その slug のサイトに属する公開済み記事だけ |
| `/robots.txt` | `/hp/<slug>/robots.txt` | |
| `/sitemap.xml` | `/hp/<slug>/sitemap.xml` | |
| 未知のパス | `/hp/<slug>/<未知>` | ルートが無いので **Next.js が 404** |
| `/api/**` `/_next/**` | 素通し | 書き換えない（POSTを巻き込まない） |
| `/laruHP/**` `/hp/**` | 素通し | 顧客ホストからは管理画面・プレビューへ入らない |

クエリは全経路で保持される（`pathname` だけを書き換えるため）。

### 旧い記事URLの互換

公開済みHTML（`lib/html-export.ts`）は `/hp/post/<id>` を出している。
このルートは残すが、**表示せず** その記事が属するサイトの正規URLへ 308 で転送する。
記事IDだけで表示していたため、どのホストで開いても同じ内容が出ていた。

### canonical / JSON-LD / sitemap

`lib/public-site-url.ts` の `canonicalBase(site)` が、そのサイトの正規URLを1つに決める。
**入口のホストには依存しない**（保存された公開先の方針だけで決まる）。
トップ・ショップ・記事・sitemap・robots・決済の戻り先が同じ基点を使う。

| サイトの状態 | 正規URLの基点 |
|---|---|
| 主な独自ドメインあり | `https://<custom_domain>` |
| 主な独自ドメインなし | `https://laruvisona.jp/hp/<slug>` |

入口ごとに canonical を変えていた頃は、同じページに複数の正規URLができていた。
サブドメイン形式（`<slug>.laruvisona.jp`）は「開ける形」ではあるが正規URLにはしない。
独自ドメインの接続前後で正規URLが揺れないようにするため。

`isHostForSite(site, host)` は「そのホストでこのサイトを配信してよいか」だけを見る別の判断で、
canonical の決め方には関与しない。

ショップは以前 `NEXT_PUBLIC_APP_URL` から会社ホストのURLを作っていた。
JSON-LD にも Stripe の `successUrl` / `cancelUrl` にも同じ値を渡していたので、
独自ドメインで買った人が会社ホストへ戻されていた。これを正規URLに揃えた。

## 3. サイトをまたがせない

- 記事は `slug` からサイトを引き、`news_posts.site_id` の一致を必須にする。
  A のホストに B の記事IDを渡しても 404。
- 非公開の記事・非公開のサイトも 404。
- 未知のホストは、どのサイトにも解決せず 404（トップページを 200 で返さない）。

## 4. apex / www の主従（C2・実装済み）

同じサイトに確認済みのホストが2つ以上あることがある（`example.com` と `www.example.com`、
独自ドメインを変えたあとの旧ホスト）。**配信するのは1つだけ**にして、残りは転送元にする。

| 役割 | 決まり方 | 画面の表示 | 実際の挙動 |
|---|---|---|---|
| 主な公開URL | `sites.custom_domain` | 「主な公開URL」 | このホストで配信する。canonical もこれ |
| 転送元 | `site_domains` の確認済みホストで、主な公開URLではないもの | 「→ `<主な公開URL>` へ転送」 | パスとクエリを保ったまま **308** |
| 準備中 | `pending_ownership` / `pending_dns` / `ssl_pending` | 「準備中です。まだこのドメインでは公開されていません。」 | **404**（転送しない） |
| 失敗・解除待ち | `failed` / `release_pending` | 「まだこのドメインでは公開できていません。」 | **404** |

主従の切替は利用者が選ぶ（「主な公開URLにする」）。切り替えると、もう一方は自動的に転送元になる。
解除しなくてよい（旧ドメインのチラシ・QRコード・被リンクがそのまま生きる）。

### 転送先の作り方（安全側の約束）

転送先は **そのホストが属するサイト自身の正規URL** からしか作らない。
`site_domains.redirects_to`（外部の転送設定を観測した記録）は表示にだけ使い、配信の宛先には使わない。
観測値を宛先にすると、別サイトのホストや自分自身を指し得るため。

- 別サイトへは転送しない（宛先は同じ `site_id` の `sites.custom_domain`）
- 自分自身へは転送しない（同じホスト・同じパスなら 404 にする）
- 未公開サイトのホストは転送も配信もしない（`sites.published=is.true`）
- `/_next` `/api` は転送しない（所有確認の往復と静的配信を壊さない）
- 308 なのでメソッドと本文が変わらない（301/302 と違い POST が GET に化けない）

### `alias` 状態（外部で転送されているホスト）

利用者のレジストラやCDNが `www → apex` の転送を持っていることがある。
このとき署名付き到達確認は 3xx を受け取る。**リダイレクトは追わない**（転送先の応答を
到達の根拠にしない）ので、そのままでは「接続済みにならない」に見えていた。

C2 では、次をすべて満たすときだけ `alias`（転送設定）として記録する:

1. 申請ホスト側の所有確認（TXT）が取れている
2. `Location` のホストが、**同じサイトの**確認済みホストである（自分自身は除く）
3. その外部登録がこちらの都合で作ったものだと帰属が取れている

`alias` は主な公開URLにはできない（SQL側でも拒否する）。`alias` でなくなると `redirects_to` は消える。
## 5. 検証状況

### 実ビルド＋実HTTP（Next 16.3.4 本番用ビルド）— 28ケース通過

`next build` を通し、`next start` にホスト名を変えて実際にHTTPで確認した。
Supabase の応答だけローカルの読み取り専用fixtureに差し替えている（外部通信なし）。

**この検証は回帰検証として取り込んだ。** `npm run build && npm run test:http` で再現できる。

- `tests/http/cases.tsv` … 期待値（HTTP・転送先・本文に出てよい印・canonical）
- `tests/http/fixture.cjs` … PostgREST の応答を模す読み取り専用サーバ
- `tests/http/run.sh` … fixture と `next start` を自分で起動し、1件でも食い違えば非0で終わる

| Host | Path | HTTP | 本文 | canonical / Location |
|---|---|---|---|---|
| salon-a.example | `/` | 200 | Aのみ | `https://salon-a.example` |
| salon-a.example | `/post/a-post` | 200 | Aのみ | `.../post/a-post` |
| salon-a.example | `/post/b-post` | **404** | — | — |
| salon-a.example | `/shop` | 200 | Aのみ | `.../shop` |
| salon-a.example | `/does-not-exist` | **404** | — | — |
| salon-a.example | `/hp/site-b/post/b-post` | **404** | — | — |
| salon-a.example | `/hp/site-b/shop` | **404** | — | — |
| salon-a.example | `/laruHP/dashboard` | **404** | — | — |
| salon-a.example | `/hp/post/b-post` | **308** | 本文なし | → `https://bistro-b.example/post/b-post` |
| bistro-b.example | `/post/b-draft`（非公開） | **404** | — | — |
| unknown.example | `/` | **404** | — | — |
| laruvisona.jp | `/hp/site-b/post/b-post` | 200 | Bのみ | `https://bistro-b.example/post/b-post` |
| site-b.laruvisona.jp | `/post/b-post` | 200 | Bのみ | `https://bistro-b.example/post/b-post` |

C2 で追加した別名ホストのケース:

| Host | Path | HTTP | Location |
|---|---|---|---|
| www.salon-a.example | `/` | **308** | `https://salon-a.example/` |
| www.salon-a.example | `/shop` | **308** | `https://salon-a.example/shop` |
| www.salon-a.example | `/post/a-post?utm_source=flyer&lang=en` | **308** | `https://salon-a.example/post/a-post?utm_source=flyer&lang=en`（クエリ保持） |
| www.salon-a.example | `/does-not-exist` | **308** | `https://salon-a.example/does-not-exist`（転送先で404） |
| www.salon-a.example | `/hp/site-b/post/b-post` | **308** | `https://salon-a.example/hp/site-b/post/b-post`（**別サイトへは行かない**。転送先で404） |
| old-salon.example（旧ドメイン） | `/shop` | **308** | `https://salon-a.example/shop` |
| hidden.example（未公開サイト） | `/` | **404** | — |
| pending.example（確認前） | `/` | **404** | — |
| www.salon-a.example | `/_next/static/...` | **404** | 転送しない |

転送は1回で終わる（308の宛先をもう一度叩いて確認済み。二重転送も輪も無い）。
同じ記事を3つの入口から開いても canonical は同一。
会社ホストのパス形式で開いた記事の「トップへ」は
`https://bistro-b.example`（そのサイトの正規URL）になり、会社トップへ戻らない。
sitemap にはそのサイトの公開記事だけが載る（非公開の `b-draft` は含まれない）。

### 実PostgreSQL（16）でのSQL回帰 — シナリオ A〜R / 63アサーション

`supabase/run-sql-regression.sh` が一時クラスタを作って検証する。
C2 で追加したのは Q（`alias` は主な公開URLにできない・自動採用もされない・
`redirects_to` が残る）と R（`alias` でなくなったら `redirects_to` を消す）。

### 自動テスト — 330件

`npm test`。C2 で追加したのは:

- `tests/customer-routing.test.ts` … 別名ホストの308、下層パスとクエリの保持、
  旧ドメイン、独自ドメインを持たないサイトの標準URLへの転送、自己転送（輪）の拒否、
  別サイトへ転送しないこと、主な公開URLは転送せず配信すること、API/`_next` の素通し
- `tests/domain.test.ts` … `forwardTargetFor`（転送元の表示判断）、`alias` は配信先でないこと、
  状態一覧から回して文言の取りこぼしを防ぐこと
- `tests/domain-api.test.ts` … 画面が3つの状態を書き分けること、
  proxy が観測値（`redirects_to`）を配信の宛先に使っていないこと

### まだ確認していないこと

- 実際の独自ドメインでの接続試験（Renderのapex/www挙動を含む）。
- 本番に独自ドメインで公開中の顧客サイトがあるか（本番DBを見ていない）。
- 上のHTTP結果は、Google Fonts に到達できない環境のため
  `app/layout.tsx` のフォント読み込みだけを差し替えた診断用コピーによるもの。
  ルーティング・canonical・記事の所属確認には影響しない。
