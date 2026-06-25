'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, Bot, Zap, Wrench, Folder, ArrowLeft, Square, ChevronRight, Wifi, WifiOff, MonitorSmartphone, Trash2, Lock, RotateCcw, Sparkles, Camera, Mic, Radio, Plus, X as XIcon, GitBranch, FolderOpen, FileText, ChevronDown } from 'lucide-react';
import GeminiLive from './GeminiLive';

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';
const BRIDGE_PIN = process.env.NEXT_PUBLIC_BRIDGE_PIN || ADMIN_SECRET;

const PROJECT_ICONS: Record<string, React.ReactNode> = {
  laruvisona: <Globe size={28} />,
  larubot: <Bot size={28} />,
  flastal: <Zap size={28} />,
  laru_dev: <Wrench size={28} />,
};

interface Project { id: string; name: string; }
interface Message { role: 'user' | 'assistant' | 'system'; content: string; streaming?: boolean; ts?: number; }

const CLAUDE_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku (速い)' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet (賢い)' },
];

function getRelayWsUrl() {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/relay`;
}

function useWS(url: string, enabled: boolean) {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Array<(msg: unknown) => void>>([]);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(1000);
  const [connected, setConnected] = useState(false);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(data));
  }, []);

  const addListener = useCallback((fn: (msg: unknown) => void) => {
    listenersRef.current.push(fn);
    return () => { listenersRef.current = listenersRef.current.filter(f => f !== fn); };
  }, []);

  useEffect(() => {
    if (!enabled || !url) return;
    let dead = false;
    function connect() {
      if (dead) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => { setConnected(true); delayRef.current = 1000; };
      ws.onmessage = (e) => {
        try { const m = JSON.parse(e.data); listenersRef.current.forEach(fn => fn(m)); } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        if (!dead) reconnectRef.current = setTimeout(() => {
          delayRef.current = Math.min(delayRef.current * 2, 30000);
          connect();
        }, delayRef.current);
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => {
      dead = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [url, enabled]);

  return { connected, send, addListener };
}

/* ── PIN Screen ───────────────────────────────────────────── */
function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [shake, setShake] = useState(false);
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setDots(d => (d + 1) % 4), 500);
    return () => clearInterval(id);
  }, []);

  const submit = () => {
    if (value === BRIDGE_PIN) {
      sessionStorage.setItem('bridge_unlocked', '1');
      onUnlock();
    } else {
      setShake(true);
      setValue('');
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0a0f1e 0%, #000 70%)' }}>
      {/* 3D floating icon */}
      <div className="mb-10" style={{ perspective: 800 }}>
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            boxShadow: '0 0 40px rgba(14,165,233,0.4), 0 0 80px rgba(99,102,241,0.2)',
            animation: 'float 3s ease-in-out infinite',
          }}>
          <MonitorSmartphone size={36} color="white" />
        </div>
      </div>

      <p className="text-gray-400 text-sm mb-2 tracking-widest uppercase">Claude Bridge</p>
      <p className="text-gray-600 text-xs mb-8">
        {'Authenticating' + '.'.repeat(dots)}
      </p>

      <div className={`w-72 ${shake ? 'shake' : ''}`}>
        <input
          type="password"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="パスワードを入力"
          autoFocus
          className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white text-center text-lg tracking-widest outline-none focus:border-sky-500 transition-all"
          style={{ backdropFilter: 'blur(10px)' }}
        />
        <button onClick={submit}
          className="mt-3 w-full py-3.5 rounded-xl font-semibold text-white transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', boxShadow: '0 0 20px rgba(14,165,233,0.3)' }}>
          アンロック
        </button>
      </div>

      <style>{`
        @keyframes float {
          0%,100% { transform: translateY(0) rotateX(0deg) rotateY(0deg); }
          33% { transform: translateY(-8px) rotateX(5deg) rotateY(5deg); }
          66% { transform: translateY(-4px) rotateX(-3deg) rotateY(-3deg); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
        .shake { animation: shake 0.5s ease; }
      `}</style>
    </div>
  );
}

/* ── 3D Project Card ──────────────────────────────────────── */
function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glow, setGlow] = useState({ x: 50, y: 50 });
  const [active, setActive] = useState(false);

  const onMove = (clientX: number, clientY: number) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    setTilt({ x: (y - 0.5) * 20, y: (x - 0.5) * -20 });
    setGlow({ x: x * 100, y: y * 100 });
  };

  return (
    <button ref={cardRef}
      onClick={onClick}
      onMouseMove={e => onMove(e.clientX, e.clientY)}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      onTouchStart={() => setActive(true)}
      onTouchEnd={() => { setActive(false); setTilt({ x: 0, y: 0 }); }}
      onTouchMove={e => onMove(e.touches[0].clientX, e.touches[0].clientY)}
      className="w-full text-left relative overflow-hidden rounded-2xl p-5 transition-all duration-200 active:scale-95"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) ${active ? 'scale(0.97)' : 'scale(1)'}`,
        boxShadow: active ? '0 0 30px rgba(14,165,233,0.2)' : '0 4px 20px rgba(0,0,0,0.3)',
        transition: 'transform 0.15s ease, box-shadow 0.2s ease',
      }}>
      {/* Glow spot */}
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{
        background: `radial-gradient(circle at ${glow.x}% ${glow.y}%, rgba(14,165,233,0.6) 0%, transparent 60%)`,
      }} />

      <div className="flex items-center gap-4 relative">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', boxShadow: '0 0 20px rgba(14,165,233,0.3)' }}>
          <span className="text-white">{PROJECT_ICONS[project.id] || <Folder size={24} />}</span>
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold">{project.name}</p>
          <p className="text-gray-500 text-xs mt-0.5">Claude Code</p>
        </div>
        <ChevronRight size={18} className="text-gray-600" />
      </div>
    </button>
  );
}

