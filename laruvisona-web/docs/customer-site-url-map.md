# 顧客サイトのURL対応表

更新: 2026-09-10。**訂正あり**（初版に事実誤認があった。下の「初版の誤り」参照）。
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

`lib/public-site-url.ts` の `publicBase(site, host)` が、開かれたホストに合わせて
そのサイトの正規URLを1つに決める。トップ・ショップ・記事・sitemap・robots・
決済の戻り先が同じ基点を使う。

| 開かれた形 | 正規URLの基点 |
|---|---|
| 独自ドメイン（`www.` 付きも） | `https://<custom_domain>` |
| サブドメイン | `https://<slug>.laruvisona.jp` |
| パス形式（独自ドメインあり） | `https://<custom_domain>`（独自ドメインが正） |
| パス形式（独自ドメインなし） | `https://laruvisona.jp/hp/<slug>` |

ショップは以前 `NEXT_PUBLIC_APP_URL` から会社ホストのURLを作っていた。
JSON-LD にも Stripe の `successUrl` / `cancelUrl` にも同じ値を渡していたので、
独自ドメインで買った人が会社ホストへ戻されていた。これを正規URLに揃えた。

## 3. サイトをまたがせない

- 記事は `slug` からサイトを引き、`news_posts.site_id` の一致を必須にする。
  A のホストに B の記事IDを渡しても 404。
- 非公開の記事・非公開のサイトも 404。
- 未知のホストは、どのサイトにも解決せず 404（トップページを 200 で返さない）。

## 4. Render の apex / www（次の差分 C2）

Render は apex と www の一方を登録すると他方からリダイレクトすることがある。
到達確認は `maxRedirects: 0` なので、**リダイレクトされる側は接続済みにならない**。
これは意図した挙動（リダイレクト先の応答を根拠にしない）だが、利用者には
「www を追加したのに接続済みにならない」に見える。

C2 では、接続状態と転送関係を分けて持つ。`Location` が同じサイトを指すことだけを
所有の根拠にしない（申請側の所有確認・外部登録の帰属・同サイトの確認済み転送先を
すべて満たす場合にのみ「別名」として記録する）。署名付き到達確認の
リダイレクト追跡禁止は維持する。

## 5. 検証状況

`tests/customer-routing.test.ts` で、実際の `proxy()` に本物の `NextRequest` を
通して12件を固定した（Supabase への参照だけ差し替え、外部通信なし）。
A/B 2サイトで解決先が混ざらないこと、クエリ保持、未知ホスト404、
管理画面・プレビュー・APIの素通しを含む。

`tests/public-site-url.test.ts` で正規URLの決め方と、記事のサイト所属確認・
旧URLの転送・ページ複製の不在を固定した。

### まだ確認していないこと

- **実ビルドでのHTTP応答**（404が本当に404で返るか）。この環境では
  `next build` が動かない（SWCのlinux/arm64バイナリが無い）。
  未知パスを存在しないルートへ渡す形にしたので Next.js の 404 になるはずだが、
  実ビルドでの確認は未了。
- 実際の独自ドメインでの接続試験（Renderのapex/www挙動を含む）。
- 本番に独自ドメインで公開中の顧客サイトがあるか（本番DBを見ていない）。
