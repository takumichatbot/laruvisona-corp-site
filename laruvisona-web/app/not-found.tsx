import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#030712] text-white flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black text-white/5 mb-2 leading-none select-none">404</div>
        <div className="text-5xl mb-6">🔍</div>
        <h1 className="text-2xl font-bold mb-3">ページが見つかりません</h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          お探しのページは削除されたか、URLが変更された可能性があります。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/laruHP/dashboard"
            className="bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 px-8 rounded-xl transition-colors text-sm"
          >
            ダッシュボードへ
          </Link>
          <Link
            href="/laruHP"
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold py-3 px-8 rounded-xl transition-colors text-sm"
          >
            トップページへ
          </Link>
        </div>
      </div>
    </div>
  );
}
