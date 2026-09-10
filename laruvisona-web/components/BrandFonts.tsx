import { Space_Grotesk } from 'next/font/google';

/**
 * 会社のブランド書体を、必要な画面だけで読み込む。
 *
 * ■ 日本語の書体を、webフォントで配るのをやめた理由
 *
 * 以前はここで Noto Sans JP も読んでいた。日本語は文字が多いので、
 * next/font は「使う文字の範囲ごとに分けた @font-face」を全部書き出す。
 * 実測で 1書体あたり124個 × 3つの太さ = 372個、CSSだけで 292KB（転送102KB）。
 * このCSSは描画をせき止める種類のもので、回線とCPUを絞った条件では
 * このファイルが届き終わるまで 2.3秒かかっていた（初回表示 3.6〜3.9秒）。
 *
 * 一方、日本語の本文は端末に入っている書体で十分に組める
 * （Apple はヒラギノ角ゴ、Windows は游ゴシック、Android は Noto Sans CJK）。
 * 0バイトで、字面もこの2ページの設計に耐える。
 * そこで日本語は端末の書体に任せ、英字の見出し（社名・番号）だけを
 * Space Grotesk で読む。こちらは latin だけなので数KBで済む。
 *
 * ■ 置く場所
 *
 * これを app/layout.tsx（全ページ共通）に置くと、管理画面にも顧客の公開ページにも
 * 配られる。顧客のページは顧客が選んだ書体で組まれるので、会社の書体は要らない。
 * ブランドを見せる画面（会社トップ・LARU HP 案内）だけがこの部品を置く。
 * next/font の CSS は「この部品を読み込んだルート」にだけ付く。
 */

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
});

export default function BrandFonts() {
  // :root の既定値を上書きする。globals.css より後に出るので、こちらが勝つ。
  // 日本語（--font-noto-sans-jp）は触らない。端末の書体のまま。
  const css = `:root{--font-space-grotesk:${spaceGrotesk.style.fontFamily}}`;
  return <style data-brand-fonts="" dangerouslySetInnerHTML={{ __html: css }} />;
}
