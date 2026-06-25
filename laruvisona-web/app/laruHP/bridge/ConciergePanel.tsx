'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Zap, Brain, Activity, Users, Camera, Mic, GitBranch, Shield, FlaskConical, ChevronRight } from 'lucide-react';

interface Props {
  macOnline: boolean;
  currentProject: { id: string; name: string } | null;
  currentMode: string;
  orchestrateRunning: boolean;
  orchestrateComplete: boolean;
  failedTasks: number;
  onNavigate: (mode: string) => void;
}

const BRIDGE_SYSTEM_PROMPT = `あなたは「Laru Bridge」の専任コンシェルジュAIです。Bridge の使い方、機能の説明、トラブルシューティングをサポートします。

## Bridge の機能一覧

### コア機能
- **Code (コード実行)**: Claude Code を Mac エージェント経由でリモート実行。指示を入力→AIがコードを書く
- **Chat (AIチャット)**: プロジェクトを理解した Claude とコード相談。会話を「AI Team に変換」ボタンで実装指示に変換可能
- **AI Team (チームオーケストレーション)**: 複数AIが並列でフェーズ分けして実装。大型機能開発向け
- **Git**: ブランチ管理・差分確認・コミット
- **Files**: ファイルツリー表示・ファイル編集

### AI パネル (More メニュー)
- **PM (AIプロダクトマネージャー)**: ビジョン→エピック→スプリント→AIチームで自動実装
- **Brain (コードベースRAG)**: プロジェクト全ファイルをインデックス化、AIが関連コードを自動参照
- **Production (本番監視)**: URL を定期チェック、エラー検知→自動修正

### AI Team の詳しい使い方
1. Team タブ → 指示入力（またはテンプレートをタップ）
2. 「プランを生成」→ Claude がフェーズ・タスクに分解（リアルタイムでストリーミング表示）
3. o4-mini が自動検証（スコア・問題点が表示される）
4. 「AIチームを起動」→ 並列実行開始
5. 完了後：テスト生成・セキュリティ監査・diff確認

### OpenAI 機能
- マイクボタン（右下の緑ボタン）: 音声で指示→AIが応答→AI Team に送信
- 完了時に音声読み上げ（TTS）

### ヒント
- スクリーンショットから実装指示を生成: カメラボタン
- プラン生成中も「スーパーバイザー」で方向修正可能
- 失敗タスクは個別リトライ可能
- フェーズごとに自動 git commit（チェックポイント）

日本語で簡潔に答えてください。`;

const FEATURE_CARDS = [
  { icon: Users, color: '#818cf8', title: 'AI Team', desc: 'フェーズ分けで大型機能を並列実装', mode: 'team' },
  { icon: Brain, color: '#a78bfa', title: 'Brain', desc: '全コードをインデックス化・意味検索', mode: 'brain' },
  { icon: Activity, color: '#34d399', title: 'Production', desc: '本番URL監視・エラー自動修正', mode: 'production' },
  { icon: Camera, color: '#f59e0b', title: 'Visual→Code', desc: 'スクリーンショットから実装', mode: 'team' },
  { icon: Mic, color: '#0ea5e9', title: '音声アシスタント', desc: '話しかけてAI Teamに送信', mode: null },
  { icon: GitBranch, color: '#10b981', title: 'Git 自動保存', desc: 'フェーズ完了ごとに自動commit', mode: null },
  { icon: Shield, color: '#f87171', title: 'セキュリティ監査', desc: '実装後にOWASP自動チェック', mode: null },
  { icon: FlaskConical, color: '#fbbf24', title: 'テスト自動生成', desc: '実装に対応するテストを生成', mode: null },
];

