'use client';
import { useState, useEffect } from 'react';
import { Target, ChevronDown, ChevronUp, Play, RotateCcw, Sparkles, CheckCircle, Circle, AlertCircle } from 'lucide-react';

interface PMTask { id: string; title: string; }
interface PMStory {
  id: string; title: string; description: string; points: number;
  directive: string; status: 'backlog' | 'doing' | 'done';
}
interface PMEpic {
  id: string; title: string; description: string;
  priority: 'high' | 'medium' | 'low'; stories: PMStory[];
}
interface PMPlan { productName: string; summary: string; epics: PMEpic[]; }

interface Props {
  projectName: string;
  onExecuteStory: (directive: string) => void;
}

const PM_KEY = 'bridge_pm_plan';
const PRIORITY_COLORS: Record<string, string> = { high: '#f87171', medium: '#fbbf24', low: '#6ee7b7' };
const PRIORITY_LABELS: Record<string, string> = { high: '高', medium: '中', low: '低' };

const VISION_EXAMPLES = [
  'Stripeで月額課金ができるSaaSプラットフォーム。Free/Pro/Enterpriseの3プラン。ダッシュボードで使用量を可視化。',
  'チーム向けタスク管理アプリ。AIが優先度を自動判定し、締切が迫ったタスクを通知する。',
  'ユーザーがコードを投稿してAIレビューを受けられるプラットフォーム。GitHubログイン必須。',
];

