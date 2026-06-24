'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

const RELAY_API = process.env.NEXT_PUBLIC_RELAY_API_URL || '';
const RELAY_WS = process.env.NEXT_PUBLIC_RELAY_WS_URL || '';
const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

interface Project { id: string; name: string; }
interface Message { role: 'user' | 'assistant' | 'system'; content: string; streaming?: boolean; }

const ICONS: Record<string, string> = {
  laruvisona: '🌐', larubot: '🤖', flastal: '⚡', laru_dev: '🛠',
};

function useWS(url: string, enabled: boolean) {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Array<(msg: unknown) => void>>([]);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(1000);
  const [connected, setConnected] = useState(false);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
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

export default function BridgeClient() {
  const [token, setToken] = useState('');
  const [tokenReady, setTokenReady] = useState(false);
  const [macOnline, setMacOnline] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [initError, setInitError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const wsUrl = token ? `${RELAY_WS}?role=client&token=${token}` : '';
  const { connected, send, addListener } = useWS(wsUrl, tokenReady && !!token);

  useEffect(() => {
    const stored = localStorage.getItem('bridge_token');
    if (stored) { setToken(stored); setTokenReady(true); return; }
    if (!RELAY_API || !ADMIN_SECRET) { setInitError('環境変数が未設定です'); return; }
    fetch(`${RELAY_API}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: ADMIN_SECRET }),
    }).then(r => r.json()).then(d => {
      if (d.token) { localStorage.setItem('bridge_token', d.token); setToken(d.token); setTokenReady(true); }
      else setInitError('トークン取得失敗');
    }).catch(() => setInitError('リレーサーバーに接続できません'));
  }, []);

  useEffect(() => {
    const unsub = addListener((msg: unknown) => {
      const m = msg as {
        type: string; online?: boolean; projects?: Project[];
        content?: string; exit_code?: number; message?: string;
      };

      if (m.type === 'mac_status') setMacOnline(m.online ?? false);
      if (m.type === 'mac_online') setMacOnline(true);
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
          if (last?.streaming) return [...prev.slice(0, -1), { ...last, streaming: false }];
          return prev;
        });
      }
      if (m.type === 'aborted') { setRunning(false); setMessages(prev => [...prev, { role: 'system', content: '⏹ 中断しました' }]); }
      if (m.type === 'error') { setRunning(false); setMessages(prev => [...prev, { role: 'system', content: `⚠ ${m.message}` }]); }
    });
    return unsub;
  }, [addListener]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSelectProject = (p: Project) => {
    send({ type: 'select_project', project: p.id });
    setCurrentProject(p);
    setMessages([]);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || running) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    send({ type: 'message', content: text });
    setInput('');
  };

  if (initError) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <p className="text-red-400 text-sm">{initError}</p>
    </div>
  );

  return (
    <div className="bg-gray-950 text-gray-100 flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-950">
        {currentProject && (
          <button onClick={() => setCurrentProject(null)} className="text-gray-400 hover:text-white text-xl leading-none">←</button>
        )}
        <span className="font-bold text-sky-400 flex-1">
          {currentProject ? currentProject.name : 'Claude Bridge'}
        </span>
        <div className="flex items-center gap-2">
          {/* Relay接続 */}
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-600'}`} title="リレー" />
          {/* Mac接続 */}
          <span className={`w-2 h-2 rounded-full ${macOnline ? 'bg-sky-400' : 'bg-gray-600'}`} title="Mac" />
        </div>
        {running && currentProject && (
          <button onClick={() => send({ type: 'abort' })} className="text-xs bg-red-800 text-red-200 px-2 py-1 rounded-lg">中断</button>
        )}
      </div>

      {/* Mac offline banner */}
      {connected && !macOnline && (
        <div className="bg-yellow-900/50 border-b border-yellow-700 px-4 py-2 text-yellow-300 text-xs text-center">
          Mac エージェントがオフラインです。Mac 側で <code>pm2 start ecosystem.config.js</code> を実行してください。
        </div>
      )}

      {!currentProject ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {projects.length === 0 && (
            <p className="text-gray-500 text-sm text-center mt-12">
              {connected && macOnline ? 'プロジェクトなし' : connected ? 'Mac 待機中...' : 'リレーに接続中...'}
            </p>
          )}
          {projects.map(p => (
            <button key={p.id} onClick={() => handleSelectProject(p)}
              className="w-full flex items-center gap-3 bg-gray-900 border border-gray-800 hover:border-sky-700 rounded-xl p-4 text-left transition-colors">
              <span className="text-2xl">{ICONS[p.id] || '📁'}</span>
              <span className="flex-1 font-semibold">{p.name}</span>
              <span className="text-gray-500">→</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-gray-600 text-sm text-center mt-12">Claude Code に指示を入力してください</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={
                m.role === 'user' ? 'flex justify-end'
                  : m.role === 'system' ? 'flex justify-center'
                  : 'flex justify-start'
              }>
                {m.role === 'system' ? (
                  <span className="text-gray-500 text-xs">{m.content}</span>
                ) : (
                  <div className={`max-w-[90%] rounded-2xl px-4 py-3 ${m.role === 'user' ? 'bg-sky-700 rounded-br-sm' : 'bg-gray-800 border border-gray-700 rounded-bl-sm'}`}>
                    <pre className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">{m.content}</pre>
                    {m.streaming && <span className="text-green-400 animate-pulse">▌</span>}
                  </div>
                )}
              </div>
            ))}
            {running && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
                  <span className="text-gray-500 text-sm italic">実行中...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2 p-3 border-t border-gray-800 bg-gray-950">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="指示を入力... (Enter で送信)"
              rows={2}
              disabled={running || !macOnline}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 resize-none outline-none focus:border-sky-700 transition-colors disabled:opacity-40"
            />
            <button
              onClick={handleSend}
              disabled={running || !input.trim() || !macOnline}
              className="bg-sky-700 hover:bg-sky-600 disabled:opacity-30 text-white font-bold px-4 rounded-xl transition-colors self-end h-10"
            >
              送信
            </button>
          </div>
        </>
      )}
    </div>
  );
}
