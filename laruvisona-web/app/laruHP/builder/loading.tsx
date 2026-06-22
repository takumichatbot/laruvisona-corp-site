export default function BuilderLoading() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-sky-500 animate-spin" />
        <p className="text-sm text-slate-400">ビルダーを起動中...</p>
      </div>
    </div>
  );
}
