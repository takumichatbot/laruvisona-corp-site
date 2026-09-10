import sys, os, shutil, re
V = sys.argv[1]          # 'now'（現状） / 'b'（採用実装）
B = '/tmp/build'

# 1) BrandFonts を「ローカルの実フォント資産を読む版」に差し替える。
#    どの画面が読むかという配線は、採用実装のまま変えない。
BRAND = '''// 計測用の差し替え版。
// 本番は next/font/google で同じ2書体を読む。計測環境からGoogle Fontsへは
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
open(f'{B}/components/BrandFonts.tsx','w',encoding='utf-8').write(BRAND)

# 2) 現状(now)は、共通レイアウトで全ページに配り、顧客見出しの免除も無い状態に戻す
layout = open(f'{B}/app/layout.tsx',encoding='utf-8').read()
layout = layout.replace('    <html lang="ja">\n      <link rel="stylesheet" href="/fonts/noto.css" />\n      <link rel="stylesheet" href="/fonts/space.css" />\n      <style dangerouslySetInnerHTML={{ __html: ":root{--font-noto-sans-jp:\'Noto Sans JP\';--font-space-grotesk:\'Space Grotesk\'}" }} />\n', '    <html lang="ja">\n')
if V == 'now':
    old = '    <html lang="ja">'
    add = ('    <html lang="ja">\n'
           '      <link rel="stylesheet" href="/fonts/noto.css" />\n'
           '      <link rel="stylesheet" href="/fonts/space.css" />\n'
           '      <style dangerouslySetInnerHTML={{ __html: ":root{--font-noto-sans-jp:\'Noto Sans JP\';--font-space-grotesk:\'Space Grotesk\'}" }} />\n')
    assert layout.count(old) == 1
    layout = layout.replace(old, add)
open(f'{B}/app/layout.tsx','w',encoding='utf-8').write(layout)

# 3) globals.css: 現状は .laru-published の免除が無い（顧客見出しがアプリ側書体に上書きされる）
css = open(f'{B}/app/globals.css',encoding='utf-8').read()
marker = '.laru-published :is(h1, h2, h3, h4, h5, h6) {\n  font-family: inherit;\n}'
placeholder = '.laru-published-disabled-for-measurement :is(h1, h2, h3, h4, h5, h6) {\n  font-family: inherit;\n}'
css = css.replace(placeholder, marker)
if V == 'now':
    assert css.count(marker) == 1
    css = css.replace(marker, placeholder)
open(f'{B}/app/globals.css','w',encoding='utf-8').write(css)

print('variant', V, 'ready')
