# 案内サイトの「始める」が、誰が押しても失敗していた（2026-09-17）

## 見つけ方

LARU HP の申し込み導線を確かめようと、`laruhp.com/plans` の
「始める →」が実際に何をするのかを追った。

```js
// app/laruHP/plans/page.tsx
const res = await fetch('/api/stripe/checkout', { method: 'POST', ... });
if (res.status === 401) { /* ログインへ */ }
if (res.status === 402) { ... }
if (res.status === 429) { ... }
const data = await res.json().catch(() => ({}));
...
return data.error || 'エラーが発生しました。もう一度お試しください。';
```

本番の `laruhp.com` で同じPOSTを投げたところ、**405 が返ってきた。**

```
POST https://laruhp.com/api/stripe/checkout   → 405（本文は空）
POST https://laruhp.com/api/contact           → 405
POST https://laruhp.com/api/popup             → 405
```

## 何が起きていたか

このページは2つの origin で配信される。

```
https://laruvisona.jp/laruHP/plans   アプリ側。決済APIもCookieもここにある
https://laruhp.com/plans             案内サイト。proxy が /api/* を通さない
```

案内サイト側では、相対パスの `/api/stripe/checkout` がAPIまで届かない。
返ってくる 405 は 401 でも 402 でも 429 でもないので、上のコードは
最後まで落ちて、

> エラーが発生しました。もう一度お試しください。

を出す。**laruhp.com の料金ページから、誰一人として申し込めなかった。**
ログインしていてもいなくても同じである。

laruhp.com を公開したのは 2026-09-13。それ以降ずっとこの状態だった。
公開サイトのいちばん大事なボタンが、無言で死んでいた。

## 直したこと

ログインCookieは `laruvisona.jp` のものなので、CORSで繋ぐのは安全でない。
**決済はアプリ側の origin で始める。**

```ts
function checkoutOnAppOrigin(plan, billing) {
  if (window.location.origin === LARUHP_APP_ORIGIN) return false;
  window.location.href =
    `${LARUHP_APP_ORIGIN}/laruHP/plans?checkout=${plan}&billing=${billing}`;
  return true;
}
```

`?checkout=` を受けて決済を再開する仕組み（`CheckoutResume`）は、
ログイン後の復帰用にすでにあった。それをそのまま使う。

- laruhp.com で押す → laruvisona.jp/laruHP/plans?checkout=… へ移動 → そこで決済開始
- laruvisona.jp で押す → これまでどおりその場で開始

## あわせて直した小さいもの

`/plans` の上下にあった「← 料金ページに戻る」。

- **料金ページで「料金ページに戻る」と言っていた**
- 行き先の `/laruHP#pricing` は laruhp.com 側に存在せず、押すとトップへ飛ぶだけ

「← LARU HP トップへ」に変え、行き先も実在するURLにした。

## 再発防止

同じ形（案内サイトから相対パスでアプリのAPIを叩く）は、また書ける。

- 決済の入口が、必ず origin 判定を通ってから fetch する
- **公開ページのどこからも、相対パスでアプリのAPIを叩いていない**
  （`LARUHP_PUBLIC_PATHS` を回して、公開される全ページを見る）
- proxy が laruhp.com に開いているAPIが `/api/domain-probe` だけである
  （ここを安易に増やすと、案内サイトに認証つきの経路が生える）
- 「料金ページに戻る」という文言と `laruHP#pricing` が残っていない

## 確認したこと

- `tsc`: エラーなし／`eslint`: エラー0
- `npm test`: 902 passed（新規4件）
- `next build`: 成功

## 残した判断

`/plans` の HP+Bot+SEO に「**半年間限定**」というバッジが付いているが、
何が半年間限定なのかページのどこにも書かれていない。料金表の上に
説明のない限定表示があると、かえって迷わせる。意味を書くか外すかは
事業の判断なので、こちらでは触っていない。
