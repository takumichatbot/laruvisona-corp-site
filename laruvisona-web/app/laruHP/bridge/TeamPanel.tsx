'use client';
import { useState, useEffect, useRef } from 'react';
import { Users, Play, Square, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, Zap, RotateCcw, AlertCircle, MessageSquare, Send, FlaskConical, Eye, Terminal, GitCommit, ShieldAlert, ShieldCheck } from 'lucide-react';

export interface OrchestrateTask {
  id: string; agent_name: string; title: string; instruction: string;
  files_to_create: string[]; files_to_modify: string[];
}
export interface OrchestratePhase {
  id: string; name: string; description: string; parallel: boolean; tasks: OrchestrateTask[];
}
export interface OrchestratePlan {
  title: string; description: string; phases: OrchestratePhase[];
}
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

interface HistoryEntry { directive: string; planTitle: string; success: boolean; ts: number; }

export interface MacInfo { id: string; name: string; }

interface Props {
  macOnline: boolean; projectName: string; fileTree: string;
  onSend: (msg: Record<string, unknown>) => void;
  orchestrateRunning: boolean; orchestratePhase: string;
  taskStatuses: Record<string, TaskStatus>; taskOutputs: Record<string, string>;
  orchestrateComplete: boolean; orchestrateReviewResult: string;
  orchestrateTestResult: { output: string; passed: boolean } | null;
  onResetOrchestrate: () => void;
  initialDirective?: string;
  macList?: MacInfo[];
  phaseEstimates?: Record<string, number>;
  checkpoints?: Record<string, { success: boolean; message: string }>;
}

const EXAMPLES = [
  '月額¥999のサブスクリプション機能をStripe決済で追加。ProはAPI使い放題、Freeは月10回まで。',
  'ユーザー認証をNextAuth v5に移行し、Google・GitHubログインを追加する。',
  'APIレート制限をRedisで実装。IPごとに1時間100リクエスト上限。',
  'ダッシュボードページを追加。統計グラフ・アクティビティログ・KPIカードを表示。',
];

const PHASE_COLORS = ['#6366f1', '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'];

function estimateCost(plan: OrchestratePlan) {
  const tasks = plan.phases.reduce((s, p) => s + p.tasks.length, 0) + 1; // +1 review agent
  const avgInstrTokens = plan.phases.reduce((s, p) =>
    s + p.tasks.reduce((ts, t) => ts + Math.ceil(t.instruction.length / 4), 0), 0
  ) / Math.max(1, tasks - 1);
  const inputPerAgent = avgInstrTokens + 3000;
  const outputPerAgent = 2500;
  const usd = (inputPerAgent * tasks * 3 + outputPerAgent * tasks * 15) / 1_000_000;
  return { usd, jpy: Math.round(usd * 150), tokens: Math.round((inputPerAgent + outputPerAgent) * tasks / 1000) };
}

const HIST_KEY = 'bridge_orch_history';
function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch { return []; }
}
function saveHistory(entry: HistoryEntry) {
  const h = loadHistory();
  localStorage.setItem(HIST_KEY, JSON.stringify([entry, ...h].slice(0, 6)));
}

// J: Risk analysis helper
function phaseRisk(phase: OrchestratePhase): { level: 'low' | 'medium' | 'high'; tags: string[] } {
  const text = [phase.name, phase.description, ...phase.tasks.map(t => t.title + ' ' + t.instruction)].join(' ').toLowerCase();
  const tags: string[] = [];
  if (/auth|login|password|session|jwt|secret|oauth/.test(text)) tags.push('認証');
  if (/db|database|migration|schema|prisma|sql|model/.test(text)) tags.push('DB');
  if (/payment|stripe|billing|subscription/.test(text)) tags.push('決済');
  if (/delete|drop|remov|truncat/.test(text)) tags.push('削除');
  if (/api|route|endpoint|middleware/.test(text)) tags.push('API');
  return { level: tags.length >= 2 ? 'high' : tags.length === 1 ? 'medium' : 'low', tags: tags.slice(0, 3) };
}

