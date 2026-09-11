# Codex 独立レビュー — 本番読み取り記録シート

対象: `8ada48e5f33bf476c4b3c4af90bf55b236d35250` / `rebuild-2026-09`

## 判定

掲載された確認SQLにデータ変更・アプリの更新RPC呼び出し・秘密値の取得はない。
旧版の republish-all を呼ばない、環境変数の値を写さないという手順も妥当。
ただし C-3 の「移行済み・安全」の判定には以下の不足があり、独自ドメインの公開判定としては未完了。
アプリコードの前回レビュー結果は変更しない。

## R1 / P1 — 権限とガードの有効性を確認していない

対象: `docs/prod-readonly-check-2026-09-11.md:95`、同 `:139`。

(5) は site_domains のテーブルGRANTだけを見るため、security definer RPCのEXECUTEが一般ユーザーへ開いていても結果が変わらない。
(3) はトリガ名だけなので、custom_domain のガードを無効にしても同じ名前が出る。
RLS有効状態・ポリシー・解除キューの権限もこのシートでは確認していない。

一時DBで以下を実行し、記載チェックが変わらないことを確認した。

- set_primary の現行シグネチャに authenticated のEXECUTEを付与 → (5)は同じ、実際の has_function_privilege は true。
- guard_sites_custom_domain_trg を無効化 → (3)は同じ、実際の tgenabled は D。
- site_domains のRLSを無効化 → (3)(5)は同じ、実際の relrowsecurity は false。

修正: anon / authenticated の実効権限（継承・PUBLIC由来を含む）、service_roleの必要な権限、RPCの実行権限、両テーブルのRLSとポリシー、ガードの有効状態・対象テーブル・呼び出す関数を読み取りで確認する。
テーブル権限だけでなく列単位のINSERT/UPDATEも対象にする。キューを一般ユーザーが読んだり変更したりできないことも期待値に含める。
期待外の権限・無効ガード・不明な結果は「合格」にせず記録して止める。

補足: 正常な隔離DBでも既存の sites_updated_at が出るため、トリガ一覧の総数を「3件」に限定しない。必要な3定義を個別照合する。
隔離DBの既定GRANTでは TRUNCATE 等も表示される。INSERT/UPDATE/DELETEがないだけで「一切書けない」と判定しない。
これらは本番に同じ不備があるという断定ではなく、シートが検出できない状態の再現である。

## R2 / P2 — 現行の関数とキュー構造が欠けても検出できない

対象: 同 `:87`、`:102`、`:127`。

現行 set_primary(uuid,text,text,bigint) を落とし、旧形の set_primary(uuid,text,text) だけを置いた。
(4)は11行すべて missing=false、(4-b)は0行のままだが、現行シグネチャの to_regprocedure はNULLだった。
名前照合だけでは引数が変わった旧版を現行版として扱う。

また domain_release_queue.kind を落としても、C-3の各出力は正常時と同じだった。
キュー側には現行SQLが後から追加する verification_token / operation_epoch / release_operation_id / external_registration_owned / kind の5列があるが、記録シートは表の存在しか見ない。

修正: 状態遷移関数はスキーマ・名前・入力引数型で期待値を固定し、取り残しも同じ識別単位で検出する。
現行SQLのキュー追加列も期待値に含め、必要な型と併せて確認する。
「名前11件で移行完了」とは書かない。出荷計画4-3の同じ確認SQLにも反映する。

## R3 / P2 — 未適用状態で確認SQLが途中終了する

対象: 同 `:97`。

sitesだけがある空の一時DBで掲載C-3ブロックをそのまま実行したところ、(1)は false/false、(3)の public.site_domains::regclass で relation does not exist、終了コード3となった。
未適用は今回想定する正常な確認結果なので、判定用SQLがこの状態で失敗しないようにする。

修正: to_regclass とカタログのLEFT JOIN等で欠落を明示するか、(1)で表がない場合は残りを実行せず「未適用」と記録する分岐を明記する。
どちらでも、その場でマイグレーションを実行する必要はない。

## 記述の修正（上記と一緒でよい）

- 14行の「いま本番で動いているのは0d00dfe」は未確認なので「想定する旧版」にする。C-1でLiveを確認するまでは事実扱いしない。
- 155–156行の「あとで流せば足りない分だけ入る」は不正確。現行 site_domains.sql は関数・ポリシー・制約・トリガの置換、旧シグネチャの削除、legacy行の取り込みも行う。承認済みの移行手順で適用する旨に置き換える。

## 独立検証の範囲

- ef8b84d以降の差分は文書のみ。lib/app/tests/scripts/public のコード変更なし。
- ローカルのorigin/mainに対して64コミット先行。
- PostgreSQL 17の使い捨てクラスタ（Unix socketのみ）へ test-bootstrap.sql → schema.sql → site_domains.sql を適用。
- 正常時、旧シグネチャ置換、RPC権限開放、ガード/RLS無効化、キュー列欠落、未適用の各状態でシート内SQLを実行。
- 上記の変更は検証用DB内のみ。クラスタは終了・削除済み。
- 本番接続・本番SQL・秘密値閲覧・push・デプロイは未実施。コード変更がないため単体449件の再実行はしていない。

今回必要なのは確認シートと対応する出荷計画SQLの修正である。素材調整やアプリ全体の再検証は不要。
