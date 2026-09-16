# 営業で配る紙の元データ

HTMLで書いて、headless chromium でPDFにする。Wordを使わないのは、
数字や実績を直したときに、差分が見えて、作り直しが一瞬で済むから。

```
chromium --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
  --print-to-pdf=partner.pdf docs/sales/partner-onepager.html
```

## partner-onepager.html — 協業のご案内（A4・1枚）

同友会、印刷会社、デザイン会社、広告代理店、税理士・社労士に渡す紙。

狙いは「うちの客になってください」ではなく
「**御社が断っている案件、うちが受けます**」。
断る理由がない話なので、渡すほうの心理的な負担が小さい。
一人でやる会社が集客を増やすとき、自分で集めるより、
すでに集めている人の後ろに立つほうが早い。

書いてある数字は `laruvisona-web/app/services/page.tsx` の
料金表と揃えてある。**片方を直したら、もう片方も直すこと。**

実績として日本エンドレス株式会社様のお名前を出している。
社名掲載の許可はいただいているが、**身内の会社はここにも書かない**
（サイト側と同じ判断）。
