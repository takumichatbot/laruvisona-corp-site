'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Session {
  id: string;
  name: string;
  cwd: string;
  description: string | null;
  color: string;
  created_at: string;
}

interface Command {
  id: string;
  session_id: string;
  message: string;
  image_urls: string[];
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled';
  output: string;
  auto_approve: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

const STATUS_ICON: Record<Command['status'], string> = {
  pending: '⏳', running: '⚙️', done: '✅', error: '❌', cancelled: '⛔',
};
const STATUS_LABEL: Record<Command['status'], string> = {
  pending: '待機中', running: '実行中', done: '完了', error: 'エラー', cancelled: 'キャンセル済み',
};
const STATUS_COLOR: Record<Command['status'], string> = {
  pending: 'text-yellow-400',
  running: 'text-blue-400',
  done: 'text-green-400',
  error: 'text-red-400',
  cancelled: 'text-gray-500',
};

type EditSession = { id: string; name: string; cwd: string; description: string; color: string };
const EMPTY_EDIT: EditSession = { id: '', name: '', cwd: '', description: '', color: 'sky' };

export default function AiCommandPage() {
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [input, setInput] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [sending, setSending] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [editForm, setEditForm] = useState<EditSession>(EMPTY_EDIT);
  const [savingSession, setSavingSession] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auth guard — admin only
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/laruHP/auth/login'); return; }
      const res = await fetch('/api/ai-command/sessions');
      if (res.status === 403) { router.replace('/laruHP/dashboard'); return; }
      const data: Session[] = await res.json();
      setSessions(data);
      if (data.length > 0) setActiveId(data[0].id);
      setReady(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch commands for active session
  useEffect(() => {
    if (!activeId) return;
    setCommands([]);
    fetch(`/api/ai-command/commands?session_id=${activeId}`)
      .then(r => r.json())
      .then((data: Command[]) => setCommands(data));
  }, [activeId]);

  // Realtime subscription
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`ai-cmd-${activeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ai_commands',
        filter: `session_id=eq.${activeId}`,
      }, (payload) => {
        const row = payload.new as Command;
        if (payload.eventType === 'INSERT') {
          setCommands(prev => [...prev, row]);
        } else if (payload.eventType === 'UPDATE') {
          setCommands(prev => prev.map(c => c.id === row.id ? row : c));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId, supabase]);

  // Auto-scroll to latest
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commands]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setImageFiles(prev => [...prev, ...files]);
    setImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removeImage = (i: number) => {
    setImageFiles(prev => prev.filter((_, j) => j !== i));
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[i]);
      return prev.filter((_, j) => j !== i);
    });
  };

  const sendCommand = useCallback(async () => {
    if (!input.trim() || !activeId || sending) return;
    setSending(true);
    try {
      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          const fd = new FormData();
          fd.append('file', file);
          const r = await fetch('/api/ai-command/upload', { method: 'POST', body: fd });
          const j = await r.json();
          if (j.url) imageUrls.push(j.url as string);
        }
        setImageFiles([]);
        setImagePreviews(prev => { prev.forEach(p => URL.revokeObjectURL(p)); return []; });
      }
      await fetch('/api/ai-command/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeId,
          message: input.trim(),
          image_urls: imageUrls,
          auto_approve: autoApprove,
        }),
      });
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } finally {
      setSending(false);
    }
  }, [input, activeId, sending, imageFiles, autoApprove]);

  const cancelCommand = async (id: string) => {
    await fetch(`/api/ai-command/commands/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
  };

  const saveSession = async () => {
    if (!editForm.id.trim() || !editForm.name.trim() || !editForm.cwd.trim()) return;
    setSavingSession(true);
    try {
      const res = await fetch('/api/ai-command/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data: Session = await res.json();
      setSessions(prev => {
        const i = prev.findIndex(s => s.id === data.id);
        return i >= 0 ? prev.map((s, j) => j === i ? data : s) : [...prev, data];
      });
      setEditForm(EMPTY_EDIT);
      if (!activeId) setActiveId(data.id);
    } finally {
      setSavingSession(false);
    }
  };

  const deleteSession = async (id: string) => {
    if (!confirm('このプロジェクトと全コマンド履歴を削除しますか？')) return;
    await fetch(`/api/ai-command/sessions?id=${id}`, { method: 'DELETE' });
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeId === id) setActiveId(sessions.find(s => s.id !== id)?.id ?? null);
  };

  const editSession = (s: Session) => setEditForm({ id: s.id, name: s.name, cwd: s.cwd, description: s.description ?? '', color: s.color });

  const hasActive = commands.some(c => c.status === 'running' || c.status === 'pending');

  const autoResizeTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-sm">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-gray-950 text-white" style={{ height: '100dvh', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header className="flex-none border-b border-gray-800 bg-gray-900 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <span className="font-bold text-white text-sm tracking-tight">AI司令室</span>
            {hasActive && (
              <span className="flex items-center gap-1.5 text-xs text-blue-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                実行中
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoApprove(v => !v)}
              className={`text-xs px-2.5 py-1 rounded-full border font-semibold transition-colors ${autoApprove ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
              title="自動承認モード（--dangerously-skip-permissions）"
            >
              {autoApprove ? '⚡ 自動' : '手動'}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-label="プロジェクト設定"
              className="text-gray-400 hover:text-white text-xl leading-none"
            >⚙️</button>
          </div>
        </div>
        {/* Project tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {sessions.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              className={`flex-none whitespace-nowrap text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                activeId === s.id
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {s.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setEditForm(EMPTY_EDIT); setShowSettings(true); }}
            className="flex-none text-xs text-gray-600 border border-dashed border-gray-700 px-3 py-1.5 rounded-full hover:text-gray-400 hover:border-gray-600 transition-colors whitespace-nowrap"
          >
            ＋ 追加
          </button>
        </div>
      </header>

      {/* ── Chat ── */}
      <main className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {commands.length === 0 && activeId && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-700">
            <span className="text-5xl mb-3">🤖</span>
            <p className="text-sm">Claude Codeへの指示を入力してください</p>
            <p className="text-xs mt-1 text-gray-700">ローカルの watcher が起動していれば自動実行されます</p>
          </div>
        )}
        {!activeId && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-700">
            <span className="text-5xl mb-3">📂</span>
            <p className="text-sm">まずプロジェクトを追加してください</p>
            <button type="button" onClick={() => setShowSettings(true)} className="mt-3 text-xs bg-sky-600 text-white px-4 py-2 rounded-xl">
              プロジェクト設定を開く
            </button>
          </div>
        )}

        {commands.map(cmd => (
          <div key={cmd.id} className="space-y-1.5">
            {/* User bubble (right) */}
            <div className="flex justify-end">
              <div className="max-w-[88%]">
                {cmd.image_urls?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5 justify-end">
                    {cmd.image_urls.map((url, i) => (
                      <img key={i} src={url} alt="" className="h-16 w-auto rounded-xl border border-sky-500/30 object-cover" />
                    ))}
                  </div>
                )}
                <div className="bg-sky-600/25 border border-sky-500/25 rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm text-sky-100 whitespace-pre-wrap break-words">
                  {cmd.message}
                </div>
                <div className="text-right text-[10px] text-gray-700 mt-0.5 pr-1">
                  {new Date(cmd.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  {!cmd.auto_approve && <span className="ml-1 text-gray-700">手動</span>}
                </div>
              </div>
            </div>

            {/* AI output (left) */}
            <div className="flex justify-start">
              <div className="w-full max-w-[95%]">
                <div className={`flex items-center gap-2 text-xs mb-1.5 pl-0.5 ${STATUS_COLOR[cmd.status]}`}>
                  <span>{STATUS_ICON[cmd.status]}</span>
                  <span className="font-medium">{STATUS_LABEL[cmd.status]}</span>
                  {cmd.started_at && cmd.completed_at && (
                    <span className="text-gray-600 text-[10px]">
                      {Math.round((new Date(cmd.completed_at).getTime() - new Date(cmd.started_at).getTime()) / 1000)}s
                    </span>
                  )}
                  {(cmd.status === 'pending' || cmd.status === 'running') && (
                    <button
                      type="button"
                      onClick={() => cancelCommand(cmd.id)}
                      className="ml-auto text-[11px] text-red-400 hover:text-red-300 border border-red-500/30 px-2.5 py-0.5 rounded-full transition-colors"
                    >
                      停止
                    </button>
                  )}
                </div>

                {(cmd.output || cmd.error_message) ? (
                  <div className="bg-[#0d1117] border border-gray-800 rounded-xl rounded-tl-sm overflow-hidden">
                    <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed px-3 py-2.5 overflow-x-auto max-h-[60vh]">
                      {cmd.output || cmd.error_message}
                    </pre>
                  </div>
                ) : cmd.status === 'running' ? (
                  <div className="bg-[#0d1117] border border-gray-800 rounded-xl px-3 py-2.5">
                    <span className="text-xs text-blue-400/60 animate-pulse">watcher が実行中...</span>
                  </div>
                ) : cmd.status === 'pending' ? (
                  <div className="bg-[#0d1117] border border-gray-800 rounded-xl px-3 py-2.5">
                    <span className="text-xs text-yellow-400/60 animate-pulse">watcher のピックアップ待ち...</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </main>

      {/* ── Input bar ── */}
      <div className="flex-none border-t border-gray-800 bg-gray-900 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        {imagePreviews.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative flex-none">
                <img src={src} alt="" className="h-12 w-auto rounded-lg object-cover border border-gray-700" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label="画像を削除"
                  className="absolute -top-1 -right-1 bg-gray-800 border border-gray-600 text-gray-300 rounded-full w-4 h-4 text-[10px] flex items-center justify-center leading-none"
                >×</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="画像を添付"
            className="flex-none text-gray-500 hover:text-gray-300 text-xl pb-0.5 transition-colors"
          >
            📎
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageChange}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResizeTextarea}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCommand(); }
            }}
            placeholder={activeId ? 'Claude Codeへの指示... (Shift+Enter で改行)' : 'プロジェクトを選択してください'}
            disabled={!activeId}
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-40 min-h-[36px]"
            style={{ lineHeight: '1.5' }}
          />
          <button
            type="button"
            onClick={sendCommand}
            disabled={!input.trim() || !activeId || sending}
            className="flex-none bg-sky-600 hover:bg-sky-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors whitespace-nowrap"
          >
            {sending ? '...' : '送信'}
          </button>
        </div>
      </div>

      {/* ── Settings Drawer ── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative bg-gray-900 border-t border-gray-700 rounded-t-2xl max-h-[88dvh] flex flex-col">
            {/* Drawer handle */}
            <div className="flex-none flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-gray-700 rounded-full" />
            </div>
            <div className="flex-none flex items-center justify-between px-4 pb-3">
              <h2 className="font-bold text-white text-base">プロジェクト設定</h2>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                aria-label="閉じる"
                className="text-gray-400 hover:text-white text-xl"
              >×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
              {/* Existing sessions */}
              {sessions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">登録済みプロジェクト</h3>
                  {sessions.map(s => (
                    <div key={s.id} className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-white text-sm">{s.name}</div>
                          <div className="text-[11px] text-gray-500 font-mono mt-0.5 break-all">{s.cwd}</div>
                          {s.description && <div className="text-xs text-gray-400 mt-0.5">{s.description}</div>}
                        </div>
                        <div className="flex-none flex flex-col gap-1 items-end">
                          <button type="button" onClick={() => editSession(s)} className="text-xs text-sky-400 hover:text-sky-300">編集</button>
                          <button type="button" onClick={() => deleteSession(s.id)} className="text-xs text-red-400 hover:text-red-300">削除</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add / Edit form */}
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  {sessions.some(s => s.id === editForm.id) ? 'プロジェクトを編集' : '新規プロジェクト'}
                </h3>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">プロジェクトID（英数字・ハイフン）</label>
                  <input
                    type="text"
                    placeholder="例: laruvisona-site"
                    value={editForm.id}
                    onChange={e => setEditForm(v => ({ ...v, id: e.target.value }))}
                    disabled={sessions.some(s => s.id === editForm.id)}
                    className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">表示名</label>
                  <input
                    type="text"
                    placeholder="例: LARUvisona HP"
                    value={editForm.name}
                    onChange={e => setEditForm(v => ({ ...v, name: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">ローカルパス（Mac の絶対パス）</label>
                  <input
                    type="text"
                    placeholder="例: /Users/yourname/project"
                    value={editForm.cwd}
                    onChange={e => setEditForm(v => ({ ...v, cwd: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">説明（任意）</label>
                  <input
                    type="text"
                    placeholder="例: Next.js × Supabase の HP ビルダー"
                    value={editForm.description}
                    onChange={e => setEditForm(v => ({ ...v, description: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={saveSession}
                  disabled={savingSession || !editForm.id.trim() || !editForm.name.trim() || !editForm.cwd.trim()}
                  className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  {savingSession ? '保存中...' : '保存'}
                </button>
              </div>

              {/* Watcher setup instructions */}
              <div className="bg-amber-500/8 border border-amber-500/25 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-400 mb-2">🔧 ローカル Watcher の起動</p>
                <p className="text-[11px] text-amber-200/60 mb-2">Mac のターミナルで一度だけ起動しておくと、このページから送ったコマンドが自動で実行されます。</p>
                <pre className="text-[10px] text-amber-200/50 font-mono whitespace-pre-wrap bg-black/30 rounded-lg p-2.5 leading-relaxed">{`cd scripts/ai-watcher
npm install
NEXT_PUBLIC_SUPABASE_URL=xxxx \\
SUPABASE_SERVICE_ROLE_KEY=xxxx \\
node ai-watcher.js`}</pre>
                <p className="text-[10px] text-amber-200/40 mt-2">env の値は .env.local と同じものを使用してください。</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