/* ── Main Component ───────────────────────────────────────── */
export default function BridgeClient() {
  const [unlocked, setUnlocked] = useState(false);
  const [token, setToken] = useState('');
  const [tokenReady, setTokenReady] = useState(false);
  const [macOnline, setMacOnline] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const loadHistory = (projectId: string): Message[] => {
    try { return JSON.parse(localStorage.getItem(`bridge_hist_${projectId}`) || '[]'); } catch { return []; }
  };
  const saveHistory = (projectId: string, msgs: Message[]) => {
    try { localStorage.setItem(`bridge_hist_${projectId}`, JSON.stringify(msgs.slice(-100))); } catch {}
  };
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [initError, setInitError] = useState('');
  const [view, setView] = useState<'projects' | 'chat'>('projects');
  // モード切り替え: code / chat / git / files
  const [mode, setMode] = useState<'code' | 'chat' | 'git' | 'files'>('code');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatModel, setChatModel] = useState(CLAUDE_MODELS[0].id);
  const [chatRunning, setChatRunning] = useState(false);
  // Git status
  const [gitStatus, setGitStatus] = useState<{ status?: string; log?: string; error?: string } | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  // ファイルビューワー
  const [filePath, setFilePath] = useState('');
  const [fileEntries, setFileEntries] = useState<{ name: string; is_dir: boolean }[]>([]);
  const [fileContent, setFileContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [fileHistory, setFileHistory] = useState<string[]>([]);
  // プリセット指示
  const [presets, setPresets] = useState<string[]>([]);
  const [showPresetAdd, setShowPresetAdd] = useState(false);
  const [presetInput, setPresetInput] = useState('');
  // Claude Code モデル選択
  const [codeModel, setCodeModel] = useState('');
  // Gemini
  const [enhanceMode, setEnhanceMode] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const voiceMediaRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const [summaries, setSummaries] = useState<Record<number, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const [relayWs, setRelayWs] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem('bridge_unlocked') === '1') setUnlocked(true);
    // プリセット読み込み
    try {
      const saved = JSON.parse(localStorage.getItem('bridge_presets') || '[]');
      if (Array.isArray(saved)) setPresets(saved);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (unlocked) setRelayWs(getRelayWsUrl()); }, [unlocked]);

  const wsUrl = token && relayWs ? `${relayWs}?role=client&token=${token}` : '';
  const { connected, send, addListener } = useWS(wsUrl, tokenReady && !!token && unlocked);

  useEffect(() => {
    if (!unlocked) return;
    const stored = localStorage.getItem('bridge_token');
    if (stored) { setToken(stored); setTokenReady(true); return; }
    if (!ADMIN_SECRET) { setInitError('NEXT_PUBLIC_ADMIN_SECRET 未設定'); return; }
    fetch('/api/bridge/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: ADMIN_SECRET }),
    }).then(r => r.json()).then(d => {
      if (d.token) { localStorage.setItem('bridge_token', d.token); setToken(d.token); setTokenReady(true); }
      else setInitError('トークン取得失敗');
    }).catch(() => setInitError('サーバーに接続できません'));
  }, [unlocked]);

  useEffect(() => {
    const unsub = addListener((msg: unknown) => {
      const m = msg as { type: string; online?: boolean; projects?: Project[]; content?: string; exit_code?: number; message?: string };
      if (m.type === 'mac_status') {
        setMacOnline(m.online ?? false);
        if (m.online) send({ type: 'list_projects' });
      }
      if (m.type === 'mac_online') { setMacOnline(true); send({ type: 'list_projects' }); }
      if (m.type === 'mac_offline') { setMacOnline(false); setRunning(false); }
      if (m.type === 'auth_error') { localStorage.removeItem('bridge_token'); setToken(''); setTokenReady(false); }
      if (m.type === 'git_status_result') {
        setGitStatus(m as { status?: string; log?: string; error?: string });
        setGitLoading(false);
      }
      if (m.type === 'file_list_result') {
        const r = m as { path?: string; entries?: { name: string; is_dir: boolean }[]; error?: string };
        if (!r.error) setFileEntries(r.entries || []);
        setFileLoading(false);
      }
      if (m.type === 'file_read_result') {
        const r = m as { path?: string; content?: string; error?: string };
        if (!r.error) setFileContent(r.content || '');
        setFileLoading(false);
      }
      if (m.type === 'projects') setProjects(m.projects || []);
      if (m.type === 'running') { setRunning(true); setContinuing(!!(m as {continuing?: boolean}).continuing); }
      if (m.type === 'conversation_reset') { setContinuing(false); setMessages(prev => [...prev, { role: 'system', content: '新しい会話を開始しました' }]); }
      if (m.type === 'output') {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.streaming)
            return [...prev.slice(0, -1), { ...last, content: last.content + (m.content || '') }];
          return [...prev, { role: 'assistant', content: m.content || '', streaming: true }];
        });
      }
      if (m.type === 'done') {
        setRunning(false);
        // バイブレーション
        if ('vibrate' in navigator) navigator.vibrate(m.exit_code === 0 ? [100, 50, 100] : [300]);
        // フォアグラウンド通知
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(m.exit_code === 0 ? 'Claude Code 完了' : 'Claude Code エラー', {
            body: m.exit_code === 0 ? '実行が正常に完了しました' : `終了コード: ${m.exit_code}`,
            icon: '/laruhp_logo.png',
          });
        }
        setMessages(prev => {
          const updated = (() => {
            const last = prev[prev.length - 1];
            return last?.streaming ? [...prev.slice(0, -1), { ...last, streaming: false, ts: Date.now() }] : prev;
          })();
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant' && lastMsg.content.length > 300) {
            setTimeout(() => summarizeOutput(lastMsg.content, updated.length - 1), 300);
          }
          return updated;
        });
      }
      if (m.type === 'aborted') { setRunning(false); setMessages(prev => [...prev, { role: 'system', content: '処理を中断しました' }]); }
      if (m.type === 'error') { setRunning(false); setMessages(prev => [...prev, { role: 'system', content: m.message || 'エラー' }]); }
    });
    return unsub;
  }, [addListener]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (currentProject && messages.length > 0) saveHistory(currentProject.id, messages);
  }, [messages, currentProject]);

  const selectProject = (p: Project) => {
    send({ type: 'select_project', project: p.id });
    setCurrentProject(p);
    setMessages(loadHistory(p.id));
    setView('chat');
  };

  const clearHistory = () => {
    if (!currentProject) return;
    localStorage.removeItem(`bridge_hist_${currentProject.id}`);
    setMessages([]);
  };

  const newConversation = () => {
    send({ type: 'new_conversation' });
  };

  // プリセット管理
  const savePreset = (text: string) => {
    if (!text.trim() || presets.includes(text.trim())) return;
    const next = [...presets, text.trim()].slice(-10);
    setPresets(next);
    localStorage.setItem('bridge_presets', JSON.stringify(next));
  };
  const removePreset = (i: number) => {
    const next = presets.filter((_, idx) => idx !== i);
    setPresets(next);
    localStorage.setItem('bridge_presets', JSON.stringify(next));
  };

  // Push 通知サブスクリプション登録
  const registerPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      await fetch('/api/bridge/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      });
    } catch { /* vapid not set up */ }
  };

  const handleChatSend = async () => {
    const text = input.trim();
    if (!text || chatRunning || !currentProject) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = '44px';

    let finalText = text;
    if (enhanceMode) {
      try {
        finalText = await gemini('enhance', {
          input: text,
          projectName: currentProject.name,
          recentHistory: chatMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        });
      } catch { finalText = text; }
    }

    const userMsg: Message = { role: 'user', content: finalText, ts: Date.now() };
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setChatRunning(true);

    const assistantMsg: Message = { role: 'assistant', content: '', streaming: true, ts: Date.now() };
    setChatMessages([...nextMessages, assistantMsg]);

    try {
      const res = await fetch('/api/bridge/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          projectName: currentProject.name,
          model: chatModel,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const { text: chunk } = JSON.parse(data);
            full += chunk;
            setChatMessages(prev => {
              const last = prev[prev.length - 1];
              return last?.streaming ? [...prev.slice(0, -1), { ...last, content: full }] : prev;
            });
          } catch { /* ignore parse errors */ }
        }
      }

      setChatMessages(prev => {
        const last = prev[prev.length - 1];
        return last?.streaming ? [...prev.slice(0, -1), { ...last, content: full, streaming: false }] : prev;
      });
    } catch (e) {
      setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: 'エラーが発生しました', ts: Date.now() }]);
    } finally {
      setChatRunning(false);
    }
  };

  const gemini = async (action: string, params: Record<string, unknown>) => {
    const res = await fetch('/api/bridge/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params }),
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    return d.result as string;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const result = await gemini('image', { imageBase64: base64, mimeType: file.type });
        setInput(result);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
      } catch (err) {
        console.error('Image analysis failed:', err);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleVoice = async () => {
    if (voiceRecording) {
      voiceMediaRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      voiceChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) voiceChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setVoiceRecording(false);
        const blob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          try {
            const text = await gemini('transcribe', { audioBase64: base64, mimeType: 'audio/webm' });
            setInput(text);
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
            }
          } catch (err) { console.error('Transcription failed:', err); }
        };
        reader.readAsDataURL(blob);
      };
      mr.start();
      voiceMediaRef.current = mr;
      setVoiceRecording(true);
    } catch { console.error('Mic access denied'); }
  };

  const summarizeOutput = async (content: string, index: number) => {
    if (!currentProject) return;
    try {
      const summary = await gemini('summarize', { content, projectName: currentProject.name });
      setSummaries(prev => ({ ...prev, [index]: summary }));
    } catch { /* サイレントフェイル */ }
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || running) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = '44px';

    let finalText = text;
    if (enhanceMode && currentProject) {
      setEnhancing(true);
      try {
        finalText = await gemini('enhance', {
          input: text,
          projectName: currentProject.name,
          recentHistory: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        });
      } catch { finalText = text; }
      setEnhancing(false);
    }

    setMessages(prev => [...prev, { role: 'user', content: finalText, ts: Date.now() }]);
    send({ type: 'message', content: finalText, model: codeModel || undefined });
  };

  const handleLock = () => {
    sessionStorage.removeItem('bridge_unlocked');
    setUnlocked(false);
  };

  if (!unlocked) return <PinScreen onUnlock={() => setUnlocked(true)} />;

  if (liveOpen && currentProject) return (
    <GeminiLive
      projectName={currentProject.name}
      recentHistory={messages.slice(-6).map(m => ({ role: m.role, content: m.content }))}
      onInstruction={(text) => { setInput(text); }}
      onClose={() => setLiveOpen(false)}
    />
  );

  if (initError) return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-6">
      <p className="text-red-400 text-sm">{initError}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col text-white"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #050d1a 0%, #000 60%)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
        style={{ backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.6)' }}>
        {view === 'chat' && (
          <button onClick={() => setView('projects')}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <ArrowLeft size={16} />
          </button>
        )}
        <span className="flex-1 font-semibold text-sm tracking-wide"
          style={{ background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {view === 'chat' && currentProject ? currentProject.name : 'Claude Bridge'}
        </span>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${connected ? 'text-emerald-400' : 'text-gray-600'}`}
            style={{ background: connected ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${connected ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
            {connected ? <Wifi size={10} /> : <WifiOff size={10} />}
            <span>{connected ? 'ON' : 'OFF'}</span>
          </div>
          <div className={`w-2 h-2 rounded-full transition-all ${macOnline ? '' : 'bg-gray-700'}`}
            style={macOnline ? { background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' } : {}} />
        </div>
        {view === 'chat' && continuing && !running && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
            継続中
          </span>
        )}
        {view === 'chat' && !running && (
          <button onClick={newConversation}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-600 active:scale-90 transition-all"
            style={{ background: 'rgba(255,255,255,0.05)' }} title="新しい会話">
            <RotateCcw size={14} />
          </button>
        )}
        {view === 'chat' && !running && messages.length > 0 && (
          <button onClick={clearHistory}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-600 active:scale-90 transition-all"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Trash2 size={14} />
          </button>
        )}
        {'Notification' in (typeof window !== 'undefined' ? window : {}) && Notification.permission !== 'granted' && (
          <button onClick={registerPush}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-yellow-500 active:scale-90 transition-all"
            style={{ background: 'rgba(234,179,8,0.1)' }} title="通知を有効化">
            <span className="text-xs">🔔</span>
          </button>
        )}
        <button onClick={handleLock}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-600 active:scale-90 transition-all"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <Lock size={14} />
        </button>
        {running && (
          <button onClick={() => send({ type: 'abort' })}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400 transition-all active:scale-90"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <Square size={10} fill="currentColor" />
            <span>中断</span>
          </button>
        )}
      </div>

      {/* Mac offline banner */}
      {connected && !macOnline && (
        <div className="px-4 py-2 text-xs text-center"
          style={{ background: 'rgba(234,179,8,0.1)', borderBottom: '1px solid rgba(234,179,8,0.2)', color: '#fbbf24' }}>
          Mac エージェントがオフラインです
        </div>
      )}

      {/* Projects view */}
      {view === 'projects' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-gray-600 text-xs text-center pt-2 pb-1 tracking-widest uppercase">プロジェクトを選択</p>
          {projects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.05)', animation: 'pulse 2s infinite' }}>
                <MonitorSmartphone size={24} className="text-gray-600" />
              </div>
              <p className="text-gray-600 text-sm">
                {connected && macOnline ? 'プロジェクトなし' : connected ? 'Mac 待機中...' : '接続中...'}
              </p>
            </div>
          )}
          {projects.map(p => <ProjectCard key={p.id} project={p} onClick={() => selectProject(p)} />)}
        </div>
      )}

      {/* Chat view */}
      {view === 'chat' && (
        <>
          {/* モード切り替えタブ */}
          <div className="flex gap-1 px-2 py-2 border-b border-white/5"
            style={{ background: 'rgba(0,0,0,0.4)' }}>
            {([
              { id: 'code', label: 'Code', activeStyle: { background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc' } },
              { id: 'chat', label: 'Chat', activeStyle: { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', color: '#fcd34d' } },
              { id: 'git',  label: 'Git',  activeStyle: { background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.4)', color: '#6ee7b7' } },
              { id: 'files',label: 'Files',activeStyle: { background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' } },
            ] as const).map(t => (
              <button key={t.id} onClick={() => {
                setMode(t.id);
                if (t.id === 'git' && !gitStatus && macOnline) { setGitLoading(true); send({ type: 'git_status' }); }
                if (t.id === 'files' && fileEntries.length === 0 && macOnline) { setFileLoading(true); send({ type: 'file_list', path: '' }); }
              }}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={mode === t.id ? t.activeStyle : { background: 'rgba(255,255,255,0.03)', color: '#4b5563' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* プリセット指示バー */}
          {(presets.length > 0 || showPresetAdd) && (
            <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto border-b border-white/5"
              style={{ background: 'rgba(0,0,0,0.3)', scrollbarWidth: 'none' }}>
              {presets.map((p, i) => (
                <div key={i} className="flex items-center gap-1 flex-shrink-0 group">
                  <button onClick={() => setInput(p)}
                    className="px-3 py-1 rounded-full text-xs text-gray-400 whitespace-nowrap transition-all active:scale-90 hover:text-white"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {p.length > 20 ? p.slice(0, 20) + '…' : p}
                  </button>
                  <button onClick={() => removePreset(i)}
                    className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(239,68,68,0.3)' }}>
                    <XIcon size={8} className="text-red-400" />
                  </button>
                </div>
              ))}
              {showPresetAdd ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input value={presetInput} onChange={e => setPresetInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { savePreset(presetInput); setPresetInput(''); setShowPresetAdd(false); }
                      if (e.key === 'Escape') { setShowPresetAdd(false); setPresetInput(''); }
                    }}
                    placeholder="指示を入力..." autoFocus
                    className="w-36 px-2 py-1 rounded-full text-xs text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)' }} />
                  <button onClick={() => { savePreset(presetInput); setPresetInput(''); setShowPresetAdd(false); }}
                    className="px-2 py-1 rounded-full text-xs text-emerald-400"
                    style={{ background: 'rgba(52,211,153,0.1)' }}>追加</button>
                </div>
              ) : null}
            </div>
          )}

          {/* Git status ビュー */}
          {mode === 'git' && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-gray-600 text-xs tracking-widest uppercase">Git Status</p>
                <button onClick={() => { setGitLoading(true); send({ type: 'git_status' }); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <RotateCcw size={12} className={gitLoading ? 'text-emerald-400 animate-spin' : 'text-gray-600'} />
                </button>
              </div>
              {gitLoading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}
              {gitStatus?.error && <p className="text-red-400 text-xs">{gitStatus.error}</p>}
              {gitStatus?.status !== undefined && (
                <div className="rounded-xl p-4 space-y-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-gray-600 text-xs mb-2">変更ファイル</p>
                  {gitStatus.status ? (
                    gitStatus.status.trim().split('\n').map((line, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold w-5" style={{ color: line.startsWith('M') ? '#fbbf24' : line.startsWith('A') ? '#34d399' : line.startsWith('D') ? '#f87171' : '#a5b4fc' }}>
                          {line.slice(0, 2).trim()}
                        </span>
                        <span className="text-gray-300 text-xs font-mono truncate">{line.slice(3)}</span>
                      </div>
                    ))
                  ) : <p className="text-gray-600 text-xs">変更なし（クリーン）</p>}
                </div>
              )}
              {gitStatus?.log && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-gray-600 text-xs mb-2">直近のコミット</p>
                  {gitStatus.log.trim().split('\n').map((line, i) => (
                    <div key={i} className="flex items-start gap-2 py-0.5">
                      <span className="text-sky-500 text-xs font-mono flex-shrink-0">{line.slice(0, 7)}</span>
                      <span className="text-gray-400 text-xs">{line.slice(8)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ファイルビューワー */}
          {mode === 'files' && (
            <div className="flex-1 overflow-y-auto">
              {/* パンくず */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                <button onClick={() => { setFilePath(''); setFileContent(''); setFileHistory([]); setFileLoading(true); send({ type: 'file_list', path: '' }); }}
                  className="text-xs text-sky-400 flex-shrink-0 active:opacity-70">root</button>
                {fileHistory.map((seg, i) => (
                  <span key={i} className="flex items-center gap-1 flex-shrink-0">
                    <ChevronDown size={10} className="text-gray-700 -rotate-90" />
                    <button onClick={() => {
                      const newPath = fileHistory.slice(0, i + 1).join('/');
                      setFilePath(newPath); setFileContent(''); setFileHistory(fileHistory.slice(0, i + 1));
                      setFileLoading(true); send({ type: 'file_list', path: newPath });
                    }} className="text-xs text-sky-400 active:opacity-70">{seg}</button>
                  </span>
                ))}
              </div>
              {fileLoading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>}
              {/* ファイルコンテンツ表示 */}
              {fileContent ? (
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-500 text-xs font-mono">{filePath}</p>
                    <button onClick={() => setInput(`${filePath} を参照して: `)}
                      className="text-xs text-violet-400 px-2 py-1 rounded-lg active:scale-90 transition-all"
                      style={{ background: 'rgba(139,92,246,0.1)' }}>Codeに送る</button>
                  </div>
                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">{fileContent}</pre>
                </div>
              ) : (
                /* ディレクトリリスト */
                <div className="px-3 py-2 space-y-0.5">
                  {fileEntries.map((entry, i) => (
                    <button key={i} onClick={() => {
                      const newPath = filePath ? `${filePath}/${entry.name}` : entry.name;
                      if (entry.is_dir) {
                        setFilePath(newPath); setFileContent(''); setFileHistory([...fileHistory, entry.name]);
                        setFileLoading(true); send({ type: 'file_list', path: newPath });
                      } else {
                        setFilePath(newPath); setFileLoading(true); send({ type: 'file_read', path: newPath });
                      }
                    }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all active:scale-98"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      {entry.is_dir
                        ? <FolderOpen size={14} className="text-sky-400 flex-shrink-0" />
                        : <FileText size={14} className="text-gray-600 flex-shrink-0" />}
                      <span className="text-sm text-gray-300 truncate">{entry.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* メッセージリスト */}
          <div className={`overflow-y-auto px-4 py-4 space-y-3 ${mode === 'code' || mode === 'chat' ? 'flex-1' : 'hidden'}`}>
            {mode === 'code' && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <p className="text-gray-700 text-sm">Claude Code に指示を送信</p>
              </div>
            )}
            {mode === 'chat' && chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(239,68,68,0.1))', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <Bot size={22} className="text-amber-400" />
                </div>
                <p className="text-gray-600 text-sm">Claude と直接会話</p>
                <p className="text-gray-700 text-xs text-center">コード質問・設計相談・なんでも</p>
              </div>
            )}
            {(mode === 'code' ? messages : chatMessages).map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : m.role === 'system' ? 'justify-center' : 'justify-start'}`}
                style={{ animation: 'fadeSlide 0.2s ease forwards' }}>
                {m.role === 'system' ? (
                  <span className="text-gray-600 text-xs px-3 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {m.content}
                  </span>
                ) : (
                  <div className="max-w-[88%]">
                    <div className="rounded-2xl px-4 py-3"
                      style={m.role === 'user'
                        ? { background: mode === 'chat' ? 'linear-gradient(135deg, #d97706, #dc2626)' : 'linear-gradient(135deg, #0ea5e9, #6366f1)', borderBottomRightRadius: 4 }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderBottomLeftRadius: 4 }}>
                      <pre className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">{m.content}</pre>
                      {m.streaming && (
                        <span className="inline-block w-2 h-4 ml-0.5 align-middle"
                          style={{ background: mode === 'chat' ? '#fbbf24' : '#38bdf8', animation: 'blink 0.7s step-end infinite' }} />
                      )}
                    </div>
                    {m.ts && !m.streaming && (
                      <p className={`text-gray-700 text-xs mt-1 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                        {new Date(m.ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {mode === 'code' && summaries[i] && (
                      <div className="mt-2 rounded-xl px-3 py-2 text-xs leading-relaxed"
                        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                        <span className="text-violet-500 font-semibold mr-1">✦ Gemini要約</span>
                        {summaries[i]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {mode === 'code' && running && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="flex gap-1.5 px-4 py-3 rounded-2xl rounded-bl-sm"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {[0, 0.15, 0.3].map((d, i) => (
                    <div key={i} className="w-2 h-2 rounded-full"
                      style={{ background: '#38bdf8', animation: `bounce 1s ease ${d}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            {mode === 'chat' && chatRunning && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="flex gap-1.5 px-4 py-3 rounded-2xl rounded-bl-sm"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {[0, 0.15, 0.3].map((d, i) => (
                    <div key={i} className="w-2 h-2 rounded-full"
                      style={{ background: '#fbbf24', animation: `bounce 1s ease ${d}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 入力エリア（code / chat のみ） */}
          {(mode === 'code' || mode === 'chat') && <div className="border-t border-white/5"
            style={{ backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.6)' }}>
            {/* ツールバー */}
            <div className="flex items-center gap-2 px-3 pt-2 pb-1">
              {/* 画像 */}
              <label className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all active:scale-90 ${enhancing ? 'opacity-40 pointer-events-none' : ''}`}
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Camera size={14} className="text-gray-500" />
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
              </label>
              {/* 音声 */}
              <button onClick={handleVoice} disabled={enhancing}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
                style={{ background: voiceRecording ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', border: voiceRecording ? '1px solid rgba(239,68,68,0.4)' : 'none' }}>
                <Mic size={14} className={voiceRecording ? 'text-red-400' : 'text-gray-500'} />
              </button>
              {/* 強化モード */}
              <button onClick={() => setEnhanceMode(v => !v)} disabled={enhancing}
                className="flex items-center gap-1 px-2 h-8 rounded-lg text-xs transition-all active:scale-90 disabled:opacity-40"
                style={{
                  background: enhanceMode ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                  border: enhanceMode ? '1px solid rgba(99,102,241,0.4)' : 'none',
                  color: enhanceMode ? '#a5b4fc' : '#6b7280',
                }}>
                {enhancing ? <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" /> : <Sparkles size={12} />}
                <span>強化</span>
              </button>
              {/* プリセット追加 */}
              <button onClick={() => setShowPresetAdd(v => !v)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90"
                style={{ background: showPresetAdd ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)', border: showPresetAdd ? '1px solid rgba(52,211,153,0.3)' : 'none' }}
                title="プリセット追加">
                <Plus size={14} className={showPresetAdd ? 'text-emerald-400' : 'text-gray-500'} />
              </button>
              {/* Codeモード: モデル選択 + Gemini Live */}
              {mode === 'code' && (
                <div className="flex items-center gap-1 ml-auto">
                  <select value={codeModel} onChange={e => setCodeModel(e.target.value)} disabled={running}
                    className="h-8 px-2 rounded-lg text-xs outline-none transition-all"
                    style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#7dd3fc' }}>
                    <option value="" style={{ background: '#111', color: '#fff' }}>デフォルト</option>
                    <option value="claude-haiku-4-5-20251001" style={{ background: '#111', color: '#fff' }}>Haiku (速い)</option>
                    <option value="claude-sonnet-4-6" style={{ background: '#111', color: '#fff' }}>Sonnet (賢い)</option>
                    <option value="claude-opus-4-8" style={{ background: '#111', color: '#fff' }}>Opus (最高)</option>
                  </select>
                  <button onClick={() => setLiveOpen(true)} disabled={!macOnline || running}
                    className="flex items-center gap-1 px-2 h-8 rounded-lg text-xs transition-all active:scale-90 disabled:opacity-40"
                    style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#c4b5fd' }}>
                    <Radio size={12} />
                    <span>Live</span>
                  </button>
                </div>
              )}
              {/* Chatモード: モデル選択 */}
              {mode === 'chat' && (
                <select value={chatModel} onChange={e => setChatModel(e.target.value)} disabled={chatRunning}
                  className="ml-auto h-8 px-2 rounded-lg text-xs outline-none transition-all"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fcd34d' }}>
                  {CLAUDE_MODELS.map(m => (
                    <option key={m.id} value={m.id} style={{ background: '#111', color: '#fff' }}>{m.label}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex gap-2 items-end px-3 pb-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    mode === 'chat' ? handleChatSend() : handleSend();
                  }
                }}
                placeholder={mode === 'chat' ? 'Claude に質問...' : '指示を入力...'}
                rows={1}
                disabled={mode === 'code' ? (running || !macOnline) : chatRunning}
                className="flex-1 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 resize-none outline-none transition-all disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', minHeight: '44px', maxHeight: '120px' }}
              />
              <button
                onClick={mode === 'chat' ? handleChatSend : handleSend}
                disabled={mode === 'code' ? (running || !input.trim() || !macOnline) : (chatRunning || !input.trim())}
                className="h-10 px-4 rounded-xl font-semibold text-sm text-white transition-all active:scale-90 disabled:opacity-30"
                style={mode === 'chat'
                  ? { background: 'linear-gradient(135deg, #d97706, #dc2626)', boxShadow: '0 0 15px rgba(217,119,6,0.3)' }
                  : { background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', boxShadow: '0 0 15px rgba(14,165,233,0.3)' }}>
                送信
              </button>
            </div>
          </div>}
        </>
      )}

      <style>{`
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        @keyframes bounce {
          0%,100% { transform:translateY(0); }
          50% { transform:translateY(-5px); }
        }
        @keyframes fadeSlide {
          from { opacity:0; transform:translateY(6px); }
          to { opacity:1; transform:translateY(0); }
        }
        @keyframes pulse {
          0%,100% { opacity:0.4; } 50% { opacity:0.8; }
        }
      `}</style>
    </div>
  );
}
