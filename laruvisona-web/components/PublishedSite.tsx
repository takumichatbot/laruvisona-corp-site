'use client';
import { useEffect, useRef } from 'react';

// 公開HP（published_html）を描画し、内部の <script> を「ちょうど1回」実行する。
//
// 背景: dangerouslySetInnerHTML で挿入した HTML 内の <script> は、
//   - 初回SSR時はパース中に実行されてしまい、React のハイドレーション前に
//     DOM を書き換えると hydration mismatch (#418) を誘発する
//   - クライアント遷移で来た場合は逆に一切実行されない
// 対策:
//   1) SSR/初期描画では <script> を実行されない type に変換しておく（パース時実行を防ぐ）
//   2) マウント後に useEffect で本物の <script> に作り直して実行（必ず1回・順序通り）
// これで「直接アクセス」「クライアント遷移」どちらでも確実に1回だけ動く。

function inertize(html: string): string {
  return html.replace(/<script\b([^>]*)>/gi, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\stype\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    return `<script${cleaned} type="text/lhp-inert">`;
  });
}

export default function PublishedSite({ html, style }: { html: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const inertScripts = Array.from(root.querySelectorAll('script[type="text/lhp-inert"]'));
    inertScripts.forEach(old => {
      const s = document.createElement('script');
      for (const attr of Array.from(old.attributes)) {
        if (attr.name.toLowerCase() === 'type') continue; // inert type は引き継がない＝実行可能に
        s.setAttribute(attr.name, attr.value);
      }
      if (!old.getAttribute('src')) s.text = old.textContent || '';
      old.replaceWith(s); // 置換＝DOM挿入で実行される
    });
  }, []);

  return <div ref={ref} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: inertize(html) }} style={style} />;
}
