'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * サイトカードの「見た目」。
 *
 * これまでは灰色の面に屋号の頭文字を1つ大きく置くだけで、中身が何も分からなかった。
 * 7件並ぶと「新」が6つ並ぶ。**「完成像を見ながら作る」と売っているのに、
 * 管理画面でその完成像が見えない**のが、いちばん惜しい所だった。
 *
 * 仕組み。
 *   ・GET /api/sites/<id>/export-html?inline=1 が、いまの中身からHTMLを作って返す。
 *     公開前の下書きでも作れる（blocks_json から組む）。持ち主だけが読める。
 *   ・それを iframe に読ませ、幅1200pxで描いてから縮小して収める。
 *   ・sandbox="" にしてあるので、中のスクリプトもフォームも動かない。
 *     顧客サイトに入っている外部の埋め込みが、管理画面で走ることはない。
 *
 * 気をつけたこと。
 *   ・カードが画面に入るまで読み込まない。7件ぶんを一度に描くと、
 *     開いた瞬間にサーバー側で7回ぶんの組み立てが走る。
 *   ・読めなかったときは、これまでと同じ頭文字の面に戻す。真っ白にはしない。
 */

// カードの幅の3倍で描いてから1/3に縮める。
// 固定の画素数にすると、カードの幅が変わったときに右が切れるか余白が出る。
const SCALE = 3;

export default function SiteThumb({
  siteId, name, gradient, updatedAt,
}: {
  siteId: string;
  name: string;
  /** 読めないときに使う、これまでの見た目 */
  gradient: string;
  /** 中身が変わったら読み直すための目印 */
  updatedAt?: string;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<'idle' | 'ready' | 'failed'>('idle');

  useEffect(() => {
    const node = holder.current;
    if (!node || visible) return;
    // 見張れない環境では、素直に読み込む。
    // 効果の中で直に状態を変えると描画が連鎖するので、一拍おく。
    if (typeof IntersectionObserver === 'undefined') {
      const t = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, { rootMargin: '200px' });
    io.observe(node);
    return () => io.disconnect();
  }, [visible]);

  const src = `/api/sites/${siteId}/export-html?inline=1${updatedAt ? `&v=${encodeURIComponent(updatedAt)}` : ''}`;

  return (
    <div ref={holder} className="site-thumb">
      {/* 読めるまでと、読めなかったときの面 */}
      <div className={`site-thumb-fallback bg-gradient-to-br ${gradient}`} aria-hidden={state === 'ready'}>
        <span className="site-thumb-initial">{(name || '?').charAt(0).toUpperCase()}</span>
      </div>

      {visible && state !== 'failed' && (
        <iframe
          title={`${name} の見た目`}
          src={src}
          sandbox=""
          loading="lazy"
          scrolling="no"
          tabIndex={-1}
          aria-hidden="true"
          className={`site-thumb-frame${state === 'ready' ? ' is-ready' : ''}`}
          style={{
            width: `${SCALE * 100}%`,
            height: `${SCALE * 100}%`,
            transform: `scale(${1 / SCALE})`,
          }}
          onLoad={() => setState('ready')}
          onError={() => setState('failed')}
        />
      )}
    </div>
  );
}
