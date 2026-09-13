# LARU HP 専用ドメインの接続

案内ページを https://laruhp.com/ で配信する。会社サイトと顧客公開サイトのURL、認証・制作・決済・保存のoriginは変えない。

## 変更
- proxy: サービスホストを顧客ホストより先に判定し、入口だけ /laruHP へrewrite。wwwと /laruHP はルートへ308。公開素材は同originで配り、制作・ログイン等は既存会社originへ307。未知パスは404、POST等は405。
- robots/sitemap/canonical/OGPは新しい案内URLに対応。旧 /laruHP も当面表示しcanonicalを新URLへ向ける。
- 案内ページのログイン・申込み・会社・法的ページへのリンクは既存originを明示する。
- デモの編集内容は期限2時間・サイズ上限・許可済み設定の検証を通すURLフラグメントで既存originの /laruHP/continue へ渡す。受信直後にフラグメントを消し、既存studioの引継ぎを使う。siteId・認証情報・任意URLは渡さない。既存下書き優先の仕様を維持。
- 新ドメインに会社用チャットの二重注入・管理用SW登録をしない。
- laruhp.comと配下を顧客による登録候補から除外。

## 確認
- 単体530件、既存顧客HTTP回帰28件。
- 本番用ビルド成功。検証ビルドのSupabaseはローカルfixture(54999)。製品ソースのフォント差替えなし。
- 専用ドメインブラウザ確認24件（390/1440px）。実際のoriginを保持してHTTPだけ3325の検証サーバに振り向ける。Google Fontsへの読み取りは許可。LCP測定でも実機試験でもない。
- 動画再生、横溢れ、canonical、会社/ログインの行先、別originへ移った後の編集した店名・見せ方の引継ぎを確認。
- 再実行: 検証ビルドを3325、fixtureを54999で起動し PLAYWRIGHT_FROM=<playwrightを解決できるディレクトリ> node tests/browser/laruhp-domain-check.mjs。
- 初回の素のビルドは検証用Supabaseキーが未設定で失敗。fixture用変数を明示した再ビルドは成功。型検査を無効化していない。

## 外部設定
- 所有者がムームーDNSで apex A=216.24.57.1 / www CNAME=laruvisona-corp-site.onrender.com を設定。公開DNSで確認済み。
- Render既存サービス srv-d8oq30ho3t8c73dvj3gg に apexを追加しwwwが自動追加された。両方verified。wwwの転送先はlaruhp.com。
- 顧客のsite_domainsテーブルには追加しない。サービス自身のドメインなのでDB移行・DNS追加変更・顧客HTML再生成は不要。
- リリース前のLiveは59741a6、REPUBLISH_ON_BOOTはなし。

## 戻し方
この変更をrevertしてデプロイする。旧会社ドメインの案内/認証/制作・顧客URLは維持される。新ドメインはこの変更を戻すと404となるため、必要なら配信先だけ別途案内する。顧客データやDBスキーマの復元は不要。

## 記録
実行ログ・スクリーンショット・Render登録応答は ~/Documents/LARUVisona/laruhp-domain-20260913/ に保存（資格情報なし）。本番の確認結果は本番反映後に同フォルダへ保存する。