export default function TeamPanel({
  macOnline, projectName, fileTree, onSend,
  orchestrateRunning, orchestratePhase, taskStatuses, taskOutputs,
  orchestrateComplete, orchestrateReviewResult, orchestrateTestResult,
  onResetOrchestrate, initialDirective, macList = [],
  phaseEstimates = {}, checkpoints = {},
}: Props) {
  const [step, setStep] = useState<'input' | 'planning' | 'review' | 'executing' | 'done'>('input');
  const [directive, setDirective] = useState('');
  const [plan, setPlan] = useState<OrchestratePlan | null>(null);
  const [planError, setPlanError] = useState('');
  const [planModel, setPlanModel] = useState('claude-sonnet-4-6');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [svInput, setSvInput] = useState('');
  const [svMessages, setSvMessages] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [showTestOutput, setShowTestOutput] = useState(false);
  const [phaseAssignments, setPhaseAssignments] = useState<Record<string, string>>({});
  const [liveExpanded, setLiveExpanded] = useState(true);
  const svRef = useRef<HTMLInputElement>(null);
  const liveTermRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHistory(loadHistory()); }, []);

  useEffect(() => {
    if (initialDirective && initialDirective.trim()) {
      setDirective(initialDirective);
      setStep('input');
    }
  }, [initialDirective]);

  useEffect(() => {
    if (orchestrateRunning && step !== 'executing') setStep('executing');
  }, [orchestrateRunning, step]);

  // F: Auto-scroll live terminal on new output
  useEffect(() => {
    if (liveTermRef.current) {
      liveTermRef.current.scrollTop = liveTermRef.current.scrollHeight;
    }
  }, [taskOutputs]);

  useEffect(() => {
    if (orchestrateComplete && step === 'executing') {
      setStep('done');
      if (plan) {
        const failed = Object.values(taskStatuses).filter(s => s === 'failed').length;
        saveHistory({ directive, planTitle: plan.title, success: failed === 0, ts: Date.now() });
        setHistory(loadHistory());
      }
    }
  }, [orchestrateComplete, step, plan, directive, taskStatuses]);

  const totalTasks = plan?.phases.reduce((s, p) => s + p.tasks.length, 0) ?? 0;
  const totalWithReview = totalTasks + 1;
  const doneTasks = Object.values(taskStatuses).filter(s => s === 'done' || s === 'failed').length;
  const failedTasks = Object.values(taskStatuses).filter(s => s === 'failed').length;
  const progress = totalWithReview > 0 ? Math.round((doneTasks / totalWithReview) * 100) : 0;

  const generatePlan = async () => {
    if (!directive.trim()) return;
    setStep('planning'); setPlanError('');
    try {
      const res = await fetch('/api/bridge/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directive, projectName, fileTree, model: planModel }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.plan?.phases?.length) throw new Error('プランの生成に失敗しました');
      setPlan(data.plan);
      setStep('review');
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : 'エラー');
      setStep('input');
    }
  };

  const startExecution = () => {
    if (!plan || !macOnline) return;
    onResetOrchestrate();
    setSvMessages([]);
    const assignments = Object.keys(phaseAssignments).length > 0 ? phaseAssignments : undefined;
    onSend({ type: 'orchestrate_start', plan, phaseAssignments: assignments });
    setStep('executing');
  };

  const sendSupervisor = () => {
    if (!svInput.trim()) return;
    onSend({ type: 'orchestrate_inject', context: svInput.trim() });
    setSvMessages(prev => [...prev, svInput.trim()]);
    setSvInput('');
  };

  const reset = () => {
    setStep('input'); setPlan(null); setDirective(''); setPlanError('');
    setSvMessages([]); setShowReview(false); setShowTestOutput(false);
    onResetOrchestrate();
  };

  // ── Input ────────────────────────────────────────────────────────────────
  if (step === 'input' || step === 'planning') {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="text-center pb-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', boxShadow: '0 0 30px rgba(79,70,229,0.35)' }}>
            <Users size={24} className="text-white" />
          </div>
          <p className="text-white font-bold text-base">AI Software Team</p>
          <p className="text-gray-500 text-xs mt-1">{projectName} · 指示ひとつで設計→実装→レビューまで</p>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-gray-700 text-xs px-1">最近のプラン</p>
            {history.slice(0, 3).map((h, i) => (
              <button key={i} onClick={() => setDirective(h.directive)}
                className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2 active:opacity-70 transition-all"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs">{h.success ? '✅' : '⚠️'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-400 text-xs font-medium truncate">{h.planTitle}</p>
                  <p className="text-gray-700 text-xs truncate">{h.directive}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Directive input */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <textarea value={directive} onChange={e => setDirective(e.target.value)}
            placeholder="例: 月額¥999のサブスクリプション機能を追加して。Stripeで決済、ProはAPI使い放題、Freeは月10回まで。"
            className="w-full text-sm text-white resize-none outline-none leading-relaxed placeholder-gray-700"
            style={{ background: 'transparent', minHeight: '90px' }} />
          <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-2">
            <select value={planModel} onChange={e => setPlanModel(e.target.value)}
              className="h-7 px-2 rounded-lg text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
              <option value="claude-haiku-4-5-20251001" style={{ background: '#111' }}>Haiku — 速い</option>
              <option value="claude-sonnet-4-6" style={{ background: '#111' }}>Sonnet — 推奨</option>
              <option value="claude-opus-4-8" style={{ background: '#111' }}>Opus — 最高品質</option>
            </select>
            <span className="text-gray-700 text-xs">{directive.length}文字</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-gray-700 text-xs px-1">例文</p>
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => setDirective(ex)}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs text-gray-500 active:opacity-70"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              {ex}
            </button>
          ))}
        </div>

        {planError && (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs">{planError}</p>
          </div>
        )}

        <button onClick={generatePlan} disabled={!directive.trim() || step === 'planning' || !macOnline}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm active:scale-98 transition-all disabled:opacity-40 flex items-center justify-center gap-3"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 30px rgba(79,70,229,0.25)' }}>
          {step === 'planning'
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />AIが計画を立案中...</>
            : <><Zap size={15} />プランを生成</>}
        </button>
        {!macOnline && <p className="text-center text-gray-600 text-xs">Mac エージェントがオフラインです</p>}
      </div>
    );
  }

  // ── Review ────────────────────────────────────────────────────────────────
  if (step === 'review' && plan) {
    const cost = estimateCost(plan);
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={15} className="text-indigo-400" />
            <p className="text-white font-bold text-sm">{plan.title}</p>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed">{plan.description}</p>
          <div className="flex flex-wrap gap-3 mt-3">
            <span className="text-indigo-400 text-xs">{plan.phases.length} フェーズ</span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-indigo-400 text-xs">{totalTasks} タスク</span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-indigo-400 text-xs">+1 コードレビュー</span>
          </div>
        </div>

        {/* Cost estimate */}
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex-1">
            <p className="text-gray-500 text-xs">推定コスト ({planModel.split('-').slice(-2).join('-')})</p>
            <p className="text-white text-sm font-semibold mt-0.5">¥{cost.jpy} <span className="text-gray-600 font-normal text-xs">(${cost.usd.toFixed(3)})</span></p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs">推定トークン</p>
            <p className="text-gray-300 text-sm font-semibold">{cost.tokens}K</p>
          </div>
        </div>

        {plan.phases.map((phase, pi) => {
          const risk = phaseRisk(phase);
          const riskColor = risk.level === 'high' ? '#f87171' : risk.level === 'medium' ? '#fbbf24' : '#34d399';
          return (
          <div key={phase.id} className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${PHASE_COLORS[pi % PHASE_COLORS.length]}22` }}>
            <div className="px-4 py-2.5 flex items-center gap-2"
              style={{ background: `${PHASE_COLORS[pi % PHASE_COLORS.length]}0d` }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: PHASE_COLORS[pi % PHASE_COLORS.length] }}>{pi + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-white text-sm font-semibold">{phase.name}</p>
                  {risk.level !== 'low' && (
                    <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: `${riskColor}18`, color: riskColor, border: `1px solid ${riskColor}33` }}>
                      <ShieldAlert size={8} />{risk.tags.join('·')}
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs truncate">{phase.description}</p>
              </div>
              {macList.length > 1 ? (
                <select value={phaseAssignments[phase.id] || macList[0]?.id || ''}
                  onChange={e => setPhaseAssignments(prev => ({ ...prev, [phase.id]: e.target.value }))}
                  className="h-6 px-1.5 rounded-lg text-xs outline-none flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', maxWidth: 90 }}>
                  {macList.map(m => <option key={m.id} value={m.id} style={{ background: '#111' }}>{m.name}</option>)}
                </select>
              ) : (
                <span className="text-xs rounded-full px-2 py-0.5 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>
                  {phase.parallel ? '並列' : '順次'}
                </span>
              )}
            </div>
            <div className="px-3 py-2 space-y-1">
              {phase.tasks.map(task => (
                <div key={task.id} className="flex items-start gap-2 rounded-lg px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className="text-sm mt-0.5">🤖</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-gray-300 text-xs font-semibold">{task.agent_name}</p>
                      <span className="text-gray-600 text-xs">—</span>
                      <p className="text-gray-500 text-xs truncate">{task.title}</p>
                    </div>
                    {(task.files_to_create.length > 0 || task.files_to_modify.length > 0) && (
                      <p className="text-gray-700 text-xs font-mono mt-0.5 truncate">
                        {[...task.files_to_create.map(f => `+${f.split('/').pop()}`),
                          ...task.files_to_modify.map(f => `~${f.split('/').pop()}`)].slice(0, 4).join('  ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })}

        <div className="flex gap-2 pt-1">
          <button onClick={reset} className="px-4 py-3 rounded-xl text-sm text-gray-500 active:scale-98"
            style={{ background: 'rgba(255,255,255,0.05)' }}>やり直す</button>
          <button onClick={startExecution} disabled={!macOnline}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white active:scale-98 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #059669, #0284c7)', boxShadow: '0 0 25px rgba(5,150,105,0.3)' }}>
            <Play size={14} fill="white" />
            AIチームを起動
          </button>
        </div>
      </div>
    );
  }

  // ── Executing / Done ──────────────────────────────────────────────────────
  if ((step === 'executing' || step === 'done') && plan) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-bold">{plan.title}</p>
            {orchestratePhase && step === 'executing' && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <p className="text-indigo-400 text-xs">{orchestratePhase}</p>
              </div>
            )}
          </div>
          {step === 'executing' ? (
            <button onClick={() => onSend({ type: 'orchestrate_stop' })}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold active:scale-90"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              <Square size={10} fill="currentColor" />中断
            </button>
          ) : (
            <button onClick={reset} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-gray-500 active:scale-90"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <RotateCcw size={10} />新しい指示
            </button>
          )}
        </div>

        {/* Progress */}
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex justify-between mb-2">
            <span className="text-gray-500 text-xs">{step === 'done' ? '完了' : '進捗'}</span>
            <span className="text-xs font-semibold" style={{ color: failedTasks > 0 ? '#fca5a5' : step === 'done' ? '#34d399' : '#a5b4fc' }}>
              {doneTasks}/{totalWithReview} {failedTasks > 0 ? `(${failedTasks}失敗)` : ''}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, background: failedTasks > 0 ? 'linear-gradient(90deg,#dc2626,#f97316)' : step === 'done' ? 'linear-gradient(90deg,#059669,#34d399)' : 'linear-gradient(90deg,#4f46e5,#7c3aed)' }} />
          </div>
        </div>

        {/* F: Live Terminal — 実行中タスクのリアルタイム出力 */}
        {(() => {
          const runningEntry = plan.phases.flatMap(p => p.tasks.map(t => ({ task: t, phase: p }))).find(({ task }) => taskStatuses[task.id] === 'running');
          const liveOut = runningEntry ? (taskOutputs[runningEntry.task.id] ?? '') : '';
          if (!runningEntry || !liveOut) return null;
          return (
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(2,6,14,0.97)', border: '1px solid rgba(99,102,241,0.4)', boxShadow: '0 0 20px rgba(99,102,241,0.1)' }}>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-indigo-900/40">
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#10b981' }} />
                </div>
                <Terminal size={11} className="text-indigo-500" />
                <span className="text-indigo-400 text-xs font-mono flex-1 truncate">⚡ {runningEntry.task.agent_name} — {runningEntry.task.title}</span>
                <button onClick={() => setLiveExpanded(v => !v)} className="text-gray-700 text-xs active:opacity-60 flex-shrink-0">
                  {liveExpanded ? '▲' : '▼'}
                </button>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              </div>
              {liveExpanded && (
                <div ref={liveTermRef} className="p-3 max-h-36 overflow-y-auto">
                  <pre className="text-emerald-400 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">{liveOut.slice(-1800)}</pre>
                  <span className="text-emerald-400 animate-pulse text-xs font-mono">▋</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Phases + Tasks */}
        {plan.phases.map((phase, pi) => {
          const allDone = phase.tasks.every(t => taskStatuses[t.id] === 'done' || taskStatuses[t.id] === 'failed');
          const isRunning = !allDone && phase.tasks.some(t => taskStatuses[t.id] === 'running');
          const hasFailed = phase.tasks.some(t => taskStatuses[t.id] === 'failed');
          const phaseColor = allDone ? (hasFailed ? '#ef4444' : '#34d399') : isRunning ? PHASE_COLORS[pi % PHASE_COLORS.length] : '#374151';
          const cp = checkpoints[phase.name];
          const estSecs = phaseEstimates[phase.name];
          return (
            <div key={phase.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${phaseColor}30` }}>
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: `${phaseColor}0a` }}>
                {allDone && !hasFailed ? <CheckCircle size={13} className="text-emerald-400" />
                  : allDone && hasFailed ? <XCircle size={13} className="text-red-400" />
                  : isRunning ? <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: phaseColor }} />
                  : <Clock size={13} className="text-gray-700" />}
                <span className="flex-1 text-sm font-semibold" style={{ color: phaseColor }}>フェーズ {pi + 1}: {phase.name}</span>
                {/* H: Time estimate */}
                {isRunning && estSecs && (
                  <span className="text-xs flex-shrink-0" style={{ color: '#fbbf24' }}>~{Math.round(estSecs / 60) || 1}分</span>
                )}
                {/* I: Checkpoint badge */}
                {cp && (
                  <span className="flex items-center gap-1 text-xs flex-shrink-0 px-1.5 py-0.5 rounded-full"
                    style={{ background: cp.success ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.1)', color: cp.success ? '#6ee7b7' : '#fca5a5' }}>
                    <GitCommit size={9} />保存済
                  </span>
                )}
                <span className="text-xs text-gray-600 flex-shrink-0">{phase.parallel ? '並列' : '順次'}</span>
              </div>
              <div className="p-2 grid grid-cols-2 gap-1.5">
                {phase.tasks.map(task => {
                  const st = taskStatuses[task.id] ?? 'pending';
                  const out = taskOutputs[task.id] ?? '';
                  const expanded = expandedTask === task.id;
                  const tColor = st === 'running' ? '#818cf8' : st === 'done' ? '#34d399' : st === 'failed' ? '#f87171' : '#374151';
                  return (
                    <div key={task.id}>
                      <button onClick={() => setExpandedTask(expanded ? null : task.id)}
                        className="w-full rounded-xl p-2.5 text-left transition-all active:scale-97"
                        style={{ background: st === 'running' ? 'rgba(99,102,241,0.12)' : st === 'done' ? 'rgba(52,211,153,0.08)' : st === 'failed' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${tColor}33` }}>
                        <div className="flex items-start gap-1.5">
                          <span className="text-sm flex-shrink-0 mt-0.5">
                            {st === 'running' ? '⚡' : st === 'done' ? '✅' : st === 'failed' ? '❌' : '🤖'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: tColor }}>{task.agent_name}</p>
                            <p className="text-gray-600 text-xs mt-0.5 truncate">{task.title}</p>
                          </div>
                          {out && (expanded ? <ChevronUp size={9} className="text-gray-700 mt-1 flex-shrink-0" /> : <ChevronDown size={9} className="text-gray-700 mt-1 flex-shrink-0" />)}
                        </div>
                        {st === 'running' && <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}><div className="h-full rounded-full animate-pulse" style={{ width: '65%', background: '#818cf8' }} /></div>}
                      </button>
                      {expanded && out && (
                        <div className="mt-1 rounded-xl p-2.5 max-h-40 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <pre className="text-gray-400 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">{out.slice(-1500)}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Review agent card */}
        {(taskStatuses['review_agent'] || step === 'done') && (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${taskStatuses['review_agent'] === 'done' ? 'rgba(52,211,153,0.25)' : taskStatuses['review_agent'] === 'failed' ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.25)'}` }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(99,102,241,0.08)' }}>
              {taskStatuses['review_agent'] === 'running' ? <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                : taskStatuses['review_agent'] === 'done' ? <CheckCircle size={13} className="text-emerald-400" />
                : <Eye size={13} className="text-indigo-400" />}
              <span className="flex-1 text-sm font-semibold text-indigo-300">AIコードレビュー</span>
              {orchestrateReviewResult && (
                <button onClick={() => setShowReview(v => !v)} className="text-xs text-indigo-400 active:opacity-70">
                  {showReview ? '折りたたむ' : '表示'}
                </button>
              )}
            </div>
            {showReview && orchestrateReviewResult && (
              <div className="px-4 pb-3 pt-1">
                <pre className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{orchestrateReviewResult}</pre>
              </div>
            )}
          </div>
        )}

        {/* Test result */}
        {orchestrateTestResult && (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${orchestrateTestResult.passed ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: orchestrateTestResult.passed ? 'rgba(52,211,153,0.06)' : 'rgba(239,68,68,0.06)' }}>
              {orchestrateTestResult.passed ? <CheckCircle size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-red-400" />}
              <span className="flex-1 text-sm font-semibold" style={{ color: orchestrateTestResult.passed ? '#6ee7b7' : '#fca5a5' }}>
                <FlaskConical size={12} className="inline mr-1" />
                テスト {orchestrateTestResult.passed ? '通過' : '失敗'}
              </span>
              <button onClick={() => setShowTestOutput(v => !v)} className="text-xs text-gray-500 active:opacity-70">
                {showTestOutput ? '折りたたむ' : '出力表示'}
              </button>
            </div>
            {showTestOutput && (
              <pre className="px-4 pb-3 pt-1 text-gray-400 text-xs font-mono whitespace-pre-wrap break-words max-h-36 overflow-y-auto">{orchestrateTestResult.output}</pre>
            )}
          </div>
        )}

        {/* Completion */}
        {step === 'done' && (
          <div className="rounded-2xl p-4 text-center space-y-1.5"
            style={{ background: failedTasks > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(52,211,153,0.06)', border: `1px solid ${failedTasks > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)'}` }}>
            <p className="text-xl">{failedTasks > 0 ? '⚠️' : '🎉'}</p>
            <p className="font-bold text-white text-sm">{failedTasks > 0 ? '一部失敗' : 'チーム完了'}</p>
            <p className="text-gray-500 text-xs">{failedTasks > 0 ? `${doneTasks - failedTasks} 成功 / ${failedTasks} 失敗` : `全${doneTasks}タスク完了`}</p>
          </div>
        )}

        {/* Supervisor Chat */}
        {step === 'executing' && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)' }}>
            <div className="px-4 py-2.5 flex items-center gap-2">
              <MessageSquare size={12} className="text-indigo-400" />
              <p className="text-indigo-300 text-xs font-semibold">スーパーバイザー — 実行中のエージェントに追加指示</p>
            </div>
            {svMessages.length > 0 && (
              <div className="px-4 pb-2 space-y-1">
                {svMessages.slice(-3).map((m, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-indigo-500">→</span>
                    <p className="text-gray-400">{m}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 px-3 pb-3">
              <input ref={svRef} value={svInput} onChange={e => setSvInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendSupervisor()}
                placeholder="例: Tailwindを使って。MUIは使わないで。"
                className="flex-1 h-8 px-3 rounded-lg text-xs text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(99,102,241,0.3)' }} />
              <button onClick={sendSupervisor} disabled={!svInput.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 disabled:opacity-40"
                style={{ background: 'rgba(99,102,241,0.2)' }}>
                <Send size={12} className="text-indigo-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
