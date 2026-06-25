'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, Bot, Zap, Wrench, Folder, ArrowLeft, Square, ChevronRight, Wifi, WifiOff, MonitorSmartphone, Trash2 } from 'lucide-react';

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';
const BRIDGE_PIN = process.env.NEXT_PUBLIC_BRIDGE_PIN || ADMIN_SECRET;

const PROJECT_ICONS: Record<string, React.ReactNode> = {
  laruvisona: <Globe size={28} />,
  larubot: <Bot size={28} />,
  flastal: <Zap size={28} />,
  laru_dev: <Wrench size={28} />,
};

interface Project { id: string; name: string; }
interface Message { role: 'user' | 'assistant' | 'system'; content: string; streaming?: boolean; }

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
  const [initError, setInitError] = useState('');
  const [view, setView] = useState<'projects' | 'chat'>('projects');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [relayWs, setRelayWs] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem('bridge_unlocked') === '1') setUnlocked(true);
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
      if (m.type === 'projects') setProjects(m.projects || []);
      if (m.type === 'running') setRunning(true);
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
        setMessages(prev => {
          const last = prev[prev.length - 1];
          return last?.streaming ? [...prev.slice(0, -1), { ...last, streaming: false }] : prev;
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

  const handleSend = () => {
    const text = input.trim();
    if (!text || running) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    send({ type: 'message', content: text });
    setInput('');
  };

  if (!unlocked) return <PinScreen onUnlock={() => setUnlocked(true)} />;

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
        {view === 'chat' && !running && messages.length > 0 && (
          <button onClick={clearHistory}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-600 hover:text-red-400 transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Trash2 size={14} />
          </button>
        )}
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
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <p className="text-gray-700 text-sm">Claude Code に指示を送信</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : m.role === 'system' ? 'justify-center' : 'justify-start'}`}
                style={{ animation: 'fadeSlide 0.2s ease forwards' }}>
                {m.role === 'system' ? (
                  <span className="text-gray-600 text-xs px-3 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {m.content}
                  </span>
                ) : (
                  <div className="max-w-[88%] rounded-2xl px-4 py-3"
                    style={m.role === 'user'
                      ? { background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', borderBottomRightRadius: 4 }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderBottomLeftRadius: 4 }}>
                    <pre className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">{m.content}</pre>
                    {m.streaming && (
                      <span className="inline-block w-2 h-4 ml-0.5 align-middle"
                        style={{ background: '#38bdf8', animation: 'blink 0.7s step-end infinite' }} />
                    )}
                  </div>
                )}
              </div>
            ))}
            {running && messages[messages.length - 1]?.role !== 'assistant' && (
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
            <div ref={bottomRef} />
          </div>

          <div className="px-3 py-3 border-t border-white/5"
            style={{ backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.6)' }}>
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="指示を入力..."
                rows={2}
                disabled={running || !macOnline}
                className="flex-1 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 resize-none outline-none transition-all disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <button
                onClick={handleSend}
                disabled={running || !input.trim() || !macOnline}
                className="h-10 px-4 rounded-xl font-semibold text-sm text-white transition-all active:scale-90 disabled:opacity-30"
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', boxShadow: '0 0 15px rgba(14,165,233,0.3)' }}>
                送信
              </button>
            </div>
          </div>
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