function ContextCard({ macOnline, currentProject, orchestrateRunning, orchestrateComplete, failedTasks, onNavigate }: Omit<Props, 'currentMode'>) {
  const getStatus = () => {
    if (!macOnline) return { emoji: '🔴', text: 'Mac エージェントがオフライン', sub: 'エージェントの接続を確認してください', action: null };
    if (!currentProject) return { emoji: '📁', text: 'プロジェクトを選択してください', sub: 'ホームからプロジェクトを選んでスタート', action: null };
    if (orchestrateRunning) return { emoji: '⚡', text: `${currentProject.name} — AI Team 実行中`, sub: 'スーパーバイザーで方向修正できます', action: { label: '→ Team で確認', mode: 'team' } };
    if (orchestrateComplete && failedTasks > 0) return { emoji: '⚠️', text: `${failedTasks}件のタスクが失敗`, sub: '失敗タスクを個別リトライできます', action: { label: '→ Team を確認', mode: 'team' } };
    if (orchestrateComplete) return { emoji: '🎉', text: '実装完了！', sub: 'テスト生成・セキュリティ監査を試しましょう', action: { label: '→ Team で後処理', mode: 'team' } };
    return { emoji: '✅', text: `${currentProject.name} — 準備完了`, sub: 'AI Team で大型機能の実装を始めましょう', action: { label: '→ AI Team を使う', mode: 'team' } };
  };
  const s = getStatus();
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{s.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{s.text}</p>
          <p className="text-gray-500 text-xs mt-0.5">{s.sub}</p>
        </div>
        {s.action && (
          <button onClick={() => onNavigate(s.action!.mode)}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-indigo-400 active:scale-95"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
            {s.action.label}<ChevronRight size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function ConciergePanel({ macOnline, currentProject, currentMode, orchestrateRunning, orchestrateComplete, failedTasks, onNavigate }: Props) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'guide' | 'chat'>('status');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendChat = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch('/api/bridge/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          projectName: currentProject?.name ?? '未選択',
          model: 'claude-haiku-4-5-20251001',
          context: [],
          systemOverride: BRIDGE_SYSTEM_PROMPT,
        }),
      });
      if (!res.body) throw new Error('no body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.delta) {
              aiText += ev.delta;
              setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: aiText }]);
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'エラーが発生しました。もう一度お試しください。' }]);
    }
    setLoading(false);
  };

  const QUICK_QUESTIONS = [
    'AI Team の使い方を教えて',
    'Brain を使うメリットは？',
    '大型機能を実装するベストプラクティスは？',
    '音声で指示するには？',
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 20px rgba(79,70,229,0.3)' }}>
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Bridge コンシェルジュ</p>
            <p className="text-gray-500 text-xs">使い方ガイド・AI サポート</p>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {(['status', 'guide', 'chat'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: activeTab === t ? 'rgba(99,102,241,0.3)' : 'transparent', color: activeTab === t ? '#a5b4fc' : '#6b7280' }}>
              {t === 'status' ? '📊 状況' : t === 'guide' ? '📖 ガイド' : '💬 AI に聞く'}
            </button>
          ))}
        </div>
      </div>

      {/* Status tab */}
      {activeTab === 'status' && (
        <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-6">
          <ContextCard macOnline={macOnline} currentProject={currentProject} orchestrateRunning={orchestrateRunning}
            orchestrateComplete={orchestrateComplete} failedTasks={failedTasks} onNavigate={onNavigate} />

          {/* Step guide */}
          <div className="space-y-2">
            <p className="text-gray-600 text-xs px-1">AI Team の使い方（5ステップ）</p>
            {[
              { step: 1, title: 'プロジェクトを選択', desc: 'ホーム画面からプロジェクトを選ぶ' },
              { step: 2, title: '指示を入力', desc: 'テンプレートを使うか自由に記述。音声入力も可' },
              { step: 3, title: 'プランを確認', desc: 'o4-mini が自動検証。リスクバッジを確認して修正' },
              { step: 4, title: 'AIチームを起動', desc: '並列実行開始。スーパーバイザーで軌道修正可' },
              { step: 5, title: 'テスト & 監査', desc: '完了後にテスト生成・セキュリティ監査を実行' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>{s.step}</div>
                <div>
                  <p className="text-gray-300 text-xs font-semibold">{s.title}</p>
                  <p className="text-gray-600 text-xs">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tips */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <p className="text-yellow-400 text-xs font-semibold">💡 プロのコツ</p>
            <p className="text-gray-400 text-xs leading-relaxed">Brain にインデックスを作成しておくと、AI Team がプロジェクトの既存コードスタイルを自動参照して、一貫性のある実装をします。大型機能の前に必ず実行しましょう。</p>
          </div>
        </div>
      )}

      {/* Guide tab */}
      {activeTab === 'guide' && (
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="grid grid-cols-2 gap-2 pt-1">
            {FEATURE_CARDS.map(card => {
              const Icon = card.icon;
              return (
                <button key={card.title}
                  onClick={() => card.mode && onNavigate(card.mode)}
                  className="p-3 rounded-xl text-left active:scale-95 transition-all"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${card.color}22` }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
                    style={{ background: `${card.color}18` }}>
                    <Icon size={16} style={{ color: card.color }} />
                  </div>
                  <p className="text-white text-xs font-semibold mb-0.5">{card.title}</p>
                  <p className="text-gray-600 leading-snug" style={{ fontSize: '10px' }}>{card.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Keyboard shortcuts */}
          <div className="mt-4 rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-gray-500 text-xs font-semibold">ショートカット</p>
            {[
              { key: 'Enter', desc: '送信（テキストエリアで改行は Shift+Enter）' },
              { key: 'マイクボタン', desc: '音声で指示 → AI Team に変換' },
              { key: 'カメラボタン', desc: 'スクリーンショット → 実装指示生成' },
            ].map(s => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-md font-mono flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#d1d5db' }}>{s.key}</span>
                <p className="text-gray-600 text-xs">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat tab */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-gray-600 text-xs px-1">よくある質問</p>
                {QUICK_QUESTIONS.map(q => (
                  <button key={q} onClick={() => { setInput(q); }}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs text-gray-400 active:opacity-70"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap"
                  style={m.role === 'user'
                    ? { background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white', borderBottomRightRadius: 4 }
                    : { background: 'rgba(255,255,255,0.06)', color: '#d1d5db', borderBottomLeftRadius: 4 }}>
                  {m.content || (loading && i === messages.length - 1 ? <span className="animate-pulse">▋</span> : '')}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="px-3 py-3 flex gap-2 border-t border-white/5">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder="Bridge の使い方を聞いてみよう..."
              className="flex-1 h-10 px-3 rounded-xl text-xs text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
            <button onClick={sendChat} disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 disabled:opacity-40"
              style={{ background: 'rgba(99,102,241,0.2)' }}>
              {loading ? <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> : <Send size={14} className="text-indigo-400" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
