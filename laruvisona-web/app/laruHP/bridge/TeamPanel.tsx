'use client';
import { useState, useEffect } from 'react';
import { Users, Play, Square, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, Zap, RotateCcw, AlertCircle } from 'lucide-react';

export interface OrchestrateTask {
  id: string;
  agent_name: string;
  title: string;
  instruction: string;
  files_to_create: string[];
  files_to_modify: string[];
}

export interface OrchestratePhase {
  id: string;
  name: string;
  description: string;
  parallel: boolean;
  tasks: OrchestrateTask[];
}

export interface OrchestratePlan {
  title: string;
  description: string;
  phases: OrchestratePhase[];
}

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

interface Props {
  macOnline: boolean;
  projectName: string;
  fileTree: string;
  onSend: (msg: Record<string, unknown>) => void;
  orchestrateRunning: boolean;
  orchestratePhase: string;
  taskStatuses: Record<string, TaskStatus>;
  taskOutputs: Record<string, string>;
  orchestrateComplete: boolean;
  onResetOrchestrate: () => void;
}

const EXAMPLES = [
  '月額¥999のサブスクリプション機能をStripe決済で追加。Proプランはフル機能、Freeは制限あり。',
  'ユーザー認証をNextAuth v5に移行し、Google・GitHubログインを追加',
  'APIレート制限をRedisで実装。1時間100リクエストまで。',
  'ダッシュボードページを追加。統計グラフとアクティビティログを表示。',
];

const PHASE_COLORS = ['#6366f1', '#0ea5e9', '#8b5cf6', '#f59e0b'];

