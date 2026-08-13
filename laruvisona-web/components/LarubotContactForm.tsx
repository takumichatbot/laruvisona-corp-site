'use client';

import Script from 'next/script';
import { useCallback, useRef } from 'react';

/**
 * LARUbot製のお問い合わせフォーム（iframe埋め込み）。
 * ・フォームIDは環境変数 NEXT_PUBLIC_LARUBOT_FORM_ID から取得（ハードコードしない）。
 * ・iframe-resizer 4.3.2 を next/script（afterInteractive）で読み込み、高さを自動調整
 *   （スクロールバーを出さない）。
 * ・送信内容はCRM顧客・SFA案件に自動登録され、info@laruvisona.jp へ通知＋自動返信。
 */
const FORM_ID = process.env.NEXT_PUBLIC_LARUBOT_FORM_ID;

export default function LarubotContactForm() {
  const done = useRef(false);
  const iframeId = FORM_ID ? `laru-form-${FORM_ID}` : '';

  const resize = useCallback(() => {
    if (done.current || !FORM_ID) return;
    const w = window as unknown as { iFrameResize?: (opts: object, target: string) => void };
    if (typeof w.iFrameResize !== 'function') return;
    try {
      w.iFrameResize({ log: false, checkOrigin: false }, `#${iframeId}`);
      done.current = true;
    } catch {
      /* noop */
    }
  }, [iframeId]);

  if (!FORM_ID) return null;

  return (
    <>
      <iframe
        id={iframeId}
        src={`https://larubot.tokyo/f/${FORM_ID}`}
        title="お問い合わせフォーム"
        width="100%"
        scrolling="no"
        onLoad={resize}
        style={{ border: 'none', width: '100%', minHeight: 800 }}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/iframe-resizer/4.3.2/iframeResizer.min.js"
        strategy="afterInteractive"
        onReady={resize}
      />
    </>
  );
}
