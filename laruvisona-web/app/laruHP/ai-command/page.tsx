'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Session {
  id: string;
  name: string;
  cwd: string;
  description: string | null;
  system_context: string | null;
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

type EditSession = {
  id: string; name: string; cwd: string;
  description: string; system_context: string; color: string;
};
const EMPTY_EDIT: EditSession = { id: '', name: '', cwd: '', description: '', system_context: '', color: 'sky' };

const STATUS_ICON: Record<Command['status'], string> = {
  pending: '⏳', running: '⚙️', done: '✅', error: '❌', cancelled: '⛔',
};
const STATUS_LABEL: Record<Command['status'], string> = {
  pending: '待機中', running: '実行中', done: '完了', error: 'エラー', cancelled: 'キャンセル済み',
};
const STATUS_COLOR: Record<Command['status'], string> = {
  pending: 'text-yellow-400', running: 'text-blue-400',
  done: 'text-green-400', error: 'text-red-400', cancelled: 'text-gray-500',
};

const OUTPUT_COLLAPSE_LINES = 25;

function formatElapsed(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'たった今';
  if (m < 60) return `${m}分前`;
  return `${Math.floor(m / 60)}時間前`;
}

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

  // v2 state
  const [watcherOnline, setWatcherOnline] = useState<boolean | null>(null);
  const [watcherLastSeen, setWatcherLastSeen] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [presets, setPresets] = useState<string[]>([]);
  const [newPreset, setNewPreset] = useState('');
  const [clearing, setClearing] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load presets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ai-cmd-presets');
    if (saved) { try { setPresets(JSON.parse(saved)); } catch {} }
  }, []);

  // Auth guard
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

  // Fetch commands on session change
  useEffect(() => {
    if (!activeId) return;
    setCommands([]);
    fetch(`/api/ai-command/commands?session_id=${activeId}`)
      .then(r => r.json())
      .then((data: Command[]) => setCommands(data));
  }, [activeId]);

  // Commands Realtime
  useEffect(() => {
    if (!activeId) return;
    const ch = supabase.channel(`ai-cmd-${activeId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'ai_commands',
        filter: `session_id=eq.${activeId}`,
      }, (payload) => {
        const row = payload.new as Command;
        if (payload.eventType === 'INSERT') setCommands(prev => [...prev, row]);
        else if (payload.eventType === 'UPDATE') setCommands(prev => prev.map(c => c.id === row.id ? row : c));
        else if (payload.eventType === 'DELETE') setCommands(prev => prev.filter(c => c.id !== (payload.old as Command).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, supabase]);

  // Watcher heartbeat Realtime
  useEffect(() => {
    // Initial fetch
    supabase.from('watcher_heartbeat').select('last_seen').eq('id', 'main').single()
      .then(({ data }) => {
        if (data?.last_seen) {
          setWatcherLastSeen(data.last_seen);
          setWatcherOnline(Date.now() - new Date(data.last_seen).getTime() < 15_000);
        } else {
          setWatcherOnline(false);
        }
      });

    const ch = supabase.channel('watcher-hb')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watcher_heartbeat' }, (payload) => {
        const row = payload.new as { last_seen: string };
        if (row?.last_seen) {
          setWatcherLastSeen(row.last_seen);
          setWatcherOnline(true);
        }
      })
      .subscribe();

    // Re-evaluate online status every 20s
    const interval = setInterval(() => {
      setWatcherLastSeen(prev => {
        if (prev) setWatcherOnline(Date.now() - new Date(prev).getTime() < 20_000);
        return prev;
      });
    }, 20_000);

    return () => { supabase.removeChannel(ch); clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Elapsed timer for running commands
  useEffect(() => {
    const iv = setInterval(() => {
      const running = commands.filter(c => c.status === 'running' && c.started_at);
      if (!running.length) return;
      setElapsed(prev => {
        const next = { ...prev };
        running.forEach(c => {
          next[c.id] = Math.floor((Date.now() - new Date(c.started_at!).getTime()) / 1000);
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [commands]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commands]);

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const copyOutput = async (cmd: Command) => {
    await navigator.clipboard.writeText(cmd.output || cmd.error_message || '');
    setCopied(cmd.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setImageFiles(prev => [...prev, ...files]);
    setImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removeImage = (i: number) => {
    setImageFiles(prev => prev.filter((_, j) => j !== i));
    setImagePreviews(prev => { URL.revokeObjectURL(prev[i]); return prev.filter((_, j) => j !== i); });
  };

  const doSend = useCallback(async (msg: string, imgFiles: File[] = []) => {
    if (!msg.trim() || !activeId || sending) return;
    setSending(true);
    try {
      let imageUrls: string[] = [];
      for (const file of imgFiles) {
        const fd = new FormData(); fd.append('file', file);
        const r = await fetch('/api/ai-command/upload', { method: 'POST', body: fd });
        const j = await r.json();
        if (j.url) imageUrls.push(j.url as string);
      }
      await fetch('/api/ai-command/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeId, message: msg.trim(), image_urls: imageUrls, auto_approve: autoApprove }),
      });
    } finally {
      setSending(false);
    }
  }, [activeId, sending, autoApprove]);

  const sendCommand = useCallback(async () => {
    if (!input.trim()) return;
    await doSend(input, imageFiles);
    setInput('');
    setImageFiles([]);
    setImagePreviews(prev => { prev.forEach(p => URL.revokeObjectURL(p)); return []; });
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, imageFiles, doSend]);

  const sendPreset = (preset: string) => doSend(preset);

  const cancelCommand = async (id: string) => {
    await fetch(`/api/ai-command/commands/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
  };

  const retryCommand = async (cmd: Command) => {
    await fetch('/api/ai-command/commands', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: cmd.session_id, message: cmd.message,
        image_urls: cmd.image_urls, auto_approve: cmd.auto_approve,
      }),
    });
  };

  const clearSession = async () => {
    if (!activeId || !confirm('このプロジェクトのコマンド履歴を全て削除しますか？')) return;
    setClearing(true);
    await fetch(`/api/ai-command/commands?session_id=${activeId}`, { method: 'DELETE' });
    setCommands([]);
    setClearing(false);
  };

  const saveSession = async () => {
    if (!editForm.id.trim() || !editForm.name.trim() || !editForm.cwd.trim()) return;
    setSavingSession(true);
    try {
      const res = await fetch('/api/ai-command/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, system_context: editForm.system_context || null }),
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
    if (!confirm('このプロジェクトと全履歴を削除しますか？')) return;
    await fetch(`/api/ai-command/sessions?id=${id}`, { method: 'DELETE' });
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeId === id) setActiveId(sessions.find(s => s.id !== id)?.id ?? null);
  };

  const addPreset = () => {
    if (!newPreset.trim()) return;
    const next = [...presets, newPreset.trim()];
    setPresets(next);
    localStorage.setItem('ai-cmd-presets', JSON.stringify(next));
    setNewPreset('');
  };

  const removePreset = (i: number) => {
    const next = presets.filter((_, j) => j !== i);
    setPresets(next);
    localStorage.setItem('ai-cmd-presets', JSON.stringify(next));
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const hasActive = commands.some(c => c.status === 'running' || c.status === 'pending');

  const watcherDot = watcherOnline === null
    ? 'bg-gray-600'
    : watcherOnline ? 'bg-green-400 animate-pulse' : 'bg-red-500';
  const watcherText = watcherOnline === null
    ? '確認中'
    : watcherOnline ? 'オンライン' : `オフライン${watcherLastSeen ? `（${timeAgo(watcherLastSeen)}）` : ''}`;

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
          <div className="flex items-center gap-2.5">
            <span className="text-base">🤖</span>
            <span className="font-bold text-white text-sm tracking-tight">AI司令室</span>
            {/* Watcher status */}
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${watcherDot}`} />
              <span className={`text-[10px] ${watcherOnline ? 'text-green-400' : 'text-gray-600'}`}>{watcherText}</span>
            </div>
            {hasActive && (
              <span className="flex items-center gap-1 text-xs text-blue-400">
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
              title="⚡ 自動モード: --dangerously-skip-permissions でyes/noをスキップ"
            >
              {autoApprove ? '⚡ 自動' : '手動'}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-label="設定"
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
            className="flex-none text-xs text-gray-600 border border-dashed border-gray-700 px-3 py-1.5 rounded-full hover:text-gray-400 transition-colors whitespace-nowrap"
          >
            ＋
          </button>
        </div>
      </header>

      {/* ── Presets bar ── */}
      {presets.length > 0 && (
        <div className="flex-none bg-gray-900/60 border-b border-gray-800/50 px-3 py-1.5 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {presets.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => sendPreset(p)}
              disabled={!activeId || sending}
              className="flex-none text-[11px] text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {p.length > 24 ? p.slice(0, 24) + '…' : p}
            </button>
          ))}
        </div>
      )}

      {/* ── Chat ── */}
      <main className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {commands.length === 0 && activeId && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-700">
            <span className="text-5xl mb-3">🤖</span>
            <p className="text-sm">Claude Codeへの指示を送信してください</p>
            {!watcherOnline && (
              <p className="text-xs mt-2 text-red-500/70">watcher がオフラインです — Mac のターミナルで起動してください</p>
            )}
          </div>
        )}
        {!activeId && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-700">
            <span className="text-5xl mb-3">📂</span>
            <p className="text-sm">プロジェクトを追加してください</p>
            <button type="button" onClick={() => setShowSettings(true)} className="mt-3 text-xs bg-sky-600 text-white px-4 py-2 rounded-xl">
              設定を開く
            </button>
          </div>
        )}

        {commands.map(cmd => {
          const outputLines = (cmd.output || '').split('\n').length;
          const isLong = outputLines > OUTPUT_COLLAPSE_LINES;
          const isExp = expanded.has(cmd.id);
          const displayOutput = isLong && !isExp
            ? cmd.output.split('\n').slice(0, OUTPUT_COLLAPSE_LINES).join('\n') + '\n…'
            : cmd.output;
          const elapsedSec = elapsed[cmd.id] ?? 0;

          return (
            <div key={cmd.id} className="space-y-1.5">
              {/* User bubble */}
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
                    {timeAgo(cmd.created_at)}
                    {!cmd.auto_approve && <span className="ml-1">手動</span>}
                  </div>
                </div>
              </div>

              {/* AI output */}
              <div className="w-full">
                {/* Status row */}
                <div className={`flex items-center gap-2 text-xs mb-1.5 pl-0.5 ${STATUS_COLOR[cmd.status]}`}>
                  <span>{STATUS_ICON[cmd.status]}</span>
                  <span className="font-medium">{STATUS_LABEL[cmd.status]}</span>
                  {cmd.status === 'running' && elapsedSec > 0 && (
                    <span className="text-blue-400/60 text-[10px]">{formatElapsed(elapsedSec)}</span>
                  )}
                  {cmd.started_at && cmd.completed_at && (
                    <span className="text-gray-600 text-[10px]">
                      {formatElapsed(Math.round((new Date(cmd.completed_at).getTime() - new Date(cmd.started_at).getTime()) / 1000))}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {(cmd.status === 'pending' || cmd.status === 'running') && (
                      <button
                        type="button"
                        onClick={() => cancelCommand(cmd.id)}
                        className="text-[11px] text-red-400 hover:text-red-300 border border-red-500/30 px-2.5 py-0.5 rounded-full transition-colors"
                      >
                        停止
                      </button>
                    )}
                    {(cmd.status === 'error' || cmd.status === 'cancelled') && (
                      <button
                        type="button"
                        onClick={() => retryCommand(cmd)}
                        className="text-[11px] text-amber-400 hover:text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full transition-colors"
                      >
                        再試行
                      </button>
                    )}
                  </div>
                </div>

                {/* Output block */}
                {(cmd.output || cmd.error_message) ? (
                  <div className="bg-[#0d1117] border border-gray-800 rounded-xl rounded-tl-sm overflow-hidden">
                    <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed px-3 py-2.5 overflow-x-auto" style={{ maxHeight: isExp ? 'none' : undefined }}>
                      {displayOutput || cmd.error_message}
                    </pre>
                    <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-800/60">
                      {isLong ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(cmd.id)}
                          className="text-[10px] text-sky-500 hover:text-sky-400"
                        >
                          {isExp ? '▲ 折りたたむ' : `▼ 全て表示 (${outputLines}行)`}
                        </button>
                      ) : <span />}
                      <button
                        type="button"
                        onClick={() => copyOutput(cmd)}
                        className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                      >
                        {copied === cmd.id ? '✓ コピー済み' : 'コピー'}
                      </button>
                    </div>
                  </div>
                ) : cmd.status === 'running' ? (
                  <div className="bg-[#0d1117] border border-gray-800 rounded-xl px-3 py-2.5">
                    <span className="text-xs text-blue-400/60 animate-pulse">実行中...</span>
                  </div>
                ) : cmd.status === 'pending' ? (
                  <div className="bg-[#0d1117] border border-gray-800 rounded-xl px-3 py-2.5">
                    <span className="text-xs text-yellow-400/60 animate-pulse">watcher が起動するまで待機中...</span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
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
                  className="absolute -top-1 -right-1 bg-gray-800 border border-gray-600 text-gray-300 rounded-full w-4 h-4 text-[10px] flex items-center justify-center"
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
          >📎</button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResize}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCommand(); } }}
            placeholder={activeId ? 'Claude Codeへの指示... (Shift+Enter で改行)' : 'プロジェクトを選択'}
            disabled={!activeId}
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-40 min-h-[36px]"
            style={{ lineHeight: '1.5' }}
          />
          <button
            type="button"
            onClick={sendCommand}
            disabled={!input.trim() || !activeId || sending}
            className="flex-none bg-sky-600 hover:bg-sky-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
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
          <div className="relative bg-gray-900 border-t border-gray-700 rounded-t-2xl max-h-[90dvh] flex flex-col">
            <div className="flex-none flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-gray-700 rounded-full" />
            </div>
            <div className="flex-none flex items-center justify-between px-4 pb-3">
              <h2 className="font-bold text-white text-base">設定</h2>
              <button type="button" onClick={() => setShowSettings(false)} aria-label="閉じる" className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">

              {/* Existing sessions */}
              {sessions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">プロジェクト</h3>
                    {activeId && (
                      <button
                        type="button"
                        onClick={clearSession}
                        disabled={clearing}
                        className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
                      >
                        {clearing ? '削除中...' : '履歴をクリア'}
                      </button>
                    )}
                  </div>
                  {sessions.map(s => (
                    <div key={s.id} className={`bg-gray-800 border rounded-xl p-3 ${activeId === s.id ? 'border-sky-600/50' : 'border-gray-700'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-white text-sm">{s.name}</div>
                          <div className="text-[11px] text-gray-500 font-mono mt-0.5 break-all">{s.cwd}</div>
                          {s.system_context && <div className="text-[10px] text-sky-400/60 mt-0.5">📋 コンテキストあり</div>}
                        </div>
                        <div className="flex-none flex gap-2">
                          <button type="button" onClick={() => setEditForm({ id: s.id, name: s.name, cwd: s.cwd, description: s.description ?? '', system_context: s.system_context ?? '', color: s.color })} className="text-xs text-sky-400 hover:text-sky-300">編集</button>
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
                {[
                  { label: 'ID（英数字・ハイフン）', placeholder: 'laruvisona-site', key: 'id', mono: false, disabled: sessions.some(s => s.id === editForm.id) },
                  { label: '表示名', placeholder: 'LARUvisona HP', key: 'name', mono: false },
                  { label: 'Mac の絶対パス', placeholder: '/Users/yourname/project', key: 'cwd', mono: true },
                  { label: '説明（任意）', placeholder: 'Next.js × Supabase', key: 'description', mono: false },
                ].map(({ label, placeholder, key, mono, disabled }) => (
                  <div key={key}>
                    <label className="text-[11px] text-gray-500 mb-1 block">{label}</label>
                    <input
                      type="text"
                      placeholder={placeholder}
                      value={(editForm as Record<string, string>)[key]}
                      onChange={e => setEditForm(v => ({ ...v, [key]: e.target.value }))}
                      disabled={disabled}
                      className={`w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50 ${mono ? 'font-mono' : ''}`}
                    />
                  </div>
                ))}
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">常設コンテキスト（毎回の指示の先頭に付く）</label>
                  <textarea
                    placeholder={'例:\n- このプロジェクトは Next.js 14 App Router + Supabase\n- TypeScript strict モード\n- Tailwind CSS 使用'}
                    value={editForm.system_context}
                    onChange={e => setEditForm(v => ({ ...v, system_context: e.target.value }))}
                    rows={4}
                    className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
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

              {/* Quick presets */}
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">クイックプリセット</h3>
                {presets.length > 0 && (
                  <div className="space-y-1.5">
                    {presets.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-400 truncate flex-1">{p}</span>
                        <button type="button" onClick={() => removePreset(i)} className="text-[10px] text-red-400/60 hover:text-red-400 flex-none">削除</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="よく使う指示を追加..."
                    value={newPreset}
                    onChange={e => setNewPreset(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addPreset(); }}
                    className="flex-1 bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <button type="button" onClick={addPreset} disabled={!newPreset.trim()} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs transition-colors">
                    追加
                  </button>
                </div>
              </div>

              {/* Watcher instructions */}
              <div className="bg-amber-500/8 border border-amber-500/25 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${watcherDot}`} />
                  <p className="text-xs font-bold text-amber-400">Watcher: {watcherText}</p>
                </div>
                <pre className="text-[10px] text-amber-200/50 font-mono bg-black/30 rounded-lg p-2.5 leading-relaxed">{`cd scripts/ai-watcher
node ai-watcher.js`}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
