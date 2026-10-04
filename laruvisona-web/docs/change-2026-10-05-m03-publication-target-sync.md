# 2026-10-05 M03 Publication Target の自動同期

LARU SEO の記事の「正規の公開先」（Publication Target）を、LARU HP の公開ライフサイクルに合わせて HP 側から自動で登録・停止・廃止する。
契約は LARUbot 側の仕様 `docs/integrations/laru_hp_publication_target_lifecycle.md`（e953113）だけ。LARU SEO 側は変えていない。

## 共通の呼び出し口

`lib/publication-target-sync.ts` の `syncPublicationTarget(site, action, { event, ownerSeo, reason })` 1 か所だけが
`POST {LARUBOT_API_URL}/api/hp/seo/publication-target` を呼ぶ（鍵は既存の `LARU_HP_API_SECRET`、ヘッダ `x-laru-secret`）。

- 対象：`settings_json.laruseoPublicId` があり、持ち主の契約に LARU SEO がある（既存の `laruEntitlement` をそのまま使う）。サイト設定で LARU SEO を切っていない。
- 除外：運営の一時テストサイト（public_id `f509753a-…`／site `3a99d73a-…`）。
- 記録：`[publication-target] {event, site_id, public_id, action, status, code, retryable, attempts, final}`。鍵・認証ヘッダ・個人情報は出さない。
- 再試行：5xx とタイムアウトだけ、300ms → 900ms → 2.7s の 3 回まで。401・400・404・409 は再試行しない。

## いつ呼ぶか

| 出来事 | 呼び出し | 順番 | 失敗したとき |
|---|---|---|---|
| 公開・再公開 | register | 公開後、記事一覧が 200 を返すのを確かめてから | 公開は止めない（未登録＝LARU 側が正規のまま） |
| 独自ドメインの設定・主の切替 | register（新しい base・同じ site_id） | 新しい URL の記事一覧が 200 になってから | 切替は止めない |
| 主の独自ドメインを外す | register（パス形式の base） | 外す前 | 外すのを保留（503） |
| 非公開 | deactivate site_unpublished | 記事ページが消える前 | 非公開を保留（503） |
| LARU SEO なしへの変更（プラン変更・支払い失敗・管理画面） | deactivate seo_disabled | 契約を書き換える前 | 変更を保留（Stripe の通知は 500 を返して再送させる） |
| LARU SEO ありへの変更 | register | 契約を書き換えた後 | 止めない |
| 解約 | retire plan_cancelled | 公開停止の前 | 保留 |
| サイト削除 | retire site_deleted | 削除の前 | 削除を保留（503） |

「消す前」の呼び出しは、成功・404・409（LARU 側が HP へ 301 していない）・鍵なし（登録もできていない）・対象外なら進む。
それ以外（401・5xx を再試行し尽くした）は状態が分からないので保留する。

記事の非公開・削除・slug 変更は今までどおり（Content API の 404/410/moved に従う）。サイト単位の deactivate はしない。

## そのほか

- 記事ページの 404 はキャッシュしない（`no-store`）。登録で 301 が始まった直後に、古い 404 が残らないようにする。
- サイトマップは変更なし（既存の「ここが正規か」の判定に従う）。

## 確認の入口

- `tests/publication-target-sync.test.ts`：呼び出しの中身・冪等・除外・401/409/5xx・順番（ソース）。
- `tests/http/publication-target-lifecycle-check.ts`：実サーバーで、呼ばれた瞬間の記事一覧の状態を LARUbot の代わりが記録し、
  register は 200 の後、deactivate/retire は 200 の間（そのあと 404）であることを確かめる。
- `tests/http/hp-seo-articles.sh` から両方を流す。
