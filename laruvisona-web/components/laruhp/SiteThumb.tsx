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
 *
 * 2026-09-17: 「読み込めるまで透明、済んだら見せる」をやめた。
 *   その作りは、移り変わりが走らない状況（裏に回ったタブ・動きを減らす設定・
 *   描画の間引き）で **0 のまま止まる**。本番で実際に止まっていて、
 *   中身は正しく届いているのに頭文字の面だけが出ていた。
 *   いまは最初から見せる。下に頭文字の面を敷いてあるので穴は開かない。
 */

/**
 * 枠の高さ。カードより高くしておき、上から切って見せる。
 *
 * **縮小（transform: scale）はやめた。**
 * 3倍で描いて1/3に縮めると広い画面の姿が出るが、縮小を掛けた枠は
 * 中の読み込みが終わっても描き直されないことがあり、絵が白いまま残る。
 * 本番で7枚すべてがそうなった。枠も位置も大きさも正しく、返るHTMLも正しい。
 * **コードからは正常に見えるのに、出ない。**
 *
 * いまは等倍のまま、カードの幅で描く。
 * 出るのはスマホでの姿で、これはお客様の訪問者がいちばん多く見る姿でもある。
 */
const FRAME_H = 420;

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
          className="site-thumb-frame"
          style={{ width: '100%', height: `${FRAME_H}px` }}
          onLoad={() => setState('ready')}
          onError={() => setState('failed')}
        />
      )}
    </div>
  );
}
