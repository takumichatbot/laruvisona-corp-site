/*
  記事本文の行内マークアップを HTML にする。

  記事（app/laruHP/articles）の本文は、リポジトリの中で書いた信頼できる文章なので、
  太字・コード・リンクだけを HTML に置き換える。2026-09-19 まで、リンクは置き換えて
  おらず、公開ページに `[料金プラン](https://laruhp.com/plans)` がそのまま出ていた。
  「ホームページ作成 無料」で1ページ目に出ている記事が、料金へ辿れない状態だった。

  リンク先は自社のページだけに絞る。外部サイトへの出典は記事の sources に書く。
*/

const OWN_ORIGINS = ['https://laruhp.com', 'https://laruvisona.jp'];

function linkHref(target: string): string | null {
  if (target.startsWith('/')) return `https://laruhp.com${target}`;
  if (OWN_ORIGINS.some(origin => target === origin || target.startsWith(`${origin}/`))) return target;
  return null;
}

export function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-[13px] font-mono">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, target: string) => {
      const href = linkHref(target);
      // 自社以外は、リンクにせず文字だけ残す（書き間違いを本番で気づけるように）
      if (!href) return label;
      return `<a href="${href}" class="text-sky-700 underline underline-offset-2 hover:text-sky-900">${label}</a>`;
    });
}
