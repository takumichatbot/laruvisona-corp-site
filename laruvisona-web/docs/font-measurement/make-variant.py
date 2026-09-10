#!/usr/bin/env python3
"""計測用の変種を作る。

    python3 docs/font-measurement/make-variant.py now --app-root .
    python3 docs/font-measurement/make-variant.py b   --app-root .

案:
  now … この変更前。共通レイアウトが全ページに日本語Webフォントを配り、
         顧客の見出しにもアプリ側の書体が当たる
  b   … 採用実装。ブランドを見せる画面だけが読み込み、
         顧客の見出しはアプリ側から指定しない

components/BrandFonts.tsx は、どちらの案でも「ローカルの実フォント資産を読む版」に
差し替える。next/font/google はビルド時に Google からフォントを取りに行くため、
外部へ出られない環境では動かないため。
**どの画面がこれを置くかという配線は本番のまま変えない。**

このスクリプトはリポジトリのファイルを書き換える。計測が終わったら
`git checkout -- app components` で元に戻すこと。
"""
import argparse
import os
import sys

BRAND_TSX = '''// 計測用の差し替え版（docs/font-measurement/make-variant.py が生成）。
// 本番は next/font/google で同じ2書体を読む。計測環境から Google Fonts へは
// 出られないため、同じ実ファイル（本番ビルドで生成された woff2 とCSS）を
// /fonts から読む。どの画面がこれを置くかという配線は本番と同一。
export default function BrandFonts() {
  return (
    <>
      <link rel="stylesheet" href="/fonts/noto.css" />
      <link rel="stylesheet" href="/fonts/space.css" />
      <style dangerouslySetInnerHTML={{ __html: ":root{--font-noto-sans-jp:'Noto Sans JP';--font-space-grotesk:'Space Grotesk'}" }} />
    </>
  );
}
'''

LAYOUT_FONT_BLOCK = (
    '      <link rel="stylesheet" href="/fonts/noto.css" />\n'
    '      <link rel="stylesheet" href="/fonts/space.css" />\n'
    '      <style dangerouslySetInnerHTML={{ __html: ":root{--font-noto-sans-jp:\'Noto Sans JP\';'
    '--font-space-grotesk:\'Space Grotesk\'}" }} />\n'
)
HTML_TAG = '    <html lang="ja">'

PUBLISHED_RULE = '.laru-published :is(h1, h2, h3, h4, h5, h6) {\n  font-family: inherit;\n}'
PUBLISHED_RULE_OFF = ('.laru-published-off-for-measurement :is(h1, h2, h3, h4, h5, h6) {\n'
                      '  font-family: inherit;\n}')


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def write(p, s):
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('variant', choices=['now', 'b'])
    ap.add_argument('--app-root', default='.', help='アプリのルート（package.json のある場所）')
    a = ap.parse_args()
    root = os.path.abspath(a.app_root)

    layout_p = os.path.join(root, 'app/layout.tsx')
    globals_p = os.path.join(root, 'app/globals.css')
    brand_p = os.path.join(root, 'components/BrandFonts.tsx')
    for p in (layout_p, globals_p, brand_p):
        if not os.path.exists(p):
            sys.exit(f'ファイルが見つかりません: {p}（--app-root を確認してください）')

    # 1) BrandFonts をローカル資産版に差し替える（配線は変えない）
    write(brand_p, BRAND_TSX)

    # 2) 共通レイアウト: now だけ全ページに配る
    layout = read(layout_p)
    layout = layout.replace(HTML_TAG + '\n' + LAYOUT_FONT_BLOCK, HTML_TAG + '\n')  # まず素に戻す
    if a.variant == 'now':
        if layout.count(HTML_TAG) != 1:
            sys.exit('app/layout.tsx の <html lang="ja"> が見つからないか複数あります')
        layout = layout.replace(HTML_TAG, HTML_TAG + '\n' + LAYOUT_FONT_BLOCK)
    write(layout_p, layout)

    # 3) 顧客の見出しの免除: now だけ無効にする
    css = read(globals_p)
    css = css.replace(PUBLISHED_RULE_OFF, PUBLISHED_RULE)  # まず素に戻す
    if a.variant == 'now':
        if css.count(PUBLISHED_RULE) != 1:
            sys.exit('app/globals.css の .laru-published の規則が見つかりません')
        css = css.replace(PUBLISHED_RULE, PUBLISHED_RULE_OFF)
    write(globals_p, css)

    print(f'変種 {a.variant} を用意しました（{root}）')


if __name__ == '__main__':
    main()
