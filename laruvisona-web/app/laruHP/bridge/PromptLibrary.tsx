'use client';
import { useState } from 'react';
import { Star, Plus, Trash2, Terminal, MessageSquare, Users, X as XIcon, Copy, Play } from 'lucide-react';
import { getPrompts, addPrompt, deletePrompt, toggleStar, type SavedPrompt } from './PromptStore';

const DEFAULTS: Omit<SavedPrompt, 'id' | 'ts' | 'useCount'>[] = [
  { label: 'テスト実行', prompt: 'テストを実行して結果を教えて', mode: 'code', starred: true },
  { label: 'コードレビュー', prompt: '最近変更したファイルをレビューして改善点を教えて', mode: 'chat', starred: true },
  { label: '型エラー修正', prompt: 'TypeScript の型エラーを全て修正して', mode: 'code', starred: false },
  { label: 'バグ調査', prompt: 'コンソールエラーの原因を調査して修正方法を提案して', mode: 'chat', starred: false },
];

const MODE_COLOR: Record<string, string> = { code: '#a5b4fc', chat: '#fcd34d', team: '#818cf8' };
const MODE_ICON: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = { code: Terminal, chat: MessageSquare, team: Users };

interface Props {
  onRunPrompt: (prompt: string, mode: 'code' | 'chat') => void;
}

export default function PromptLibrary({ onRunPrompt }: Props) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>(() => {
    const existing = getPrompts();
    if (existing.length === 0) {
      DEFAULTS.forEach(d => addPrompt(d));
      return getPrompts();
    }
    return existing;
  });
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState('');
  const [promptText, setPromptText] = useState('');
  const [mode, setMode] = useState<'code' | 'chat' | 'team'>('code');
  const [filter, setFilter] = useState<'all' | 'code' | 'chat' | 'team'>('all');

  const reload = () => setPrompts(getPrompts());

  const handleAdd = () => {
    if (!promptText.trim()) return;
    addPrompt({ label: label.trim() || promptText.slice(0, 20), prompt: promptText.trim(), mode, starred: false });
    setLabel(''); setPromptText(''); setShowAdd(false);
    reload();
  };

  const filtered = filter === 'all' ? prompts : prompts.filter(p => p.mode === filter);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filter tabs */}
      <div className="flex gap-2 px-4 py-3 shrink-0">
        {(['all', 'code', 'chat', 'team'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
            style={{
              background: filter === f ? (f === 'all' ? 'rgba(255,255,255,0.12)' : `${MODE_COLOR[f]}18`) : 'rgba(255,255,255,0.04)',
              color: filter === f ? (f === 'all' ? 'white' : MODE_COLOR[f]) : '#6b7280',
              border: `1px solid ${filter === f ? (f === 'all' ? 'rgba(255,255,255,0.15)' : `${MODE_COLOR[f]}35`) : 'rgba(255,255,255,0.07)'}`,
            }}>
            {f === 'all' ? 'すべて' : f}
          </button>
        ))}
        <button onClick={() => setShowAdd(true)}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 active:scale-95 transition-all"
          style={{ background: 'rgba(129,140,248,0.2)', border: '1px solid rgba(129,140,248,0.35)' }}>
          <Plus size={12} />追加
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-6" style={{ scrollbarWidth: 'none' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Star size={32} className="text-gray-700" />
            <p className="text-gray-600 text-sm">プロンプトがありません</p>
            <button onClick={() => setShowAdd(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-indigo-400 active:scale-95"
              style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)' }}>
              最初のプロンプトを追加
            </button>
          </div>
        ) : (
          filtered.map(p => {
            const MIcon = MODE_ICON[p.mode] ?? Terminal;
            const color = MODE_COLOR[p.mode] ?? '#9ca3af';
            return (
              <div key={p.id} className="rounded-2xl p-3.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${color}14`, border: `1px solid ${color}28` }}>
                    <MIcon size={14} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white text-sm font-semibold truncate">{p.label}</p>
                      {p.useCount > 0 && (
                        <span className="text-gray-600 text-[10px]">×{p.useCount}</span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{p.prompt}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <button onClick={() => { toggleStar(p.id); reload(); }}
                    className="p-1.5 rounded-lg active:scale-90 transition-all"
                    style={{ background: p.starred ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)' }}>
                    <Star size={13} style={{ color: p.starred ? '#fbbf24' : '#6b7280' }} />
                  </button>
                  <button onClick={() => { navigator.clipboard?.writeText(p.prompt).catch(() => {}); }}
                    className="p-1.5 rounded-lg active:scale-90 transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Copy size={13} className="text-gray-500" />
                  </button>
                  <button onClick={() => { onRunPrompt(p.prompt, p.mode === 'team' ? 'code' : p.mode); }}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}>
                    <Play size={11} />実行
                  </button>
                  <button onClick={() => { deletePrompt(p.id); reload(); }}
                    className="p-1.5 rounded-lg active:scale-90 transition-all"
                    style={{ background: 'rgba(248,113,113,0.08)' }}>
                    <Trash2 size={13} className="text-red-400/60" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add sheet */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowAdd(false)}>
          <div className="rounded-t-3xl px-4 pt-5 pb-8 space-y-4"
            style={{ background: 'rgba(12,12,24,0.98)', border: '1px solid rgba(255,255,255,0.08)', animation: 'slideUp 0.22s ease' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">プロンプトを追加</p>
              <button onClick={() => setShowAdd(false)}><XIcon size={18} className="text-gray-500" /></button>
            </div>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="ラベル（省略可）"
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
            <textarea value={promptText} onChange={e => setPromptText(e.target.value)} placeholder="プロンプトテキスト"
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
            <div className="flex gap-2">
              {(['code', 'chat', 'team'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
                  style={{
                    background: mode === m ? `${MODE_COLOR[m]}20` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${mode === m ? `${MODE_COLOR[m]}40` : 'rgba(255,255,255,0.07)'}`,
                    color: mode === m ? MODE_COLOR[m] : '#6b7280',
                  }}>{m}</button>
              ))}
            </div>
            <button onClick={handleAdd} disabled={!promptText.trim()}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white active:scale-95 transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
