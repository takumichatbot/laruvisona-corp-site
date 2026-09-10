import { Space_Grotesk, Noto_Sans_JP } from 'next/font/google';

/**
 * 会社のブランド書体を、必要な画面だけで読み込む。
 *
 * これを app/layout.tsx（全ページ共通）に置くと、日本語の @font-face 宣言だけで
 * CSS 283KB（転送100KB）が管理画面にも顧客サイトにも配られ、日本語本文の
 * あるページではサブセットが30〜38ファイル追加で落ちてくる。
 * 顧客の公開ページは顧客が選んだ書体で組まれるので、会社の書体は要らない。
 *
 * そこで共通レイアウトからは外し、ブランドを見せる画面（会社サイト・LP）だけが
 * この部品を置く。置いた画面でだけ、変数が実際の書体に差し替わる。
 * 置かない画面は app/globals.css の既定（端末フォント）のまま。
 *
 * next/font の CSS は「この部品を読み込んだルート」にだけ付くので、
 * ここに書いてあること自体は他のページの転送量に影響しない。
 */

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
});

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

export default function BrandFonts() {
  // :root の既定値を上書きする。globals.css より後に出るので、こちらが勝つ。
  const css = `:root{`
    + `--font-space-grotesk:${spaceGrotesk.style.fontFamily};`
    + `--font-noto-sans-jp:${notoSansJP.style.fontFamily}`
    + `}`;
  return <style data-brand-fonts="" dangerouslySetInnerHTML={{ __html: css }} />;
}
