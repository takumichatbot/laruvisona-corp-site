'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  url: string;
  siteName: string;
  onClose: () => void;
}

export default function QRCodeModal({ url, siteName, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 240,
      margin: 2,
      color: { dark: '#0c1a3a', light: '#ffffff' },
    }, (err) => {
      if (err) return;
      setDataUrl(canvasRef.current?.toDataURL('image/png') ?? '');
    });
  }, [url]);

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${siteName}-qr.png`;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-7 shadow-2xl max-w-xs w-full text-center"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-bold text-gray-900 mb-1">QRコード</h3>
        <p className="text-xs text-gray-400 mb-5 truncate">{url}</p>

        <div className="flex justify-center mb-5">
          <canvas ref={canvasRef} className="rounded-lg" />
        </div>

        <p className="text-xs text-gray-500 mb-5">
          名刺・チラシに印刷してお使いください
        </p>

        <div className="flex gap-2">
          <button
            onClick={download}
            disabled={!dataUrl}
            className="flex-1 bg-sky-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-sky-500 transition-colors disabled:opacity-40"
          >
            PNGでダウンロード
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-300 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
