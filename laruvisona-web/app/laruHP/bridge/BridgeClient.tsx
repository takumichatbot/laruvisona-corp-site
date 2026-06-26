'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, Bot, Zap, Wrench, Folder, ArrowLeft, Square, ChevronRight, Wifi, WifiOff, MonitorSmartphone, Trash2, Lock, RotateCcw, Sparkles, Camera, Mic, Radio, Plus, X as XIcon, GitBranch, FolderOpen, FileText, ChevronDown, Search, Upload, Cpu, MonitorCheck, Volume2, VolumeX, AlertTriangle, Users, MoreHorizontal, SlidersHorizontal, Clock, Target, Brain, Activity, GitCommit, Star } from 'lucide-react';
import GeminiLive from './GeminiLive';
import SchedulePanel, { type Schedule } from './SchedulePanel';
import ToolsPanel from './ToolsPanel';
import GitHubPanel from './GitHubPanel';
import TeamPanel, { type TaskStatus, type MacInfo } from './TeamPanel';
import PMPanel from './PMPanel';
import BrainPanel from './BrainPanel';
import ProductionPanel from './ProductionPanel';
import RealtimeVoice from './RealtimeVoice';
import ConciergePanel from './ConciergePanel';
import HomePanel from './HomePanel';
import PromptLibrary from './PromptLibrary';
import DiffViewer from './DiffViewer';
import GoalDecomposer, { type DecomposePlan, type TaskStatus as DecomposeStatus } from './GoalDecomposer';
import QuantumBrain from './QuantumBrain';
import { addRecord, getRecords } from './TaskHistoryStore';
import { Home, Copy, Check } from 'lucide-react';

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
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
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
          <p className="text-black font-semibold">{project.name}</p>
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
  const [progressText, setProgressText] = useState<string>('');  // 機能5: 実行中の進捗
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);  // コピー完了フィードバック
  const [runElapsed, setRunElapsed] = useState(0);
  const runTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [initError, setInitError] = useState('');
  const [view, setView] = useState<'projects' | 'chat'>('projects');
  // モード切り替え: code / chat / git / files / team / pm / brain / production
  const [mode, setMode] = useState<'home' | 'code' | 'chat' | 'git' | 'files' | 'schedule' | 'tools' | 'github' | 'team' | 'pm' | 'brain' | 'production' | 'concierge' | 'prompts' | 'history'>('home');
  const [modeStack, setModeStack] = useState<(typeof mode)[]>([]);
  const prevModeRef = useRef<typeof mode>('home');
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
  const [watchdogAlerts, setWatchdogAlerts] = useState<{ level: string; message: string; ts?: number }[]>([]);
  const [watchdogActive, setWatchdogActive] = useState(false);
  // Diff ビューア (機能1)
  const [diffResult, setDiffResult] = useState<{ stat: string; diff: string } | null>(null);
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
  const [securityAuditResult, setSecurityAuditResult] = useState<{ score: number; issues: { severity: string; desc: string; fix: string }[]; summary: string } | null>(null);
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
  const [codeModel, setCodeModel] = useState('claude-haiku-4-5-20251001');
  // Gemini
  const [enhanceMode, setEnhanceMode] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const voiceMediaRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const [summaries, setSummaries] = useState<Record<number, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMsgPending, setNewMsgPending] = useState(false);
  const [collapsedOutputs, setCollapsedOutputs] = useState<Set<number>>(new Set());
  const [fileSummaries, setFileSummaries] = useState<Record<number, string[]>>({});
  const [relayWs, setRelayWs] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showToolSheet, setShowToolSheet] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const visualInputRef = useRef<HTMLInputElement>(null);
  // Visual-to-Code
  const [visualCapturing, setVisualCapturing] = useState(false);
  const [visualPreview, setVisualPreview] = useState<string | null>(null);
  const [visualMime, setVisualMime] = useState('image/jpeg');
  const [visualAnalyzing, setVisualAnalyzing] = useState(false);
  const [teamInitialDirective, setTeamInitialDirective] = useState('');
  const [showRealtimeVoice, setShowRealtimeVoice] = useState(false);
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
  // 量子思考エンジン
  const [showQuantumBrain, setShowQuantumBrain] = useState(false);
  const [quantumGoal, setQuantumGoal] = useState('');
  // ゴール分解・並列実行
  const [decomposePlan, setDecomposePlan] = useState<DecomposePlan | null>(null);
  const [decomposeStatuses, setDecomposeStatuses] = useState<Record<string, DecomposeStatus>>({});
  const [decomposeOutputs, setDecomposeOutputs] = useState<Record<string, string>>({});
  const [showDecomposer, setShowDecomposer] = useState(false);
  const [decomposing, setDecomposing] = useState(false);
  const [decomposeBatchRunning, setDecomposeBatchRunning] = useState(false);
  const [decomposeGoal, setDecomposeGoal] = useState('');
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

  // 機能5: iOS ショートカットからのタスクをポーリング（30秒ごと）
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/bridge/quick');
        const data = await res.json() as { tasks: Array<{ id: string; input: string; project: string }> };
        for (const task of data.tasks || []) {
          if (task.input && macOnline && currentProject) {
            setInput(task.input);
          }
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [macOnline, currentProject]);

  // K+T+Y: Push notification + haptic + TTS on orchestration complete
  useEffect(() => {
    if (!orchestrateComplete || !currentProject) return;
    haptic([40, 30, 80]);
    // Y: TTS 音声通知
    const taskVals = Object.values(taskStatuses as Record<string, string>);
    const failed = taskVals.filter(s => s === 'failed').length;
    const done = taskVals.filter(s => s === 'done').length;
    const text = failed > 0
      ? `${currentProject.name}、${done}タスク完了、${failed}件失敗しました。確認してください。`
      : `${currentProject.name}の実装が完了しました。全${done}タスク成功です。`;
    fetch('/api/bridge/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tts', text, voice: 'shimmer' }),
    }).then(r => r.ok ? r.blob() : null).then(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play().catch(() => {});
      audio.onended = () => URL.revokeObjectURL(url);
    }).catch(() => {});
  }, [orchestrateComplete]);

  // 実行中タイマー
  useEffect(() => {
    if (running) {
      setRunElapsed(0);
      runTimerRef.current = setInterval(() => setRunElapsed(s => s + 1), 1000);
    } else {
      if (runTimerRef.current) { clearInterval(runTimerRef.current); runTimerRef.current = null; }
    }
    return () => { if (runTimerRef.current) clearInterval(runTimerRef.current); };
  }, [running]);

  // タスク履歴トラッキング
  const taskStartRef = useRef<number>(0);
  useEffect(() => { if (running) taskStartRef.current = Date.now(); }, [running]);
  useEffect(() => {
    if (!running && taskStartRef.current > 0 && currentProject && messages.length > 0) {
      const last = messages[messages.length - 1];
      const input = messages.findLast(m => m.role === 'user')?.content ?? '';
      if (input && last?.role === 'assistant') {
        addRecord({
          projectName: currentProject.name, type: 'code', input: input.slice(0, 100),
          outputPreview: last.content.slice(0, 120), status: 'success',
          ts: Date.now(), durationMs: Date.now() - taskStartRef.current,
        });
        taskStartRef.current = 0;
      }
    }
  }, [running, currentProject]);

  const chatStartRef = useRef<number>(0);
  useEffect(() => { if (chatRunning) chatStartRef.current = Date.now(); }, [chatRunning]);
  useEffect(() => {
    if (!chatRunning && chatStartRef.current > 0 && currentProject && chatMessages.length > 0) {
      const userMsg = chatMessages.findLast(m => m.role === 'user')?.content ?? '';
      if (userMsg) {
        addRecord({
          projectName: currentProject.name, type: 'chat', input: userMsg.slice(0, 100),
          outputPreview: '', status: 'success',
          ts: Date.now(), durationMs: Date.now() - chatStartRef.current,
        });
        chatStartRef.current = 0;
      }
    }
  }, [chatRunning, currentProject]);

  useEffect(() => {
    if (orchestrateComplete && currentProject) {
      const failed = Object.values(taskStatuses as Record<string, string>).filter(s => s === 'failed').length;
      const done = Object.values(taskStatuses as Record<string, string>).filter(s => s === 'done').length;
      addRecord({
        projectName: currentProject.name, type: 'team', input: `AI Team: ${done + failed}タスク`,
        outputPreview: `完了 ${done}件 / 失敗 ${failed}件`,
        status: failed === 0 ? 'success' : 'failed',
        ts: Date.now(), durationMs: 0, taskCount: done + failed,
      });
    }
  }, [orchestrateComplete, currentProject]);

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
    // セッション復元: mode
    const savedMode = sessionStorage.getItem('bridge_mode') as typeof mode;
    if (savedMode && savedMode !== 'home') setMode(savedMode);
  }, []);

  // セッション保存 + ナビ履歴更新
  useEffect(() => {
    sessionStorage.setItem('bridge_mode', mode);
    if (prevModeRef.current !== mode) {
      const prev = prevModeRef.current;
      setModeStack(s => [...s.slice(-9), prev]);
      prevModeRef.current = mode;
    }
  }, [mode]);

  const goBack = () => {
    setModeStack(s => {
      if (s.length === 0) return s;
      const prev = s[s.length - 1];
      prevModeRef.current = prev;
      setMode(prev);
      return s.slice(0, -1);
    });
  };

  // セッション復元: project (projects 読込後)
  useEffect(() => {
    if (projects.length > 0 && !currentProject) {
      const savedName = sessionStorage.getItem('bridge_project');
      if (savedName) {
        const p = projects.find(pr => pr.name === savedName);
        if (p) { setCurrentProject(p); setMessages(loadHistory(p.id)); setView('chat'); }
      }
    }
  }, [projects]);

  useEffect(() => {
    if (currentProject) sessionStorage.setItem('bridge_project', currentProject.name);
  }, [currentProject]);

  // URL パラメータからの mode 起動 (PWA shortcuts)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const m = sp.get('mode') as typeof mode | null;
      if (m) setMode(m);
    }
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
      // 機能1: Diff ビューア
      if (m.type === 'diff_result') {
        const r = m as unknown as { stat: string; diff: string };
        setDiffResult({ stat: r.stat, diff: r.diff });
      }
      // 機能6: エラーログ自動監視
      if (m.type === 'log_alert') {
        const r = m as unknown as { path: string; excerpt: string; level: string };
        setWatchdogAlerts(prev => [...prev.slice(-4), {
          level: 'danger',
          message: `ログエラー検出: ${r.path.split('/').pop()} — ${r.excerpt.slice(-100)}`,
          ts: Date.now(),
        }]);
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
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
      // AA: generate_tests result → pass to TeamPanel via orchestrateTestResult
      if (m.type === 'generate_tests_result') {
        const r = m as unknown as { output: string; passed: boolean };
        setOrchestrateTestResult({ output: r.output, passed: r.passed });
      }
      // AH: security_audit result
      if (m.type === 'security_audit_result') {
        setSecurityAuditResult((m as unknown) as { score: number; issues: { severity: string; desc: string; fix: string }[]; summary: string });
      }
      // AC: auto-debug retry notification
      if (m.type === 'orchestrate_task_auto_retry') {
        const r = m as unknown as { task_id: string; attempt: number };
        setTaskStatuses(prev => ({ ...prev, [r.task_id]: 'running' }));
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
      if (m.type === 'running') { setRunning(true); setProgressText('実行中...'); setContinuing(!!(m as {continuing?: boolean}).continuing); }
      // 機能5: 30秒ごとの進捗通知（接続が生きている確認）
      // 注意: setRunning(true) は呼ばない。done の後に遅れて届いた progress で
      //       running が再び true になり「動作確認中」のまま固まるのを防ぐ。
      if (m.type === 'progress') { setProgressText((m as { message?: string }).message || '実行中...'); }
      // 機能1: keepalive ping は無視（接続維持のみ）
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
        setProgressText('');
        // バイブレーション + TTS
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
          // 機能3: 音声ウォークスルー
          if (ttsEnabled) {
            const lastMsg2 = updated[updated.length - 1];
            const fileMatches = lastMsg2?.content?.matchAll(/(?:Write|Edit|Create)\s*\(\s*["']?([^"'\s)]+)/g);
            const changedFiles = fileMatches ? [...fileMatches].map(fm => fm[1]).slice(0, 3) : [];
            if (m.exit_code === 0) {
              const summary = changedFiles.length > 0
                ? `完了しました。${changedFiles.map((f: string) => f.split('/').pop()).join('、')}を変更しました。`
                : '実行が完了しました。';
              speakText(summary);
            } else {
              speakText('エラーが発生しました。出力を確認してください。');
            }
          }
          return updated;
        });
      }
      if (m.type === 'aborted') { setRunning(false); setProgressText(''); setMessages(prev => [...prev, { role: 'system', content: '処理を停止しました' }]); }
      // 機能3: タイムアウト通知
      if (m.type === 'timeout') {
        setRunning(false); setProgressText('');
        if ('vibrate' in navigator) navigator.vibrate([300]);
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Claude Code タイムアウト', { body: (m as { message?: string }).message || 'タイムアウトしました', icon: '/laruhp_logo.png' });
        }
        setMessages(prev => [...prev, { role: 'system', content: `⏱ ${(m as { message?: string }).message || 'タイムアウトしました'}` }]);
      }
      if (m.type === 'error') { setRunning(false); setProgressText(''); setMessages(prev => [...prev, { role: 'system', content: m.message || 'エラー' }]); }
      if (m.type === 'missed_output') {
        const r = m as unknown as { output: string; exit_code: number; project: string };
        // バグ④: 実行終了として扱う（入力欄が固まるのを防ぐ）
        setRunning(false); setProgressText('');
        setMessages(prev => {
          const last = prev[prev.length - 1];
          const head = (r.output || '').slice(0, 80);
          // バグ③: 既に同じ内容が表示済みなら二重表示しない
          const alreadyShown = last?.role === 'assistant' && !!last.content && head.length > 0 &&
            (last.content === r.output || last.content.includes(head) || r.output.includes(last.content.slice(0, 80)));
          if (alreadyShown) {
            // ストリーミング途中なら確定だけして終わる
            if (last.streaming) return [...prev.slice(0, -1), { ...last, content: r.output, streaming: false, ts: Date.now() }];
            return prev; // 既に確定済み → 何も足さない
          }
          return [
            ...prev,
            { role: 'system', content: `📬 ページを閉じている間に完了しました（${r.exit_code === 0 ? '成功' : 'エラー'}）` },
            { role: 'assistant', content: r.output, streaming: false, ts: Date.now() },
          ];
        });
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      }
      // ゴール分解バッチ実行イベント
      if (m.type === 'batch_task_start') {
        const r = m as unknown as { task_id: string };
        setDecomposeStatuses(prev => ({ ...prev, [r.task_id]: 'running' }));
      }
      if (m.type === 'batch_task_output') {
        const r = m as unknown as { task_id: string; content: string };
        setDecomposeOutputs(prev => ({ ...prev, [r.task_id]: ((prev[r.task_id] || '') + r.content).slice(-800) }));
      }
      if (m.type === 'batch_task_done') {
        const r = m as unknown as { task_id: string };
        setDecomposeStatuses(prev => ({ ...prev, [r.task_id]: 'done' }));
        haptic(20);
      }
      if (m.type === 'batch_task_failed') {
        const r = m as unknown as { task_id: string };
        setDecomposeStatuses(prev => ({ ...prev, [r.task_id]: 'failed' }));
      }
      if (m.type === 'batch_done') {
        setDecomposeBatchRunning(false);
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 100]);
      }
    });
    return unsub;
  }, [addListener]);

  // スクロール位置を監視して isAtBottom を更新
  const handleChatScroll = () => {
    if (!chatScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 60;
    setIsAtBottom(atBottom);
    if (atBottom) setNewMsgPending(false);
  };

  // 新メッセージ到達時: 末尾にいれば自動スクロール、離れていれば「↓ 新着」ボタン
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewMsgPending(false);
    } else {
      setNewMsgPending(true);
    }
  }, [messages]);

  // done 時にファイル変更サマリーを抽出してメッセージを折りたたむ
  useEffect(() => {
    if (running) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || last.content.length < 200) return;
    const idx = messages.length - 1;
    const matches = [...last.content.matchAll(/(?:Write|Edit|Create)\s*\(\s*["']?([^"'\s,)\n]+)/g)];
    const files = [...new Set(matches.map(m => m[1]).filter(f => f.includes('.')))];
    if (files.length > 0) {
      setFileSummaries(prev => ({ ...prev, [idx]: files }));
      setCollapsedOutputs(prev => new Set([...prev, idx]));
    }
  }, [running]);


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

    // 機能8: 自然言語スケジュール検出
    const schedulePatterns = [
      { regex: /毎朝(\d+)時/, cron: (h: string) => `0 ${h} * * *` },
      { regex: /毎日(\d+)時/, cron: (h: string) => `0 ${h} * * *` },
      { regex: /(\d+)分ごと/, cron: (mm: string) => `*/${mm} * * * *` },
      { regex: /毎時/, cron: () => `0 * * * *` },
      { regex: /毎週(月|火|水|木|金|土|日)/, cron: (d: string) => {
          const map: Record<string, string> = { 月: '1', 火: '2', 水: '3', 木: '4', 金: '5', 土: '6', 日: '0' };
          return `0 9 * * ${map[d] || '1'}`;
        }
      },
    ];
    let matchedSchedule = false;
    for (const p of schedulePatterns) {
      const match = finalText.match(p.regex);
      if (match) {
        const cron = p.cron(match[1] || '');
        const taskWithoutSchedule = finalText.replace(p.regex, '').replace(/[にをのは]$/, '').trim();
        try {
          const schedules = JSON.parse(localStorage.getItem('bridge_schedules') || '[]');
          schedules.push({ id: Date.now().toString(), cron, task: taskWithoutSchedule, project: currentProject?.id, createdAt: Date.now() });
          localStorage.setItem('bridge_schedules', JSON.stringify(schedules.slice(-20)));
        } catch { /* ignore */ }
        setMessages(prev => [...prev, { role: 'system', content: `スケジュール登録: ${p.regex.source.replace(/[()]/g, '')} → "${taskWithoutSchedule}"` }]);
        matchedSchedule = true;
        break;
      }
    }
    if (matchedSchedule) return;

    // 機能2: スマートコンテキスト注入
    let enrichedText = finalText;
    if (macOnline && currentProject && finalText.length > 5) {
      const lastAssistant = messages.findLast(mm => mm.role === 'assistant');
      const hasError = lastAssistant?.content?.match(/Error:|error:|TypeError:|SyntaxError:|Cannot find/);
      if (hasError && lastAssistant) {
        const errorContext = lastAssistant.content.slice(0, 500);
        enrichedText = `[前回のエラー]\n${errorContext}\n\n[指示]\n${finalText}`;
      }
      const fileMentions = finalText.match(/[\w/\-]+\.(tsx?|jsx?|py|css|json|md)/g);
      if (fileMentions && fileMentions.length > 0 && !enrichedText.includes('[前回のエラー]')) {
        enrichedText = `[対象ファイル: ${fileMentions.join(', ')}]\n${finalText}`;
      }
    }
    const finalEnrichedText = enrichedText;

    if (autonomousMode) {
      autonomousRef.current = true;
      setAutonomousStep(0);
      setAutonomousLog([finalEnrichedText]);
    }
    setMessages(prev => [...prev, { role: 'user', content: finalText, ts: Date.now() }]);
    send({ type: 'message', content: finalEnrichedText, model: codeModel || undefined, mac_id: selectedMacId || undefined });
  };

  // ゴール分解: 入力テキストを Claude で分解してタスク計画を生成
  const handleDecompose = async () => {
    const goal = input.trim();
    if (!goal || !currentProject) return;
    haptic(10);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = '44px';
    setDecomposing(true);
    setDecomposeGoal(goal);
    try {
      const res = await fetch('/api/bridge/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, project: currentProject.name, secret: ADMIN_SECRET }),
      });
      const plan = await res.json() as DecomposePlan & { error?: string };
      if (plan.error) throw new Error(plan.error);
      setDecomposePlan(plan);
      const initStatuses: Record<string, DecomposeStatus> = {};
      plan.tasks.forEach(t => { initStatuses[t.id] = 'pending'; });
      setDecomposeStatuses(initStatuses);
      setDecomposeOutputs({});
      setShowDecomposer(true);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'system', content: `ゴール分解エラー: ${String(e)}` }]);
    } finally {
      setDecomposing(false);
    }
  };

  // バッチ実行開始: mac_agent に run_batch を送信
  const executeBatch = () => {
    if (!decomposePlan || !currentProject) return;
    setDecomposeBatchRunning(true);
    send({
      type: 'run_batch',
      tasks: decomposePlan.tasks.map(t => ({ id: t.id, prompt: t.prompt })),
      parallel_groups: decomposePlan.parallelGroups,
      project: currentProject.id,
      model: codeModel || undefined,
    });
  };

  const abortBatch = () => {
    send({ type: 'abort_batch' });
    setDecomposeBatchRunning(false);
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

  if (liveOpen) return (
    <GeminiLive
      projectName={currentProject?.name || ''}
      recentHistory={messages.slice(-6).map(m => ({ role: m.role, content: m.content }))}
      onInstruction={(text) => { setInput(text); setMode('code'); }}
      onClose={() => setLiveOpen(false)}
    />
  );

  if (initError) return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-6">
      <p className="text-red-400 text-sm">{initError}</p>
    </div>
  );

  // ライトテーマ カラーパレット
  const LC = {
    bg: '#F8F7F4', surface: '#FFFFFF', sky: '#0EA5E9', skyLight: '#E0F2FE', skyMid: '#38BDF8',
    beige: '#F5EFE6', beigeAlt: '#EDE8DC', beigeStrong: '#D4CAB8',
    text: '#1E293B', textSub: '#64748B', textMuted: '#94A3B8', border: '#E8E3DC',
    success: '#10B981', warning: '#F59E0B', error: '#EF4444',
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: LC.bg, color: LC.text }}>

      {/* Header */}
      <div className="relative flex items-center gap-2 px-4 flex-shrink-0"
        style={{
          backdropFilter: 'blur(20px)',
          background: 'rgba(255,255,255,0.85)',
          borderBottom: `1px solid ${LC.border}`,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          paddingBottom: 10,
        }}>

        {/* 左: 戻る or ホーム */}
        {view === 'chat' && modeStack.length > 0 ? (
          <button onClick={goBack}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
            style={{ background: LC.beigeAlt, border: `1px solid ${LC.border}` }}>
            <ArrowLeft size={16} style={{ color: LC.textSub }} />
          </button>
        ) : view === 'chat' && mode !== 'home' ? (
          <button onClick={() => setMode('home')}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
            style={{ background: LC.beigeAlt, border: `1px solid ${LC.border}` }}>
            <Home size={15} style={{ color: LC.textSub }} />
          </button>
        ) : null}

        {/* 中: タイトル */}
        <span className="flex-1 font-bold text-sm tracking-wide truncate"
          style={{ background: `linear-gradient(90deg, ${LC.sky}, #0284C7)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {view === 'chat' && currentProject ? currentProject.name : 'Bridge'}
        </span>

        {/* 右: 実行中は中断ボタン、それ以外はステータスドット + ⋯ */}
        {running ? (
          <button onClick={() => { send({ type: 'abort' }); setRunning(false); setProgressText(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-90 flex-shrink-0"
            style={{ background: LC.surface, border: `1px solid rgba(239,68,68,0.3)`, color: LC.error }}>
            <Square size={10} fill="currentColor" />
            停止
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {/* ステータスドット */}
            <div className="relative w-6 h-6 flex items-center justify-center" title={!connected ? '未接続' : !macOnline ? 'Mac オフライン' : 'Mac オンライン'}>
              <div className="w-2 h-2 rounded-full" style={{
                background: !connected ? LC.textMuted : !macOnline ? LC.warning : LC.sky,
                boxShadow: connected && macOnline ? `0 0 6px ${LC.sky}` : 'none',
              }} />
              {connected && macOnline && <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: LC.sky }} />}
            </div>

            {/* ⋯ メニューボタン */}
            <button onClick={() => setShowHeaderMenu(v => !v)}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
              style={{ background: showHeaderMenu ? LC.skyLight : LC.surface, border: `1px solid ${LC.border}`, color: LC.textSub }}>
              <MoreHorizontal size={16} />
            </button>
          </div>
        )}

        {/* ヘッダーメニュードロップダウン */}
        {showHeaderMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} />
            <div className="absolute top-full right-3 mt-1 z-50 rounded-2xl overflow-hidden"
              style={{ background: LC.surface, border: `1px solid ${LC.border}`, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', backdropFilter: 'blur(20px)', minWidth: 180 }}>
              {[
                { icon: <RotateCcw size={15} />, label: '新しい会話',    action: () => { newConversation(); setShowHeaderMenu(false); }, show: view === 'chat' },
                { icon: <Trash2 size={15} />,    label: '履歴をクリア',  action: () => { clearHistory(); setShowHeaderMenu(false); }, show: view === 'chat' && messages.length > 0 },
                { icon: <span className="text-sm">🔔</span>, label: '通知を有効化', action: () => { registerPush(); setShowHeaderMenu(false); },
                  show: typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' },
                { icon: <Lock size={15} />,      label: 'ロック',        action: () => { handleLock(); setShowHeaderMenu(false); }, show: true },
              ].filter(item => item.show).map((item, i, arr) => (
                <button key={i} onClick={item.action}
                  className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                  style={{ borderBottom: i < arr.length - 1 ? `1px solid ${LC.border}` : 'none', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = LC.beigeAlt)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ color: LC.textMuted }}>{item.icon}</span>
                  <span className="text-sm" style={{ color: LC.text }}>{item.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Mac offline banner */}
      {connected && !macOnline && (
        <div className="px-4 py-2 text-xs text-center"
          style={{ background: 'rgba(245,158,11,0.08)', borderBottom: `1px solid rgba(245,158,11,0.2)`, color: LC.warning }}>
          Mac エージェントがオフラインです
        </div>
      )}

      {/* ライブステータスバー (code モード実行中) */}
      {mode === 'code' && running && (() => {
        const last = messages[messages.length - 1];
        const streamingLine = last?.streaming && last.content
          ? last.content.split('\n').filter(l => l.trim()).slice(-1)[0]?.trim().slice(0, 72) ?? ''
          : '';
        return (
          <div className="px-4 py-2 flex items-center gap-2 overflow-hidden"
            style={{ background: LC.skyLight, borderBottom: `1px solid rgba(14,165,233,0.2)` }}>
            {/* プログレスバー */}
            <div className="flex-shrink-0 w-20 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(14,165,233,0.15)' }}>
              <div className="h-full rounded-full" style={{
                background: `linear-gradient(90deg, ${LC.sky}, #0284C7)`,
                width: `${Math.min(95, (runElapsed / 120) * 100 + 5)}%`,
                transition: 'width 1s linear',
              }} />
            </div>
            <span className="text-[11px] font-mono flex-shrink-0" style={{ color: '#0369A1' }}>{runElapsed}s</span>
            {streamingLine ? (
              <span className="text-[11px] truncate" style={{ color: LC.textSub }}>{streamingLine}</span>
            ) : (
              <span className="text-[11px]" style={{ color: '#0369A1' }}>
                {runElapsed < 5 ? 'ファイルを読み込んでいます' :
                 runElapsed < 15 ? 'コードを分析しています' :
                 runElapsed < 30 ? '実装を計画しています' :
                 runElapsed < 60 ? 'ファイルを編集しています' : '動作確認しています'}
              </span>
            )}
            {/* 機能5: サーバー由来の進捗（接続が生きている証明）。緑ドットで明示 */}
            {progressText && (
              <span className="flex items-center gap-1 flex-shrink-0 ml-auto">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981', animation: 'pulse 1.5s infinite' }} />
                <span className="text-[10px]" style={{ color: '#10B981' }}>接続OK</span>
              </span>
            )}
          </div>
        );
      })()}

      {/* Projects view */}
      {view === 'projects' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: LC.bg }}>
          <p className="text-xs text-center pt-2 pb-1 tracking-widest uppercase" style={{ color: LC.textMuted }}>プロジェクトを選択</p>
          {projects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: LC.skyLight, animation: 'pulse 2s infinite' }}>
                <MonitorSmartphone size={24} style={{ color: LC.sky }} />
              </div>
              <p className="text-sm" style={{ color: LC.textSub }}>
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
            <div className="px-3 py-1.5 space-y-1" style={{ background: 'rgba(239,68,68,0.06)', borderBottom: `1px solid rgba(239,68,68,0.15)` }}>
              {watchdogAlerts.slice(-2).map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span style={{ color: a.level === 'danger' ? LC.error : LC.warning }}>⚠</span>
                  <span className="flex-1 truncate" style={{ color: LC.text }}>{a.message}</span>
                  <button onClick={() => setWatchdogAlerts(prev => prev.filter((_, j) => j !== i))} className="active:opacity-50 flex-shrink-0" style={{ color: LC.textMuted }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* マルチエージェント UI */}
          {parallelMode && (
            <div className="px-3 py-2 space-y-2" style={{ background: LC.skyLight, borderBottom: `1px solid rgba(14,165,233,0.2)` }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: '#0369A1' }}>Multi-Agent — 並列実行</p>
                <button onClick={() => setParallelMode(false)} className="text-xs active:opacity-50" style={{ color: LC.textSub }}>✕ 閉じる</button>
              </div>
              {parallelTasks.map((t, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-xs w-12 flex-shrink-0" style={{ color: LC.textMuted }}>Agent {i+1}</span>
                  <input value={t} onChange={e => setParallelTasks(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                    placeholder={`タスク ${i+1}`}
                    className="flex-1 h-8 px-2 rounded-lg text-xs outline-none"
                    style={{ background: LC.surface, border: `1px solid ${LC.border}`, color: LC.text }} />
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={() => setParallelTasks(prev => [...prev, ''])} disabled={parallelTasks.length >= 4}
                  className="px-3 py-1.5 rounded-lg text-xs active:scale-90 disabled:opacity-40"
                  style={{ background: LC.surface, border: `1px solid ${LC.border}`, color: LC.sky }}>+ 追加</button>
                <button onClick={() => {
                  const tasks = parallelTasks.filter(t => t.trim());
                  if (!tasks.length || !macOnline) return;
                  setAgentOutputs({});
                  send({ type: 'parallel_exec', tasks, model: codeModel || undefined });
                }} disabled={agentRunning || !macOnline || !parallelTasks.some(t => t.trim())}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white active:scale-98 transition-all disabled:opacity-40"
                  style={{ background: `linear-gradient(135deg, ${LC.sky}, #0284C7)` }}>
                  {agentRunning ? '実行中...' : '並列実行'}
                </button>
              </div>
              {Object.keys(agentOutputs).length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(agentOutputs).map(([id, out]) => (
                    <div key={id} className="rounded-lg p-2" style={{ background: LC.beigeAlt }}>
                      <p className="text-xs mb-1" style={{ color: LC.sky }}>{id}</p>
                      <pre className="text-xs font-mono whitespace-pre-wrap break-words" style={{ color: LC.textSub }}>{out.slice(-500)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* プリセット指示バー */}
          {(presets.length > 0 || showPresetAdd) && (
            <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto"
              style={{ background: LC.surface, borderBottom: `1px solid ${LC.border}`, scrollbarWidth: 'none' }}>
              {presets.map((p, i) => (
                <div key={i} className="flex items-center gap-1 flex-shrink-0 group">
                  <button onClick={() => setInput(p)}
                    className="px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all active:scale-90"
                    style={{ background: LC.beigeAlt, border: `1px solid ${LC.border}`, color: LC.textSub }}>
                    {p.length > 20 ? p.slice(0, 20) + '…' : p}
                  </button>
                  <button onClick={() => removePreset(i)}
                    className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <XIcon size={8} style={{ color: LC.error }} />
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
                    className="w-36 px-2 py-1 rounded-full text-xs outline-none"
                    style={{ background: LC.beigeAlt, border: `1px solid ${LC.border}`, color: LC.text }} />
                  <button onClick={() => { savePreset(presetInput); setPresetInput(''); setShowPresetAdd(false); }}
                    className="px-2 py-1 rounded-full text-xs"
                    style={{ background: 'rgba(16,185,129,0.1)', color: LC.success }}>追加</button>
                </div>
              ) : null}
            </div>
          )}

          {/* Git status ビュー */}
          {mode === 'git' && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: LC.bg }}>
              <div className="flex items-center justify-between">
                <p className="text-xs tracking-widest uppercase" style={{ color: LC.textMuted }}>Git Status</p>
                <button onClick={() => { setGitLoading(true); send({ type: 'git_status' }); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-all"
                  style={{ background: LC.surface, border: `1px solid ${LC.border}` }}>
                  <RotateCcw size={12} style={{ color: gitLoading ? LC.success : LC.textMuted, animation: gitLoading ? 'spin 1s linear infinite' : 'none' }} />
                </button>
              </div>
              {gitLoading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${LC.success} transparent transparent transparent` }} /></div>}
              {gitStatus?.error && <p className="text-xs" style={{ color: LC.error }}>{gitStatus.error}</p>}
              {gitStatus?.status !== undefined && (
                <div className="rounded-xl p-4 space-y-1" style={{ background: LC.surface, border: `1px solid ${LC.border}` }}>
                  <p className="text-xs mb-2" style={{ color: LC.textMuted }}>変更ファイル</p>
                  {gitStatus.status ? (
                    gitStatus.status.trim().split('\n').map((line, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold w-5" style={{ color: line.startsWith('M') ? LC.warning : line.startsWith('A') ? LC.success : line.startsWith('D') ? LC.error : LC.sky }}>
                          {line.slice(0, 2).trim()}
                        </span>
                        <span className="text-xs font-mono truncate" style={{ color: LC.text }}>{line.slice(3)}</span>
                      </div>
                    ))
                  ) : <p className="text-xs" style={{ color: LC.textMuted }}>変更なし（クリーン）</p>}
                </div>
              )}
              {gitStatus?.log && (
                <div className="rounded-xl p-4" style={{ background: LC.surface, border: `1px solid ${LC.border}` }}>
                  <p className="text-xs mb-2" style={{ color: LC.textMuted }}>直近のコミット</p>
                  {gitStatus.log.trim().split('\n').map((line, i) => (
                    <div key={i} className="flex items-start gap-2 py-0.5">
                      <span className="text-xs font-mono flex-shrink-0" style={{ color: LC.sky }}>{line.slice(0, 7)}</span>
                      <span className="text-xs" style={{ color: LC.textSub }}>{line.slice(8)}</span>
                    </div>
                  ))}
                </div>
              )}
              {gitDiff && (
                <div className="flex gap-2">
                  <button onClick={() => { setInput('現在のgit diffを説明して'); setMode('chat'); }}
                    className="flex-1 py-2 rounded-xl text-xs active:scale-98 transition-all"
                    style={{ background: 'rgba(16,185,129,0.06)', border: `1px solid rgba(16,185,129,0.2)`, color: LC.success }}>
                    差分を説明
                  </button>
                  <button onClick={() => setMode('tools')}
                    className="flex-1 py-2 rounded-xl text-xs active:scale-98 transition-all"
                    style={{ background: LC.skyLight, border: `1px solid rgba(14,165,233,0.3)`, color: LC.sky }}>
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

          {/* V: Realtime Voice modal */}
          {showRealtimeVoice && currentProject && (
            <RealtimeVoice
              projectName={currentProject.name}
              onDirective={(text) => { setTeamInitialDirective(text); setMode('team'); setShowRealtimeVoice(false); }}
              onClose={() => setShowRealtimeVoice(false)}
            />
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
              securityAuditResult={securityAuditResult}
            />
          )}

          {/* Home Dashboard */}
          {mode === 'home' && (
            <HomePanel
              key="home-panel"
              projects={projects}
              currentProject={currentProject}
              macOnline={macOnline}
              macCount={macList.length || (macOnline ? 1 : 0)}
              orchestrateRunning={orchestrateRunning}
              orchestrateComplete={orchestrateComplete}
              lastMode={messages.findLast(m => m.role === 'user') ? 'code' : chatMessages.findLast(m => m.role === 'user') ? 'chat' : undefined}
              lastInput={messages.findLast(m => m.role === 'user')?.content?.slice(0, 60) ?? chatMessages.findLast(m => m.role === 'user')?.content?.slice(0, 60)}
              onContinueLast={messages.length > 0 || chatMessages.length > 0 ? () => setMode(messages.length > 0 ? 'code' : 'chat') : undefined}
              onSelectProject={(p) => { selectProject(p); setMode('code'); }}
              onNavigate={(m) => setMode(m as typeof mode)}
              onRunPrompt={(prompt, m) => {
                setInput(prompt);
                setMode(m);
              }}
            />
          )}

          {/* Prompt Library */}
          {mode === 'prompts' && (
            <PromptLibrary
              onRunPrompt={(prompt, m) => {
                setInput(prompt);
                setMode(m);
              }}
            />
          )}

          {/* Concierge */}
          {mode === 'concierge' && (
            <ConciergePanel
              macOnline={macOnline}
              currentProject={currentProject}
              currentMode={mode}
              orchestrateRunning={orchestrateRunning}
              orchestrateComplete={orchestrateComplete}
              failedTasks={Object.values(taskStatuses).filter(s => s === 'failed').length}
              onNavigate={(m) => setMode(m as typeof mode)}
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
            <div className="flex-1 overflow-y-auto" style={{ background: LC.bg }}>
              {/* パンくず */}
              <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto" style={{ borderBottom: `1px solid ${LC.border}`, scrollbarWidth: 'none' }}>
                <button onClick={() => { setFilePath(''); setFileContent(''); setFileHistory([]); setFileLoading(true); send({ type: 'file_list', path: '', mac_id: selectedMacId || undefined }); }}
                  className="text-xs flex-shrink-0 active:opacity-70" style={{ color: LC.sky }}>root</button>
                {fileHistory.map((seg, i) => (
                  <span key={i} className="flex items-center gap-1 flex-shrink-0">
                    <ChevronDown size={10} style={{ color: LC.textMuted }} className="-rotate-90" />
                    <button onClick={() => {
                      const newPath = fileHistory.slice(0, i + 1).join('/');
                      setFilePath(newPath); setFileContent(''); setFileHistory(fileHistory.slice(0, i + 1));
                      setFileLoading(true); send({ type: 'file_list', path: newPath });
                    }} className="text-xs active:opacity-70" style={{ color: LC.sky }}>{seg}</button>
                  </span>
                ))}
              </div>
              <label className="ml-auto flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer active:scale-90 transition-all" style={{ background: LC.skyLight }}>
                <Upload size={13} style={{ color: LC.sky }} />
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
              {fileLoading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${LC.sky} transparent transparent transparent` }} /></div>}
              {/* ファイルコンテンツ表示 */}
              {fileContent ? (
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-mono" style={{ color: LC.textSub }}>{filePath}</p>
                    <button onClick={() => setInput(`${filePath} を参照して: `)}
                      className="text-xs px-2 py-1 rounded-lg active:scale-90 transition-all"
                      style={{ background: LC.skyLight, color: LC.sky }}>Codeに送る</button>
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words leading-relaxed overflow-x-auto" style={{ color: LC.text }}>{fileContent}</pre>
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
                      style={{ background: LC.surface, border: `1px solid ${LC.border}` }}>
                      {entry.is_dir
                        ? <FolderOpen size={14} style={{ color: LC.sky, flexShrink: 0 }} />
                        : <FileText size={14} style={{ color: LC.textMuted, flexShrink: 0 }} />}
                      <span className="text-sm truncate" style={{ color: LC.text }}>{entry.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 確認ダイアログ */}
          {pendingInstruction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(8px)' }}>
              <div className="w-full rounded-2xl p-5 space-y-4" style={{ background: LC.surface, border: `1px solid rgba(239,68,68,0.3)`, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} style={{ color: LC.error }} />
                  <p className="font-semibold text-sm" style={{ color: LC.text }}>実行確認</p>
                </div>
                <p className="text-sm rounded-xl px-3 py-2" style={{ background: LC.beigeAlt, color: LC.textSub }}>{pendingInstruction}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPendingInstruction(null)}
                    className="flex-1 py-3 rounded-xl text-sm active:scale-95"
                    style={{ background: LC.beigeAlt, color: LC.textSub }}>キャンセル</button>
                  <button onClick={() => { const t = pendingInstruction; setPendingInstruction(null); handleSend(t); }}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #dc2626, #f97316)' }}>実行</button>
                </div>
              </div>
            </div>
          )}

          {/* メッセージリスト */}
          <div
            ref={chatScrollRef}
            onScroll={handleChatScroll}
            className={`overflow-y-auto px-4 py-4 space-y-3 ${mode === 'code' || mode === 'chat' ? 'flex-1' : 'hidden'}`}
            style={{ background: LC.bg }}>
            {mode === 'code' && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <p className="text-sm" style={{ color: LC.textMuted }}>Claude Code に指示を送信</p>
              </div>
            )}
            {mode === 'chat' && memories.length > 0 && chatMessages.length === 0 && (
              <div className="rounded-xl p-3 mb-2" style={{ background: LC.skyLight, border: `1px solid rgba(14,165,233,0.2)` }}>
                <p className="text-xs mb-2" style={{ color: '#0369A1' }}>記憶 ({memories.length}件)</p>
                {memories.slice(-3).map(m => (
                  <div key={m.id} className="flex items-start gap-2 py-1">
                    <p className="flex-1 text-xs truncate" style={{ color: LC.textSub }}>{m.content}</p>
                    <button onClick={() => deleteMemory(m.id)} className="flex-shrink-0 active:opacity-50 text-xs" style={{ color: LC.textMuted }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {mode === 'chat' && chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: LC.beige, border: `1px solid ${LC.beigeStrong}` }}>
                  <Bot size={22} style={{ color: LC.warning }} />
                </div>
                <p className="text-sm" style={{ color: LC.textSub }}>Claude と直接会話</p>
                <p className="text-xs text-center" style={{ color: LC.textMuted }}>コード質問・設計相談・なんでも</p>
              </div>
            )}
            {(mode === 'code' ? messages : chatMessages).map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : m.role === 'system' ? 'justify-center' : 'justify-start'}`}
                style={{ animation: 'fadeSlideUp 0.25s cubic-bezier(0.16,1,0.3,1) both' }}>
                {m.role === 'system' ? (
                  <span className="text-xs px-3 py-1 rounded-full"
                    style={{ background: LC.beige, color: LC.textSub }}>
                    {m.content}
                  </span>
                ) : (
                  <div className="max-w-[88%]">
                    {/* assistant + code モード + 折りたたみ対象 → ファイルサマリーカード表示 */}
                    {m.role === 'assistant' && mode === 'code' && fileSummaries[i] && !m.streaming && (
                      <div className="mb-2 rounded-2xl px-3.5 py-3"
                        style={{ background: '#F0FDF4', border: `1px solid #BBF7D0` }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: LC.success }}>✅ 変更ファイル ({fileSummaries[i].length}件)</p>
                        {fileSummaries[i].map((f, fi) => (
                          <p key={fi} className="text-xs font-mono truncate leading-relaxed" style={{ color: '#059669' }}>{f}</p>
                        ))}
                      </div>
                    )}
                    <div className="rounded-2xl px-4 py-3"
                      style={m.role === 'user'
                        ? { background: mode === 'chat' ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : `linear-gradient(135deg, ${LC.sky}, #0284C7)`, borderBottomRightRadius: 4, color: 'white' }
                        : { background: LC.surface, border: `1px solid ${LC.border}`, borderBottomLeftRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      {/* 折りたたみ表示 */}
                      {m.role === 'assistant' && mode === 'code' && collapsedOutputs.has(i) && !m.streaming ? (
                        <>
                          <pre className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed line-clamp-3" style={{ color: LC.textSub }}>
                            {m.content.split('\n').slice(0, 3).join('\n')}
                          </pre>
                          <button onClick={() => setCollapsedOutputs(prev => { const s = new Set(prev); s.delete(i); return s; })}
                            className="mt-2 text-xs active:opacity-60" style={{ color: LC.sky }}>
                            全文を見る ({m.content.split('\n').length}行) ↓
                          </button>
                        </>
                      ) : (
                        <>
                          <pre className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed" style={{ color: m.role === 'user' ? 'white' : LC.text }}>{m.content}</pre>
                          {m.role === 'assistant' && mode === 'code' && !m.streaming && m.content.split('\n').length > 6 && !collapsedOutputs.has(i) && (
                            <button onClick={() => setCollapsedOutputs(prev => new Set([...prev, i]))}
                              className="mt-2 text-xs active:opacity-60" style={{ color: LC.textMuted }}>
                              折りたたむ ↑
                            </button>
                          )}
                        </>
                      )}
                      {m.streaming && (
                        <span className="inline-block w-2 h-4 ml-0.5 align-middle"
                          style={{ background: mode === 'chat' ? LC.warning : LC.sky, animation: 'blink 0.7s step-end infinite' }} />
                      )}
                    </div>
                    {m.ts && !m.streaming && (
                      <p className={`text-xs mt-1 ${m.role === 'user' ? 'text-right' : 'text-left'}`} style={{ color: LC.textMuted }}>
                        {new Date(m.ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {mode === 'code' && summaries[i] && (
                      <div className="mt-2 rounded-xl px-3 py-2 text-xs leading-relaxed"
                        style={{ background: LC.skyLight, border: `1px solid rgba(14,165,233,0.25)`, color: '#0369A1' }}>
                        <span className="font-semibold mr-1">✦ Gemini要約</span>
                        {summaries[i]}
                      </div>
                    )}
                    {m.role === 'assistant' && !m.streaming && (
                      <div className="flex gap-1 mt-1">
                        {/* ワンタップでコピー */}
                        <button onClick={async () => {
                          try { await navigator.clipboard.writeText(m.content); }
                          catch { /* ignore */ }
                          setCopiedMsgIdx(i);
                          haptic(15);
                          setTimeout(() => setCopiedMsgIdx(prev => prev === i ? null : prev), 1500);
                        }}
                          title="コピー"
                          className="h-6 px-2 rounded-lg flex items-center gap-1 active:scale-90 transition-all"
                          style={{ background: copiedMsgIdx === i ? 'rgba(16,185,129,0.15)' : LC.skyLight }}>
                          {copiedMsgIdx === i
                            ? <><Check size={10} style={{ color: LC.success }} /><span style={{ fontSize: 10, color: LC.success }}>コピー済</span></>
                            : <><Copy size={10} style={{ color: '#0369A1' }} /><span style={{ fontSize: 10, color: '#0369A1' }}>コピー</span></>}
                        </button>
                        {ttsEnabled && (
                          <button onClick={() => speakText(m.content)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center active:scale-90 opacity-40 hover:opacity-100 transition-opacity"
                            style={{ background: LC.beigeAlt }}>
                            <Volume2 size={10} style={{ color: LC.textSub }} />
                          </button>
                        )}
                        <button onClick={() => saveMemory(m.content.slice(0, 200))}
                          title="メモリに保存"
                          className="w-6 h-6 rounded-lg flex items-center justify-center active:scale-90 opacity-40 hover:opacity-100 transition-opacity"
                          style={{ background: LC.beigeAlt }}>
                          <Plus size={10} style={{ color: LC.textSub }} />
                        </button>
                        {/* 機能7: スニペット共有 */}
                        <button onClick={async () => {
                          try {
                            const res = await fetch('/api/bridge/share', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ content: m.content }),
                            });
                            const data = await res.json() as { id: string };
                            const url = `${window.location.origin}/api/bridge/share?id=${data.id}`;
                            await navigator.clipboard.writeText(url);
                          } catch { /* ignore */ }
                        }}
                          title="共有リンクをコピー"
                          className="w-6 h-6 rounded-lg flex items-center justify-center active:scale-90 opacity-40 hover:opacity-100 transition-opacity"
                          style={{ background: LC.beigeAlt }}>
                          <span style={{ fontSize: 10 }}>🔗</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {mode === 'code' && running && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm px-4 py-3 max-w-[88%]"
                  style={{ background: LC.surface, border: `1px solid ${LC.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  {/* フェーズヒント */}
                  <p className="text-xs font-semibold mb-1.5" style={{ color: LC.sky }}>
                    {runElapsed < 5 ? 'コードベースを読んでいます...' :
                     runElapsed < 15 ? '問題を分析しています...' :
                     runElapsed < 30 ? '実装を計画しています...' :
                     runElapsed < 60 ? 'ファイルを書き換えています...' :
                     '動作確認しています...'}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 0.15, 0.3].map((d, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full"
                          style={{ background: LC.sky, animation: `bounce 1s ease ${d}s infinite` }} />
                      ))}
                    </div>
                    <span className="text-[11px]" style={{ color: LC.textMuted }}>{runElapsed}s 経過</span>
                  </div>
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
                  style={{ background: LC.skyLight, border: `1px solid rgba(14,165,233,0.3)`, color: '#0369A1' }}>
                  <Users size={11} />この会話を AI Team に渡す
                </button>
              </div>
            )}
            {mode === 'chat' && chatRunning && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="flex gap-1.5 px-4 py-3 rounded-2xl rounded-bl-sm"
                  style={{ background: LC.surface, border: `1px solid ${LC.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  {[0, 0.15, 0.3].map((d, i) => (
                    <div key={i} className="w-2 h-2 rounded-full"
                      style={{ background: LC.warning, animation: `bounce 1s ease ${d}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 機能1: Diff ビューア */}
          {diffResult && <DiffViewer stat={diffResult.stat} diff={diffResult.diff} onClose={() => setDiffResult(null)} />}

          {/* 量子思考エンジン */}
          {showQuantumBrain && (
            <QuantumBrain
              goal={quantumGoal}
              project={currentProject?.name || ''}
              adminSecret={ADMIN_SECRET}
              onClose={() => setShowQuantumBrain(false)}
              onApply={(text) => {
                setInput(text);
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                  textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
                }
              }}
            />
          )}

          {/* ゴール分解モーダル */}
          {showDecomposer && decomposePlan && (
            <GoalDecomposer
              goal={decomposeGoal}
              plan={decomposePlan}
              statuses={decomposeStatuses}
              outputs={decomposeOutputs}
              running={decomposeBatchRunning}
              onStart={executeBatch}
              onAbort={abortBatch}
              onClose={() => setShowDecomposer(false)}
            />
          )}

          {/* ↓ 新着ボタン */}
          {newMsgPending && (mode === 'code' || mode === 'chat') && (
            <button
              onClick={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setNewMsgPending(false); setIsAtBottom(true); }}
              className="absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg active:scale-95 transition-all"
              style={{ bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 8px) + 120px)', background: LC.sky, backdropFilter: 'blur(8px)' }}>
              ↓ 新着メッセージ
            </button>
          )}

          {/* コード検索パネル (Chat モード) */}
          {mode === 'chat' && searchQuery !== '' && (
            <div className="px-3 py-3 space-y-2" style={{ borderTop: `1px solid ${LC.border}`, background: LC.surface }}>
              <div className="flex gap-2">
                <input value={searchQuery.trim()} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCodeSearch(); if (e.key === 'Escape') { setSearchQuery(''); setSearchResults([]); } }}
                  placeholder="キーワードで検索..."
                  className="flex-1 h-8 px-3 rounded-lg text-xs outline-none"
                  style={{ background: LC.beigeAlt, border: `1px solid ${LC.border}`, color: LC.text }} />
                <button onClick={handleCodeSearch} disabled={searching || !macOnline}
                  className="px-3 h-8 rounded-lg text-xs active:scale-90 disabled:opacity-40 transition-all"
                  style={{ background: 'rgba(16,185,129,0.1)', color: LC.success }}>
                  {searching ? '検索中...' : '検索'}
                </button>
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90"
                  style={{ background: LC.beigeAlt, color: LC.textMuted }}>
                  <XIcon size={12} />
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg"
                      style={{ background: attachedContext.some(c => c.path === r.path) ? '#F0FDF4' : LC.beigeAlt }}>
                      <span className="text-xs font-mono truncate flex-1" style={{ color: LC.textSub }}>{r.path}</span>
                      <button onClick={() => setAttachedContext(prev => prev.some(c => c.path === r.path) ? prev.filter(c => c.path !== r.path) : [...prev, r])}
                        className="flex-shrink-0 text-xs px-2 py-0.5 rounded-lg transition-all active:scale-90"
                        style={{ background: attachedContext.some(c => c.path === r.path) ? 'rgba(16,185,129,0.15)' : LC.surface, color: attachedContext.some(c => c.path === r.path) ? LC.success : LC.textSub }}>
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
            <div className="px-3 py-2 max-h-24 overflow-y-auto" style={{ borderTop: `1px solid ${LC.border}`, background: 'rgba(245,158,11,0.05)' }}>
              <p className="text-xs mb-1" style={{ color: LC.warning }}>自律実行 — ステップ {autonomousStep + 1}</p>
              {autonomousLog.map((l, i) => (
                <p key={i} className="text-xs truncate" style={{ color: LC.textSub }}><span className="mr-1" style={{ color: LC.warning }}>{i + 1}.</span>{l}</p>
              ))}
            </div>
          )}

          {/* hidden file inputs */}
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
          <input ref={visualInputRef} type="file" accept="image/*" className="hidden" onChange={handleVisualCapture} />

          {/* 入力エリア（code / chat のみ） */}
          {(mode === 'code' || mode === 'chat') && (
            <div className="flex-shrink-0 relative"
              style={{ backdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.9)', borderTop: `1px solid ${LC.border}` }}>

              {/* アクティブバッジ行 */}
              {(enhanceMode || confirmMode || autonomousMode || parallelMode || watchdogActive || ttsEnabled || attachedContext.length > 0 || presets.length > 0) && (
                <div className="flex items-center gap-1.5 px-3 pt-2 pb-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {enhanceMode    && <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ background: LC.skyLight, color: '#0369A1' }}><Sparkles size={9} />強化</span>}
                  {ttsEnabled     && <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ background: LC.skyLight, color: LC.sky }}><Volume2 size={9} />読上げ</span>}
                  {confirmMode    && <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ background: 'rgba(239,68,68,0.08)', color: LC.error }}><AlertTriangle size={9} />確認</span>}
                  {autonomousMode && <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ background: 'rgba(245,158,11,0.1)', color: LC.warning }}><Cpu size={9} />自律</span>}
                  {parallelMode   && <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ background: LC.skyLight, color: LC.sky }}><MonitorCheck size={9} />並列</span>}
                  {watchdogActive && <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ background: 'rgba(239,68,68,0.08)', color: LC.error }}><Radio size={9} className="animate-pulse" />監視</span>}
                  {attachedContext.length > 0 && (
                    <button onClick={() => setAttachedContext([])} className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] active:scale-90" style={{ background: '#F0FDF4', color: LC.success }}>
                      📎{attachedContext.length}件 ✕
                    </button>
                  )}
                  {presets.length > 0 && presets.map((p, i) => (
                    <button key={i} onClick={() => setInput(p)}
                      className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] active:scale-90 whitespace-nowrap"
                      style={{ background: LC.beigeAlt, color: LC.textSub }}>
                      {p.length > 14 ? p.slice(0, 14) + '…' : p}
                    </button>
                  ))}
                </div>
              )}

              {/* アタッチメントメニュー */}
              {showAttachMenu && (
                <div className="absolute bottom-full left-3 mb-2 z-50 rounded-2xl overflow-hidden"
                  style={{ background: LC.surface, border: `1px solid ${LC.border}`, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', backdropFilter: 'blur(20px)', minWidth: 200 }}>
                  {[
                    { icon: <span style={{ fontSize: 15 }}>⚛</span>, label: '量子思考',  color: '#818CF8', action: () => { if (!input.trim()) return; setQuantumGoal(input.trim()); setShowAttachMenu(false); setShowQuantumBrain(true); }, disabled: !input.trim() },
                    { icon: <Zap size={16} />,    label: 'ゴール分解',        color: '#F59E0B', action: () => { setShowAttachMenu(false); handleDecompose(); }, disabled: !input.trim() || !macOnline || decomposing },
                    { icon: <Camera size={16} />, label: 'スクショ → Code',  color: LC.sky, action: () => { cameraInputRef.current?.click(); setShowAttachMenu(false); } },
                    { icon: <Users size={16} />,  label: 'スクショ → Team',  color: '#A78BFA', action: () => { visualInputRef.current?.click(); setShowAttachMenu(false); } },
                    { icon: <Mic size={16} />,    label: '音声入力',          color: voiceRecording ? LC.error : LC.textMuted, action: () => { handleVoice(); setShowAttachMenu(false); } },
                    { icon: <Radio size={16} />,  label: 'AI音声アシスタント', color: LC.success, action: () => { setShowRealtimeVoice(true); setShowAttachMenu(false); } },
                    { icon: <SlidersHorizontal size={16} />, label: 'ツール設定', color: (enhanceMode||confirmMode||autonomousMode||parallelMode||watchdogActive||ttsEnabled) ? LC.sky : LC.textMuted, action: () => { setShowToolSheet(true); setShowAttachMenu(false); } },
                  ].map((item, i) => (
                    <button key={i} onClick={(item as { disabled?: boolean }).disabled ? undefined : item.action}
                      disabled={(item as { disabled?: boolean }).disabled}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left disabled:opacity-40"
                      style={{ borderBottom: i < 6 ? `1px solid ${LC.border}` : 'none', background: 'transparent' }}
                      onMouseEnter={e => { if (!(item as { disabled?: boolean }).disabled) e.currentTarget.style.background = LC.beigeAlt; }}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ color: item.color }}>{item.icon}</span>
                      <span className="text-sm" style={{ color: LC.text }}>{item.label}</span>
                      {item.label === 'ゴール分解' && decomposing && (
                        <span className="ml-auto text-[10px] animate-pulse" style={{ color: '#F59E0B' }}>分解中...</span>
                      )}
                      {item.label === 'ツール設定' && (enhanceMode||confirmMode||autonomousMode||parallelMode||watchdogActive||ttsEnabled) && (
                        <span className="ml-auto w-2 h-2 rounded-full" style={{ background: LC.sky }} />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {showAttachMenu && <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />}

              {/* メイン入力行 */}
              <div className="flex gap-2 items-end px-3 py-2.5">
                {/* モデル切り替え（code モードのみ） */}
                {mode === 'code' && (
                  <button
                    onClick={() => setCodeModel(m => m === 'claude-haiku-4-5-20251001' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001')}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold flex-shrink-0 transition-all active:scale-90"
                    style={codeModel === 'claude-haiku-4-5-20251001'
                      ? { background: LC.beige, border: `1px solid ${LC.beigeStrong}`, color: LC.textSub }
                      : { background: LC.skyLight, border: `1px solid ${LC.skyMid}`, color: LC.sky }}>
                    {codeModel === 'claude-haiku-4-5-20251001' ? '⚡' : '◑'}
                  </button>
                )}
                {/* + ボタン */}
                <button
                  onClick={() => setShowAttachMenu(v => !v)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                  style={{
                    background: showAttachMenu ? LC.skyLight : LC.beige,
                    border: showAttachMenu ? `1px solid ${LC.skyMid}` : `1px solid ${LC.border}`,
                  }}>
                  <Plus size={20} style={{ color: showAttachMenu ? LC.sky : LC.textSub, transform: showAttachMenu ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                </button>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                  /* Enter は改行のみ。送信は送信ボタンからのみ（誤送信防止） */
                  placeholder={mode === 'chat' ? 'Claude に質問...（送信ボタンで送信）' : '指示を入力...（送信ボタンで送信）'}
                  rows={1}
                  disabled={mode === 'code' ? (running || !macOnline) : chatRunning}
                  className="flex-1 rounded-xl px-3.5 py-2.5 text-sm resize-none outline-none transition-all disabled:opacity-30"
                  style={{ background: LC.bg, border: `1px solid ${LC.border}`, color: LC.text, minHeight: '44px', maxHeight: '120px' }}
                />

                {/* 送信ボタン */}
                <button
                  onClick={() => mode === 'chat' ? handleChatSend() : handleSend()}
                  disabled={mode === 'code' ? (running || !input.trim() || !macOnline) : (chatRunning || !input.trim())}
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm text-white transition-all active:scale-90 disabled:opacity-30 flex-shrink-0"
                  style={mode === 'chat'
                    ? { background: 'linear-gradient(135deg, #F59E0B, #EF4444)', boxShadow: input.trim() ? '0 0 15px rgba(245,158,11,0.25)' : 'none' }
                    : { background: `linear-gradient(135deg, ${LC.sky}, #0284C7)`, boxShadow: input.trim() ? '0 0 15px rgba(14,165,233,0.25)' : 'none' }}>
                  {(running || chatRunning || enhancing)
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <ChevronRight size={18} />}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── ボトムナビゲーション ─── */}
      {view === 'chat' && (
        <div className="flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(24px)', borderTop: `1px solid ${LC.border}`, paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}>
          <div className="flex">
            {([
              { id: 'home',  label: 'Home',  icon: Home,              color: LC.sky },
              { id: 'code',  label: 'Code',  icon: MonitorSmartphone, color: LC.sky },
              { id: 'chat',  label: 'Chat',  icon: Bot,               color: LC.warning },
              { id: 'team',  label: 'Team',  icon: Users,             color: LC.sky },
              { id: 'more',  label: 'More',  icon: MoreHorizontal,    color: LC.sky },
            ] as { id: string; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string }[]).map(tab => {
              const isMore = tab.id === 'more';
              const isActive = isMore
                ? (['git', 'files', 'schedule', 'tools', 'github', 'pm', 'brain', 'production', 'concierge', 'prompts', 'history'] as string[]).includes(mode)
                : mode === tab.id;
              const Icon = tab.icon;
              return (
                <button key={tab.id}
                  onClick={() => {
                    if (isMore) { setShowMoreMenu(true); return; }
                    const m = tab.id as typeof mode;
                    setMode(m);
                    if (m === 'team' && !fileTree && macOnline) send({ type: 'file_tree', mac_id: selectedMacId || undefined });
                  }}
                  className="flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-all active:scale-90 relative select-none">
                  {tab.id === 'team' && (orchestrateRunning || orchestrateComplete) && (
                    <span className="absolute top-2 right-[calc(50%-14px)] w-2 h-2 rounded-full"
                      style={{ background: orchestrateRunning ? LC.sky : LC.success, boxShadow: orchestrateRunning ? `0 0 6px ${LC.sky}` : 'none', animation: orchestrateRunning ? 'pulse 1.5s ease infinite' : 'none' }} />
                  )}
                  {tab.id === 'code' && running && (
                    <span className="absolute top-2 right-[calc(50%-14px)] w-2 h-2 rounded-full animate-pulse" style={{ background: LC.sky }} />
                  )}
                  <Icon size={22} style={{ color: isActive ? tab.color : LC.textMuted }} />
                  <span className="text-xs font-medium" style={{ color: isActive ? tab.color : LC.textMuted }}>{tab.label}</span>
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

      {/* ─── グローバル実行インジケーター ─── */}
      {view === 'chat' && (
        <>
          {running && mode !== 'code' && (
            <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-auto" style={{ animation: 'fadeSlideUp 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
              <button onClick={() => setMode('code')}
                className="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg"
                style={{ background: LC.sky, backdropFilter: 'blur(16px)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-xs font-semibold">Claude Code 実行中</span>
                <span className="text-white/70 text-xs">→ Code</span>
              </button>
            </div>
          )}
          {orchestrateRunning && mode !== 'team' && (
            <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-auto" style={{ animation: 'fadeSlideUp 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
              <button onClick={() => setMode('team')}
                className="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg"
                style={{ background: '#818CF8', backdropFilter: 'blur(16px)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-xs font-semibold">AI Team 実行中 — {orchestratePhase}</span>
                <span className="text-white/70 text-xs">→ Team</span>
              </button>
            </div>
          )}
          {currentProject && macOnline && !showRealtimeVoice && mode !== 'code' && mode !== 'chat' && (
            <button onClick={() => setShowRealtimeVoice(true)}
              className="fixed right-4 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-all"
              style={{
                bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 8px) + 64px)',
                background: `linear-gradient(135deg, ${LC.success}, ${LC.sky})`,
                boxShadow: `0 0 20px rgba(16,185,129,0.3)`,
              }}
              title="音声アシスタント">
              <Mic size={18} className="text-white" />
            </button>
          )}
        </>
      )}

      {/* ─── I: Git Checkpoint Toast ─── */}
      {cpToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          style={{ animation: 'slideUp 0.2s ease' }}>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-xl"
            style={{ background: cpToast.success ? LC.success : LC.error, color: 'white', backdropFilter: 'blur(10px)' }}>
            <GitCommit size={12} />
            <span>{cpToast.success ? `✓ ${cpToast.phase} — git checkpoint 保存` : `✗ ${cpToast.phase} — checkpoint 失敗`}</span>
          </div>
        </div>
      )}

      {/* ─── Visual Capture モーダル ─── */}
      {visualCapturing && visualPreview && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => { setVisualCapturing(false); setVisualPreview(null); }}>
          <div className="w-full rounded-t-3xl overflow-hidden"
            style={{ background: LC.surface, border: `1px solid ${LC.border}`, paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)', animation: 'slideUp 0.22s ease', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-3"><div className="w-10 h-1 rounded-full" style={{ background: LC.border }} /></div>
            <div className="px-4 pb-2">
              <p className="font-bold text-sm mb-3" style={{ color: LC.text }}>Visual → AI Team</p>
              <img src={`data:${visualMime};base64,${visualPreview}`} alt="preview"
                className="w-full max-h-48 object-contain rounded-xl mb-4"
                style={{ border: `1px solid ${LC.border}` }} />
              <p className="text-xs mb-4" style={{ color: LC.textMuted }}>この画像を分析してAI Teamの実装指示を自動生成します</p>
              <div className="flex gap-2">
                <button onClick={() => { setVisualCapturing(false); setVisualPreview(null); }}
                  className="px-4 py-3 rounded-xl text-sm active:scale-95"
                  style={{ background: LC.beigeAlt, color: LC.textSub }}>キャンセル</button>
                <button onClick={analyzeVisual} disabled={visualAnalyzing}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${LC.sky}, #0284C7)` }}>
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
            style={{ background: LC.surface, border: `1px solid ${LC.border}`, paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)', animation: 'slideUp 0.22s ease', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-5"><div className="w-10 h-1 rounded-full" style={{ background: LC.beigeStrong }} /></div>
            <p className="text-xs tracking-widest uppercase text-center mb-4" style={{ color: LC.textMuted }}>その他のパネル</p>
            <div className="grid grid-cols-4 gap-2 px-4 pb-6">
              {([
                { id: 'files',      label: 'ファイル',  icon: FolderOpen, color: '#A78BFA', onSelect: () => { if (fileEntries.length === 0 && macOnline) { setFileLoading(true); send({ type: 'file_list', path: '', mac_id: selectedMacId || undefined }); } } },
                { id: 'tools',      label: 'ツール',    icon: Wrench,     color: '#F87171', onSelect: () => {} },
                { id: 'schedule',   label: '予約',      icon: Clock,      color: LC.warning, onSelect: () => {} },
                { id: 'github',     label: 'GitHub',    icon: GitBranch,  color: '#C084FC', onSelect: () => {} },
                { id: 'pm',         label: 'AI PM',     icon: Target,     color: '#FB923C', onSelect: () => {} },
                { id: 'brain',      label: 'Brain',     icon: Brain,      color: '#A78BFA', onSelect: () => { if (macOnline) send({ type: 'brain_status', mac_id: selectedMacId || undefined }); } },
                { id: 'git',        label: 'Git',       icon: GitBranch,  color: LC.success, onSelect: () => { if (macOnline) { setGitLoading(true); send({ type: 'git_status', mac_id: selectedMacId || undefined }); send({ type: 'git_diff', mac_id: selectedMacId || undefined }); } } },
                { id: 'production', label: '本番監視',  icon: Activity,   color: LC.success, onSelect: () => {} },
                { id: 'concierge',  label: 'ガイド',    icon: Bot,        color: LC.sky,    onSelect: () => {} },
                { id: 'prompts',    label: 'Prompts',   icon: Star,       color: LC.warning, onSelect: () => {} },
              ] as { id: string; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string; onSelect: () => void }[]).map(item => {
                const Icon = item.icon;
                const isActive = mode === item.id;
                return (
                  <button key={item.id} onClick={() => { item.onSelect(); setMode(item.id as typeof mode); setShowMoreMenu(false); }}
                    className="flex flex-col items-center py-4 rounded-2xl active:scale-95 transition-all gap-2"
                    style={{ background: isActive ? `${item.color}15` : LC.beigeAlt, border: `1px solid ${isActive ? item.color + '50' : LC.border}` }}>
                    <Icon size={26} style={{ color: isActive ? item.color : LC.textMuted }} />
                    <span className="text-xs font-medium" style={{ color: isActive ? item.color : LC.textSub }}>{item.label}</span>
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
            style={{ background: LC.surface, border: `1px solid ${LC.border}`, paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)', animation: 'slideUp 0.22s ease', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-4"><div className="w-10 h-1 rounded-full" style={{ background: LC.beigeStrong }} /></div>
            <p className="text-xs tracking-widest uppercase text-center mb-4" style={{ color: LC.textMuted }}>ツール設定</p>
            <div className="px-4 pb-6 space-y-3">
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
                    style={{ background: item.active ? LC.skyLight : LC.beigeAlt, border: `1px solid ${item.active ? LC.skyMid : LC.border}`, color: item.active ? '#0369A1' : LC.textSub }}>
                    <span className="text-base leading-none">{item.label.slice(0, 2)}</span>
                    <span className="text-xs font-medium">{item.label.slice(3)}</span>
                  </button>
                ))}
              </div>

              {/* モデル選択 */}
              <div className="rounded-2xl px-4 py-3 space-y-2" style={{ background: LC.bg, border: `1px solid ${LC.border}` }}>
                <p className="text-xs" style={{ color: LC.textMuted }}>モデル選択</p>
                <div className="flex gap-2">
                  {mode === 'code' ? (
                    ['', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-8'].map((m, i) => {
                      const labels = ['Default', 'Haiku', 'Sonnet', 'Opus'];
                      return (
                        <button key={m} onClick={() => { setCodeModel(m); setShowToolSheet(false); }}
                          className="flex-1 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
                          style={{ background: codeModel === m ? LC.skyLight : LC.surface, border: `1px solid ${codeModel === m ? LC.skyMid : LC.border}`, color: codeModel === m ? LC.sky : LC.textSub }}>
                          {labels[i]}
                        </button>
                      );
                    })
                  ) : (
                    CLAUDE_MODELS.map(m => (
                      <button key={m.id} onClick={() => { setChatModel(m.id); setShowToolSheet(false); }}
                        className="flex-1 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
                        style={{ background: chatModel === m.id ? 'rgba(245,158,11,0.1)' : LC.surface, border: `1px solid ${chatModel === m.id ? LC.warning : LC.border}`, color: chatModel === m.id ? LC.warning : LC.textSub }}>
                        {m.label.split(' ')[0]}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {mode === 'code' && (
                <div className="flex gap-2">
                  {macList.length > 1 && (
                    <select value={selectedMacId} onChange={e => setSelectedMacId(e.target.value)}
                      className="flex-1 h-11 px-3 rounded-xl text-xs outline-none"
                      style={{ background: LC.bg, border: `1px solid ${LC.border}`, color: LC.textSub }}>
                      {macList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  )}
                  <button onClick={() => { setLiveOpen(true); setShowToolSheet(false); }} disabled={running}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium active:scale-95 disabled:opacity-40"
                    style={{ background: LC.skyLight, border: `1px solid ${LC.skyMid}`, color: LC.sky }}>
                    <Radio size={14} /><span>Gemini Live</span>
                  </button>
                </div>
              )}

              {/* iOS ショートカット設定 */}
              {(() => {
                const apiUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/bridge/quick` : '';
                const exampleBody = JSON.stringify({ secret: '(Bridge PIN)', project: currentProject?.id || '(project ID)', input: '(指示内容)' }, null, 2);
                const [cpStep, setCpStep] = useState<number | null>(null);
                const copyStep = (text: string, i: number) => { navigator.clipboard.writeText(text).catch(() => {}); setCpStep(i); setTimeout(() => setCpStep(null), 1500); };
                return (
                  <div className="rounded-2xl p-4 space-y-3" style={{ background: LC.beige, border: `1px solid ${LC.border}` }}>
                    <p className="font-semibold text-sm" style={{ color: LC.text }}>📱 iOS ショートカット設定</p>
                    <p className="text-xs" style={{ color: LC.textSub }}>Bridge を開かなくても iPhone からタスクを送れます。</p>
                    {[
                      { label: '① ショートカットアプリ → 新規 → 「URLの内容を取得」', copy: null },
                      { label: '② URL（コピーして貼り付け）', copy: apiUrl },
                      { label: '③ メソッド: POST　ヘッダー: Content-Type = application/json', copy: null },
                      { label: '④ 本文 (JSON) をコピーして編集', copy: exampleBody },
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-[11px] leading-relaxed" style={{ color: LC.textSub }}>{step.label}</p>
                        </div>
                        {step.copy && (
                          <button onClick={() => copyStep(step.copy!, i)}
                            className="flex-shrink-0 text-[10px] px-2 py-1 rounded-lg active:scale-90 transition-all"
                            style={{ background: cpStep === i ? 'rgba(16,185,129,0.15)' : LC.beigeAlt, color: cpStep === i ? LC.success : LC.textSub, border: `1px solid ${LC.border}` }}>
                            {cpStep === i ? '✓' : 'コピー'}
                          </button>
                        )}
                      </div>
                    ))}
                    <p className="text-[10px] pt-1" style={{ color: LC.textMuted }}>
                      ※ 実行中は Bridge を開かなくてOK。完了後に Push 通知が届きます。
                    </p>
                  </div>
                );
              })()}
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
        @keyframes fadeSlideUp {
          from { opacity:0; transform:translateY(16px); }
          to { opacity:1; transform:translateY(0); }
        }
        @keyframes panelIn {
          from { opacity:0; transform:translateY(10px) scale(0.99); }
          to { opacity:1; transform:translateY(0) scale(1); }
        }
        .panel-enter { animation: panelIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes pulse {
          0%,100% { opacity:0.4; } 50% { opacity:0.8; }
        }
        @keyframes orbFloat {
          0%,100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
