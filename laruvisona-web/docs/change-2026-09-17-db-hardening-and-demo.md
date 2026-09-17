# 2026-09-17 本番DBの守りを閉じ、作ってあった見本を公開した

## 1. 本番DBへ適用したこと（Supabase SQLエディタ）

`supabase/security-and-missing-columns-2026-09-17.sql` の (2)(3) を適用した。
(1) の列追加と `supabase/larubot_conversations.sql`、`supabase/news_posts_scheduled.sql` は
これより前に適用済み。

```
drop policy if exists "sites_select_published" on public.sites;
revoke all on public.sites from anon;
```

```
create or replace function public.laruhp_guard_profile_billing() ... ;
drop trigger if exists laruhp_guard_profile_billing_trg on public.profiles;
create trigger laruhp_guard_profile_billing_trg before update on public.profiles ... ;
revoke insert, delete on public.profiles from anon, authenticated;
revoke all on public.profiles from anon;
```

### 適用後に実機で確かめたこと

| 見たこと | 結果 |
|---|---|
| `pg_policies` に `sites_select_published` が残っていないか | 0件 |
| `profiles` の番人トリガがあるか | 1件 |
| `has_table_privilege('anon','public.sites','select')` | false |
| `has_table_privilege('anon','public.profiles','select')` | false |
| `has_table_privilege('authenticated','public.profiles','update')` | true（列は番人で守る） |
| `role=authenticated` として `plan='agency', subscription_status='active'` に更新 | `profile_billing_server_only` で失敗。中身は変わっていない（更新前後で `(null)/inactive` 7件・`hp/active` 1件） |
| 公開ページ `/hp/-ec--mqzi7cww` | これまで通り表示される |
| 管理画面 `/laruHP/dashboard` | プロフィール・サイト7件とも読めている |

これで、ブラウザに配られる anon キーだけで
`settings_json`（通知先メール・LINEトークン・Webhook URL・閲覧パスワード・プレビュートークン）を
読み出すことはできなくなり、本人のJWTで自分のプランや停止状態を書き換えることもできなくなった。

## 2. 作ってあったのに、誰も辿り着けなかった見本を公開した

`app/laruHP/demo` は15業種ぶんの構成見本を持っていたが、

- `laruhp.com` の公開パスに入っておらず、開くと404
- `/laruHP` 配下の既定で `noindex, nofollow`
- リポジトリ全体で、このページへのリンクが**1本も無い**

という状態で、置いていないのと同じだった。
「申し込む前に中身を見たい」はいちばん多い止まり方なので、ここを入口にした。

- `page.tsx` をサーバー側に分け、metadata（title・description・canonical・OG）と
  `robots: { index: true, follow: true }`、パンくずの構造化データを持たせた。
  画面本体は `demo-client.tsx` へ移した。
- `/demo` を `LARUHP_PUBLIC_PATHS` と sitemap（priority 0.9）に入れた。
- 導線を4か所に足した: 共通フッター（公開11ページ）、LPのフッターと業種一覧、
  業種ページのヘッダーと末尾。
- 業種ページのヘッダーは `…/laruHP/studio?industry=…` を指していた。
  制作スタジオは契約が無いと403で止まるので、登録も契約も要らない見本へ向け直した。

### 書き直した売り文句

| 前 | いま | 理由 |
|---|---|---|
| クレジットカード登録のみ。初月は0円。 | 登録は無料です。作りはじめるにはプランの申し込みが必要で、月払いは初月0円 | 登録しただけでは制作スタジオが403になる |
| プロ品質のサイトが完成します | 業種と屋号を入れると、この構成で下書きが作られます | 確かめようがない |
| AI がコンテンツを自動生成 | 業種と屋号から下書きを作る | 実装に合わせた |
| SEO対策・Googleマップ連携 | タイトル・説明文・サイトマップなどのSEO基本設定 | 「対策」は結果の約束に読める |
| AIチャットボットが24時間対応 | チャットで来訪者の質問に応対 | 稼働時間をこちらで保証していない |

## 3. テスト

`tests/reachability.test.ts` に3本足した。

- 見本が公開パス・sitemap・index・4か所の導線すべてに乗っていること
- 見本のCTAが `/laruHP/...` の相対パスのまま（=laruhp.comで404）になっていないこと
- 「クレジットカード登録のみ」「プロ品質」が戻っていないこと

`tests/http/cases.tsv` に `laruhp.com /demo 200` を足した（33件に）。

単体 973件・経路 33件・build・eslint すべて通過。
