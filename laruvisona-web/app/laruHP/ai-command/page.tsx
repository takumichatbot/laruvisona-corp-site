'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────

interface Session {
  id: string; name: string; cwd: string;
  description: string | null; system_context: string | null; color: string;
  created_at: string;
}
interface Health {
  session_id: string; git_branch: string | null;
  uncommitted_count: number; last_commit_msg: string | null; updated_at: string;
}
interface Command {
  id: string; session_id: string; message: string; image_urls: string[];
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled';
  output: string; auto_approve: boolean; auto_retry: boolean;
  created_at: string; started_at: string | null; completed_at: string | null;
  error_message: string | null; git_diff_stat: string | null; git_diff: string | null;
  parent_id: string | null; context_output: string | null;
}

type EditSession = { id: string; name: string; cwd: string; description: string; system_context: string; color: string };
const EMPTY_EDIT: EditSession = { id: '', name: '', cwd: '', description: '', system_context: '', color: 'sky' };

// ── Constants ─────────────────────────────────────────────────────

const STATUS_ICON: Record<Command['status'], string> = { pending: '⏳', running: '⚙️', done: '✅', error: '❌', cancelled: '⛔' };
const STATUS_LABEL: Record<Command['status'], string> = { pending: '待機中', running: '実行中', done: '完了', error: 'エラー', cancelled: 'キャンセル済み' };
const STATUS_COLOR: Record<Command['status'], string> = { pending: 'text-yellow-400', running: 'text-blue-400', done: 'text-green-400', error: 'text-red-400', cancelled: 'text-gray-500' };
const COLLAPSE_LINES = 25;

// ── Utils ─────────────────────────────────────────────────────────

