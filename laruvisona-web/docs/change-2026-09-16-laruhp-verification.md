# laruhp.com を Search Console に登録できるようにする（2026-09-16）

## 見つけたこと

**laruhp.com が Search Console に登録されていなかった。**

登録済みだったのは `larubot.tokyo` / `net.larubot.tokyo` / `laruvisona.jp` の3つ。
LARU HP の案内サイトは、15業種ページ・記事5本・料金・独自ドメイン案内を
持っているのに、検索で何が当たっているか一切測れていない状態だった。

登録しようとすると、所有権の確認で止まる。

```
所有権を証明できませんでした
確認方法: HTML ファイル
エラーの理由: 所定の場所で確認ファイルが見つかりませんでした。
```

## 原因

確認ファイル `public/googleeacf3d1df863e622.html` は存在していて、
laruvisona.jp では配信できている。ところが `proxy.ts` の
laruhp.com 向けの分岐は、同じoriginで配るパスを列挙しており、
そこに確認ファイルが入っていなかった。結果 404。

```ts
if (pathname.startsWith('/_next/') || staticFile ||
    ['/favicon.ico', '/laruhp-icon-192.png', ..., '/api/domain-probe'].includes(pathname)) {
  return NextResponse.next();
}
```

案内サイトに余計なものを出さないための設計なので、作りとしては正しい。
確認ファイルだけが漏れていた。

## 直したこと

`proxy.ts` に、検索エンジンの所有権確認ファイルを通す条件を足した。
個別のファイル名ではなく形で許可しているので、確認ファイルが
再発行されても直し直さなくてよい。

```ts
const siteVerification = /^\/google[0-9a-f]{16}\.html$/i.test(pathname);
```

## 再発しないように

`tests/http/cases.tsv` に laruhp.com の4件を追加した。
このホストは今までルーティング検査の対象に一件も入っていなかった。

```
laruhp.com  /googleeacf3d1df863e622.html  200
laruhp.com  /robots.txt                   200
laruhp.com  /sitemap.xml                  200
laruhp.com  /laruHP/dashboard             307 → laruvisona.jp
```

## 確認したこと

- `tsc`: エラーなし
- `npm test`: 828 passed
- `next build`: 成功
- `bash tests/http/run.sh`: 通過 32 / 失敗 0

## 残っていること

本番反映後、Search Console で laruhp.com の所有権確認を通し、
`https://laruhp.com/sitemap.xml` を送信する。
