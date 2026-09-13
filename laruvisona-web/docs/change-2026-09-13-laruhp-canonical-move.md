# LARU HP 案内URLの正式移転

前回413bf07では新ドメインでの配信を追加し、旧案内URLの本文も残していた。今回は旧URLを開いた訪問者が新ドメインへ着くようにする。

- laruvisona.jpとwwwの /laruHP・/laruHP/ のGET/HEADを https://laruhp.com/ へ308恒久転送。クエリを保持。会社トップ・制作/認証の下層・顧客公開ホストには適用しない。
- 会社トップ、サービス紹介、ログイン画面等の「LARU HPトップ」リンク22ファイルを新URLへ直接変更。ログイン・保存・決済APIのoriginはそのまま。
- LARU HPレイアウトのサービスURL/canonical、OGP画像内のURL表記を新ドメインへ。LPにWebSite構造化データを追加。専用ドメインのrobots/sitemapは前回から新URLを配信済み。
- ローカル単体531件、顧客HTTP回帰28件、本番用ビルド成功。型検査と対象のlintはerrorなし（proxyの既存未使用定数warning 1件）。
- 専用ドメインのブラウザ検査28件通過。Google Fontsを読み込む390/1440px、ローカルfixture。ローカルでは308を追従せず照合し、新URLを明示して開く（Playwrightの経路差し替えが転送先に再適用されず本番と混ざるのを防ぐ）。LIVE=yesでは実際の旧URLからブラウザが転送をたどる。本番検査は非読み取りリクエストを遮断する。
- Googleの検索結果表示はGoogleの再クロール・再処理を待つ。表示更新を完了したとは扱わない。Search Consoleでの申請も未実施。
- RenderのDNS/TLS設定は前回で接続済み。今回はコードのデプロイのみ。REPUBLISH_ON_BOOTは未設定を確認。DB/顧客HTML/DNSの変更なし。
- 戻す場合はこのコミットをrevertしてデプロイ。前回の新ドメイン配信が残り、旧URLも再び本文を返す。
- 本番ログは ~/Documents/LARUVisona/laruhp-move-20260913/ に保存。