export default function PMPanel({ projectName, onExecuteStory }: Props) {
  const [view, setView] = useState<'vision' | 'roadmap' | 'sprint'>('vision');
  const [vision, setVision] = useState('');
  const [plan, setPlan] = useState<PMPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedEpic, setExpandedEpic] = useState<string | null>(null);
  const [model, setModel] = useState('claude-sonnet-4-6');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PM_KEY) || 'null');
      if (saved?.epics) { setPlan(saved); setView('roadmap'); }
    } catch { /* ignore */ }
  }, []);

  const generatePlan = async () => {
    if (!vision.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/bridge/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pm_breakdown', vision, projectName, model }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const p: PMPlan = {
        ...data.plan,
        epics: (data.plan.epics || []).map((e: PMEpic) => ({
          ...e,
          stories: (e.stories || []).map((s: PMStory) => ({ ...s, status: 'backlog' })),
        })),
      };
      setPlan(p);
      localStorage.setItem(PM_KEY, JSON.stringify(p));
      setView('roadmap');
      setExpandedEpic(p.epics[0]?.id || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setLoading(false);
    }
  };

  const updateStoryStatus = (epicId: string, storyId: string, status: PMStory['status']) => {
    if (!plan) return;
    const updated: PMPlan = {
      ...plan,
      epics: plan.epics.map(e => e.id === epicId
        ? { ...e, stories: e.stories.map(s => s.id === storyId ? { ...s, status } : s) }
        : e
      ),
    };
    setPlan(updated);
    localStorage.setItem(PM_KEY, JSON.stringify(updated));
  };

  const allStories = plan?.epics.flatMap(e => e.stories.map(s => ({ ...s, epicTitle: e.title }))) ?? [];
  const doingStories = allStories.filter(s => s.status === 'doing');
  const doneStories = allStories.filter(s => s.status === 'done');
  const backlogStories = allStories.filter(s => s.status === 'backlog');

  // ── Vision ────────────────────────────────────────────────────────────────
  if (view === 'vision' || !plan) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="text-center pb-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', boxShadow: '0 0 30px rgba(245,158,11,0.35)' }}>
            <Target size={24} className="text-white" />
          </div>
          <p className="text-white font-bold text-base">AI Product Manager</p>
          <p className="text-gray-500 text-xs mt-1">{projectName} · ビジョンから実装計画まで</p>
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <textarea value={vision} onChange={e => setVision(e.target.value)}
            placeholder="例: Stripeで月額課金ができるSaaSプラットフォーム。Free/Pro/Enterpriseの3プラン。ダッシュボードで使用量を可視化。"
            className="w-full text-sm text-white resize-none outline-none leading-relaxed placeholder-gray-700"
            style={{ background: 'transparent', minHeight: '100px' }} />
          <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-2">
            <select value={model} onChange={e => setModel(e.target.value)}
              className="h-7 px-2 rounded-lg text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
              <option value="claude-haiku-4-5-20251001" style={{ background: '#111' }}>Haiku — 速い</option>
              <option value="claude-sonnet-4-6" style={{ background: '#111' }}>Sonnet — 推奨</option>
              <option value="claude-opus-4-8" style={{ background: '#111' }}>Opus — 最高品質</option>
            </select>
            <span className="text-gray-700 text-xs">{vision.length}文字</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-gray-700 text-xs px-1">ビジョン例</p>
          {VISION_EXAMPLES.map(ex => (
            <button key={ex} onClick={() => setVision(ex)}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs text-gray-500 active:opacity-70"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              {ex}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        <button onClick={generatePlan} disabled={!vision.trim() || loading}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm active:scale-98 transition-all disabled:opacity-40 flex items-center justify-center gap-3"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 0 30px rgba(245,158,11,0.25)' }}>
          {loading
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />AIが計画を策定中...</>
            : <><Sparkles size={15} />ロードマップを生成</>}
        </button>
      </div>
    );
  }

  // ── Roadmap ───────────────────────────────────────────────────────────────
  if (view === 'roadmap') {
    const totalPoints = allStories.reduce((s, st) => s + (st.points || 0), 0);
    const donePoints = doneStories.reduce((s, st) => s + (st.points || 0), 0);
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">{plan.productName}</p>
            <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{plan.summary}</p>
          </div>
          <div className="flex gap-1.5">
            {(['roadmap', 'sprint'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                style={{ background: view === v ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', color: view === v ? '#fcd34d' : '#4b5563', border: view === v ? '1px solid rgba(245,158,11,0.3)' : 'none' }}>
                {v === 'roadmap' ? 'ロードマップ' : 'スプリント'}
              </button>
            ))}
          </div>
        </div>

        {/* Progress */}
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex justify-between mb-2">
            <span className="text-gray-500 text-xs">進捗 {donePoints}/{totalPoints} pt</span>
            <span className="text-xs text-amber-400 font-semibold">{totalPoints > 0 ? Math.round(donePoints / totalPoints * 100) : 0}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${totalPoints > 0 ? donePoints / totalPoints * 100 : 0}%`, background: 'linear-gradient(90deg,#f59e0b,#ef4444)' }} />
          </div>
          <div className="flex gap-3 mt-2 text-xs text-gray-600">
            <span>📋 Backlog {backlogStories.length}</span>
            <span>⚡ Doing {doingStories.length}</span>
            <span>✅ Done {doneStories.length}</span>
          </div>
        </div>

        {/* Epics */}
        {plan.epics.map(epic => (
          <div key={epic.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${PRIORITY_COLORS[epic.priority]}22` }}>
            <button className="w-full px-4 py-3 flex items-center gap-2 text-left"
              style={{ background: `${PRIORITY_COLORS[epic.priority]}08` }}
              onClick={() => setExpandedEpic(expandedEpic === epic.id ? null : epic.id)}>
              <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: `${PRIORITY_COLORS[epic.priority]}18`, color: PRIORITY_COLORS[epic.priority] }}>
                {PRIORITY_LABELS[epic.priority]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{epic.title}</p>
                <p className="text-gray-500 text-xs truncate">{epic.description}</p>
              </div>
              <span className="text-gray-600 text-xs flex-shrink-0">{epic.stories.length}件</span>
              {expandedEpic === epic.id ? <ChevronUp size={13} className="text-gray-600 flex-shrink-0" /> : <ChevronDown size={13} className="text-gray-600 flex-shrink-0" />}
            </button>
            {expandedEpic === epic.id && (
              <div className="p-2 space-y-1.5">
                {epic.stories.map(story => (
                  <div key={story.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-start gap-2">
                      <span className="text-xs mt-0.5 flex-shrink-0">
                        {story.status === 'done' ? '✅' : story.status === 'doing' ? '⚡' : '📋'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-300 text-xs font-semibold">{story.title}</p>
                        <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">{story.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-gray-700 text-xs">{story.points}pt</span>
                          <div className="flex gap-1">
                            {(['backlog', 'doing', 'done'] as const).map(st => (
                              <button key={st} onClick={() => updateStoryStatus(epic.id, story.id, st)}
                                className="text-xs px-1.5 py-0.5 rounded-lg active:scale-90 transition-all"
                                style={{
                                  background: story.status === st ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                                  color: story.status === st ? '#a5b4fc' : '#4b5563',
                                  border: story.status === st ? '1px solid rgba(99,102,241,0.3)' : 'none',
                                }}>
                                {st === 'backlog' ? '📋' : st === 'doing' ? '⚡' : '✅'}
                              </button>
                            ))}
                          </div>
                          <button onClick={() => { onExecuteStory(story.directive); updateStoryStatus(epic.id, story.id, 'doing'); }}
                            className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-xs active:scale-90 transition-all"
                            style={{ background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.3)', color: '#34d399' }}>
                            <Play size={9} fill="currentColor" />AI実行
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <button onClick={() => { setPlan(null); setView('vision'); localStorage.removeItem(PM_KEY); }}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs text-gray-500 active:scale-98"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <RotateCcw size={11} />再設計
          </button>
        </div>
      </div>
    );
  }

  // ── Sprint (Kanban) ───────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-white font-bold text-sm">スプリント</p>
        <div className="flex gap-1.5">
          {(['roadmap', 'sprint'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{ background: view === v ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', color: view === v ? '#fcd34d' : '#4b5563', border: view === v ? '1px solid rgba(245,158,11,0.3)' : 'none' }}>
              {v === 'roadmap' ? 'ロードマップ' : 'スプリント'}
            </button>
          ))}
        </div>
      </div>

      {[
        { label: '📋 Backlog', key: 'backlog' as const, color: '#6b7280', stories: backlogStories },
        { label: '⚡ In Progress', key: 'doing' as const, color: '#818cf8', stories: doingStories },
        { label: '✅ Done', key: 'done' as const, color: '#34d399', stories: doneStories },
      ].map(col => (
        <div key={col.key}>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold" style={{ color: col.color }}>{col.label}</p>
            <span className="text-xs rounded-full px-1.5 py-0.5" style={{ background: 'rgba(255,255,255,0.06)', color: '#4b5563' }}>{col.stories.length}</span>
          </div>
          {col.stories.length === 0 ? (
            <div className="rounded-xl py-4 text-center text-gray-700 text-xs" style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>なし</div>
          ) : (
            <div className="space-y-2">
              {col.stories.map((story) => (
                <div key={story.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${col.color}20` }}>
                  <p className="text-gray-300 text-xs font-semibold">{story.title}</p>
                  <p className="text-gray-600 text-xs mt-0.5">{(story as { epicTitle?: string }).epicTitle}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-gray-700 text-xs">{story.points}pt</span>
                    {col.key !== 'done' && (
                      <button onClick={() => onExecuteStory(story.directive)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs active:scale-90"
                        style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.25)', color: '#34d399' }}>
                        <Play size={9} fill="currentColor" />AI実行
                      </button>
                    )}
                    {col.key === 'doing' && (
                      <button onClick={() => {
                        const epic = plan.epics.find(e => e.stories.some(s => s.id === story.id));
                        if (epic) updateStoryStatus(epic.id, story.id, 'done');
                      }} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs active:scale-90"
                        style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}>
                        <CheckCircle size={9} />完了
                      </button>
                    )}
                    {col.key === 'backlog' && (
                      <button onClick={() => {
                        const epic = plan.epics.find(e => e.stories.some(s => s.id === story.id));
                        if (epic) updateStoryStatus(epic.id, story.id, 'doing');
                      }} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs active:scale-90"
                        style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}>
                        <Circle size={9} />開始
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
