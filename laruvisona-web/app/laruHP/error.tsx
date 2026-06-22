'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function LaruHPError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5"/>
            <line x1="12" y1="7" x2="12" y2="13" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="16.5" r="1" fill="#ef4444"/>
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">エラーが発生しました</h1>
        <p className="text-sm text-gray-500 mb-6">
          予期しないエラーが発生しました。再試行してもう一度お試しください。
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-sky-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-sky-500 transition-colors"
          >
            再試行
          </button>
          <Link
            href="/laruHP/dashboard"
            className="border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:border-gray-300 transition-colors"
          >
            ダッシュボードへ
          </Link>
        </div>
      </div>
    </div>
  );
}
