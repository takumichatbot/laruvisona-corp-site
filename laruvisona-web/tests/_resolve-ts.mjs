// テスト実行用の解決フック。
//
// アプリのコードは Next.js の解決に合わせて拡張子なしで import する
// （import { x } from './domain'）。一方 node --test の ESM 解決は
// 拡張子を補完しないので、そのままだと lib 同士を import している
// モジュールをテストから読み込めない。
//
// アプリ側の書き方を変えるとビルド側の挙動に影響が出るので、
// テスト側にだけ「拡張子なし → .ts / .tsx」の補完を足す。
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./_resolve-ts-hooks.mjs', pathToFileURL('./tests/'));
