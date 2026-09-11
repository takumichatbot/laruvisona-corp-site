# Codex 独立レビュー rev3（2026-09-11）

対象: `rebuild-2026-09` / `28c2960`。実装は変更せず、前回 R1・R2、出荷手順、改訂プレビューを確認。

## 独立確認した結果

- `npm test`: 438/438 通過。
- `republish-safety-check.mjs`: 39/39 通過。ローカルの実 Next.js API と検証用データサービスを使用。本番 Supabase の権限・トランザクションを検証した結果ではない。
- 全件バックアップに expected が無ければ復元せず、当該再生成の undo だけを戻すと A のみ復元し、後から公開された B は保持された。
- 存在しない ID を成功に数えず、再生成への割り込みは conflict となり undo にも入らない。
- `force:true` は検査を迂回できる管理者用経路として残る。「全経路で復元不能」ではなく「標準の復元経路で保護」と評価する。
- rev3 の PC・スマホ冒頭と雰囲気見本の画像を確認。冒頭を縮め、予約デモを展開する方向を採用し、素材投入へ進めてよい。今回、性能値の再計測はしていない。

前回 R1・R2 は今回の確認範囲で解消。

## P1: 新版専用 dryRun を旧版の本番確認に使わない

`docs/ship-plan-2026-09-11.md:133` は「出す前」の読み取り確認として、現行本番の再生成 API へ `{"dryRun":true}` を POST する。

しかし `origin/main`（`0d00dfe`）の実装が読む引数は `onlyOutdated` だけであり、dryRun は無視される。そのコードで応答した場合、公開中サイトを全件取得し、実際に published_html を更新する。確認操作のつもりで一括再生成するため、この手順は実行しないこと。本番には送信していない。

修正要求:

1. デプロイ前は読み取り専用 SELECT 等で、保存済み公開 HTML の版数分布を確認する。
2. Render の実稼働 SHA は Render の Deploys/API で確認する。`git ls-remote` が示す GitHub main の SHA は別項目として記録する。
3. 新コードが稼働していることを確認した後でのみ、新版の dryRun を利用する。
4. 「旧コードの EXPORT_VERSION は 3」と「保存済み公開 HTML がすべて v3」を区別し、後者を未確認のまま断定しない。
5. `site_domains` の表の有無は表の存在確認と表記する。関数・トリガ・権限を含む移行完了判定とは分ける。

版数分布の読み取り専用 SQL の例（未実行）:

```sql
select
  coalesce(substring(published_html from '<!--lhpv:([0-9]+)-->'), 'unmarked') as export_version,
  count(*) as site_count
from public.sites
where published is true
group by 1
order by 1;
```

## 次の進め方

出荷手順を修正し、Higgsfield 素材の組み込み・画像動画の最適化・素材入りの最終比較をまとめて進める。今回解消した点を理由なく繰り返し検証せず、素材変更の影響と残る出荷条件に絞る。

push・本番 SQL・DNS・デプロイ・本番再生成は未実施、未承認。
