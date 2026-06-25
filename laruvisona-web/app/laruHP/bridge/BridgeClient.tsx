'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, Bot, Zap, Wrench, Folder, ArrowLeft, Square, ChevronRight, Wifi, WifiOff, MonitorSmartphone, Trash2, Lock, RotateCcw, Sparkles, Camera, Mic, Radio, Plus, X as XIcon, GitBranch, FolderOpen, FileText, ChevronDown, Search, Upload, Cpu, MonitorCheck, Volume2, VolumeX, AlertTriangle, Users, MoreHorizontal, SlidersHorizontal, Clock, Target, Brain, Activity, GitCommit } from 'lucide-react';
import GeminiLive from './GeminiLive';
import SchedulePanel, { type Schedule } from './SchedulePanel';
import ToolsPanel from './ToolsPanel';
import GitHubPanel from './GitHubPanel';
import TeamPanel, { type TaskStatus, type MacInfo } from './TeamPanel';
import PMPanel from './PMPanel';
import BrainPanel from './BrainPanel';
import ProductionPanel from './ProductionPanel';

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';
const BRIDGE_PIN = process.env.NEXT_PUBLIC_BRIDGE_PIN || ADMIN_SECRET;

const PROJECT_ICONS: Record<string, React.ReactNode> = {
  laruvisona: <Globe size={28} />,
  larubot: <Bot size={28} />,
  flastal: <Zap size={28} />,
  laru_dev: <Wrench size={28} />,
};