function fmt(s: number) { return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`; }
function ago(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'たった今'; if (m < 60) return `${m}分前`; return `${Math.floor(m / 60)}時間前`;
}
function diffLineClass(line: string) {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'text-green-400 bg-green-400/5';
  if (line.startsWith('-') && !line.startsWith('---')) return 'text-red-400 bg-red-400/5';
  if (line.startsWith('@@')) return 'text-sky-400';
  if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) return 'text-gray-500';
  return 'text-gray-400';
}

// ── Component ─────────────────────────────────────────────────────

export default function AiCommandPage() {
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [health, setHealth] = useState<Record<string, Health>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [input, setInput] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [autoRetry, setAutoRetry] = useState(false);
  const [sending, setSending] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [editForm, setEditForm] = useState<EditSession>(EMPTY_EDIT);
  const [savingSession, setSavingSession] = useState(false);
  const [clearing, setClearing] = useState(false);

  // v2
  const [watcherOnline, setWatcherOnline] = useState<boolean | null>(null);
  const [watcherLastSeen, setWatcherLastSeen] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [presets, setPresets] = useState<string[]>([]);
  const [newPreset, setNewPreset] = useState('');

  // v3
  const [continueFrom, setContinueFrom] = useState<Command | null>(null);
  const [showDiff, setShowDiff] = useState<Command | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [sequenceMode, setSequenceMode] = useState(false);
  const [seqInput, setSeqInput] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  // Load presets from localStorage
  useEffect(() => {
    const s = localStorage.getItem('ai-cmd-presets');
    if (s) { try { setPresets(JSON.parse(s)); } catch {} }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifGranted(Notification.permission === 'granted');
    }
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
      .then(r => r.json()).then((d: Command[]) => setCommands(d));
  }, [activeId]);

  // Commands Realtime
  useEffect(() => {
    if (!activeId) return;
    const ch = supabase.channel(`ai-cmd-${activeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_commands', filter: `session_id=eq.${activeId}` }, (payload) => {
        const row = payload.new as Command;
        if (payload.eventType === 'INSERT') setCommands(p => [...p, row]);
        else if (payload.eventType === 'UPDATE') {
          setCommands(p => p.map(c => c.id === row.id ? row : c));
          // Browser notification
          const old = payload.old as Command;
          if ((row.status === 'done' || row.status === 'error') && old.status !== row.status &&
              typeof document !== 'undefined' && document.hidden && Notification.permission === 'granted') {
            new Notification(row.status === 'done' ? `✅ 完了 — ${(sessions.find(s => s.id === activeId)?.name ?? '')}` : `❌ エラー`, {
              body: row.message.slice(0, 80),
              icon: '/favicon.ico',
            });
          }
        } else if (payload.eventType === 'DELETE') {
          setCommands(p => p.filter(c => c.id !== (payload.old as Command).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, sessions, supabase]);

  // Health Realtime
  useEffect(() => {
    supabase.from('watcher_health').select('*').then(({ data }) => {
      if (data) setHealth(Object.fromEntries(data.map(h => [h.session_id, h])));
    });
    const ch = supabase.channel('health-sub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watcher_health' }, (payload) => {
        const row = payload.new as Health;
        setHealth(p => ({ ...p, [row.session_id]: row }));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Heartbeat
  useEffect(() => {
    supabase.from('watcher_heartbeat').select('last_seen').eq('id', 'main').single().then(({ data }) => {
      if (data?.last_seen) { setWatcherLastSeen(data.last_seen); setWatcherOnline(Date.now() - new Date(data.last_seen).getTime() < 20_000); }
      else setWatcherOnline(false);
    });
    const ch = supabase.channel('hb-sub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watcher_heartbeat' }, (p) => {
        const r = p.new as { last_seen: string };
        if (r?.last_seen) { setWatcherLastSeen(r.last_seen); setWatcherOnline(true); }
      }).subscribe();
    const iv = setInterval(() => {
      setWatcherLastSeen(prev => { if (prev) setWatcherOnline(Date.now() - new Date(prev).getTime() < 20_000); return prev; });
    }, 20_000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Elapsed timer
  useEffect(() => {
    const iv = setInterval(() => {
      setElapsed(prev => {
        const running = commands.filter(c => c.status === 'running' && c.started_at);
        if (!running.length) return prev;
        const next = { ...prev };
        running.forEach(c => { next[c.id] = Math.floor((Date.now() - new Date(c.started_at!).getTime()) / 1000); });
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [commands]);

  // Auto scroll
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [commands]);

  // ── Handlers ────────────────────────────────────────────────────

  const toggleExpand = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const copyOutput = async (cmd: Command) => {
    await navigator.clipboard.writeText(cmd.output || cmd.error_message || '');
    setCopied(cmd.id); setTimeout(() => setCopied(null), 2000);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fs = Array.from(e.target.files);
    setImageFiles(p => [...p, ...fs]);
    setImagePreviews(p => [...p, ...fs.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };
  const removeImage = (i: number) => {
    setImageFiles(p => p.filter((_, j) => j !== i));
    setImagePreviews(p => { URL.revokeObjectURL(p[i]); return p.filter((_, j) => j !== i); });
  };

  const doSend = useCallback(async (msg: string, opts: { files?: File[]; contextOutput?: string } = {}) => {
    if (!msg.trim() || !activeId || sending) return;
    setSending(true);
    try {
      let imageUrls: string[] = [];
      for (const file of (opts.files ?? [])) {
        const fd = new FormData(); fd.append('file', file);
        const r = await fetch('/api/ai-command/upload', { method: 'POST', body: fd });
        const j = await r.json(); if (j.url) imageUrls.push(j.url as string);
      }
      await fetch('/api/ai-command/commands', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeId, message: msg.trim(), image_urls: imageUrls,
          auto_approve: autoApprove, auto_retry: autoRetry,
          context_output: opts.contextOutput ?? null,
          parent_id: null,
        }),
      });
    } finally { setSending(false); }
  }, [activeId, sending, autoApprove, autoRetry]);

  const sendCommand = useCallback(async () => {
    if (!input.trim()) return;
    const ctx = continueFrom?.output ?? undefined;
    await doSend(input, { files: imageFiles, contextOutput: ctx });
    setInput(''); setContinueFrom(null);
    setImageFiles([]); setImagePreviews(p => { p.forEach(u => URL.revokeObjectURL(u)); return []; });
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, imageFiles, continueFrom, doSend]);

  const sendSequence = async () => {
    const lines = seqInput.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length || !activeId) return;
    setSending(true);
    for (const line of lines) {
      await fetch('/api/ai-command/commands', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeId, message: line, image_urls: [], auto_approve: autoApprove, auto_retry: autoRetry }),
      });
    }
    setSending(false); setSeqInput(''); setSequenceMode(false);
  };

  const cancelCommand = async (id: string) => {
    await fetch(`/api/ai-command/commands/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) });
  };
  const retryCommand = async (cmd: Command) => {
    await fetch('/api/ai-command/commands', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: cmd.session_id, message: cmd.message, image_urls: cmd.image_urls, auto_approve: cmd.auto_approve, auto_retry: cmd.auto_retry }),
    });
  };
  const clearSession = async () => {
    if (!activeId || !confirm('履歴を全て削除しますか？')) return;
    setClearing(true);
    await fetch(`/api/ai-command/commands?session_id=${activeId}`, { method: 'DELETE' });
    setCommands([]); setClearing(false);
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
      setSessions(p => { const i = p.findIndex(s => s.id === data.id); return i >= 0 ? p.map((s, j) => j === i ? data : s) : [...p, data]; });
      setEditForm(EMPTY_EDIT); if (!activeId) setActiveId(data.id);
    } finally { setSavingSession(false); }
  };
  const deleteSession = async (id: string) => {
    if (!confirm('削除しますか？')) return;
    await fetch(`/api/ai-command/sessions?id=${id}`, { method: 'DELETE' });
    setSessions(p => p.filter(s => s.id !== id));
    if (activeId === id) setActiveId(sessions.find(s => s.id !== id)?.id ?? null);
  };

  const addPreset = () => {
    if (!newPreset.trim()) return;
    const n = [...presets, newPreset.trim()];
    setPresets(n); localStorage.setItem('ai-cmd-presets', JSON.stringify(n)); setNewPreset('');
  };
  const removePreset = (i: number) => {
    const n = presets.filter((_, j) => j !== i);
    setPresets(n); localStorage.setItem('ai-cmd-presets', JSON.stringify(n));
  };

  const startVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { alert('このブラウザは音声入力に対応していません（Chrome/Safari を試してください）'); return; }
    if (isRecording) { recRef.current?.stop(); setIsRecording(false); return; }
    const rec = new SR();
    rec.lang = 'ja-JP'; rec.interimResults = false; rec.maxAlternatives = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setInput((p: string) => p ? p + ' ' + t : t);
    };
    rec.onerror = () => setIsRecording(false);
    rec.onend = () => setIsRecording(false);
    rec.start(); recRef.current = rec; setIsRecording(true);
  };

  const requestNotif = async () => {
    if (!('Notification' in window)) return;
    const p = await Notification.requestPermission();
    setNotifGranted(p === 'granted');
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  // ── Derived ──────────────────────────────────────────────────────

  const hasActive = commands.some(c => c.status === 'running' || c.status === 'pending');
  const h = activeId ? health[activeId] : null;
  const todayCmds = commands.filter(c => new Date(c.created_at).toDateString() === new Date().toDateString());
  const successRate = todayCmds.length ? Math.round(todayCmds.filter(c => c.status === 'done').length / todayCmds.filter(c => ['done', 'error'].includes(c.status)).length * 100) || 0 : 0;
  const avgTime = (() => {
    const done = todayCmds.filter(c => c.status === 'done' && c.started_at && c.completed_at);
    if (!done.length) return 0;
    return Math.round(done.reduce((s, c) => s + (new Date(c.completed_at!).getTime() - new Date(c.started_at!).getTime()) / 1000, 0) / done.length);
  })();

  const watcherDot = watcherOnline === null ? 'bg-gray-600' : watcherOnline ? 'bg-green-400 animate-pulse' : 'bg-red-500';

  if (!ready) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-gray-500 text-sm">読み込み中...</div></div>;
  }

  return (
    <div className="flex flex-col bg-gray-950 text-white" style={{ height: '100dvh', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header className="flex-none border-b border-gray-800 bg-gray-900 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">🤖</span>
            <span className="font-bold text-white text-sm">AI司令室</span>
            <span className={`w-1.5 h-1.5 rounded-full ${watcherDot}`} />
            {hasActive && <span className="flex items-center gap-1 text-[10px] text-blue-400"><span className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />実行中</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setAutoRetry(v => !v)}
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${autoRetry ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-gray-800 border-gray-700 text-gray-600'}`}
              title="エラー時に自動でリトライ指示を送る">🔄</button>
            <button type="button" onClick={() => setAutoApprove(v => !v)}
              className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${autoApprove ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
            >{autoApprove ? '⚡ 自動' : '手動'}</button>
            <button type="button" onClick={() => setSequenceMode(v => !v)} aria-label="シーケンスモード"
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${sequenceMode ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
            >📋</button>
            <button type="button" onClick={() => setShowSettings(true)} aria-label="設定" className="text-gray-400 hover:text-white text-lg leading-none ml-1">⚙️</button>
          </div>
        </div>

        {/* Stats bar */}
        {todayCmds.length > 0 && (
          <div className="flex gap-3 text-[10px] text-gray-600 mb-2">
            <span>今日: <span className="text-gray-400">{todayCmds.length}</span></span>
            {successRate > 0 && <span>成功率: <span className={successRate >= 80 ? 'text-green-400' : 'text-yellow-400'}>{successRate}%</span></span>}
            {avgTime > 0 && <span>平均: <span className="text-gray-400">{fmt(avgTime)}</span></span>}
          </div>
        )}

        {/* Project tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {sessions.map(s => {
            const sh = health[s.id];
            return (
              <button key={s.id} type="button" onClick={() => setActiveId(s.id)}
                className={`flex-none whitespace-nowrap text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${activeId === s.id ? 'bg-sky-600 border-sky-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'}`}
              >
                {s.name}
                {sh?.git_branch && <span className="ml-1 text-[9px] opacity-60">({sh.git_branch})</span>}
                {(sh?.uncommitted_count ?? 0) > 0 && <span className="ml-1 text-[9px] text-amber-400">+{sh?.uncommitted_count}</span>}
              </button>
            );
          })}
          <button type="button" onClick={() => { setEditForm(EMPTY_EDIT); setShowSettings(true); }}
            className="flex-none text-xs text-gray-600 border border-dashed border-gray-700 px-2.5 py-1 rounded-full hover:text-gray-400 transition-colors">＋</button>
        </div>
      </header>

      {/* Presets bar */}
      {presets.length > 0 && (
        <div className="flex-none bg-gray-900/50 border-b border-gray-800/50 px-3 py-1.5 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {presets.map((p, i) => (
            <button key={i} type="button" onClick={() => doSend(p)} disabled={!activeId || sending}
              className="flex-none text-[10px] text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2 py-0.5 rounded-full whitespace-nowrap transition-colors disabled:opacity-30">
              {p.length > 20 ? p.slice(0, 20) + '…' : p}
            </button>
          ))}
        </div>
      )}

      {/* Continue banner */}
      {continueFrom && (
        <div className="flex-none bg-sky-600/15 border-b border-sky-500/30 px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-sky-400">💬 前の出力を引き継いで送信します</span>
          <button type="button" onClick={() => setContinueFrom(null)} className="text-sky-500 hover:text-sky-300 text-sm">×</button>
        </div>
      )}

      {/* Sequence mode input */}
      {sequenceMode && (
        <div className="flex-none bg-green-500/8 border-b border-green-500/25 px-3 py-2.5 space-y-2">
          <p className="text-[11px] text-green-400">📋 シーケンスモード — 1行につき1コマンド、順番に実行</p>
          <textarea
            value={seqInput} onChange={e => setSeqInput(e.target.value)}
            placeholder={"1行目の指示\n2行目の指示\n3行目の指示"}
            rows={3}
            className="w-full bg-gray-900 border border-green-500/30 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <div className="flex gap-2">
            <button type="button" onClick={sendSequence} disabled={!seqInput.trim() || sending}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors">
              {seqInput.trim().split('\n').filter(Boolean).length}ステップ実行
            </button>
            <button type="button" onClick={() => setSequenceMode(false)} className="text-gray-500 text-xs">キャンセル</button>
          </div>
        </div>
      )}

      {/* ── Chat ── */}
      <main className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {commands.length === 0 && activeId && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-700">
            <span className="text-4xl mb-3">🤖</span>
            <p className="text-sm">Claude Codeへの指示を送信してください</p>
            {!watcherOnline && <p className="text-xs mt-2 text-red-500/70">watcher がオフラインです</p>}
            {h && <p className="text-[11px] mt-2 text-gray-700">{h.git_branch} · {h.last_commit_msg?.slice(0, 40)}</p>}
          </div>
        )}

        {commands.map((cmd, idx) => {
          const isThread = !!cmd.parent_id || (idx > 0 && commands[idx - 1]?.id === cmd.parent_id);
          const outputLines = (cmd.output || '').split('\n').length;
          const isLong = outputLines > COLLAPSE_LINES;
          const isExp = expanded.has(cmd.id);
          const displayOutput = isLong && !isExp ? cmd.output.split('\n').slice(0, COLLAPSE_LINES).join('\n') + '\n…' : cmd.output;
          const elapsedSec = elapsed[cmd.id] ?? 0;

          return (
            <div key={cmd.id} className={`space-y-1.5 ${isThread ? 'pl-3 border-l-2 border-sky-600/30' : ''}`}>
              {/* User bubble */}
              <div className="flex justify-end">
                <div className="max-w-[88%]">
                  {cmd.image_urls?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-1.5 justify-end">
                      {cmd.image_urls.map((url, i) => <img key={i} src={url} alt="" className="h-14 w-auto rounded-xl border border-sky-500/30 object-cover" />)}
                    </div>
                  )}
                  <div className="bg-sky-600/25 border border-sky-500/25 rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm text-sky-100 whitespace-pre-wrap break-words">
                    {cmd.message}
                  </div>
                  <div className="text-right text-[10px] text-gray-700 mt-0.5 pr-1">
                    {ago(cmd.created_at)}{!cmd.auto_approve && ' · 手動'}{cmd.auto_retry && ' · 自動リトライ'}
                  </div>
                </div>
              </div>

              {/* AI output */}
              <div className="w-full">
                <div className={`flex items-center gap-2 text-xs mb-1.5 pl-0.5 ${STATUS_COLOR[cmd.status]}`}>
                  <span>{STATUS_ICON[cmd.status]}</span>
                  <span className="font-medium">{STATUS_LABEL[cmd.status]}</span>
                  {cmd.status === 'running' && elapsedSec > 0 && <span className="text-blue-400/60 text-[10px]">{fmt(elapsedSec)}</span>}
                  {cmd.started_at && cmd.completed_at && <span className="text-gray-600 text-[10px]">{fmt(Math.round((new Date(cmd.completed_at).getTime() - new Date(cmd.started_at).getTime()) / 1000))}</span>}
                  {cmd.git_diff_stat && (
                    <button type="button" onClick={() => setShowDiff(cmd)}
                      className="ml-1 text-[10px] text-emerald-400/80 hover:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      📁 {cmd.git_diff_stat.split('\n').pop()?.trim() ?? 'diff'}
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    {(cmd.status === 'pending' || cmd.status === 'running') && (
                      <button type="button" onClick={() => cancelCommand(cmd.id)}
                        className="text-[11px] text-red-400 hover:text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">停止</button>
                    )}
                    {(cmd.status === 'error' || cmd.status === 'cancelled') && (
                      <button type="button" onClick={() => retryCommand(cmd)}
                        className="text-[11px] text-amber-400 hover:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">再試行</button>
                    )}
                    {cmd.status === 'done' && (
                      <button type="button" onClick={() => setContinueFrom(cmd)}
                        className="text-[11px] text-sky-400 hover:text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full">続きから</button>
                    )}
                  </div>
                </div>

                {(cmd.output || cmd.error_message) ? (
                  <div className="bg-[#0d1117] border border-gray-800 rounded-xl rounded-tl-sm overflow-hidden">
                    <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed px-3 py-2.5 overflow-x-auto">
                      {displayOutput || cmd.error_message}
                    </pre>
                    <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-800/60 gap-2">
                      {isLong ? (
                        <button type="button" onClick={() => toggleExpand(cmd.id)} className="text-[10px] text-sky-500 hover:text-sky-400">
                          {isExp ? '▲ 折りたたむ' : `▼ 全て表示 (${outputLines}行)`}
                        </button>
                      ) : <span />}
                      <button type="button" onClick={() => copyOutput(cmd)} className="text-[10px] text-gray-600 hover:text-gray-400">
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
                    <span className="text-xs text-yellow-400/60 animate-pulse">待機中...</span>
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
                <button type="button" onClick={() => removeImage(i)} aria-label="削除" className="absolute -top-1 -right-1 bg-gray-800 border border-gray-600 text-gray-300 rounded-full w-4 h-4 text-[10px] flex items-center justify-center">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5">
          {/* Voice button */}
          <button type="button" onClick={startVoice} aria-label="音声入力"
            className={`flex-none text-xl pb-0.5 transition-colors ${isRecording ? 'text-red-400 animate-pulse' : 'text-gray-500 hover:text-gray-300'}`}>
            🎤
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="画像を添付"
            className="flex-none text-xl pb-0.5 text-gray-500 hover:text-gray-300 transition-colors">📎</button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
          <textarea ref={textareaRef} value={input} onChange={autoResize}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCommand(); } }}
            placeholder={continueFrom ? '続きの指示...' : activeId ? 'Claude Codeへの指示... (Shift+Enter で改行)' : 'プロジェクトを選択'}
            disabled={!activeId}
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-40 min-h-[36px]"
            style={{ lineHeight: '1.5' }}
          />
          <button type="button" onClick={sendCommand} disabled={!input.trim() || !activeId || sending}
            className="flex-none bg-sky-600 hover:bg-sky-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors">
            {sending ? '...' : '送信'}
          </button>
        </div>
      </div>

      {/* ── Git Diff Modal ── */}
      {showDiff && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-950/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div>
              <h2 className="font-bold text-white text-sm">📁 変更ファイル</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">{showDiff.git_diff_stat?.split('\n').pop()?.trim()}</p>
            </div>
            <button type="button" onClick={() => setShowDiff(null)} aria-label="閉じる" className="text-gray-400 hover:text-white text-xl">×</button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <pre className="text-[10px] font-mono leading-relaxed">
              {(showDiff.git_diff || '').split('\n').map((line, i) => (
                <span key={i} className={`block ${diffLineClass(line)}`}>{line || ' '}</span>
              ))}
            </pre>
          </div>
        </div>
      )}

      {/* ── Settings Drawer ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative bg-gray-900 border-t border-gray-700 rounded-t-2xl max-h-[90dvh] flex flex-col">
            <div className="flex-none flex justify-center pt-2 pb-1"><div className="w-10 h-1 bg-gray-700 rounded-full" /></div>
            <div className="flex-none flex items-center justify-between px-4 pb-3">
              <h2 className="font-bold text-white text-base">設定</h2>
              <button type="button" onClick={() => setShowSettings(false)} aria-label="閉じる" className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">

              {/* Notification */}
              {!notifGranted && 'Notification' in (typeof window !== 'undefined' ? window : {}) && (
                <button type="button" onClick={requestNotif}
                  className="w-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-sm py-2.5 rounded-xl font-medium">
                  🔔 通知を許可する（完了時にスマホへ通知）
                </button>
              )}
              {notifGranted && <p className="text-xs text-green-400">🔔 通知: 有効</p>}

              {/* Existing sessions */}
              {sessions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">プロジェクト</h3>
                    {activeId && (
                      <button type="button" onClick={clearSession} disabled={clearing} className="text-xs text-red-400/70 hover:text-red-400">
                        {clearing ? '削除中...' : '履歴クリア'}
                      </button>
                    )}
                  </div>
                  {sessions.map(s => {
                    const sh = health[s.id];
                    return (
                      <div key={s.id} className={`bg-gray-800 border rounded-xl p-3 ${activeId === s.id ? 'border-sky-600/50' : 'border-gray-700'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-white text-sm">{s.name}</div>
                            <div className="text-[10px] text-gray-500 font-mono mt-0.5 break-all">{s.cwd}</div>
                            {sh && <div className="text-[10px] text-gray-600 mt-0.5">🌿 {sh.git_branch} {sh.uncommitted_count > 0 ? `· ${sh.uncommitted_count}件未コミット` : ''}</div>}
                            {s.system_context && <div className="text-[10px] text-sky-400/60 mt-0.5">📋 コンテキストあり</div>}
                          </div>
                          <div className="flex-none flex gap-2">
                            <button type="button" onClick={() => setEditForm({ id: s.id, name: s.name, cwd: s.cwd, description: s.description ?? '', system_context: s.system_context ?? '', color: s.color })} className="text-xs text-sky-400 hover:text-sky-300">編集</button>
                            <button type="button" onClick={() => deleteSession(s.id)} className="text-xs text-red-400 hover:text-red-300">削除</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add/Edit form */}
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  {sessions.some(s => s.id === editForm.id) ? 'プロジェクトを編集' : '新規プロジェクト'}
                </h3>
                {[
                  { l: 'ID（英数字・ハイフン）', ph: 'laruvisona-site', k: 'id', m: false, dis: sessions.some(s => s.id === editForm.id) },
                  { l: '表示名', ph: 'LARUvisona HP', k: 'name', m: false },
                  { l: 'Mac の絶対パス', ph: '/Users/yourname/project', k: 'cwd', m: true },
                  { l: '説明（任意）', ph: 'Next.js × Supabase', k: 'description', m: false },
                ].map(({ l, ph, k, m, dis }) => (
                  <div key={k}>
                    <label className="text-[11px] text-gray-500 mb-1 block">{l}</label>
                    <input type="text" placeholder={ph} value={(editForm as Record<string, string>)[k]}
                      onChange={e => setEditForm(v => ({ ...v, [k]: e.target.value }))} disabled={dis}
                      className={`w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50 ${m ? 'font-mono' : ''}`} />
                  </div>
                ))}
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">常設コンテキスト（毎回先頭に付く）</label>
                  <textarea placeholder={'例:\n- Next.js 14 App Router + Supabase\n- TypeScript strict\n- Tailwind CSS'} value={editForm.system_context}
                    onChange={e => setEditForm(v => ({ ...v, system_context: e.target.value }))} rows={3}
                    className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none" />
                </div>
                <button type="button" onClick={saveSession}
                  disabled={savingSession || !editForm.id.trim() || !editForm.name.trim() || !editForm.cwd.trim()}
                  className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
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
                  <input type="text" placeholder="よく使う指示..." value={newPreset}
                    onChange={e => setNewPreset(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addPreset(); }}
                    className="flex-1 bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500" />
                  <button type="button" onClick={addPreset} disabled={!newPreset.trim()}
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs transition-colors">追加</button>
                </div>
              </div>

              {/* Watcher */}
              <div className="bg-amber-500/8 border border-amber-500/25 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${watcherDot}`} />
                  <p className="text-xs font-bold text-amber-400">Watcher {watcherOnline ? 'オンライン' : `オフライン${watcherLastSeen ? `（${ago(watcherLastSeen)}）` : ''}`}</p>
                </div>
                <pre className="text-[10px] text-amber-200/50 font-mono bg-black/30 rounded-lg p-2.5">{`cd scripts/ai-watcher\nnode ai-watcher.js`}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
