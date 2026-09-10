# 顧客サイトのURL対応表（現状と、直すべきところ）

作成: 2026-09-10。**調査と設計のみ。コードは変更していない。**
対象: `proxy.ts` / `app/hp/[slug]/**` / `app/hp/by-domain/[domain]/**` / `lib/site-origin.ts`

独自ドメイン差分（所有確認・世代管理）とは別の変更単位として扱う。

## 1. ホストの種類

| 種類 | 例 | 決まり方 | proxy.ts の扱い |
|---|---|---|---|
| 主な公開URL（独自ドメイン） | `example.com` | `sites.custom_domain`。接続確認が取れたホストだけ入る | `/hp/by-domain/<host>` へ rewrite |
| 別名（www / apex の相方） | `www.example.com` | いまは**別々の候補として個別に接続**する必要がある | 同上（別のホストとして扱われる） |
| 標準の公開URL（サブドメイン） | `<slug>.laruvisona.jp` | `sites.slug`。ワイルドカードDNS前提 | `/hp/<slug>` へ rewrite（サブパス透過） |
| 標準の公開URL（パス） | `laruvisona.jp/hp/<slug>` | 同上 | 実ルート |
| 旧ホスト | 解除済みの独自ドメイン | `site_domains` から消える | システムホスト扱いにならず `/hp/by-domain/<host>` → 404 |
| 代理店の管理画面ドメイン | `agency.example` | `profiles.agency_admin_domain` | `/` をダッシュボードへ rewrite |
| 自社ホスト | `laruvisona.jp` / `*.onrender.com` | `MAIN_HOST` 等 | rewrite しない |

## 2. パスごとの対応（ここが今回の本題）

`proxy.ts` は独自ドメインの場合、`robots.txt` と `sitemap.xml` 以外の**すべてのパスを
トップページへ rewrite する**。下層ページが独立したURLにならない。

| パス | `<slug>.laruvisona.jp` / `/hp/<slug>` | 独自ドメイン `example.com` | 直すべきか |
|---|---|---|---|
| `/` | トップ | トップ | — |
| `/shop` | ショップ（`app/hp/[slug]/shop`） | **トップが出る**（別ページにならない） | **要修正** |
| `/post/<id>` | 記事（`app/hp/post/[postId]`） | **トップが出る** | **要修正** |
| `/preview/<token>` | プレビュー | **トップが出る** | 要検討（顧客向けではない） |
| 存在しないパス | 404 | **トップが200で出る**（ソフト404） | **要修正** |
| `?lang=xx` 等のクエリ | 保持される | rewrite先が固定のため**落ちる** | **要修正** |
| `/robots.txt` | `/hp/<slug>/robots.txt` | `/hp/by-domain/<host>/robots.txt` | — |
| `/sitemap.xml` | `/hp/<slug>/sitemap.xml` | `/hp/by-domain/<host>/sitemap.xml` | 内容が食い違う（下記） |
| `/api/**` | 素通し | 素通し | — |
| `/_next/**` | 素通し | 素通し | — |

### sitemap の食い違い

- `/hp/<slug>/sitemap.xml` … トップ + **`/shop`** + `?lang=` 各言語
- `/hp/by-domain/<host>/sitemap.xml` … トップ + `?lang=` 各言語のみ（`/shop` を出していない）

独自ドメインでは `/shop` が実際に開けないので、sitemap から外れているのは
現状の挙動としては整合している。ただし「下層ページを独立URLにする」なら
両方に載せる必要がある。

### canonical

- `/hp/<slug>` … `generateMetadata` は canonical を設定していない
- `/hp/by-domain/<host>` … `https://<host>`（トップ固定）

下層ページを独立URLにすると、canonical もページごとに変える必要がある。
いまはどのパスでもトップの canonical が出るため、下層を作った瞬間に
重複コンテンツになる。

### GET と POST

`proxy.ts` の rewrite はメソッドを問わない。フォーム送信は `/api/**`
（rewrite 対象外）へ出しているので現状は影響しないが、
下層ページを追加するときは **POST を rewrite で握りつぶさない**こと。

## 3. Render 側の apex / www の挙動

Render にカスタムドメインを追加すると、apex と www の**片方を登録すると
もう片方も候補として扱われ、一方から他方へリダイレクトされる**ことがある。
（公式: Custom Domains の www / apex の節）

この差分の設計との関係:

- 到達確認（`/api/domain-probe`）は **`maxRedirects: 0`**。
  Render 側で www → apex のリダイレクトが入るホストは、
  リダイレクトされる側では到達確認が成立しない。
- したがって **リダイレクトされる側のホストは「主な公開URL」にできない**。
  これは意図した挙動（リダイレクト先の応答で接続済みと判断しない）だが、
  利用者から見ると「www を追加したのに接続済みにならない」になる。

対応案（次の差分で実装する候補）:

1. 到達確認で 3xx を受けたとき、`Location` のホストが**同じサイトの
   確認済みホスト**であれば「別名（リダイレクト）」として記録し、
   `connected` ではなく `alias` という状態にする。
   主な公開URLにはできないが、画面には正しく「www → apex に転送」と出せる。
2. 画面で apex と www をペアとして扱い、「どちらを正規にするか」を
   1回選ばせる。もう一方は自動で別名にする。

いずれも到達確認のリダイレクト禁止は維持する（リダイレクト先の応答を
根拠にしない、という性質は変えない）。

## 4. 直す順番の案

1. **ソフト404をやめる**（`/hp/by-domain/<host>` にしか rewrite しない現状で、
   未知のパスを 404 にする）。SEO上の実害が一番大きい。
2. **クエリを保持する**（`url.search` を rewrite 先に引き継ぐ）。
3. **下層パスを独立URLにする**（`/shop`, `/post/<id>` を
   `/hp/by-domain/<host>/shop` などへ振り分ける）。canonical と sitemap を同時に直す。
4. **apex/www の別名**を状態として持つ（上記3節）。
5. 旧ホストの扱い（解除後にアクセスされたときの応答）を決める。

各段階で、既存の公開中サイトが落ちないことを先に確認する。
1〜3 は `proxy.ts` と by-domain 配下だけで閉じるので、
独自ドメインの接続処理（`site_domains`）には影響しない。

## 5. まだ確認していないこと

- 実際に独自ドメインで公開中の顧客サイトが存在するか（本番DBを見ていない）
- Render の apex/www リダイレクトの実挙動（実ドメインでの接続試験が必要）
- 現状の顧客サイトで `/shop` を使っているサイトがあるか
