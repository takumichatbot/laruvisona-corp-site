'use client';

import { useEffect, useRef } from 'react';

/**
 * LARU SEO（AI生成記事）のScript版embedを指定コンテナ内に読み込む。
 * ・公開IDは環境変数から取得（ハードコードしない）。
 * ・iframe版ではなくScript版を使用（自社ドメインのページとして表示され、SEOに有効）。
 * ・blog.js は自身の<script>の直前に #laru-seo-app を挿入して記事一覧を描画するため、
 *   描画位置を制御できるようコンテナ内へ注入する。
 */
export default function LaruSeoBlog() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = process.env.NEXT_PUBLIC_LARUBOT_PUBLIC_ID;
    const el = ref.current;
    if (!id || !el) return;
    if (el.querySelector('script[data-laru-seo]')) return; // 二重ロード防止

    const s = document.createElement('script');
    s.src = 'https://larubot.tokyo/embed/blog.js';
    s.setAttribute('data-id', id);
    s.setAttribute('data-laru-seo', '1');
    el.appendChild(s);
  }, []);

  return <div ref={ref} className="laru-seo-mount" />;
}
