export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin" />
        <p className="text-sm text-gray-400">読み込み中...</p>
      </div>
    </div>
  );
}