interface Project { id: string; name: string; githubRepo?: string; }
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
  // モード切り替え: code / chat / git / files / team / pm / brain / production
  const [mode, setMode] = useState<'code' | 'chat' | 'git' | 'files' | 'schedule' | 'tools' | 'github' | 'team' | 'pm' | 'brain' | 'production'>('code');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatModel, setChatModel] = useState(CLAUDE_MODELS[0].id);
  const [chatRunning, setChatRunning] = useState(false);
  // TTS
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const speakText = (text: string) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 500));
    u.lang = 'ja-JP'; u.rate = 1.15;
    window.speechSynthesis.speak(u);
  };
  // 確認モード
  const [confirmMode, setConfirmMode] = useState(false);
  const [pendingInstruction, setPendingInstruction] = useState<string | null>(null);
  // スワイプ
  const touchStartX = useRef(0);
  // メモリ
  const [memories, setMemories] = useState<{ id: string; content: string; ts: number }[]>([]);
  // Tools パネル用
  const [logs, setLogs] = useState('');
  const [logsActive, setLogsActive] = useState(false);
  const [envContent, setEnvContent] = useState('');
  const [envPath, setEnvPath] = useState('.env');
  const [envLoading, setEnvLoading] = useState(false);
  const [costs, setCosts] = useState<{ inputTokens: number; outputTokens: number; model: string }[]>([]);
  const [gitDiff, setGitDiff] = useState('');
  const [deployOutput, setDeployOutput] = useState('');
  // エラー診断
  const [diagnosing, setDiagnosing] = useState(false);
  // Ambient監視
  const [watchdogAlerts, setWatchdogAlerts] = useState<{ level: string; message: string }[]>([]);
  const [watchdogActive, setWatchdogActive] = useState(false);
  // テストループ
  const [testOutput, setTestOutput] = useState('');
  const [testRunning, setTestRunning] = useState(false);
  const [testPassed, setTestPassed] = useState<boolean | null>(null);
  // ライブプレビュー
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [tunnelLoading, setTunnelLoading] = useState(false);
  // マルチエージェント
  const [parallelMode, setParallelMode] = useState(false);
  const [parallelTasks, setParallelTasks] = useState(['', '']);
  const [agentOutputs, setAgentOutputs] = useState<Record<string, string>>({});
  const [agentRunning, setAgentRunning] = useState(false);
  // AI Software Team (オーケストレーター)
  const [orchestrateRunning, setOrchestrateRunning] = useState(false);
  const [orchestratePhase, setOrchestratePhase] = useState('');
  const [taskStatuses, setTaskStatuses] = useState<Record<string, TaskStatus>>({});
  const [taskOutputsMap, setTaskOutputsMap] = useState<Record<string, string>>({});
  const [orchestrateComplete, setOrchestrateComplete] = useState(false);
  const [orchestrateReviewResult, setOrchestrateReviewResult] = useState('');
  const [orchestrateTestResult, setOrchestrateTestResult] = useState<{ output: string; passed: boolean } | null>(null);
  const [fileTree, setFileTree] = useState('');
  // 複数Mac
  const [macList, setMacList] = useState<{ id: string; name: string }[]>([]);
  const [selectedMacId, setSelectedMacId] = useState('');
  // コード検索コンテキスト
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ path: string; content: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [attachedContext, setAttachedContext] = useState<{ path: string; content: string }[]>([]);
  // 自律実行モード
  const [autonomousMode, setAutonomousMode] = useState(false);
  const [autonomousLog, setAutonomousLog] = useState<string[]>([]);
  const [autonomousStep, setAutonomousStep] = useState(0);
  const autonomousRef = useRef(false);
  const lastOutputRef = useRef('');
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
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showToolSheet, setShowToolSheet] = useState(false);
  // Visual-to-Code
  const [visualCapturing, setVisualCapturing] = useState(false);
  const [visualPreview, setVisualPreview] = useState<string | null>(null);
  const [visualMime, setVisualMime] = useState('image/jpeg');
  const [visualAnalyzing, setVisualAnalyzing] = useState(false);
  const [teamInitialDirective, setTeamInitialDirective] = useState('');
  // Brain
  const [brainStatus, setBrainStatus] = useState<{ exists: boolean; count?: number; indexed_at?: string } | null>(null);
  const [brainSearchResults, setBrainSearchResults] = useState<{ path: string; score: number; lines: number; preview: string }[]>([]);
  const [brainIndexing, setBrainIndexing] = useState(false);
  const [brainProgress, setBrainProgress] = useState<{ count: number; total: number } | null>(null);
  // H: Phase time estimates
  const phaseStartTimeRef = useRef<Record<string, number>>({});
  const [phaseEstimates, setPhaseEstimates] = useState<Record<string, number>>({});
  // I: Git checkpoints
  const [checkpoints, setCheckpoints] = useState<Record<string, { success: boolean; message: string }>>({});
  const [cpToast, setCpToast] = useState<{ phase: string; success: boolean } | null>(null);
  // Production
  const [productionMonitorActive, setProductionMonitorActive] = useState(false);
  const [productionHistory, setProductionHistory] = useState<{ ts: string; status: number; ms: number; ok: boolean; error?: string }[]>([]);
  const [productionLatest, setProductionLatest] = useState<{ ts: string; status: number; ms: number; ok: boolean; error?: string } | null>(null);
  const [productionIncidents, setProductionIncidents] = useState<{ ts: string; error: string; fixOutput: string; fixDone: boolean }[]>([]);

  // T: Haptic feedback utility
  const haptic = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  };

  // M: Auto-fetch git diff after orchestration completes
  useEffect(() => {
    if (orchestrateComplete && macOnline) {
      send({ type: 'git_diff', mac_id: selectedMacId || undefined });
    }
  }, [orchestrateComplete]);

  // K+T: Push notification + haptic on orchestration complete
  useEffect(() => {
    if (!orchestrateComplete || !currentProject) return;
    haptic([40, 30, 80]);
  }, [orchestrateComplete]);

  // H: Track phase start time & load stored estimates
  useEffect(() => {
    if (!orchestratePhase || !currentProject) return;
    phaseStartTimeRef.current[orchestratePhase] = Date.now();
    try {
      const stored = JSON.parse(localStorage.getItem(`bridge_phase_times_${currentProject.name}`) || '{}');
      setPhaseEstimates(stored);
    } catch { /* ignore */ }
  }, [orchestratePhase, currentProject]);

  // H: Save phase durations on completion
  useEffect(() => {
    if (!orchestrateComplete || !currentProject) return;
    const now = Date.now();
    const newEsts = { ...phaseEstimates };
    Object.entries(phaseStartTimeRef.current).forEach(([phase, start]) => {
      const secs = (now - start) / 1000;
      if (secs > 5 && secs < 900) {
        newEsts[phase] = newEsts[phase] ? (newEsts[phase] + secs) / 2 : secs;
      }
    });
    localStorage.setItem(`bridge_phase_times_${currentProject.name}`, JSON.stringify(newEsts));
    setPhaseEstimates(newEsts);
    phaseStartTimeRef.current = {};
  }, [orchestrateComplete, currentProject]);

  // I: Reset checkpoints on new orchestration
  useEffect(() => {
    if (orchestrateRunning) setCheckpoints({});
  }, [orchestrateRunning]);

  // K: Push notification on orchestration complete
  useEffect(() => {
    if (!orchestrateComplete || !currentProject) return;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const n = new Notification('Bridge — AI Team 完了 🎉', {
        body: `${currentProject.name} のタスクが完了しました`,
        icon: '/favicon.ico',
      });
      setTimeout(() => n.close(), 8000);
    }
  }, [orchestrateComplete, currentProject]);

  // K: Request notification permission when team tab activated
  useEffect(() => {
    if (mode === 'team' && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [mode]);

  useEffect(() => {
    if (sessionStorage.getItem('bridge_unlocked') === '1') setUnlocked(true);
    // プリセット読み込み
    try {
      const saved = JSON.parse(localStorage.getItem('bridge_presets') || '[]');
      if (Array.isArray(saved)) setPresets(saved);
    } catch { /* ignore */ }
    // メモリ読み込み
    try {
      const mem = JSON.parse(localStorage.getItem('bridge_memories') || '[]');
      if (Array.isArray(mem)) setMemories(mem);
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
      if (m.type === 'mac_list') {
        const list = ((m as unknown) as { macs: { id: string; name: string }[] }).macs || [];
        setMacList(list);
        if (list.length > 0 && !selectedMacId) setSelectedMacId(list[0].id);
      }
      if (m.type === 'code_search_result') {
        const r = m as { results?: { path: string; content: string }[]; error?: string };
        if (!r.error) setSearchResults(r.results || []);
        setSearching(false);
      }
      if (m.type === 'file_write_result') { setFileLoading(false); }
      if (m.type === 'log_output') {
        setLogs(prev => (prev + (m as { content: string }).content).slice(-4000));
      }
      if (m.type === 'logs_stopped') { setLogsActive(false); }
      if (m.type === 'deploy_started') { setDeployOutput('デプロイ中...\n'); }
      if (m.type === 'deploy_result') {
        const r = m as { output?: string; error?: string; exit_code?: number };
        setDeployOutput(r.error || r.output || '');
        if (r.exit_code === 0 && 'vibrate' in navigator) navigator.vibrate([100, 50, 200]);
      }
      if (m.type === 'env_result') {
        const r = m as { content?: string; path?: string; error?: string };
        setEnvContent(r.content || ''); setEnvPath(r.path || '.env'); setEnvLoading(false);
      }
      if (m.type === 'env_write_result') { setEnvLoading(false); onSend({ type: 'env_read' }); }
      if (m.type === 'git_action_result') {
        const r = m as { output?: string; error?: string; action?: string };
        setMessages(prev => [...prev, { role: 'system', content: r.error || `${r.action}: ${r.output?.trim().slice(0, 100)}` }]);
      }
      if (m.type === 'git_diff_result') {
        const r = m as { stat?: string; diff?: string; error?: string };
        if (!r.error) setGitDiff(r.diff || '');
      }
      // Ambient watchdog
      if (m.type === 'watchdog_started') setWatchdogActive(true);
      if (m.type === 'watchdog_stopped') setWatchdogActive(false);
      if (m.type === 'watchdog_alert') {
        const r = (m as unknown) as { alerts: { level: string; message: string }[] };
        setWatchdogAlerts(prev => [...prev, ...r.alerts]);
      }
      // テスト
      if (m.type === 'test_started') { setTestRunning(true); setTestOutput(''); setTestPassed(null); }
      if (m.type === 'test_output') {
        const r = m as { content: string };
        setTestOutput(prev => (prev + r.content).slice(-3000));
      }
      if (m.type === 'test_result') {
        const r = m as { exit_code?: number; passed?: boolean; error?: string };
        setTestRunning(false);
        setTestPassed(r.error ? false : (r.passed ?? r.exit_code === 0));
        if (r.error) setTestOutput(prev => prev + '\n[エラー] ' + r.error);
      }
      // トンネル
      if (m.type === 'tunnel_started') {
        const r = (m as unknown) as { url: string };
        setTunnelUrl(r.url); setTunnelLoading(false);
      }
      if (m.type === 'tunnel_stopped') { setTunnelUrl(''); setTunnelLoading(false); }
      if (m.type === 'tunnel_result') {
        const r = m as { error?: string };
        setTunnelLoading(false);
        if (r.error) setMessages(prev => [...prev, { role: 'system', content: `トンネルエラー: ${r.error}` }]);
      }
      // マルチエージェント
      if (m.type === 'parallel_started') setAgentRunning(true);
      if (m.type === 'agent_output') {
        const r = (m as unknown) as { agent_id: string; content: string };
        setAgentOutputs(prev => ({ ...prev, [r.agent_id]: ((prev[r.agent_id] || '') + r.content).slice(-2000) }));
      }
      if (m.type === 'agent_done') {
        const r = (m as unknown) as { agent_id: string };
        setAgentOutputs(prev => ({ ...prev, [r.agent_id]: (prev[r.agent_id] || '') + '\n✓ 完了' }));
      }
      if (m.type === 'parallel_done') setAgentRunning(false);
      // Orchestrate
      if (m.type === 'orchestrate_phase_start') {
        const r = (m as unknown) as { name: string };
        setOrchestratePhase(r.name);
      }
      if (m.type === 'orchestrate_task_start') {
        const r = (m as unknown) as { task_id: string };
        setTaskStatuses(prev => ({ ...prev, [r.task_id]: 'running' }));
      }
      if (m.type === 'orchestrate_task_output') {
        const r = (m as unknown) as { task_id: string; content: string };
        setTaskOutputsMap(prev => ({ ...prev, [r.task_id]: ((prev[r.task_id] || '') + r.content).slice(-3000) }));
      }
      if (m.type === 'orchestrate_task_done') {
        const r = (m as unknown) as { task_id: string };
        setTaskStatuses(prev => ({ ...prev, [r.task_id]: 'done' }));
      }
      if (m.type === 'orchestrate_task_failed') {
        const r = (m as unknown) as { task_id: string };
        setTaskStatuses(prev => ({ ...prev, [r.task_id]: 'failed' }));
      }
      if (m.type === 'orchestrate_complete') { setOrchestrateRunning(false); setOrchestrateComplete(true); }
      if (m.type === 'orchestrate_stopped') { setOrchestrateRunning(false); }
      if (m.type === 'orchestrate_review_result') {
        const r = (m as unknown) as { content: string };
        setOrchestrateReviewResult(r.content || '');
      }
      if (m.type === 'orchestrate_test_result') {
        const r = (m as unknown) as { output?: string; passed: boolean; error?: string };
        setOrchestrateTestResult({ output: r.output || r.error || '', passed: r.passed });
      }
      // I: Git checkpoint
      if (m.type === 'git_checkpoint') {
        const r = (m as unknown) as { phase: string; success: boolean; message: string };
        setCheckpoints(prev => ({ ...prev, [r.phase]: { success: r.success, message: r.message } }));
        setCpToast({ phase: r.phase, success: r.success });
        setTimeout(() => setCpToast(null), 3000);
      }
      // Brain
      if (m.type === 'brain_indexed') {
        const r = (m as unknown) as { count: number; indexed_at: string };
        setBrainStatus({ exists: true, count: r.count, indexed_at: r.indexed_at });
        setBrainIndexing(false); setBrainProgress(null);
      }
      if (m.type === 'brain_progress') {
        const r = (m as unknown) as { count: number; total: number };
        setBrainProgress({ count: r.count, total: r.total });
      }
      if (m.type === 'brain_status_result') {
        const r = (m as unknown) as { exists: boolean; count?: number; indexed_at?: string };
        setBrainStatus(r); setBrainIndexing(false);
      }
      if (m.type === 'brain_search_result') {
        const r = (m as unknown) as { results: { path: string; score: number; lines: number; preview: string }[] };
        setBrainSearchResults(r.results || []);
      }
      if (m.type === 'brain_index') { setBrainIndexing(true); setBrainProgress(null); }
      // Production
      if (m.type === 'production_monitor_started') setProductionMonitorActive(true);
      if (m.type === 'production_monitor_stopped') setProductionMonitorActive(false);
      if (m.type === 'production_status') {
        const r = (m as unknown) as { entry: { ts: string; status: number; ms: number; ok: boolean; error?: string }; history: typeof productionHistory };
        setProductionLatest(r.entry);
        setProductionHistory(r.history);
      }
      if (m.type === 'production_incident') {
        const r = (m as unknown) as { error: string };
        setProductionIncidents(prev => [{ ts: new Date().toISOString(), error: r.error, fixOutput: '', fixDone: false }, ...prev].slice(0, 10));
      }
      if (m.type === 'production_fix_output') {
        const r = (m as unknown) as { content: string };
        setProductionIncidents(prev => prev.map((inc, i) => i === 0 ? { ...inc, fixOutput: inc.fixOutput + r.content } : inc));
      }
      if (m.type === 'production_fix_done') {
        setProductionIncidents(prev => prev.map((inc, i) => i === 0 ? { ...inc, fixDone: true } : inc));
      }
      if (m.type === 'file_tree_result') {
        const r = (m as unknown) as { tree?: string };
        if (r.tree) setFileTree(r.tree);
      }
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
        // バイブレーション + TTS
        if ('vibrate' in navigator) navigator.vibrate(m.exit_code === 0 ? [100, 50, 100] : [300]);
        if (ttsEnabled) speakText(m.exit_code === 0 ? '実行完了しました' : 'エラーが発生しました');
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
            if (last?.streaming) {
              lastOutputRef.current = last.content;
              return [...prev.slice(0, -1), { ...last, streaming: false, ts: Date.now() }];
            }
            return prev;
          })();
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant' && lastMsg.content.length > 300) {
            setTimeout(() => summarizeOutput(lastMsg.content, updated.length - 1), 300);
          }
          // 自律実行モード
          if (autonomousRef.current && m.exit_code === 0 && autonomousStep < 10) {
            setTimeout(() => runAutonomousStep(lastOutputRef.current), 1000);
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

  // メモリ管理
  const saveMemory = (content: string) => {
    if (!content.trim()) return;
    const id = Date.now().toString();
    const updated = [...memories, { id, content: content.trim(), ts: Date.now() }].slice(-20);
    setMemories(updated);
    localStorage.setItem('bridge_memories', JSON.stringify(updated));
  };
  const deleteMemory = (id: string) => {
    const updated = memories.filter(m => m.id !== id);
    setMemories(updated);
    localStorage.setItem('bridge_memories', JSON.stringify(updated));
  };

  // エラー自動診断
  const diagnoseError = async (errorText: string) => {
    if (!currentProject) return;
    setDiagnosing(true);
    try {
      const result = await gemini('diagnose', { error: errorText, projectName: currentProject.name });
      setChatMessages(prev => [...prev, { role: 'assistant', content: result, ts: Date.now() }]);
      setMode('chat');
    } catch { /* ignore */ }
    setDiagnosing(false);
  };

  // プロジェクト概要生成
  const generateProjectSummary = async () => {
    if (!currentProject || !macOnline) return;
    const keyFiles = ['package.json', 'README.md', 'src/index.ts', 'app/layout.tsx'];
    const fileContents: { path: string; content: string }[] = [];
    for (const f of keyFiles) {
      try {
        const res = await new Promise<{ content?: string }>((resolve) => {
          const handler = (msg: unknown) => {
            const m = msg as { type: string; path?: string; content?: string };
            if (m.type === 'file_read_result' && m.path === f) { resolve(m); }
          };
          addListener(handler);
          send({ type: 'file_read', path: f, mac_id: selectedMacId || undefined });
          setTimeout(() => resolve({}), 3000);
        });
        if (res.content) fileContents.push({ path: f, content: res.content });
      } catch { /* ignore */ }
    }
    if (fileContents.length === 0) return;
    const summary = await gemini('project_summary', { files: fileContents, projectName: currentProject.name });
    setChatMessages(prev => [...prev, { role: 'assistant', content: `**プロジェクト概要**\n\n${summary}`, ts: Date.now() }]);
    setMode('chat');
  };

  // handleSend のラッパー（確認モード対応）
  const onSend = (msg: Record<string, unknown>) => send(msg);

  // 自律実行
  const runAutonomousStep = useCallback(async (lastOutput: string) => {
    if (!currentProject || !autonomousRef.current) return;
    try {
      const res = await fetch('/api/bridge/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `前のステップの実行結果:\n${lastOutput.slice(0, 2000)}\n\nタスクが完全に完了していたら「タスク完了」とだけ返してください。まだ残っていたら次に実行すべきClaude Codeへの指示を1つだけ返してください（説明不要）。` }],
          projectName: currentProject.name,
          model: 'claude-haiku-4-5-20251001',
        }),
      });
      let nextStep = '';
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try { nextStep += JSON.parse(data).text || ''; } catch { /* ignore */ }
        }
      }
      nextStep = nextStep.trim();
      if (!nextStep || nextStep.includes('タスク完了') || !autonomousRef.current) {
        setAutonomousLog(prev => [...prev, '完了']);
        autonomousRef.current = false;
        setAutonomousMode(false);
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 100]);
        return;
      }
      setAutonomousLog(prev => [...prev, nextStep]);
      setAutonomousStep(s => s + 1);
      setMessages(prev => [...prev, { role: 'user', content: `[自律] ${nextStep}`, ts: Date.now() }]);
      send({ type: 'message', content: nextStep, mac_id: selectedMacId || undefined });
    } catch { autonomousRef.current = false; setAutonomousMode(false); }
  }, [currentProject, send, selectedMacId]);

  // コード検索
  const handleCodeSearch = () => {
    if (!searchQuery.trim() || !macOnline) return;
    setSearching(true);
    setSearchResults([]);
    send({ type: 'code_search', query: searchQuery, mac_id: selectedMacId || undefined });
  };

  // ファイルアップロード（Files タブ）
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/bridge/upload', { method: 'POST', body: form });
      const { name, base64 } = await res.json();
      const targetPath = filePath ? `${filePath}/${name}` : name;
      send({ type: 'file_write', path: targetPath, content: base64, mac_id: selectedMacId || undefined });
    } catch { setFileLoading(false); }
    e.target.value = '';
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
          context: attachedContext.length > 0 ? attachedContext : undefined,
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
            const parsed = JSON.parse(data);
            if (parsed.usage) {
              setCosts(prev => [...prev, { inputTokens: parsed.usage.input_tokens || 0, outputTokens: parsed.usage.output_tokens || 0, model: parsed.model || chatModel }]);
            }
            const chunk = parsed.text || '';
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

  const handleSend = async (overrideText?: string) => {
    const text = overrideText ?? input.trim();
    if (!text || running) return;
    haptic(8);
    if (!overrideText) { setInput(''); if (textareaRef.current) textareaRef.current.style.height = '44px'; }

    // 確認モード
    if (confirmMode && !overrideText) { setPendingInstruction(text); return; }

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

    if (autonomousMode) {
      autonomousRef.current = true;
      setAutonomousStep(0);
      setAutonomousLog([finalText]);
    }
    setMessages(prev => [...prev, { role: 'user', content: finalText, ts: Date.now() }]);
    send({ type: 'message', content: finalText, model: codeModel || undefined, mac_id: selectedMacId || undefined });
  };

  const handleVisualCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVisualMime(file.type);
    const reader = new FileReader();
    reader.onloadend = () => {
      setVisualPreview((reader.result as string).split(',')[1]);
      setVisualCapturing(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const analyzeVisual = async () => {
    if (!visualPreview || !currentProject) return;
    setVisualAnalyzing(true);
    try {
      const res = await fetch('/api/bridge/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'visual_to_directive', imageBase64: visualPreview, mimeType: visualMime, projectName: currentProject.name, fileTree }),
      });
      const data = await res.json();
      if (data.result) {
        setTeamInitialDirective(data.result.trim());
        setVisualCapturing(false);
        setVisualPreview(null);
        setMode('team');
        if (!fileTree && macOnline) send({ type: 'file_tree', mac_id: selectedMacId || undefined });
      }
    } catch { /* ignore */ }
    setVisualAnalyzing(false);
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

          {/* Ambient アラートバー */}
          {watchdogAlerts.length > 0 && (
            <div className="px-3 py-1.5 space-y-1" style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
              {watchdogAlerts.slice(-2).map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={a.level === 'danger' ? 'text-red-400' : 'text-amber-400'}>⚠</span>
                  <span className="text-gray-300 flex-1 truncate">{a.message}</span>
                  <button onClick={() => setWatchdogAlerts(prev => prev.filter((_, j) => j !== i))} className="text-gray-600 active:opacity-50 flex-shrink-0">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* マルチエージェント UI */}
          {parallelMode && (
            <div className="px-3 py-2 space-y-2" style={{ background: 'rgba(99,102,241,0.06)', borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
              <div className="flex items-center justify-between">
                <p className="text-indigo-400 text-xs font-semibold">Multi-Agent — 並列実行</p>
                <button onClick={() => setParallelMode(false)} className="text-gray-600 text-xs active:opacity-50">✕ 閉じる</button>
              </div>
              {parallelTasks.map((t, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-gray-600 text-xs w-12 flex-shrink-0">Agent {i+1}</span>
                  <input value={t} onChange={e => setParallelTasks(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                    placeholder={`タスク ${i+1}`}
                    className="flex-1 h-8 px-2 rounded-lg text-xs text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(99,102,241,0.3)' }} />
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={() => setParallelTasks(prev => [...prev, ''])} disabled={parallelTasks.length >= 4}
                  className="px-3 py-1.5 rounded-lg text-xs text-indigo-400 active:scale-90 disabled:opacity-40"
                  style={{ background: 'rgba(99,102,241,0.1)' }}>+ 追加</button>
                <button onClick={() => {
                  const tasks = parallelTasks.filter(t => t.trim());
                  if (!tasks.length || !macOnline) return;
                  setAgentOutputs({});
                  send({ type: 'parallel_exec', tasks, model: codeModel || undefined });
                }} disabled={agentRunning || !macOnline || !parallelTasks.some(t => t.trim())}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white active:scale-98 transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                  {agentRunning ? '実行中...' : '並列実行'}
                </button>
              </div>
              {Object.keys(agentOutputs).length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(agentOutputs).map(([id, out]) => (
                    <div key={id} className="rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.4)' }}>
                      <p className="text-indigo-300 text-xs mb-1">{id}</p>
                      <pre className="text-gray-400 text-xs font-mono whitespace-pre-wrap break-words">{out.slice(-500)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
              {gitDiff && (
                <div className="flex gap-2">
                  <button onClick={() => { setInput('現在のgit diffを説明して'); setMode('chat'); }}
                    className="flex-1 py-2 rounded-xl text-xs active:scale-98 transition-all"
                    style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#6ee7b7' }}>
                    差分を説明
                  </button>
                  <button onClick={() => setMode('tools')}
                    className="flex-1 py-2 rounded-xl text-xs active:scale-98 transition-all"
                    style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', color: '#c4b5fd' }}>
                    コミット生成 →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ツール */}
          {mode === 'tools' && currentProject && (
            <ToolsPanel
              projectName={currentProject.name}
              macOnline={macOnline}
              onSend={(msg) => {
                if (msg.type === 'env_read' || msg.type === 'env_write') setEnvLoading(true);
                if (msg.type === 'start_tunnel') setTunnelLoading(true);
                send(msg);
              }}
              logs={logs}
              logsActive={logsActive}
              envContent={envContent}
              envPath={envPath}
              envLoading={envLoading}
              costs={costs}
              onGemini={gemini}
              gitDiff={gitDiff}
              testOutput={testOutput}
              testRunning={testRunning}
              testPassed={testPassed}
              tunnelUrl={tunnelUrl}
              tunnelLoading={tunnelLoading}
            />
          )}

          {/* GitHub */}
          {mode === 'github' && (
            <GitHubPanel githubRepo={currentProject?.githubRepo ?? null} />
          )}

          {/* AI Software Team */}
          {mode === 'team' && currentProject && (
            <TeamPanel
              macOnline={macOnline}
              projectName={currentProject.name}
              fileTree={fileTree}
              onSend={(msg) => {
                if (msg.type === 'orchestrate_start') {
                  setOrchestrateRunning(true);
                  setOrchestrateComplete(false);
                  setOrchestratePhase('');
                  setTaskStatuses({});
                  setTaskOutputsMap({});
                }
                send(msg);
              }}
              orchestrateRunning={orchestrateRunning}
              orchestratePhase={orchestratePhase}
              taskStatuses={taskStatuses}
              taskOutputs={taskOutputsMap}
              orchestrateComplete={orchestrateComplete}
              orchestrateReviewResult={orchestrateReviewResult}
              orchestrateTestResult={orchestrateTestResult}
              onResetOrchestrate={() => {
                setOrchestrateRunning(false);
                setOrchestrateComplete(false);
                setOrchestratePhase('');
                setTaskStatuses({});
                setTaskOutputsMap({});
                setOrchestrateReviewResult('');
                setOrchestrateTestResult(null);
              }}
              initialDirective={teamInitialDirective}
              macList={macList as MacInfo[]}
              phaseEstimates={phaseEstimates}
              checkpoints={checkpoints}
              orchestrateDiff={gitDiff}
            />
          )}

          {/* AI PM */}
          {mode === 'pm' && currentProject && (
            <PMPanel
              projectName={currentProject.name}
              onExecuteStory={(directive) => {
                setTeamInitialDirective(directive);
                setMode('team');
                if (!fileTree && macOnline) send({ type: 'file_tree', mac_id: selectedMacId || undefined });
              }}
            />
          )}

          {/* Codebase Brain */}
          {mode === 'brain' && currentProject && (
            <BrainPanel
              projectName={currentProject.name}
              macOnline={macOnline}
              onSend={(msg) => {
                if (msg.type === 'brain_index') setBrainIndexing(true);
                send({ ...msg, mac_id: selectedMacId || undefined });
              }}
              brainStatus={brainStatus}
              brainSearchResults={brainSearchResults}
              brainIndexing={brainIndexing}
              brainProgress={brainProgress}
            />
          )}

          {/* Production AI */}
          {mode === 'production' && currentProject && (
            <ProductionPanel
              projectName={currentProject.name}
              macOnline={macOnline}
              onSend={(msg) => send({ ...msg, mac_id: selectedMacId || undefined })}
              monitorActive={productionMonitorActive}
              statusHistory={productionHistory}
              latestEntry={productionLatest}
              incidentLog={productionIncidents}
            />
          )}

          {/* スケジュール */}
          {mode === 'schedule' && (
            <SchedulePanel
              projects={projects}
              onExecute={(s: Schedule) => {
                const proj = projects.find(p => p.id === s.projectId);
                if (!proj) return;
                setCurrentProject(proj);
                setMessages(prev => [...prev, { role: 'user', content: `[スケジュール] ${s.instruction}`, ts: Date.now() }]);
                send({ type: 'select_project', project: s.projectId });
                setTimeout(() => send({ type: 'message', content: s.instruction, mac_id: selectedMacId || undefined }), 200);
                setMode('code');
              }}
            />
          )}

          {/* ファイルビューワー */}
          {mode === 'files' && (
            <div className="flex-1 overflow-y-auto">
              {/* パンくず */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                <button onClick={() => { setFilePath(''); setFileContent(''); setFileHistory([]); setFileLoading(true); send({ type: 'file_list', path: '', mac_id: selectedMacId || undefined }); }}
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
              <label className="ml-auto flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer active:scale-90 transition-all" style={{ background: 'rgba(167,139,250,0.1)' }}>
                <Upload size={13} className="text-violet-400" />
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
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

          {/* 確認ダイアログ */}
          {pendingInstruction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.8)' }}>
              <div className="w-full rounded-2xl p-5 space-y-4" style={{ background: '#0f0f1a', border: '1px solid rgba(239,68,68,0.3)' }}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-400" />
                  <p className="text-white font-semibold text-sm">実行確認</p>
                </div>
                <p className="text-gray-300 text-sm rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>{pendingInstruction}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPendingInstruction(null)}
                    className="flex-1 py-3 rounded-xl text-sm text-gray-400 active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.05)' }}>キャンセル</button>
                  <button onClick={() => { const t = pendingInstruction; setPendingInstruction(null); handleSend(t); }}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #dc2626, #f97316)' }}>実行</button>
                </div>
              </div>
            </div>
          )}

          {/* メッセージリスト */}
          <div
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              const dx = e.changedTouches[0].clientX - touchStartX.current;
              const TAB_ORDER: typeof mode[] = ['code', 'chat', 'git', 'team'];
              if (Math.abs(dx) > 70) {
                const cur = TAB_ORDER.indexOf(mode);
                const next = dx < 0 ? Math.min(cur + 1, TAB_ORDER.length - 1) : Math.max(cur - 1, 0);
                setMode(TAB_ORDER[next]);
              }
            }}
            className={`overflow-y-auto px-4 py-4 space-y-3 ${mode === 'code' || mode === 'chat' ? 'flex-1' : 'hidden'}`}>
            {mode === 'code' && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <p className="text-gray-700 text-sm">Claude Code に指示を送信</p>
              </div>
            )}
            {mode === 'chat' && memories.length > 0 && chatMessages.length === 0 && (
              <div className="rounded-xl p-3 mb-2" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <p className="text-indigo-400 text-xs mb-2">記憶 ({memories.length}件)</p>
                {memories.slice(-3).map(m => (
                  <div key={m.id} className="flex items-start gap-2 py-1">
                    <p className="flex-1 text-gray-500 text-xs truncate">{m.content}</p>
                    <button onClick={() => deleteMemory(m.id)} className="flex-shrink-0 text-gray-700 active:opacity-50 text-xs">✕</button>
                  </div>
                ))}
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
                    {m.role === 'assistant' && !m.streaming && (
                      <div className="flex gap-1 mt-1">
                        {ttsEnabled && (
                          <button onClick={() => speakText(m.content)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center active:scale-90 opacity-40 hover:opacity-100 transition-opacity"
                            style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <Volume2 size={10} className="text-gray-500" />
                          </button>
                        )}
                        <button onClick={() => saveMemory(m.content.slice(0, 200))}
                          title="メモリに保存"
                          className="w-6 h-6 rounded-lg flex items-center justify-center active:scale-90 opacity-40 hover:opacity-100 transition-opacity"
                          style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <Plus size={10} className="text-gray-500" />
                        </button>
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
            {/* Q: Chat → AI Team 変換ボタン */}
            {mode === 'chat' && chatMessages.length >= 2 && !chatRunning && (
              <div className="flex justify-center py-1">
                <button onClick={async () => {
                  if (!currentProject) return;
                  haptic(12);
                  try {
                    const res = await fetch('/api/bridge/gemini', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'chat_to_directive', messages: chatMessages, projectName: currentProject.name }),
                    });
                    const data = await res.json();
                    if (data.result) { setTeamInitialDirective(data.result.trim()); setMode('team'); if (!fileTree && macOnline) send({ type: 'file_tree', mac_id: selectedMacId || undefined }); }
                  } catch { /* ignore */ }
                }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs active:scale-95 transition-all"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}>
                  <Users size={11} />この会話を AI Team に渡す
                </button>
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

          {/* コード検索パネル (Chat モード) */}
          {mode === 'chat' && searchQuery !== '' && (
            <div className="border-t border-white/5 px-3 py-3 space-y-2" style={{ background: 'rgba(0,0,0,0.5)' }}>
              <div className="flex gap-2">
                <input value={searchQuery.trim()} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCodeSearch(); if (e.key === 'Escape') { setSearchQuery(''); setSearchResults([]); } }}
                  placeholder="キーワードで検索..."
                  className="flex-1 h-8 px-3 rounded-lg text-xs text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                <button onClick={handleCodeSearch} disabled={searching || !macOnline}
                  className="px-3 h-8 rounded-lg text-xs text-emerald-400 active:scale-90 disabled:opacity-40 transition-all"
                  style={{ background: 'rgba(52,211,153,0.1)' }}>
                  {searching ? '検索中...' : '検索'}
                </button>
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 active:scale-90"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <XIcon size={12} />
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg"
                      style={{ background: attachedContext.some(c => c.path === r.path) ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)' }}>
                      <span className="text-xs text-gray-400 font-mono truncate flex-1">{r.path}</span>
                      <button onClick={() => setAttachedContext(prev => prev.some(c => c.path === r.path) ? prev.filter(c => c.path !== r.path) : [...prev, r])}
                        className="flex-shrink-0 text-xs px-2 py-0.5 rounded-lg transition-all active:scale-90"
                        style={{ background: attachedContext.some(c => c.path === r.path) ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)', color: attachedContext.some(c => c.path === r.path) ? '#6ee7b7' : '#6b7280' }}>
                        {attachedContext.some(c => c.path === r.path) ? '添付中' : '添付'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 自律実行ログ (Code モード) */}
          {mode === 'code' && autonomousMode && autonomousLog.length > 0 && (
            <div className="border-t border-white/5 px-3 py-2 max-h-24 overflow-y-auto" style={{ background: 'rgba(251,146,60,0.05)' }}>
              <p className="text-orange-400 text-xs mb-1">自律実行 — ステップ {autonomousStep + 1}</p>
              {autonomousLog.map((l, i) => (
                <p key={i} className="text-gray-500 text-xs truncate"><span className="text-orange-600 mr-1">{i + 1}.</span>{l}</p>
              ))}
            </div>
          )}

          {/* 入力エリア（code / chat のみ） */}
          {(mode === 'code' || mode === 'chat') && (
            <div className="border-t border-white/5 flex-shrink-0"
              style={{ backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.7)' }}>
              {/* プリセット + ツール状態バッジ行 */}
              {(presets.length > 0 || showPresetAdd || enhanceMode || confirmMode || autonomousMode || parallelMode || watchdogActive || ttsEnabled || attachedContext.length > 0) && (
                <div className="flex items-center gap-2 px-3 pt-2 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {/* アクティブツールバッジ */}
                  {enhanceMode && <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc' }}><Sparkles size={10} />強化</span>}
                  {ttsEnabled && <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#7dd3fc' }}><Volume2 size={10} />読上げ</span>}
                  {confirmMode && <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}><AlertTriangle size={10} />確認</span>}
                  {autonomousMode && <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)', color: '#fdba74' }}><Cpu size={10} />自律</span>}
                  {parallelMode && <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}><MonitorCheck size={10} />並列</span>}
                  {watchdogActive && <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}><Radio size={10} className="animate-pulse" />監視中</span>}
                  {attachedContext.length > 0 && (
                    <button onClick={() => setAttachedContext([])} className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium active:scale-90" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#6ee7b7' }}>
                      <MonitorCheck size={10} />{attachedContext.length}件 ✕
                    </button>
                  )}
                  {/* プリセット */}
                  {presets.length > 0 && <div className="w-px h-4 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />}
                  {presets.map((p, i) => (
                    <div key={i} className="flex items-center gap-1 flex-shrink-0 group">
                      <button onClick={() => setInput(p)}
                        className="px-3 py-1 rounded-full text-xs text-gray-400 whitespace-nowrap transition-all active:scale-90"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {p.length > 18 ? p.slice(0, 18) + '…' : p}
                      </button>
                      <button onClick={() => removePreset(i)} className="w-4 h-4 rounded-full flex-shrink-0 hidden group-hover:flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.3)' }}>
                        <XIcon size={8} className="text-red-400" />
                      </button>
                    </div>
                  ))}
                  {showPresetAdd && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input value={presetInput} onChange={e => setPresetInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { savePreset(presetInput); setPresetInput(''); setShowPresetAdd(false); } if (e.key === 'Escape') { setShowPresetAdd(false); setPresetInput(''); } }}
                        placeholder="指示..." autoFocus
                        className="w-32 px-2 py-1 rounded-full text-xs text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)' }} />
                      <button onClick={() => { savePreset(presetInput); setPresetInput(''); setShowPresetAdd(false); }} className="px-2 py-1 rounded-full text-xs text-emerald-400" style={{ background: 'rgba(52,211,153,0.1)' }}>追加</button>
                    </div>
                  )}
                </div>
              )}
              {/* メイン入力行 */}
              <div className="flex gap-2 items-end px-3 py-2.5">
                {/* 画像 (Code送信) */}
                <label className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-90 flex-shrink-0 ${enhancing ? 'opacity-40 pointer-events-none' : ''}`}
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <Camera size={17} className="text-gray-500" />
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                </label>
                {/* Visual → Team */}
                <label className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-90 flex-shrink-0"
                  style={{ background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}
                  title="スクリーンショット → AI Team">
                  <Users size={15} className="text-indigo-400" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleVisualCapture} />
                </label>
                {/* 音声 */}
                <button onClick={handleVoice} disabled={enhancing}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 flex-shrink-0"
                  style={{ background: voiceRecording ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)', border: voiceRecording ? '1px solid rgba(239,68,68,0.5)' : 'none' }}>
                  <Mic size={17} className={voiceRecording ? 'text-red-400' : 'text-gray-500'} />
                </button>
                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mode === 'chat' ? handleChatSend() : handleSend(); } }}
                  placeholder={mode === 'chat' ? 'Claude に質問...' : '指示を入力...'}
                  rows={1}
                  disabled={mode === 'code' ? (running || !macOnline) : chatRunning}
                  className="flex-1 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-700 resize-none outline-none transition-all disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', minHeight: '44px', maxHeight: '120px' }}
                />
                {/* ツールシートボタン */}
                <button onClick={() => setShowToolSheet(true)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0 relative"
                  style={{ background: (enhanceMode || confirmMode || autonomousMode || parallelMode || watchdogActive || ttsEnabled) ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)', border: (enhanceMode || confirmMode || autonomousMode || parallelMode || watchdogActive || ttsEnabled) ? '1px solid rgba(99,102,241,0.4)' : 'none' }}>
                  <SlidersHorizontal size={17} className={(enhanceMode || confirmMode || autonomousMode || parallelMode || watchdogActive || ttsEnabled) ? 'text-indigo-400' : 'text-gray-500'} />
                </button>
                {/* 送信 */}
                <button
                  onClick={() => mode === 'chat' ? handleChatSend() : handleSend()}
                  disabled={mode === 'code' ? (running || !input.trim() || !macOnline) : (chatRunning || !input.trim())}
                  className="h-10 px-4 rounded-xl font-semibold text-sm text-white transition-all active:scale-90 disabled:opacity-30 flex-shrink-0"
                  style={mode === 'chat'
                    ? { background: 'linear-gradient(135deg, #d97706, #dc2626)', boxShadow: '0 0 15px rgba(217,119,6,0.25)' }
                    : { background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', boxShadow: '0 0 15px rgba(14,165,233,0.25)' }}>
                  {(running || chatRunning || enhancing) ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '送信'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── ボトムナビゲーション ─── */}
      {view === 'chat' && (
        <div className="flex-shrink-0 border-t border-white/5"
          style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(24px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex">
            {([
              { id: 'code',  label: 'Code',  icon: MonitorSmartphone, color: '#a5b4fc' },
              { id: 'chat',  label: 'Chat',  icon: Bot,                color: '#fcd34d' },
              { id: 'git',   label: 'Git',   icon: GitBranch,          color: '#6ee7b7' },
              { id: 'team',  label: 'Team',  icon: Users,              color: '#818cf8' },
              { id: 'more',  label: 'More',  icon: MoreHorizontal,     color: '#9ca3af' },
            ] as { id: string; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string }[]).map(tab => {
              const isMore = tab.id === 'more';
              const isActive = isMore
                ? (['files', 'schedule', 'tools', 'github', 'pm', 'brain', 'production'] as string[]).includes(mode)
                : mode === tab.id;
              const Icon = tab.icon;
              return (
                <button key={tab.id}
                  onClick={() => {
                    if (isMore) { setShowMoreMenu(true); return; }
                    const m = tab.id as typeof mode;
                    setMode(m);
                    if (m === 'git' && macOnline) { setGitLoading(true); send({ type: 'git_status', mac_id: selectedMacId || undefined }); send({ type: 'git_diff', mac_id: selectedMacId || undefined }); }
                    if (m === 'team' && !fileTree && macOnline) send({ type: 'file_tree', mac_id: selectedMacId || undefined });
                  }}
                  className="flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-all active:scale-90 relative select-none">
                  {/* 実行中ドット (team) */}
                  {tab.id === 'team' && (orchestrateRunning || orchestrateComplete) && (
                    <span className="absolute top-2 right-[calc(50%-14px)] w-2 h-2 rounded-full"
                      style={{ background: orchestrateRunning ? '#818cf8' : '#34d399', boxShadow: orchestrateRunning ? '0 0 6px #818cf8' : 'none', animation: orchestrateRunning ? 'pulse 1.5s ease infinite' : 'none' }} />
                  )}
                  {/* 実行中ドット (code) */}
                  {tab.id === 'code' && running && (
                    <span className="absolute top-2 right-[calc(50%-14px)] w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  )}
                  <Icon size={22} style={{ color: isActive ? tab.color : '#374151' }} />
                  <span className="text-xs font-medium" style={{ color: isActive ? tab.color : '#374151' }}>{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full"
                      style={{ background: tab.color }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── グローバル実行インジケーター（他タブで実行中に表示） ─── */}
      {view === 'chat' && (
        <>
          {running && mode !== 'code' && (
            <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-auto" style={{ animation: 'fadeSlide 0.3s ease' }}>
              <button onClick={() => setMode('code')}
                className="flex items-center gap-2 px-4 py-2 rounded-full shadow-2xl"
                style={{ background: 'rgba(14,165,233,0.95)', border: '1px solid rgba(56,189,248,0.5)', backdropFilter: 'blur(16px)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-xs font-semibold">Claude Code 実行中</span>
                <span className="text-white/60 text-xs">→ Code</span>
              </button>
            </div>
          )}
          {orchestrateRunning && mode !== 'team' && (
            <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-auto" style={{ animation: 'fadeSlide 0.3s ease' }}>
              <button onClick={() => setMode('team')}
                className="flex items-center gap-2 px-4 py-2 rounded-full shadow-2xl"
                style={{ background: 'rgba(79,70,229,0.95)', border: '1px solid rgba(99,102,241,0.5)', backdropFilter: 'blur(16px)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-xs font-semibold">AI Team 実行中 — {orchestratePhase}</span>
                <span className="text-white/60 text-xs">→ Team</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── I: Git Checkpoint Toast ─── */}
      {cpToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          style={{ animation: 'slideUp 0.2s ease' }}>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-xl"
            style={{ background: cpToast.success ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.9)', color: 'white', backdropFilter: 'blur(10px)' }}>
            <GitCommit size={12} />
            <span>{cpToast.success ? `✓ ${cpToast.phase} — git checkpoint 保存` : `✗ ${cpToast.phase} — checkpoint 失敗`}</span>
          </div>
        </div>
      )}

      {/* ─── Visual Capture モーダル ─── */}
      {visualCapturing && visualPreview && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => { setVisualCapturing(false); setVisualPreview(null); }}>
          <div className="w-full rounded-t-3xl overflow-hidden"
            style={{ background: 'rgba(8,8,18,0.98)', border: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'env(safe-area-inset-bottom, 16px)', animation: 'slideUp 0.22s ease' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-3"><div className="w-10 h-1 rounded-full bg-white/15" /></div>
            <div className="px-4 pb-2">
              <p className="text-white font-bold text-sm mb-3">Visual → AI Team</p>
              <img src={`data:${visualMime};base64,${visualPreview}`} alt="preview"
                className="w-full max-h-48 object-contain rounded-xl mb-4"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
              <p className="text-gray-500 text-xs mb-4">この画像を分析してAI Teamの実装指示を自動生成します</p>
              <div className="flex gap-2">
                <button onClick={() => { setVisualCapturing(false); setVisualPreview(null); }}
                  className="px-4 py-3 rounded-xl text-sm text-gray-500 active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>キャンセル</button>
                <button onClick={analyzeVisual} disabled={visualAnalyzing}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                  {visualAnalyzing
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Gemini が解析中...</>
                    : <><Sparkles size={14} />解析 → プラン生成</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── More メニュー ─── */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setShowMoreMenu(false)}>
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden"
            style={{ background: 'rgba(8,8,18,0.98)', border: '1px solid rgba(255,255,255,0.09)', paddingBottom: 'env(safe-area-inset-bottom, 16px)', animation: 'slideUp 0.22s ease' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-5"><div className="w-10 h-1 rounded-full bg-white/15" /></div>
            <p className="text-gray-600 text-xs tracking-widest uppercase text-center mb-4">その他のパネル</p>
            <div className="grid grid-cols-4 gap-2 px-4 pb-6">
              {([
                { id: 'files',      label: 'ファイル',  icon: FolderOpen, color: '#c4b5fd', onSelect: () => { if (fileEntries.length === 0 && macOnline) { setFileLoading(true); send({ type: 'file_list', path: '', mac_id: selectedMacId || undefined }); } } },
                { id: 'tools',      label: 'ツール',    icon: Wrench,     color: '#fca5a5', onSelect: () => {} },
                { id: 'schedule',   label: '予約',      icon: Clock,      color: '#fdba74', onSelect: () => {} },
                { id: 'github',     label: 'GitHub',    icon: GitBranch,  color: '#d8b4fe', onSelect: () => {} },
                { id: 'pm',         label: 'AI PM',     icon: Target,     color: '#fb923c', onSelect: () => {} },
                { id: 'brain',      label: 'Brain',     icon: Brain,      color: '#a78bfa', onSelect: () => { if (macOnline) send({ type: 'brain_status', mac_id: selectedMacId || undefined }); } },
                { id: 'production', label: '本番監視',  icon: Activity,   color: '#34d399', onSelect: () => {} },
              ] as { id: string; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string; onSelect: () => void }[]).map(item => {
                const Icon = item.icon;
                const isActive = mode === item.id;
                return (
                  <button key={item.id} onClick={() => { item.onSelect(); setMode(item.id as typeof mode); setShowMoreMenu(false); }}
                    className="flex flex-col items-center py-4 rounded-2xl active:scale-95 transition-all gap-2"
                    style={{ background: isActive ? `${item.color}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${isActive ? item.color + '40' : 'rgba(255,255,255,0.07)'}` }}>
                    <Icon size={26} style={{ color: isActive ? item.color : '#4b5563' }} />
                    <span className="text-xs font-medium" style={{ color: isActive ? item.color : '#6b7280' }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── ツールシート ─── */}
      {showToolSheet && (
        <div className="fixed inset-0 z-50" onClick={() => setShowToolSheet(false)}>
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden"
            style={{ background: 'rgba(8,8,18,0.98)', border: '1px solid rgba(255,255,255,0.09)', paddingBottom: 'env(safe-area-inset-bottom, 16px)', animation: 'slideUp 0.22s ease' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-4"><div className="w-10 h-1 rounded-full bg-white/15" /></div>
            <p className="text-gray-600 text-xs tracking-widest uppercase text-center mb-4">ツール設定</p>
            <div className="px-4 pb-6 space-y-3">
              {/* 共通トグル */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '🔊 読み上げ (TTS)',      active: ttsEnabled,      toggle: () => { setTtsEnabled(v => !v); if (ttsEnabled) window.speechSynthesis?.cancel(); } },
                  { label: '✨ Gemini 強化',          active: enhanceMode,     toggle: () => setEnhanceMode(v => !v) },
                  ...(mode === 'code' ? [
                    { label: '⚠️ 確認モード',         active: confirmMode,     toggle: () => setConfirmMode(v => !v) },
                    { label: '🤖 自律実行',            active: autonomousMode,  toggle: () => { setAutonomousMode(v => !v); autonomousRef.current = false; } },
                    { label: '⚡ 並列エージェント',   active: parallelMode,    toggle: () => setParallelMode(v => !v) },
                    { label: '📡 Ambient 監視',        active: watchdogActive,  toggle: () => { if (watchdogActive) { send({ type: 'watchdog_stop' }); setWatchdogActive(false); } else send({ type: 'watchdog_start' }); } },
                  ] : [
                    { label: '🔍 コード検索',         active: searchQuery !== '', toggle: () => setSearchQuery(q => q || ' ') },
                    { label: '⚠️ エラー自動診断',     active: diagnosing,      toggle: () => { const err = window.prompt('エラーを貼り付けてください'); if (err) diagnoseError(err); setShowToolSheet(false); } },
                    { label: '📝 プロジェクト概要',   active: false,           toggle: () => { generateProjectSummary(); setShowToolSheet(false); } },
                  ]),
                  { label: '📌 プリセット追加',       active: showPresetAdd,   toggle: () => setShowPresetAdd(v => !v) },
                ].map(item => (
                  <button key={item.label} onClick={item.toggle}
                    className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl text-sm text-left active:scale-97 transition-all"
                    style={{ background: item.active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)', border: item.active ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.07)', color: item.active ? '#a5b4fc' : '#6b7280' }}>
                    <span className="text-base leading-none">{item.label.slice(0, 2)}</span>
                    <span className="text-xs font-medium">{item.label.slice(3)}</span>
                  </button>
                ))}
              </div>

              {/* モデル選択 */}
              <div className="rounded-2xl px-4 py-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-gray-600 text-xs">モデル選択</p>
                <div className="flex gap-2">
                  {mode === 'code' ? (
                    ['', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-8'].map((m, i) => {
                      const labels = ['Default', 'Haiku', 'Sonnet', 'Opus'];
                      return (
                        <button key={m} onClick={() => { setCodeModel(m); setShowToolSheet(false); }}
                          className="flex-1 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
                          style={{ background: codeModel === m ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.04)', border: codeModel === m ? '1px solid rgba(14,165,233,0.4)' : '1px solid rgba(255,255,255,0.07)', color: codeModel === m ? '#7dd3fc' : '#6b7280' }}>
                          {labels[i]}
                        </button>
                      );
                    })
                  ) : (
                    CLAUDE_MODELS.map(m => (
                      <button key={m.id} onClick={() => { setChatModel(m.id); setShowToolSheet(false); }}
                        className="flex-1 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
                        style={{ background: chatModel === m.id ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)', border: chatModel === m.id ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.07)', color: chatModel === m.id ? '#fcd34d' : '#6b7280' }}>
                        {m.label.split(' ')[0]}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Code専用追加オプション */}
              {mode === 'code' && (
                <div className="flex gap-2">
                  {macList.length > 1 && (
                    <select value={selectedMacId} onChange={e => setSelectedMacId(e.target.value)}
                      className="flex-1 h-11 px-3 rounded-xl text-xs outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
                      {macList.map(m => <option key={m.id} value={m.id} style={{ background: '#111' }}>{m.name}</option>)}
                    </select>
                  )}
                  <button onClick={() => { setLiveOpen(true); setShowToolSheet(false); }} disabled={!macOnline || running}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium active:scale-95 disabled:opacity-40"
                    style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#c4b5fd' }}>
                    <Radio size={14} /><span>Gemini Live</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
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
