'use client';

import { useEffect } from 'react';

export default function GlobalError({
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
    <div className="min-h-screen bg-[#030712] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="text-slate-500 text-sm font-mono mb-3">500</p>
        <h1 className="text-2xl font-bold text-white mb-3">エラーが発生しました</h1>
        <p className="text-slate-400 text-sm mb-8">
          予期しないエラーが発生しました。しばらくしてから再度お試しください。
        </p>
        <button
          onClick={reset}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors"
        >
          再試行
        </button>
      </div>
    </div>
  );
}