export default function TeamPanel({
  macOnline, projectName, fileTree, onSend,
  orchestrateRunning, orchestratePhase, taskStatuses, taskOutputs,
  orchestrateComplete, onResetOrchestrate,
}: Props) {
  const [step, setStep] = useState<'input' | 'planning' | 'review' | 'executing' | 'done'>('input');
  const [directive, setDirective] = useState('');
  const [plan, setPlan] = useState<OrchestratePlan | null>(null);
  const [planError, setPlanError] = useState('');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [planModel, setPlanModel] = useState('claude-sonnet-4-6');

  useEffect(() => {
    if (orchestrateRunning && step !== 'executing') setStep('executing');
    if (orchestrateComplete && step === 'executing') setStep('done');
  }, [orchestrateRunning, orchestrateComplete, step]);

  const totalTasks = plan?.phases.reduce((s, p) => s + p.tasks.length, 0) ?? 0;
  const doneTasks = Object.values(taskStatuses).filter(s => s === 'done' || s === 'failed').length;
  const failedTasks = Object.values(taskStatuses).filter(s => s === 'failed').length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const generatePlan = async () => {
    if (!directive.trim()) return;
    setStep('planning');
    setPlanError('');
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
    onSend({ type: 'orchestrate_start', plan });
    setStep('executing');
  };

  const reset = () => {
    setStep('input');
    setPlan(null);
    setDirective('');
    setPlanError('');
    onResetOrchestrate();
  };

  // ── Input ────────────────────────────────────────────────────────────────
  if (step === 'input' || step === 'planning') {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Header */}
        <div className="text-center pb-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', boxShadow: '0 0 30px rgba(79,70,229,0.4)' }}>
            <Users size={24} className="text-white" />
          </div>
          <p className="text-white font-bold text-base">AI Software Team</p>
          <p className="text-gray-500 text-xs mt-1">高レベルの指示を入力するとAIチームが分析・実装します</p>
        </div>

        {/* Directive input */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <textarea
            value={directive}
            onChange={e => setDirective(e.target.value)}
            placeholder="例: 月額¥999のサブスクリプション機能を追加して。ProプランはAPI使い放題、Freeは月10回まで。Stripeで決済。"
            className="w-full text-sm text-white resize-none outline-none leading-relaxed placeholder-gray-700"
            style={{ background: 'transparent', minHeight: '100px' }}
          />
          <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-3">
            <select value={planModel} onChange={e => setPlanModel(e.target.value)}
              className="h-7 px-2 rounded-lg text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
              <option value="claude-haiku-4-5-20251001" style={{ background: '#111' }}>Haiku (速い)</option>
              <option value="claude-sonnet-4-6" style={{ background: '#111' }}>Sonnet (推奨)</option>
              <option value="claude-opus-4-8" style={{ background: '#111' }}>Opus (高品質)</option>
            </select>
            <span className="text-gray-700 text-xs">{directive.length}文字</span>
          </div>
        </div>

        {/* Examples */}
        <div className="space-y-1.5">
          <p className="text-gray-700 text-xs px-1">例文</p>
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => setDirective(ex)}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs text-gray-500 active:opacity-70 transition-all"
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
          className="w-full py-4 rounded-2xl font-semibold text-white text-sm active:scale-98 transition-all disabled:opacity-40 flex items-center justify-center gap-3"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 30px rgba(79,70,229,0.3)' }}>
          {step === 'planning'
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />AIが計画を立案中...</>
            : <><Zap size={16} />プランを生成</>}
        </button>

        {!macOnline && <p className="text-center text-gray-600 text-xs">Mac エージェントがオフラインです</p>}
      </div>
    );
  }

  // ── Review ────────────────────────────────────────────────────────────────
  if (step === 'review' && plan) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={15} className="text-indigo-400" />
            <p className="text-white font-bold text-sm">{plan.title}</p>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed">{plan.description}</p>
          <div className="flex gap-3 mt-3">
            <span className="text-indigo-400 text-xs">{plan.phases.length} フェーズ</span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-indigo-400 text-xs">{totalTasks} タスク</span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-indigo-400 text-xs">{plan.phases.filter(p => p.parallel).length} 並列フェーズ</span>
          </div>
        </div>

        {plan.phases.map((phase, pi) => (
          <div key={phase.id} className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${PHASE_COLORS[pi % PHASE_COLORS.length]}22` }}>
            <div className="px-4 py-3 flex items-center gap-2"
              style={{ background: `${PHASE_COLORS[pi % PHASE_COLORS.length]}10` }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: PHASE_COLORS[pi % PHASE_COLORS.length] }}>{pi + 1}</span>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{phase.name}</p>
                <p className="text-gray-500 text-xs">{phase.description}</p>
              </div>
              <span className="text-xs rounded-full px-2 py-0.5"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>
                {phase.parallel ? '並列' : '順次'}
              </span>
            </div>
            <div className="px-3 py-2 space-y-1.5">
              {phase.tasks.map(task => (
                <div key={task.id} className="rounded-lg px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🤖</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-gray-300 text-xs font-medium">{task.agent_name}</p>
                        <span className="text-gray-600 text-xs">—</span>
                        <p className="text-gray-500 text-xs truncate">{task.title}</p>
                      </div>
                      {(task.files_to_create.length > 0 || task.files_to_modify.length > 0) && (
                        <p className="text-gray-700 text-xs font-mono mt-0.5 truncate">
                          {[
                            ...task.files_to_create.map(f => `+${f.split('/').pop()}`),
                            ...task.files_to_modify.map(f => `~${f.split('/').pop()}`),
                          ].slice(0, 4).join('  ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <button onClick={reset}
            className="px-4 py-3 rounded-xl text-sm text-gray-500 active:scale-98 transition-all"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            やり直す
          </button>
          <button onClick={startExecution} disabled={!macOnline}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white active:scale-98 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #059669, #0284c7)', boxShadow: '0 0 25px rgba(5,150,105,0.35)' }}>
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
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold active:scale-90 transition-all"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              <Square size={10} fill="currentColor" />
              中断
            </button>
          ) : (
            <button onClick={reset}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs active:scale-90 transition-all text-gray-500"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <RotateCcw size={10} />
              新しい指示
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-xs">{step === 'done' ? '完了' : '進捗'}</span>
            <span className="text-xs font-semibold" style={{ color: failedTasks > 0 ? '#fca5a5' : step === 'done' ? '#34d399' : '#a5b4fc' }}>
              {doneTasks}/{totalTasks} タスク{failedTasks > 0 ? ` (${failedTasks} 失敗)` : ''}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress}%`,
                background: failedTasks > 0
                  ? 'linear-gradient(90deg, #dc2626, #f97316)'
                  : step === 'done'
                  ? 'linear-gradient(90deg, #059669, #34d399)'
                  : 'linear-gradient(90deg, #4f46e5, #7c3aed)',
              }} />
          </div>
        </div>

        {/* Phases */}
        {plan.phases.map((phase, pi) => {
          const allDone = phase.tasks.every(t => taskStatuses[t.id] === 'done' || taskStatuses[t.id] === 'failed');
          const isRunning = !allDone && phase.tasks.some(t => taskStatuses[t.id] === 'running');
          const hasFailed = phase.tasks.some(t => taskStatuses[t.id] === 'failed');
          const phaseColor = allDone ? (hasFailed ? '#ef4444' : '#34d399') : isRunning ? PHASE_COLORS[pi % PHASE_COLORS.length] : '#374151';

          return (
            <div key={phase.id} className="rounded-xl overflow-hidden transition-all"
              style={{ border: `1px solid ${phaseColor}33` }}>
              <div className="px-4 py-2.5 flex items-center gap-2.5"
                style={{ background: `${phaseColor}0d` }}>
                {allDone && !hasFailed ? <CheckCircle size={13} className="text-emerald-400" />
                  : allDone && hasFailed ? <XCircle size={13} className="text-red-400" />
                  : isRunning ? <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: phaseColor }} />
                  : <Clock size={13} className="text-gray-700" />}
                <span className="text-sm font-semibold" style={{ color: phaseColor }}>
                  フェーズ {pi + 1}: {phase.name}
                </span>
                <span className="text-xs text-gray-600 ml-auto">{phase.parallel ? '並列' : '順次'}</span>
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
                        style={{
                          background: st === 'running' ? 'rgba(99,102,241,0.12)'
                            : st === 'done' ? 'rgba(52,211,153,0.08)'
                            : st === 'failed' ? 'rgba(239,68,68,0.08)'
                            : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${tColor}33`,
                        }}>
                        <div className="flex items-start gap-1.5">
                          <span className="text-sm flex-shrink-0 mt-0.5" style={{ filter: st === 'pending' ? 'grayscale(1)' : 'none' }}>
                            {st === 'running' ? '⚡' : st === 'done' ? '✅' : st === 'failed' ? '❌' : '🤖'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold leading-tight truncate" style={{ color: tColor }}>
                              {task.agent_name}
                            </p>
                            <p className="text-gray-600 text-xs mt-0.5 truncate">{task.title}</p>
                          </div>
                          {out && (expanded ? <ChevronUp size={9} className="text-gray-700 mt-1 flex-shrink-0" /> : <ChevronDown size={9} className="text-gray-700 mt-1 flex-shrink-0" />)}
                        </div>
                        {st === 'running' && (
                          <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                            <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: '#818cf8' }} />
                          </div>
                        )}
                      </button>
                      {expanded && out && (
                        <div className="mt-1 rounded-xl p-2.5 max-h-40 overflow-y-auto"
                          style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <pre className="text-gray-400 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
                            {out.slice(-1500)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {step === 'done' && (
          <div className="rounded-2xl p-5 text-center space-y-2"
            style={{
              background: failedTasks > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(52,211,153,0.06)',
              border: `1px solid ${failedTasks > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.25)'}`,
            }}>
            <p className="text-2xl">{failedTasks > 0 ? '⚠️' : '🎉'}</p>
            <p className="font-bold text-white">{failedTasks > 0 ? '一部失敗' : 'チーム完了'}</p>
            <p className="text-gray-500 text-xs">
              {failedTasks > 0
                ? `${doneTasks - failedTasks} 成功 / ${failedTasks} 失敗`
                : `${doneTasks} タスクが完了しました`}
            </p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
