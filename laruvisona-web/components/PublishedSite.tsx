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
    // 元の type（application/ld+json 等）は data 属性に退避し、実行時に復元する。
    // 捨ててしまうと JSON-LD が JS として実行され SyntaxError になる。
    let origType = '';
    const cleaned = attrs.replace(/\stype\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (_t, v: string) => {
      origType = v.replace(/^["']|["']$/g, '');
      return '';
    });
    const keep = origType ? ` data-lhp-orig-type="${origType.replace(/"/g, '&quot;')}"` : '';
    return `<script${cleaned}${keep} type="text/lhp-inert">`;
  });
}

export default function PublishedSite({ html, style }: { html: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const inertScripts = Array.from(root.querySelectorAll('script[type="text/lhp-inert"]'));
    inertScripts.forEach(old => {
      try {
        const s = document.createElement('script');
        for (const attr of Array.from(old.attributes)) {
          const n = attr.name.toLowerCase();
          if (n === 'type' || n === 'data-lhp-orig-type') continue;
          s.setAttribute(attr.name, attr.value);
        }
        // 元が application/ld+json 等の非実行 type ならそのまま復元（JS として実行しない）
        const origType = old.getAttribute('data-lhp-orig-type');
        if (origType) s.setAttribute('type', origType);
        if (!old.getAttribute('src')) s.text = old.textContent || '';
        old.replaceWith(s); // 置換＝DOM挿入で実行される
      } catch (e) {
        console.error('[PublishedSite] script activation failed:', e);
      }
    });

    // Stripe決済から ?payment=success で戻ってきた時の完了バナー（ショップページと同じ文言）
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      const bar = document.createElement('div');
      bar.setAttribute('role', 'status');
      bar.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;background:#059669;color:#fff;padding:12px 24px;border-radius:12px;font-weight:700;font-size:.95rem;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:90vw';
      bar.textContent = '✅ ご購入ありがとうございます！確認メールをお送りしました。';
      document.body.appendChild(bar);
      setTimeout(() => bar.remove(), 8000);
    }
    if (params.has('payment')) {
      params.delete('payment');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    }
  }, []);

  return <div ref={ref} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: inertize(html) }} style={style} />;
}
