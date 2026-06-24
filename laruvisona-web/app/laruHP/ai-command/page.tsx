'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────────────

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
type FilterStatus = 'all' | 'running' | 'pending' | 'done' | 'error';
type EditSession = { id: string; name: string; cwd: string; description: string; system_context: string; color: string };
const EMPTY_EDIT: EditSession = { id: '', name: '', cwd: '', description: '', system_context: '', color: 'sky' };

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(s: number) { return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`; }
function ago(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
}
function diffLineClass(line: string) {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'text-emerald-400 bg-emerald-500/5';
  if (line.startsWith('-') && !line.startsWith('---')) return 'text-rose-400 bg-rose-500/5';
  if (line.startsWith('@@')) return 'text-sky-400 bg-sky-500/5';
  if (/^(diff |index |---|[+]{3})/.test(line)) return 'text-slate-600';
  return 'text-slate-400';
}

// Smart terminal output colorizer
function renderOutput(text: string) {
  return text.split('\n').map((line, i) => {
    const isErr  = /(\bError\b|\bERROR\b|error:|✗|✕|failed|FAILED|TypeError|SyntaxError|ReferenceError)/.test(line) && !/no.error/.test(line);
    const isWarn = /(\bWarning\b|\bWARN\b|warning:|⚠|deprecated|Deprecat)/.test(line);
    const isOk   = /(\bsuccess|Success|✓|✅|\bdone\b|Done|DONE|compiled|built|passed|ready)/.test(line) && !isErr;
    const isCmd  = /^\s*[\$>]\s/.test(line);
    const isStack= /^\s+at\s+/.test(line);
    const isTs   = /^\d{4}-\d{2}-\d{2}T/.test(line);
    const isDim  = isStack || isTs;
    const isPath = /\s+(\/|\.\/)[^\s]+\.(ts|tsx|js|jsx|json)(:[\d]+)?/.test(line);

    let color = '#6b7280';
    if (isErr)  color = '#fca5a5';
    else if (isWarn) color = '#fcd34d';
    else if (isOk)   color = '#86efac';
    else if (isCmd)  color = '#67e8f9';
    else if (isDim)  color = '#374151';
    else if (isPath) color = '#818cf8';
    else             color = '#94a3b8';

    return (
      <span key={i} style={{ display: 'block', color, background: isErr ? 'rgba(248,113,113,.04)' : 'transparent', lineHeight: 1.55 }}>
        {line || ' '}
      </span>
    );
  });
}

const STATUS_LABEL: Record<Command['status'], string> = { pending: 'QUEUED', running: 'RUNNING', done: 'DONE', error: 'ERROR', cancelled: 'STOPPED' };
const STATUS_DOT: Record<Command['status'], string>   = { pending: '#f59e0b', running: '#38bdf8', done: '#4ade80', error: '#f87171', cancelled: '#374151' };

// ── Global CSS ─────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes msgSlideR { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:translateX(0)} }
  @keyframes msgSlideL { from{opacity:0;transform:translateX(-14px)} to{opacity:1;transform:translateX(0)} }
  @keyframes fadeUp    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes scaleIn   { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
  @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes rippleRing{ 0%{transform:scale(1);opacity:.5} 100%{transform:scale(2.2);opacity:0} }
  @keyframes spin      { to{transform:rotate(360deg)} }
  @keyframes gradFlow  { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
  @keyframes orbDrift  { 0%,100%{transform:translate(0,0)} 33%{transform:translate(24px,-18px)} 66%{transform:translate(-12px,12px)} }
  @keyframes recPulse  { 0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,.5)} 60%{box-shadow:0 0 0 10px rgba(248,113,113,0)} }
  .msg-r   { animation: msgSlideR .22s cubic-bezier(.2,.8,.4,1) both }
  .msg-l   { animation: msgSlideL .22s cubic-bezier(.2,.8,.4,1) both }
  .msg-e   { animation: fadeUp    .18s ease-out both }
  .scale-in{ animation: scaleIn   .18s ease-out both }
  .cursor::after { content:'▊'; animation:blink 1s step-end infinite; color:#38bdf8; margin-left:2px; font-size:.9em }
  .rec-btn { animation: recPulse  1.4s ease-in-out infinite }
  .orb     { animation: orbDrift  14s ease-in-out infinite; will-change:transform }
  .orb2    { animation: orbDrift  18s ease-in-out infinite reverse }
  .spin    { animation: spin .8s linear infinite }
  .watcher-ripple { position:absolute; inset:-4px; border-radius:13px; border:1px solid #4ade80; animation:rippleRing 2s ease-out infinite }
  ::-webkit-scrollbar { width:2px; height:2px }
  ::-webkit-scrollbar-track { background:transparent }
  ::-webkit-scrollbar-thumb { background:#1e293b; border-radius:2px }
`;

// ── Component ──────────────────────────────────────────────────────────────────

export default function AiCommandPage() {
  const supabase = createClient();

  // PIN auth
  const [pinVerified, setPinVerified] = useState(false);
  const [pinInput, setPinInput]       = useState('');
  const [pinError, setPinError]       = useState('');
  const [pinLoading, setPinLoading]   = useState(false);

  // Core data
  const [ready, setReady]             = useState(false);
  const [sessions, setSessions]       = useState<Session[]>([]);
  const [health, setHealth]           = useState<Record<string, Health>>({});
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [commands, setCommands]       = useState<Command[]>([]);

  // Watcher
  const [watcherOnline, setWatcherOnline]       = useState<boolean | null>(null);
  const [watcherLastSeen, setWatcherLastSeen]   = useState<string | null>(null);
  const [elapsed, setElapsed]                   = useState<Record<string, number>>({});

  // Input
  const [input, setInput]             = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [autoRetry, setAutoRetry]     = useState(false);
  const [sending, setSending]         = useState(false);
  const [imageFiles, setImageFiles]   = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Chat UI
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [copied, setCopied]           = useState<string | null>(null);
  const [starredIds, setStarredIds]   = useState<Set<string>>(new Set());
  const [continueFrom, setContinueFrom] = useState<Command | null>(null);
  const [showDiff, setShowDiff]       = useState<Command | null>(null);
  const [atBottom, setAtBottom]       = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [activeView, setActiveView]   = useState<'chat' | 'starred'>('chat');

  // Sequence & presets
  const [sequenceMode, setSequenceMode] = useState(false);
  const [seqInput, setSeqInput]         = useState('');
  const [presets, setPresets]           = useState<string[]>([]);
  const [newPreset, setNewPreset]       = useState('');

  // Command palette
  const [showPalette, setShowPalette]   = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const paletteInputRef = useRef<HTMLInputElement>(null);

  // Broadcast
  const [broadcastMode, setBroadcastMode] = useState(false);

  // Input history
  const [inputHistory, setInputHistory]     = useState<string[]>([]);
  const [inputHistoryIdx, setInputHistoryIdx] = useState(-1);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [editForm, setEditForm]         = useState<EditSession>(EMPTY_EDIT);
  const [savingSession, setSavingSession] = useState(false);
  const [clearing, setClearing]         = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [isRecording, setIsRecording]   = useState(false);

  const chatRef     = useRef<HTMLDivElement>(null);
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef      = useRef<any>(null);

  // ── Init ──────────────────────────────────────────────────────────

  useEffect(() => {
    const s = localStorage.getItem('ai-cmd-presets');
    if (s) { try { setPresets(JSON.parse(s)); } catch {} }
    const h = localStorage.getItem('ai-cmd-history');
    if (h) { try { setInputHistory(JSON.parse(h)); } catch {} }
    const st = localStorage.getItem('ai-cmd-stars');
    if (st) { try { setStarredIds(new Set(JSON.parse(st))); } catch {} }
    if (typeof window !== 'undefined' && 'Notification' in window) setNotifGranted(Notification.permission === 'granted');
  }, []);

  // Check PIN cookie by probing the sessions API on first load
  useEffect(() => {
    fetch('/api/ai-command/sessions').then(r => {
      if (r.ok) {
        r.json().then((data: Session[]) => {
          setSessions(data);
          if (data.length > 0) setActiveId(data[0].id);
          setPinVerified(true);
          setReady(true);
        });
      }
      // 403 means PIN not verified yet — show PIN screen
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinLoading(true);
    setPinError('');
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pinInput }),
    });
    if (res.ok) {
      const sessRes = await fetch('/api/ai-command/sessions');
      if (sessRes.ok) {
        const data: Session[] = await sessRes.json();
        setSessions(data);
        if (data.length > 0) setActiveId(data[0].id);
      }
      setPinVerified(true);
      setReady(true);
    } else {
      setPinError('PINが正しくありません');
    }
    setPinLoading(false);
  };

  useEffect(() => {
    if (!activeId) return;
    setCommands([]);
    fetch(`/api/ai-command/commands?session_id=${activeId}`)
      .then(r => r.json()).then((d: Command[]) => setCommands(d));
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    const ch = supabase.channel(`cmd-${activeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_commands', filter: `session_id=eq.${activeId}` }, (pl) => {
        const row = pl.new as Command;
        if (pl.eventType === 'INSERT') setCommands(p => [...p, row]);
        else if (pl.eventType === 'UPDATE') {
          setCommands(p => p.map(c => c.id === row.id ? row : c));
          const old = pl.old as Command;
          if ((row.status === 'done' || row.status === 'error') && old.status !== row.status
              && typeof document !== 'undefined' && document.hidden && Notification.permission === 'granted') {
            new Notification(row.status === 'done' ? '✓ Done' : '✕ Error', { body: row.message.slice(0, 80) });
          }
        } else if (pl.eventType === 'DELETE') {
          setCommands(p => p.filter(c => c.id !== (pl.old as Command).id));
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, supabase]);

  useEffect(() => {
    supabase.from('watcher_health').select('*').then(({ data }) => {
      if (data) setHealth(Object.fromEntries(data.map((h: Health) => [h.session_id, h])));
    });
    const ch = supabase.channel('hlth').on('postgres_changes', { event: '*', schema: 'public', table: 'watcher_health' }, (pl) => {
      const row = pl.new as Health; setHealth(p => ({ ...p, [row.session_id]: row }));
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    supabase.from('watcher_heartbeat').select('last_seen').eq('id', 'main').single().then(({ data }) => {
      if (data?.last_seen) { setWatcherLastSeen(data.last_seen); setWatcherOnline(Date.now() - new Date(data.last_seen).getTime() < 20_000); }
      else setWatcherOnline(false);
    });
    const ch = supabase.channel('hb').on('postgres_changes', { event: '*', schema: 'public', table: 'watcher_heartbeat' }, (pl) => {
      const r = pl.new as { last_seen: string }; if (r?.last_seen) { setWatcherLastSeen(r.last_seen); setWatcherOnline(true); }
    }).subscribe();
    const iv = setInterval(() => {
      setWatcherLastSeen(p => { if (p) setWatcherOnline(Date.now() - new Date(p).getTime() < 20_000); return p; });
    }, 15_000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setShowPalette(true);
        setTimeout(() => paletteInputRef.current?.focus(), 50);
        return;
      }
      if (e.key === 'Escape') {
        setShowPalette(false); setShowDiff(null); setShowSettings(false); setPaletteQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const onScroll = () => setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (atBottom) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commands, atBottom]);

  // ── Derived ──────────────────────────────────────────────────────

  const h = activeId ? health[activeId] : null;
  const hasRunning = commands.some(c => c.status === 'running');
  const hasPending = commands.some(c => c.status === 'pending');
  const todayCmds = commands.filter(c => new Date(c.created_at).toDateString() === new Date().toDateString());
  const doneCmds  = commands.filter(c => c.status === 'done' && c.started_at && c.completed_at);
  const successRate = todayCmds.length >= 2 ? Math.round(todayCmds.filter(c => c.status === 'done').length / todayCmds.filter(c => ['done','error'].includes(c.status)).length * 100) : null;
  const avgTime = doneCmds.length >= 2 ? Math.round(doneCmds.slice(-20).reduce((s, c) => s + (new Date(c.completed_at!).getTime() - new Date(c.started_at!).getTime()) / 1000, 0) / Math.min(doneCmds.length, 20)) : 0;

  const filteredCommands = useMemo(() => {
    const base = activeView === 'starred' ? commands.filter(c => starredIds.has(c.id)) : commands;
    if (filterStatus === 'all') return base;
    return base.filter(c => c.status === filterStatus);
  }, [commands, filterStatus, activeView, starredIds]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { running: 0, pending: 0, done: 0, error: 0 };
    commands.forEach(c => { if (c.status in counts) counts[c.status]++; });
    return counts;
  }, [commands]);

  const paletteResults = useMemo(() => {
    const q = paletteQuery.toLowerCase();
    return commands
      .filter(c => !q || c.message.toLowerCase().includes(q) || (c.output ?? '').toLowerCase().includes(q))
      .slice().reverse().slice(0, 20);
  }, [commands, paletteQuery]);

  const etaFor = useCallback((cmd: Command): number | null => {
    if (cmd.status !== 'running' || !cmd.started_at || doneCmds.length < 3) return null;
    const avg = doneCmds.slice(-10).reduce((s, c) => s + (new Date(c.completed_at!).getTime() - new Date(c.started_at!).getTime()) / 1000, 0) / Math.min(doneCmds.length, 10);
    const rem = Math.round(avg - (Date.now() - new Date(cmd.started_at).getTime()) / 1000);
    return rem > 5 ? rem : null;
  }, [doneCmds]);

  // ── Actions ──────────────────────────────────────────────────────

  const toggleExpand = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleStar = (id: string) => {
    setStarredIds(p => {
      const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id);
      localStorage.setItem('ai-cmd-stars', JSON.stringify([...n]));
      return n;
    });
  };

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

  const saveToHistory = (msg: string) => {
    const nh = [msg, ...inputHistory.filter(x => x !== msg)].slice(0, 50);
    setInputHistory(nh); setInputHistoryIdx(-1);
    localStorage.setItem('ai-cmd-history', JSON.stringify(nh));
  };

  const doSend = useCallback(async (msg: string, opts: { files?: File[]; ctx?: string; sessionId?: string } = {}) => {
    if (!msg.trim()) return;
    const sid = opts.sessionId ?? activeId;
    if (!sid) return;
    let imageUrls: string[] = [];
    for (const f of (opts.files ?? [])) {
      const fd = new FormData(); fd.append('file', f);
      const r = await fetch('/api/ai-command/upload', { method: 'POST', body: fd });
      const j = await r.json(); if (j.url) imageUrls.push(j.url as string);
    }
    await fetch('/api/ai-command/commands', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sid, message: msg.trim(), image_urls: imageUrls, auto_approve: autoApprove, auto_retry: autoRetry, context_output: opts.ctx ?? null }),
    });
  }, [activeId, autoApprove, autoRetry]);

  const sendCommand = useCallback(async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    saveToHistory(input);
    try {
      if (broadcastMode) {
        await Promise.all(sessions.map(s => doSend(input, { files: imageFiles, ctx: continueFrom?.output, sessionId: s.id })));
      } else {
        await doSend(input, { files: imageFiles, ctx: continueFrom?.output });
      }
    } finally {
      setSending(false); setInput(''); setContinueFrom(null);
      setImageFiles([]); setImagePreviews(p => { p.forEach(u => URL.revokeObjectURL(u)); return []; });
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, imageFiles, continueFrom, doSend, sending, broadcastMode, sessions]);

  const sendSequence = async () => {
    const lines = seqInput.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length || !activeId) return;
    setSending(true);
    for (const line of lines) await doSend(line);
    setSending(false); setSeqInput(''); setSequenceMode(false);
  };

  const sendFromPalette = (cmd: Command) => {
    setShowPalette(false); setPaletteQuery('');
    setActiveId(cmd.session_id);
    setTimeout(() => { setInput(cmd.message); textareaRef.current?.focus(); }, 100);
  };

  const cancelCommand = (id: string) => fetch(`/api/ai-command/commands/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) });
  const retryCommand  = (cmd: Command) => doSend(cmd.message, { sessionId: cmd.session_id });
  const clearSession  = async () => {
    if (!activeId || !confirm('Clear all history?')) return;
    setClearing(true); await fetch(`/api/ai-command/commands?session_id=${activeId}`, { method: 'DELETE' }); setCommands([]); setClearing(false);
  };

  const saveSession = async () => {
    if (!editForm.id.trim() || !editForm.name.trim() || !editForm.cwd.trim()) return;
    setSavingSession(true);
    try {
      const res = await fetch('/api/ai-command/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editForm, system_context: editForm.system_context || null }) });
      const data: Session = await res.json();
      setSessions(p => { const i = p.findIndex(s => s.id === data.id); return i >= 0 ? p.map((s, j) => j === i ? data : s) : [...p, data]; });
      setEditForm(EMPTY_EDIT); if (!activeId) setActiveId(data.id);
    } finally { setSavingSession(false); }
  };
  const deleteSession = async (id: string) => {
    if (!confirm('Delete project?')) return;
    await fetch(`/api/ai-command/sessions?id=${id}`, { method: 'DELETE' });
    setSessions(p => p.filter(s => s.id !== id));
    if (activeId === id) setActiveId(sessions.find(s => s.id !== id)?.id ?? null);
  };
  const addPreset = () => {
    if (!newPreset.trim()) return;
    const n = [...presets, newPreset.trim()]; setPresets(n); localStorage.setItem('ai-cmd-presets', JSON.stringify(n)); setNewPreset('');
  };
  const removePreset = (i: number) => { const n = presets.filter((_, j) => j !== i); setPresets(n); localStorage.setItem('ai-cmd-presets', JSON.stringify(n)); };

  const startVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any; const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { alert('Voice not supported'); return; }
    if (isRecording) { recRef.current?.stop(); setIsRecording(false); return; }
    const rec = new SR(); rec.lang = 'ja-JP'; rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => setInput((p: string) => p ? p + ' ' + e.results[0][0].transcript : e.results[0][0].transcript);
    rec.onerror = () => setIsRecording(false); rec.onend = () => setIsRecording(false);
    rec.start(); recRef.current = rec; setIsRecording(true);
  };
  const requestNotif = async () => { if (!('Notification' in window)) return; setNotifGranted(await Notification.requestPermission() === 'granted'); };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value); e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
    setInputHistoryIdx(-1);
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCommand(); return; }
    if (e.key === 'ArrowUp' && !input.trim()) {
      e.preventDefault();
      const idx = Math.min(inputHistoryIdx + 1, inputHistory.length - 1);
      setInputHistoryIdx(idx); setInput(inputHistory[idx] ?? '');
      return;
    }
    if (e.key === 'ArrowDown' && inputHistoryIdx >= 0) {
      e.preventDefault();
      const idx = inputHistoryIdx - 1;
      setInputHistoryIdx(idx); setInput(idx >= 0 ? inputHistory[idx] : '');
    }
  };

  // ── Loading ───────────────────────────────────────────────────────

  if (!ready && !pinVerified) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020408' }}>
        <style>{CSS}</style>
        <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: 280 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🤖</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>AI司令室</div>
            <div style={{ fontSize: 11, color: '#475569' }}>管理者PINを入力してください</div>
          </div>
          <input
            type="password"
            value={pinInput}
            onChange={e => setPinInput(e.target.value)}
            placeholder="PIN"
            autoFocus
            style={{ width: '100%', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '12px 16px', color: '#f1f5f9', fontSize: 14, outline: 'none', textAlign: 'center', letterSpacing: '0.2em', boxSizing: 'border-box' }}
          />
          {pinError && <div style={{ fontSize: 12, color: '#f87171' }}>{pinError}</div>}
          <button
            type="submit"
            disabled={pinLoading || !pinInput}
            style={{ width: '100%', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', border: 'none', borderRadius: 10, padding: '12px', color: 'white', fontSize: 14, fontWeight: 700, cursor: pinLoading ? 'wait' : 'pointer', opacity: (!pinInput || pinLoading) ? 0.5 : 1 }}
          >
            {pinLoading ? '確認中...' : 'アクセス'}
          </button>
        </form>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020408' }}>
        <style>{CSS}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>🤖</div>
          <div style={{ fontSize: 10, color: '#1e293b', letterSpacing: '.12em', fontWeight: 700 }}>LOADING</div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#020408', color: '#e2e8f0', overflow: 'hidden', position: 'relative', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{CSS}</style>

      {/* Ambient orbs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div className="orb"  style={{ position: 'absolute', top: '-20%', left: '-10%', width: 380, height: 380, background: 'radial-gradient(circle, rgba(14,165,233,.065) 0%, transparent 65%)', borderRadius: '50%' }} />
        <div className="orb2" style={{ position: 'absolute', bottom: '5%', right: '-12%', width: 440, height: 440, background: 'radial-gradient(circle, rgba(99,102,241,.055) 0%, transparent 65%)', borderRadius: '50%' }} />
      </div>

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <header style={{ flexShrink: 0, background: 'rgba(2,4,8,.88)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,.05)', position: 'relative', zIndex: 10 }}>

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 8px' }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ position: 'relative', width: 30, height: 30, flexShrink: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#0ea5e9,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, boxShadow: '0 0 16px rgba(14,165,233,.22)' }}>🤖</div>
              {watcherOnline && <div className="watcher-ripple" />}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.03em', background: 'linear-gradient(90deg,#f1f5f9 60%,#64748b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI司令室</div>
              <div style={{ fontSize: 9, letterSpacing: '.07em', fontWeight: 700, marginTop: 1, color: watcherOnline ? '#22d3ee' : '#ef4444' }}>
                {watcherOnline ? '● ONLINE' : '● OFFLINE'}
                {watcherLastSeen && !watcherOnline ? <span style={{ opacity: .5 }}> · {ago(watcherLastSeen)}</span> : ''}
                {(hasRunning || hasPending) ? <span style={{ color: '#38bdf8', marginLeft: 6 }}>· {commands.filter(c => c.status === 'running').length} RUNNING</span> : ''}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button type="button" onClick={() => setBroadcastMode(v => !v)} title="全プロジェクト一斉送信" style={{ padding: '0 8px', height: 26, borderRadius: 7, border: broadcastMode ? '1px solid rgba(251,146,60,.5)' : '1px solid rgba(255,255,255,.07)', background: broadcastMode ? 'rgba(251,146,60,.12)' : 'rgba(255,255,255,.03)', color: broadcastMode ? '#fb923c' : '#2d3748', fontSize: 9, fontWeight: 800, letterSpacing: '.04em', cursor: 'pointer', transition: 'all .15s' }}>
              📡{broadcastMode ? ' BROAD' : ''}
            </button>
            <button type="button" onClick={() => { setShowPalette(true); setTimeout(() => paletteInputRef.current?.focus(), 50); }} title="コマンドパレット (⌘K)" style={{ padding: '0 8px', height: 26, borderRadius: 7, border: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.03)', color: '#2d3748', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>⌘K</button>
            <button type="button" onClick={() => setAutoApprove(v => !v)} title="自動承認" style={{ padding: '0 7px', height: 26, borderRadius: 7, border: autoApprove ? '1px solid rgba(251,191,36,.4)' : '1px solid rgba(255,255,255,.07)', background: autoApprove ? 'rgba(251,191,36,.1)' : 'rgba(255,255,255,.03)', color: autoApprove ? '#fbbf24' : '#2d3748', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>
              {autoApprove ? '⚡AUTO' : 'MAN'}
            </button>
            <button type="button" onClick={() => setAutoRetry(v => !v)} title="自動リトライ" style={{ width: 26, height: 26, borderRadius: 7, border: autoRetry ? '1px solid rgba(139,92,246,.4)' : '1px solid rgba(255,255,255,.07)', background: autoRetry ? 'rgba(139,92,246,.12)' : 'rgba(255,255,255,.03)', color: autoRetry ? '#a78bfa' : '#2d3748', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔄</button>
            <button type="button" onClick={() => setShowSettings(true)} aria-label="設定" style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.03)', color: '#2d3748', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙️</button>
          </div>
        </div>

        {/* Project tabs */}
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 14px 8px' }}>
          {sessions.map(s => {
            const active = activeId === s.id;
            const sh = health[s.id];
            const rCount = commands.filter(c => c.session_id === s.id && c.status === 'running').length;
            const pCount = commands.filter(c => c.session_id === s.id && c.status === 'pending').length;
            return (
              <button key={s.id} type="button" onClick={() => setActiveId(s.id)} style={{
                flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 9, cursor: 'pointer', position: 'relative',
                border: active ? 'none' : '1px solid rgba(255,255,255,.05)',
                background: active ? 'linear-gradient(135deg,#0369a1,#4338ca)' : 'rgba(255,255,255,.03)',
                color: active ? '#fff' : '#2d3748', transition: 'all .15s',
                boxShadow: active ? '0 0 16px rgba(14,165,233,.28),inset 0 1px 0 rgba(255,255,255,.15)' : 'none',
              }}>
                {s.name}
                {sh?.git_branch && <span style={{ marginLeft: 5, fontSize: 9, opacity: .5 }}>{sh.git_branch}</span>}
                {sh && sh.uncommitted_count > 0 && <span style={{ marginLeft: 3, color: '#fbbf24', fontSize: 9 }}>·{sh.uncommitted_count}</span>}
                {(rCount > 0 || pCount > 0) && (
                  <span style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: '50%', background: rCount > 0 ? '#38bdf8' : '#fbbf24', border: '1.5px solid #020408', boxShadow: rCount > 0 ? '0 0 4px #38bdf8' : 'none' }} />
                )}
              </button>
            );
          })}
          <button type="button" onClick={() => { setEditForm(EMPTY_EDIT); setShowSettings(true); }} style={{ flexShrink: 0, fontSize: 10, color: '#1e293b', border: '1px dashed #1e293b', background: 'transparent', padding: '5px 10px', borderRadius: 9, cursor: 'pointer' }}>＋</button>
        </div>

        {/* Stats + filter row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px 9px' }}>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 10 }}>
            {todayCmds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 8, color: '#1e293b', letterSpacing: '.1em', fontWeight: 700 }}>TODAY</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>{todayCmds.length}</span>
              </div>
            )}
            {successRate !== null && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 8, color: '#1e293b', letterSpacing: '.1em', fontWeight: 700 }}>RATE</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: successRate >= 80 ? '#4ade80' : '#fbbf24' }}>{successRate}%</span>
              </div>
            )}
            {avgTime > 0 && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 8, color: '#1e293b', letterSpacing: '.1em', fontWeight: 700 }}>AVG</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>{fmt(avgTime)}</span>
              </div>
            )}
          </div>
          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 3 }}>
            {(['all', 'running', 'done', 'error'] as FilterStatus[]).map(f => {
              const cnt = f === 'all' ? commands.length : filterCounts[f];
              const isAct = filterStatus === f;
              const clr = f === 'running' ? '#38bdf8' : f === 'done' ? '#4ade80' : f === 'error' ? '#f87171' : '#475569';
              return (
                <button key={f} type="button" onClick={() => setFilterStatus(f)} style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, cursor: 'pointer',
                  border: isAct ? `1px solid ${clr}40` : '1px solid transparent',
                  background: isAct ? `${clr}15` : 'transparent',
                  color: isAct ? clr : '#1e293b',
                }}>
                  {f === 'all' ? 'ALL' : f.slice(0,3).toUpperCase()}{cnt > 0 ? ` ${cnt}` : ''}
                </button>
              );
            })}
            <button type="button" onClick={() => setActiveView(v => v === 'starred' ? 'chat' : 'starred')} style={{
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, cursor: 'pointer',
              border: activeView === 'starred' ? '1px solid rgba(251,191,36,.4)' : '1px solid transparent',
              background: activeView === 'starred' ? 'rgba(251,191,36,.12)' : 'transparent',
              color: activeView === 'starred' ? '#fbbf24' : '#1e293b',
            }}>★{starredIds.size > 0 ? ` ${starredIds.size}` : ''}</button>
          </div>
        </div>
      </header>

      {/* Presets bar */}
      {presets.length > 0 && (
        <div style={{ flexShrink: 0, background: 'rgba(2,4,8,.7)', borderBottom: '1px solid rgba(255,255,255,.04)', padding: '5px 14px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {presets.map((p, i) => (
            <button key={i} type="button" onClick={() => doSend(p)} disabled={!activeId || sending} style={{ flexShrink: 0, fontSize: 10, color: '#334155', background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)', padding: '3px 10px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .12s' }}
              onMouseEnter={e => { (e.currentTarget).style.color = '#64748b'; }}
              onMouseLeave={e => { (e.currentTarget).style.color = '#334155'; }}>
              {p.length > 24 ? p.slice(0, 24) + '…' : p}
            </button>
          ))}
        </div>
      )}

      {/* Continue banner */}
      {continueFrom && (
        <div style={{ flexShrink: 0, background: 'rgba(14,165,233,.07)', borderBottom: '1px solid rgba(14,165,233,.15)', padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#38bdf8' }}>💬 前の出力を引き継ぎます</span>
          <button type="button" onClick={() => setContinueFrom(null)} style={{ color: '#0ea5e9', background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Broadcast banner */}
      {broadcastMode && (
        <div style={{ flexShrink: 0, background: 'rgba(251,146,60,.06)', borderBottom: '1px solid rgba(251,146,60,.18)', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#fb923c', fontWeight: 700 }}>📡 BROADCAST</span>
          <span style={{ fontSize: 10, color: 'rgba(251,146,60,.55)' }}>全 {sessions.length} プロジェクト一斉送信</span>
          <button type="button" onClick={() => setBroadcastMode(false)} style={{ marginLeft: 'auto', color: '#fb923c', background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', opacity: .6, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Sequence panel */}
      {sequenceMode && (
        <div style={{ flexShrink: 0, background: 'rgba(74,222,128,.04)', borderBottom: '1px solid rgba(74,222,128,.12)', padding: '10px 14px' }}>
          <div style={{ fontSize: 9, color: '#22c55e', marginBottom: 6, letterSpacing: '.08em', fontWeight: 700 }}>SEQUENCE — 1行 = 1コマンド（順番実行）</div>
          <textarea value={seqInput} onChange={e => setSeqInput(e.target.value)} placeholder={"TypeScriptエラーを全部直して\nビルドを確認して\n変更をコミットして"} rows={3}
            style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(74,222,128,.15)', color: '#e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 11, fontFamily: 'monospace', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={sendSequence} disabled={!seqInput.trim() || sending} style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {seqInput.trim().split('\n').filter(Boolean).length} ステップ実行
            </button>
            <button type="button" onClick={() => setSequenceMode(false)} style={{ color: '#374151', background: 'none', border: 'none', fontSize: 12, cursor: 'pointer' }}>キャンセル</button>
          </div>
        </div>
      )}

      {/* ── CHAT ──────────────────────────────────────────────────── */}
      <main ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 13px 8px', display: 'flex', flexDirection: 'column', gap: 18, position: 'relative', zIndex: 1 }}>

        {filteredCommands.length === 0 && (
          <div className="msg-e" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, paddingTop: 60, paddingBottom: 40 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,rgba(14,165,233,.1),rgba(99,102,241,.1))', border: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              {activeView === 'starred' ? '★' : filterStatus !== 'all' ? { running: '◉', pending: '○', done: '✓', error: '✕' }[filterStatus as 'running'|'pending'|'done'|'error'] : '🤖'}
            </div>
            {activeView === 'starred' ? (
              <div style={{ textAlign: 'center', color: '#1e293b', fontSize: 12 }}>スターを付けたメッセージはありません</div>
            ) : filterStatus !== 'all' ? (
              <div style={{ textAlign: 'center', color: '#1e293b', fontSize: 12 }}>{filterStatus.toUpperCase()} のコマンドはありません</div>
            ) : (
              <>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>Ready</div>
                  {h && <div style={{ fontSize: 10, color: '#0f172a', marginTop: 3 }}>🌿 {h.git_branch}{h.last_commit_msg ? ` · ${h.last_commit_msg.slice(0, 36)}` : ''}</div>}
                </div>
                {!watcherOnline && <div style={{ fontSize: 10, color: 'rgba(239,68,68,.5)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(239,68,68,.12)', background: 'rgba(239,68,68,.04)' }}>⚠ watcher offline</div>}
              </>
            )}
          </div>
        )}

        {filteredCommands.map((cmd) => {
          const isThread    = !!cmd.parent_id;
          const outputLines = (cmd.output || '').split('\n').length;
          const isLong      = outputLines > 30;
          const isExp       = expanded.has(cmd.id);
          const displayOutput = isLong && !isExp ? cmd.output.split('\n').slice(0, 30).join('\n') : cmd.output;
          const elapsedSec  = elapsed[cmd.id] ?? 0;
          const eta         = etaFor(cmd);
          const isStarred   = starredIds.has(cmd.id);
          const statusDot   = STATUS_DOT[cmd.status];

          return (
            <div key={cmd.id} className="msg-e" style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: isThread ? 14 : 0, borderLeft: isThread ? '2px solid rgba(14,165,233,.18)' : 'none' }}>

              {/* User message */}
              <div className="msg-r" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ maxWidth: '90%' }}>
                  {cmd.image_urls?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6, justifyContent: 'flex-end' }}>
                      {cmd.image_urls.map((url, i) => <img key={i} src={url} alt="" style={{ height: 52, width: 'auto', borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(14,165,233,.15)' }} />)}
                    </div>
                  )}
                  <div style={{ background: 'linear-gradient(135deg,rgba(3,105,161,.32),rgba(67,56,202,.22))', border: '1px solid rgba(14,165,233,.13)', borderRadius: '14px 14px 3px 14px', padding: '9px 13px', fontSize: 13, color: '#bae6fd', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>
                    {cmd.message}
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 3, paddingRight: 2 }}>
                    {cmd.auto_retry && <span style={{ fontSize: 8, color: '#a78bfa', opacity: .7 }}>retry↩</span>}
                    <span style={{ fontSize: 9, color: '#1e293b' }}>{ago(cmd.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* AI response */}
              <div className="msg-l" style={{ maxWidth: '97%' }}>
                {/* Status row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, paddingLeft: 2, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusDot, boxShadow: cmd.status === 'running' ? `0 0 5px ${statusDot}` : 'none', flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: statusDot, letterSpacing: '.07em' }}>{STATUS_LABEL[cmd.status]}</span>
                  </div>
                  {cmd.status === 'running' && elapsedSec > 0 && (
                    <span style={{ fontSize: 9, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{fmt(elapsedSec)}{eta ? ` · ~${fmt(eta)}` : ''}</span>
                  )}
                  {cmd.started_at && cmd.completed_at && (
                    <span style={{ fontSize: 9, color: '#1e293b' }}>{fmt(Math.round((new Date(cmd.completed_at).getTime() - new Date(cmd.started_at).getTime()) / 1000))}</span>
                  )}
                  {cmd.git_diff_stat && (
                    <button type="button" onClick={() => setShowDiff(cmd)} style={{ fontSize: 9, color: '#34d399', background: 'rgba(52,211,153,.07)', border: '1px solid rgba(52,211,153,.18)', borderRadius: 20, padding: '1px 7px', cursor: 'pointer' }}>
                      ∆ {cmd.git_diff_stat.split('\n').pop()?.trim()}
                    </button>
                  )}
                  {/* Right side actions */}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button type="button" onClick={() => toggleStar(cmd.id)} style={{ fontSize: 11, color: isStarred ? '#fbbf24' : '#1e293b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, transition: 'color .15s' }}>{isStarred ? '★' : '☆'}</button>
                    {(cmd.status === 'pending' || cmd.status === 'running') && (
                      <button type="button" onClick={() => cancelCommand(cmd.id)} style={{ fontSize: 9, color: '#f87171', background: 'rgba(248,113,113,.07)', border: '1px solid rgba(248,113,113,.18)', borderRadius: 20, padding: '1px 7px', cursor: 'pointer' }}>STOP</button>
                    )}
                    {(cmd.status === 'error' || cmd.status === 'cancelled') && (
                      <button type="button" onClick={() => retryCommand(cmd)} style={{ fontSize: 9, color: '#fbbf24', background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.18)', borderRadius: 20, padding: '1px 7px', cursor: 'pointer' }}>RETRY</button>
                    )}
                    {cmd.status === 'done' && (
                      <button type="button" onClick={() => setContinueFrom(cmd)} style={{ fontSize: 9, color: '#38bdf8', background: 'rgba(56,189,248,.05)', border: '1px solid rgba(56,189,248,.18)', borderRadius: 20, padding: '1px 7px', cursor: 'pointer' }}>→</button>
                    )}
                  </div>
                </div>

                {/* Progress bar while running */}
                {cmd.status === 'running' && (
                  <div style={{ marginBottom: 6, height: 2, background: 'rgba(255,255,255,.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, transition: 'width 1s linear',
                      background: eta ? 'linear-gradient(90deg,#0ea5e9,#6366f1)' : undefined,
                      backgroundImage: eta ? undefined : 'linear-gradient(90deg,#0ea5e9,#6366f1,#0ea5e9)',
                      backgroundSize: '200% 100%',
                      animation: eta ? 'none' : 'gradFlow 1.5s linear infinite',
                      width: eta ? `${Math.min(90, (elapsedSec / (elapsedSec + eta)) * 100)}%` : '100%',
                    }} />
                  </div>
                )}

                {/* Output block */}
                {(cmd.output || cmd.error_message) ? (
                  <div style={{ background: '#030710', border: `1px solid ${cmd.status === 'error' ? 'rgba(248,113,113,.12)' : 'rgba(255,255,255,.05)'}`, borderRadius: '0 12px 12px 12px', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.02)' }}>
                    <pre style={{ margin: 0, padding: '10px 12px', fontSize: 11, fontFamily: '"JetBrains Mono","Fira Code",ui-monospace,monospace', lineHeight: 1, overflowX: 'auto' }}>
                      {cmd.output ? renderOutput(displayOutput) : <span style={{ color: '#fca5a5' }}>{cmd.error_message}</span>}
                      {cmd.status === 'running' && <span className="cursor" />}
                    </pre>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px 6px', borderTop: '1px solid rgba(255,255,255,.03)' }}>
                      {isLong ? (
                        <button type="button" onClick={() => toggleExpand(cmd.id)} style={{ fontSize: 9, color: '#0ea5e9', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          {isExp ? '▲ collapse' : `▼ +${outputLines - 30} lines`}
                        </button>
                      ) : <span />}
                      <button type="button" onClick={() => copyOutput(cmd)} style={{ fontSize: 9, color: copied === cmd.id ? '#4ade80' : '#1e293b', background: 'none', border: 'none', cursor: 'pointer', transition: 'color .2s' }}>
                        {copied === cmd.id ? '✓ copied' : 'copy'}
                      </button>
                    </div>
                  </div>
                ) : cmd.status === 'running' ? (
                  <div style={{ background: '#030710', border: '1px solid rgba(56,189,248,.1)', borderRadius: '0 12px 12px 12px', padding: '10px 12px' }}>
                    <span className="cursor" style={{ fontSize: 11, color: '#0c2a4a', fontFamily: 'monospace' }}>executing</span>
                  </div>
                ) : cmd.status === 'pending' ? (
                  <div style={{ background: '#030710', border: '1px solid rgba(251,191,36,.07)', borderRadius: '0 12px 12px 12px', padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, color: '#1a1006', fontFamily: 'monospace' }}>waiting in queue...</span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} style={{ height: 1 }} />
      </main>

      {/* Scroll-to-bottom FAB */}
      {!atBottom && (
        <button type="button" onClick={() => { setAtBottom(true); chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }} style={{ position: 'absolute', bottom: 90, right: 14, width: 30, height: 30, borderRadius: '50%', background: 'rgba(14,165,233,.12)', border: '1px solid rgba(14,165,233,.25)', color: '#38bdf8', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(12px)' }}>↓</button>
      )}

      {/* ── INPUT BAR ─────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, background: 'rgba(2,4,8,.94)', backdropFilter: 'blur(24px)', borderTop: '1px solid rgba(255,255,255,.04)', padding: '9px 12px', paddingBottom: `calc(9px + env(safe-area-inset-bottom,0px))`, position: 'relative', zIndex: 10 }}>

        {/* Sub controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <button type="button" onClick={() => setSequenceMode(v => !v)} style={{ fontSize: 9, color: sequenceMode ? '#4ade80' : '#1e293b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700, letterSpacing: '.05em' }}>
            {sequenceMode ? '▸ SEQ ON' : '▸ SEQ'}
          </button>
          {inputHistoryIdx >= 0 && (
            <span style={{ fontSize: 9, color: '#334155' }}>↑↓ hist {inputHistoryIdx + 1}/{inputHistory.length}</span>
          )}
          {broadcastMode && <span style={{ fontSize: 9, color: '#fb923c', fontWeight: 700, marginLeft: 'auto' }}>📡 → {sessions.length} projects</span>}
        </div>

        {/* Image previews */}
        {imagePreviews.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {imagePreviews.map((src, i) => (
              <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                <img src={src} alt="" style={{ height: 46, width: 'auto', borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(255,255,255,.07)' }} />
                <button type="button" onClick={() => removeImage(i)} style={{ position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: '50%', background: '#0f172a', border: '1px solid rgba(255,255,255,.12)', color: '#64748b', fontSize: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Main input row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
          <button type="button" onClick={startVoice} aria-label="音声入力" className={isRecording ? 'rec-btn' : ''} style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: isRecording ? 'rgba(248,113,113,.12)' : 'rgba(255,255,255,.03)', border: isRecording ? '1px solid rgba(248,113,113,.35)' : '1px solid rgba(255,255,255,.06)', color: isRecording ? '#f87171' : '#1e293b', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>🎤</button>
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="画像" style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', color: '#1e293b', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📎</button>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageChange} />
          <textarea
            ref={textareaRef} value={input} onChange={autoResize} onKeyDown={handleTextareaKeyDown}
            placeholder={broadcastMode ? `全${sessions.length}プロジェクトに送信... (↑ 履歴)` : continueFrom ? '続きを入力...' : activeId ? 'Claude Codeへの指示... (↑ 履歴)' : 'プロジェクトを選択してください'}
            disabled={!activeId}
            rows={1}
            style={{ flex: 1, background: 'rgba(255,255,255,.035)', border: `1px solid ${continueFrom ? 'rgba(14,165,233,.25)' : broadcastMode ? 'rgba(251,146,60,.25)' : 'rgba(255,255,255,.07)'}`, color: '#e2e8f0', borderRadius: 11, padding: '8px 11px', fontSize: 13, resize: 'none', outline: 'none', minHeight: 34, lineHeight: 1.5, fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color .2s' }}
          />
          <button type="button" onClick={sendCommand} disabled={!input.trim() || !activeId || sending} style={{
            flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: 'none',
            background: !input.trim() || !activeId || sending ? 'rgba(255,255,255,.03)' : broadcastMode ? 'linear-gradient(135deg,#c2410c,#b45309)' : 'linear-gradient(135deg,#0369a1,#4338ca)',
            color: !input.trim() || !activeId || sending ? '#1e293b' : '#fff',
            fontSize: 16, cursor: !input.trim() || !activeId || sending ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s', fontWeight: 700,
            boxShadow: !input.trim() || !activeId || sending ? 'none' : broadcastMode ? '0 0 12px rgba(251,146,60,.3)' : '0 0 12px rgba(14,165,233,.22)',
          }}>
            {sending ? <span className="spin" style={{ display: 'inline-block', fontSize: 13 }}>◌</span> : '↑'}
          </button>
        </div>
      </div>

      {/* ── COMMAND PALETTE ───────────────────────────────────────── */}
      {showPalette && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column' }} onClick={e => { if (e.target === e.currentTarget) { setShowPalette(false); setPaletteQuery(''); } }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(10px)' }} onClick={() => { setShowPalette(false); setPaletteQuery(''); }} />
          <div className="scale-in" style={{ position: 'relative', background: '#060e1e', border: '1px solid rgba(14,165,233,.15)', borderRadius: 18, margin: '56px 12px 0', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.03)', maxHeight: '62dvh', display: 'flex', flexDirection: 'column' }}>
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', borderBottom: '1px solid rgba(255,255,255,.05)', flexShrink: 0 }}>
              <span style={{ color: '#1e293b', fontSize: 15 }}>🔍</span>
              <input ref={paletteInputRef} type="text" value={paletteQuery} onChange={e => setPaletteQuery(e.target.value)} placeholder="コマンド検索 · Enterで再利用..." style={{ flex: 1, background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} autoComplete="off" />
              <kbd style={{ fontSize: 9, color: '#1e293b', border: '1px solid #1e293b', borderRadius: 5, padding: '2px 6px', fontFamily: 'monospace' }}>ESC</kbd>
            </div>
            {/* Results list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {!paletteQuery && (
                <div style={{ padding: '6px 15px 4px', fontSize: 9, color: '#1e293b', letterSpacing: '.08em', fontWeight: 700 }}>RECENT</div>
              )}
              {paletteResults.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#1e293b', fontSize: 12 }}>マッチなし</div>
              ) : paletteResults.map(cmd => {
                const sess = sessions.find(s => s.id === cmd.session_id);
                return (
                  <button key={cmd.id} type="button" onClick={() => sendFromPalette(cmd)} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4, padding: '9px 15px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,.025)', transition: 'background .1s' }}
                    onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(14,165,233,.06)'; }}
                    onMouseLeave={e => { (e.currentTarget).style.background = 'transparent'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{cmd.message}</span>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 9, color: STATUS_DOT[cmd.status], fontWeight: 700 }}>{STATUS_LABEL[cmd.status]}</span>
                        <span style={{ fontSize: 9, color: '#1e293b' }}>rerun →</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 9, color: '#0f172a' }}>{sess?.name ?? cmd.session_id}</span>
                      <span style={{ fontSize: 9, color: '#0f172a' }}>{ago(cmd.created_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── GIT DIFF ──────────────────────────────────────────────── */}
      {showDiff && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: '#020408', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flexShrink: 0, padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.05)', background: 'rgba(6,14,30,.95)', backdropFilter: 'blur(24px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#f1f5f9' }}>∆ Changes</div>
              <div style={{ fontSize: 10, color: '#34d399', marginTop: 2 }}>{showDiff.git_diff_stat?.split('\n').pop()?.trim()}</div>
            </div>
            <button type="button" onClick={() => setShowDiff(null)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', color: '#475569', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 13px' }}>
            <pre style={{ margin: 0, fontSize: 11, fontFamily: '"JetBrains Mono","Fira Code",ui-monospace,monospace', lineHeight: 1.6 }}>
              {(showDiff.git_diff || showDiff.git_diff_stat || '').split('\n').map((line, i) => (
                <span key={i} className={diffLineClass(line)} style={{ display: 'block', padding: '0 2px' }}>{line || ' '}</span>
              ))}
            </pre>
          </div>
        </div>
      )}

      {/* ── SETTINGS ──────────────────────────────────────────────── */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(5px)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#060e1e', borderTop: '1px solid rgba(255,255,255,.06)', borderRadius: '20px 20px 0 0', maxHeight: '88dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 -20px 60px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}><div style={{ width: 36, height: 3, borderRadius: 2, background: '#1e293b' }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 12px' }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#f1f5f9' }}>設定</div>
              <button type="button" onClick={() => setShowSettings(false)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', color: '#475569', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 36px', display: 'flex', flexDirection: 'column', gap: 13 }}>

              {!notifGranted && (
                <button type="button" onClick={requestNotif} style={{ background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)', color: '#a5b4fc', borderRadius: 12, padding: '10px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                  🔔 通知を許可する（完了時にスマホへプッシュ）
                </button>
              )}

              {/* Project list */}
              {sessions.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <div style={{ fontSize: 9, color: '#1e293b', letterSpacing: '.1em', fontWeight: 700 }}>PROJECTS</div>
                    {activeId && <button type="button" onClick={clearSession} disabled={clearing} style={{ fontSize: 10, color: '#ef4444', opacity: .4, background: 'none', border: 'none', cursor: 'pointer' }}>{clearing ? '...' : 'clear history'}</button>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {sessions.map(s => {
                      const sh = health[s.id];
                      return (
                        <div key={s.id} style={{ background: activeId === s.id ? 'rgba(14,165,233,.07)' : 'rgba(255,255,255,.025)', border: `1px solid ${activeId === s.id ? 'rgba(14,165,233,.18)' : 'rgba(255,255,255,.05)'}`, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: '#e2e8f0' }}>{s.name}</div>
                            <div style={{ fontSize: 10, color: '#1e293b', fontFamily: 'monospace', marginTop: 2, wordBreak: 'break-all' }}>{s.cwd}</div>
                            {sh && <div style={{ fontSize: 9, color: '#0f172a', marginTop: 2 }}>🌿 {sh.git_branch}{sh.uncommitted_count > 0 ? ` · ${sh.uncommitted_count}↑` : ''}{sh.last_commit_msg ? ` · ${sh.last_commit_msg.slice(0, 30)}` : ''}</div>}
                            {s.system_context && <div style={{ fontSize: 9, color: 'rgba(56,189,248,.4)', marginTop: 2 }}>📋 context</div>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                            <button type="button" onClick={() => setEditForm({ id: s.id, name: s.name, cwd: s.cwd, description: s.description ?? '', system_context: s.system_context ?? '', color: s.color })} style={{ fontSize: 10, color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>edit</button>
                            <button type="button" onClick={() => deleteSession(s.id)} style={{ fontSize: 10, color: '#f87171', opacity: .5, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>del</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add/Edit form */}
              <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: '13px' }}>
                <div style={{ fontSize: 9, color: '#1e293b', letterSpacing: '.1em', fontWeight: 700, marginBottom: 11 }}>
                  {sessions.some(s => s.id === editForm.id) ? 'EDIT PROJECT' : 'NEW PROJECT'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { l: 'ID',   ph: 'laruvisona-site', k: 'id', mono: false, dis: sessions.some(s => s.id === editForm.id) },
                    { l: 'NAME', ph: 'LARUvisona HP', k: 'name', mono: false },
                    { l: 'PATH', ph: '/Users/you/project', k: 'cwd', mono: true },
                    { l: 'NOTE', ph: 'Next.js + Supabase', k: 'description', mono: false },
                  ].map(({ l, ph, k, mono, dis }) => (
                    <div key={k}>
                      <div style={{ fontSize: 8, color: '#1e293b', letterSpacing: '.1em', marginBottom: 3, fontWeight: 700 }}>{l}</div>
                      <input type="text" placeholder={ph} value={(editForm as Record<string, string>)[k]} onChange={e => setEditForm(v => ({ ...v, [k]: e.target.value }))} disabled={dis}
                        style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.07)', color: '#e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: mono ? 'monospace' : 'inherit', outline: 'none', boxSizing: 'border-box', opacity: dis ? .5 : 1 }} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 8, color: '#1e293b', letterSpacing: '.1em', marginBottom: 3, fontWeight: 700 }}>SYSTEM CONTEXT</div>
                    <textarea placeholder={"- Next.js 14 App Router\n- TypeScript strict\n- Tailwind CSS"} value={editForm.system_context} onChange={e => setEditForm(v => ({ ...v, system_context: e.target.value }))} rows={3}
                      style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.07)', color: '#e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 11, fontFamily: 'monospace', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <button type="button" onClick={saveSession} disabled={savingSession || !editForm.id.trim() || !editForm.name.trim() || !editForm.cwd.trim()} style={{ background: (!editForm.id.trim()||!editForm.name.trim()||!editForm.cwd.trim()) ? 'rgba(255,255,255,.03)' : 'linear-gradient(135deg,#0369a1,#4338ca)', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, color: (!editForm.id.trim()||!editForm.name.trim()||!editForm.cwd.trim()) ? '#1e293b' : '#fff', cursor: 'pointer' }}>
                    {savingSession ? '...' : '保存'}
                  </button>
                </div>
              </div>

              {/* Presets */}
              <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: '13px' }}>
                <div style={{ fontSize: 9, color: '#1e293b', letterSpacing: '.1em', fontWeight: 700, marginBottom: 10 }}>QUICK PRESETS</div>
                {presets.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {presets.map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 8, padding: '5px 9px', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#334155', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
                        <button type="button" onClick={() => removePreset(i)} style={{ fontSize: 9, color: '#ef4444', opacity: .4, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="text" placeholder="よく使う指示を追加..." value={newPreset} onChange={e => setNewPreset(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addPreset(); }}
                    style={{ flex: 1, background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.07)', color: '#e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 11, outline: 'none' }} />
                  <button type="button" onClick={addPreset} disabled={!newPreset.trim()} style={{ background: 'rgba(14,165,233,.1)', border: '1px solid rgba(14,165,233,.2)', color: '#38bdf8', borderRadius: 8, padding: '7px 12px', fontSize: 11, cursor: 'pointer' }}>+</button>
                </div>
              </div>

              {/* Input history */}
              {inputHistory.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: '#1e293b', letterSpacing: '.1em', fontWeight: 700 }}>INPUT HISTORY ({inputHistory.length})</div>
                    <button type="button" onClick={() => { setInputHistory([]); localStorage.removeItem('ai-cmd-history'); }} style={{ fontSize: 9, color: '#ef4444', opacity: .4, background: 'none', border: 'none', cursor: 'pointer' }}>clear</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {inputHistory.slice(0, 8).map((hItem, i) => (
                      <button key={i} type="button" onClick={() => { setInput(hItem); textareaRef.current?.focus(); setShowSettings(false); }} style={{ textAlign: 'left', background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.04)', borderRadius: 7, padding: '5px 9px', fontSize: 10, color: '#334155', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {hItem}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Watcher */}
              <div style={{ background: 'rgba(251,191,36,.03)', border: '1px solid rgba(251,191,36,.08)', borderRadius: 14, padding: '11px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                  <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: watcherOnline ? '#4ade80' : '#ef4444' }} />
                    {watcherOnline && <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: '1px solid #4ade80', animation: 'rippleRing 2s ease-out infinite' }} />}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: watcherOnline ? '#4ade80' : '#fbbf24' }}>Watcher {watcherOnline ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
                <pre style={{ fontSize: 10, color: 'rgba(251,191,36,.25)', background: 'rgba(0,0,0,.3)', borderRadius: 7, padding: '7px 9px', margin: 0, fontFamily: 'monospace' }}>{`cd scripts/ai-watcher && node ai-watcher.js`}</pre>
              </div>

              {/* Keyboard shortcuts */}
              <div style={{ background: 'rgba(255,255,255,.015)', border: '1px solid rgba(255,255,255,.04)', borderRadius: 14, padding: '11px 13px' }}>
                <div style={{ fontSize: 9, color: '#1e293b', letterSpacing: '.1em', fontWeight: 700, marginBottom: 8 }}>KEYBOARD SHORTCUTS</div>
                {[['⌘K', 'コマンドパレット'], ['↑↓', '入力履歴を遡る'], ['Enter', '送信'], ['Shift+Enter', '改行'], ['Esc', 'モーダルを閉じる']].map(([k, d]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: '#1e293b' }}>{d}</span>
                    <kbd style={{ fontSize: 9, fontFamily: 'monospace', color: '#334155', background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 5, padding: '2px 6px' }}>{k}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
