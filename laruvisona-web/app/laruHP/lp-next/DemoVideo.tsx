'use client';

import { useRef, useState } from 'react';

/**
 * 操作イメージの動画。押されるまで1バイトも読まない。
 *
 * ファーストビューに自動再生の背景動画を敷くのはやめた（実測と一次資料の
 * どちらも、モバイル主体のSaaSでは不利という結論だったため）。
 * かわりに「どう動くのか見たい」と思った人が押したときだけ読み込む。
 *
 *   - 初期状態は静止したパネルとボタンだけ。<video> 要素すら作らない
 *   - 押されてから src を渡すので、通信が発生するのはその瞬間
 *   - controls を付ける。止める・戻すはブラウザの標準UIに任せる
 *     （自動再生ではないので WCAG 2.2.2 の対象外だが、操作できる方が良い）
 *   - 音声は無い動画なので muted。iOS で全画面にならないよう playsInline
 */
export default function DemoVideo() {
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  if (failed) {
    return (
      <p className="text-sm text-slate-500 text-center py-8">
        映像を読み込めませんでした。時間をおいてお試しください。
      </p>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video">
      {started ? (
        <video
          ref={ref}
          src="/api/library-video?target=lp-hero"
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="auto"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="absolute inset-0 w-full h-full grid place-items-center gap-3 text-white bg-gradient-to-br from-slate-800 via-slate-900 to-sky-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          <span className="grid place-items-center w-16 h-16 rounded-full bg-white/95 text-sky-700 shadow-lg">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="text-sm font-medium">操作イメージを再生する</span>
          <span className="text-xs text-white/60">約8秒・音声なし・押すまで読み込みません</span>
        </button>
      )}
    </div>
  );
}
