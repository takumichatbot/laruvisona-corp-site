# LARU SEO の記事を、顧客サイトの実ページとして出す（M03・HP 側）

仕様（正）: LARUbot_homepage `docs/integrations/laru_hp_seo_article_contract.md`（M03・2026-10-04、GitHub で読み取りのみ）と、
本番の Content API の実際の応答（2026-10-04、自社の public_id で確認）。LARU SEO / LARUbot 側は変更していない。

## できたこと

| URL | 返し方 |
|---|---|
| `<サイト>/articles`（`?page=n`） | 一覧。公開済みのみ・20件ずつ・`has_next` でページ送り・画像は有るときだけ・0件は空の案内 |
| `<サイト>/articles/<slug>` | 本文。200（サーバーで完成した HTML）／301（slug の変更。最後の行き先へ1回）／404（無い・取り消し・別サイトが正規）／410（削除）／503（LARU SEO に届かない） |
| `<サイト>/sitemap.xml` | このサイトが LARU SEO の正規の公開先のときだけ、記事と一覧を `lastmod=updated_at` で追加 |

- `<サイト>` は既存の入口すべて：`laruvisona.jp/hp/<slug>`・`<slug>.laruvisona.jp`・独自ドメイン（proxy.ts の既存の書き換え）。laruhp.com では出さない
- Route Handler で返す（ステータスを正しく返すため・会社サイトの共通レイアウト／計測／構造化データを混ぜないため）
- 出す条件は公開ページで blog.js を出す条件と同じ（公開中・このホストで配信してよい・持ち主の契約に LARU SEO・設定で切っていない・public_id）。
  持ち主の契約の判定は `lib/hp-owner-entitlement.ts` へ移して共通化（判定は増やしていない）
- 公開ページの記事の置き場に、`/articles` への通常のリンクを1つ追加。blog.js はそのまま

## 正規 URL と index

- canonical は API の `canonical_url` のまま
- `publication.target_type=laruhp` かつ `canonical_base` がこのサイトの正規URL かつ `article_path=/articles/{slug}` → このサイトが正規
  - 本文は `indexable && is_primary_target && canonical_url がこのサイトの記事 URL` のときだけ index。一覧も index。サイトマップに載せる
- 公開先が LARU HP の別サイト → 記事ページを出さない（404）
- まだ LARU HP が公開先でない（今の本番の状態）→ 200 で出すが noindex。canonical は LARU 側の正規 URL。サイトマップに載せない（二重掲載しない）
- サイトの「検索に出さない」設定のときは noindex（サイトマップは既存どおり出さない）

## キャッシュ

- LARU SEO への取得：5分は手元の控え、過ぎたら `If-None-Match` / `If-Modified-Since` で確かめ、304 なら使い回す。エラーは控えない
- こちらの応答：200 は `public, max-age=0, s-maxage=300, stale-while-revalidate=600` と ETag（一致で 304）。404/410 は 60 秒、503 は no-store

## 確認の入口

`tests/http/hp-seo-articles.sh`（単体 9・実サーバー 39・320/390/430/1280/1512 の見え方 25）。Content API の代わりは `tests/http/seo-content-mock.cjs`
