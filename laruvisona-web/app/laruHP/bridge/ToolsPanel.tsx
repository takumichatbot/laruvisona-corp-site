'use client';
import { useState } from 'react';
import { Rocket, Terminal, KeyRound, RotateCcw, BarChart2, Smartphone, ChevronDown, ChevronUp, Copy, FlaskConical, Globe, ExternalLink } from 'lucide-react';

interface CostStat { inputTokens: number; outputTokens: number; model: string }

interface Props {
  projectName: string;
  macOnline: boolean;
  onSend: (msg: Record<string, unknown>) => void;
  logs: string;
  logsActive: boolean;
  envContent: string;
  envPath: string;
  envLoading: boolean;
  costs: CostStat[];
  onGemini: (action: string, params: Record<string, unknown>) => Promise<string>;
  gitDiff: string;
  testOutput: string;
  testRunning: boolean;
  testPassed: boolean | null;
  tunnelUrl: string;
  tunnelLoading: boolean;
}

const MODEL_PRICES: Record<string, [number, number]> = {
  'claude-haiku-4-5-20251001': [0.80, 4.00],
  'claude-sonnet-4-6': [3.00, 15.00],
  'claude-opus-4-8': [15.00, 75.00],
};

function calcCost(stats: CostStat[]) {
  return stats.reduce((sum, s) => {
    const [inP, outP] = MODEL_PRICES[s.model] || [3.00, 15.00];
    return sum + (s.inputTokens * inP + s.outputTokens * outP) / 1_000_000;
  }, 0);
}

export default function ToolsPanel({ projectName, macOnline, onSend, logs, logsActive, envContent, envPath, envLoading, costs, onGemini, gitDiff, testOutput, testRunning, testPassed, tunnelUrl, tunnelLoading }: Props) {
  const [section, setSection] = useState<string | null>('deploy');
  const [envKey, setEnvKey] = useState('');
  const [envVal, setEnvVal] = useState('');
  const [commitMsg, setCommitMsg] = useState('');
  const [generatingCommit, setGeneratingCommit] = useState(false);
  const [deployOutput, setDeployOutput] = useState('');

  const toggle = (s: string) => setSection(v => v === s ? null : s);

  const genCommitMsg = async () => {
    if (!gitDiff) return;
    setGeneratingCommit(true);
    try {
      const result = await onGemini('commit_message', { diff: gitDiff, projectName });
      setCommitMsg(result.trim());
    } catch { /* ignore */ }
    setGeneratingCommit(false);
  };

  const totalCost = calcCost(costs);
  const totalTokens = costs.reduce((s, c) => s + c.inputTokens + c.outputTokens, 0);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">

      {/* デプロイ */}
      <Section id="deploy" label="ワンタップデプロイ" icon={<Rocket size={14} />} open={section === 'deploy'} onToggle={() => toggle('deploy')} color="#f87171">
        <div className="space-y-2">
          <button onClick={() => onSend({ type: 'run_deploy' })} disabled={!macOnline}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white active:scale-98 transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #dc2626, #f97316)', boxShadow: '0 0 20px rgba(220,38,38,0.3)' }}>
            Deploy {projectName}
          </button>
          {deployOutput && <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.4)' }}>{deployOutput}</pre>}
        </div>
      </Section>

      {/* ログ監視 */}
      <Section id="logs" label="ログ監視" icon={<Terminal size={14} />} open={section === 'logs'} onToggle={() => toggle('logs')} color="#34d399">
        <div className="space-y-2">
          <div className="flex gap-2">
            <button onClick={() => onSend({ type: 'logs_start' })} disabled={!macOnline || logsActive}
              className="flex-1 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 active:scale-98 transition-all"
              style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: '#6ee7b7' }}>
              {logsActive ? '監視中...' : '開始'}
            </button>
            <button onClick={() => onSend({ type: 'logs_stop' })} disabled={!logsActive}
              className="flex-1 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 active:scale-98 transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}>
              停止
            </button>
          </div>
          <div className="rounded-xl p-2 max-h-48 overflow-y-auto font-mono text-xs text-gray-400"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {logs || <span className="text-gray-700">ログなし</span>}
          </div>
        </div>
      </Section>

      {/* 環境変数 */}
      <Section id="env" label="環境変数" icon={<KeyRound size={14} />} open={section === 'env'} onToggle={() => { toggle('env'); if (section !== 'env') onSend({ type: 'env_read' }); }} color="#fbbf24">
        <div className="space-y-2">
          {envLoading && <div className="flex justify-center py-2"><div className="w-4 h-4 border border-amber-400 border-t-transparent rounded-full animate-spin" /></div>}
          {envContent && (
            <pre className="text-xs font-mono max-h-40 overflow-y-auto rounded-xl p-3 text-gray-300 whitespace-pre-wrap"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {envContent.split('\n').map((line, i) => {
                if (line.startsWith('#') || !line.includes('=')) return <span key={i} className="text-gray-600">{line}{'\n'}</span>;
                const [k, ...rest] = line.split('=');
                return <span key={i}><span className="text-sky-400">{k}</span>=<span className="text-amber-300">{rest.join('=')}</span>{'\n'}</span>;
              })}
            </pre>
          )}
          <p className="text-gray-600 text-xs">{envPath} を編集</p>
          <div className="flex gap-2">
            <input value={envKey} onChange={e => setEnvKey(e.target.value)} placeholder="KEY"
              className="flex-1 h-8 px-2 rounded-lg text-xs text-sky-300 outline-none font-mono"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
            <input value={envVal} onChange={e => setEnvVal(e.target.value)} placeholder="VALUE"
              className="flex-1 h-8 px-2 rounded-lg text-xs text-amber-300 outline-none font-mono"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
            <button onClick={() => { if (envKey) { onSend({ type: 'env_write', key: envKey, value: envVal }); setEnvKey(''); setEnvVal(''); } }}
              disabled={!envKey || !macOnline}
              className="px-3 h-8 rounded-lg text-xs text-white active:scale-90 disabled:opacity-40"
              style={{ background: 'rgba(251,191,36,0.2)' }}>保存</button>
          </div>
        </div>
      </Section>

      {/* クイックロールバック */}
      <Section id="rollback" label="クイックロールバック" icon={<RotateCcw size={14} />} open={section === 'rollback'} onToggle={() => toggle('rollback')} color="#a78bfa">
        <div className="space-y-2">
          <p className="text-gray-600 text-xs">操作は取り消せません。慎重に。</p>
          {[
            { action: 'stash',      label: 'Stash（変更を退避）',     color: '#818cf8' },
            { action: 'stash_pop',  label: 'Stash Pop（退避を復元）',  color: '#818cf8' },
            { action: 'reset_soft', label: 'Soft Reset（最後のコミットを取消）', color: '#f87171' },
            { action: 'reset_hard', label: 'Hard Reset（全変更を破棄）',      color: '#dc2626' },
          ].map(btn => (
            <button key={btn.action} onClick={() => { if (confirm(`"${btn.label}" を実行しますか？`)) onSend({ type: 'git_action', action: btn.action }); }}
              disabled={!macOnline}
              className="w-full py-2 px-3 rounded-xl text-xs text-left active:scale-98 transition-all disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${btn.color}22`, color: btn.color }}>
              {btn.label}
            </button>
          ))}
          {/* コミットメッセージ自動生成 */}
          <div className="pt-2 border-t border-white/5 space-y-2">
            <p className="text-gray-600 text-xs">コミットメッセージ自動生成</p>
            <button onClick={genCommitMsg} disabled={!gitDiff || generatingCommit}
              className="w-full py-2 rounded-xl text-xs active:scale-98 transition-all disabled:opacity-40"
              style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#c4b5fd' }}>
              {generatingCommit ? 'Gemini が生成中...' : 'git diff から生成'}
            </button>
            {commitMsg && (
              <div className="flex gap-2 items-start">
                <p className="flex-1 text-xs text-white rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.05)' }}>{commitMsg}</p>
                <button onClick={() => navigator.clipboard?.writeText(commitMsg)}
                  className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center active:scale-90"
                  style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <Copy size={12} className="text-gray-500" />
                </button>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* テストループ */}
      <Section id="tests" label="テスト自動ループ" icon={<FlaskConical size={14} />} open={section === 'tests'} onToggle={() => toggle('tests')} color="#f472b6">
        <div className="space-y-2">
          <button onClick={() => onSend({ type: 'run_tests' })} disabled={!macOnline || testRunning}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white active:scale-98 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: testRunning ? 'rgba(244,114,182,0.15)' : 'linear-gradient(135deg, #db2777, #7c3aed)', boxShadow: testRunning ? 'none' : '0 0 20px rgba(219,39,119,0.3)' }}>
            {testRunning
              ? <><div className="w-3 h-3 border border-pink-400 border-t-transparent rounded-full animate-spin" /> テスト実行中...</>
              : 'テストを実行'}
          </button>
          {testPassed !== null && !testRunning && (
            <div className="rounded-xl px-3 py-2 text-sm font-semibold text-center"
              style={{ background: testPassed ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', color: testPassed ? '#6ee7b7' : '#fca5a5' }}>
              {testPassed ? '✓ テスト通過' : '✗ テスト失敗'}
            </div>
          )}
          {testOutput && (
            <pre className="text-xs font-mono text-gray-400 max-h-48 overflow-y-auto rounded-xl p-3 whitespace-pre-wrap break-words"
              style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {testOutput}
            </pre>
          )}
        </div>
      </Section>

      {/* ライブプレビュー */}
      <Section id="tunnel" label="ライブプレビュー" icon={<Globe size={14} />} open={section === 'tunnel'} onToggle={() => toggle('tunnel')} color="#38bdf8">
        <div className="space-y-2">
          <p className="text-gray-600 text-xs">開発サーバーをスマホで閲覧できるよう公開URLを生成します</p>
          <div className="flex gap-2">
            <button onClick={() => onSend({ type: 'start_tunnel' })} disabled={!macOnline || tunnelLoading || !!tunnelUrl}
              className="flex-1 py-2 rounded-xl text-xs font-semibold active:scale-98 transition-all disabled:opacity-40"
              style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#7dd3fc' }}>
              {tunnelLoading ? '起動中...' : tunnelUrl ? '公開中' : '開始'}
            </button>
            <button onClick={() => onSend({ type: 'stop_tunnel' })} disabled={!tunnelUrl}
              className="flex-1 py-2 rounded-xl text-xs font-semibold active:scale-98 transition-all disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}>
              停止
            </button>
          </div>
          {tunnelUrl && (
            <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}>
              <a href={tunnelUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 text-sky-400 text-xs font-mono truncate">{tunnelUrl}</a>
              <a href={tunnelUrl} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center active:scale-90"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <ExternalLink size={11} className="text-gray-500" />
              </a>
              <button onClick={() => navigator.clipboard?.writeText(tunnelUrl)}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center active:scale-90"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Copy size={11} className="text-gray-500" />
              </button>
            </div>
          )}
          <p className="text-gray-700 text-xs">cloudflared または localtunnel を使用。事前に npx localtunnel が使えるか確認。</p>
        </div>
      </Section>

      {/* APIコスト */}
      <Section id="cost" label="API コスト追跡" icon={<BarChart2 size={14} />} open={section === 'cost'} onToggle={() => toggle('cost')} color="#60a5fa">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-gray-600 text-xs">セッション</p>
              <p className="text-white text-lg font-semibold">¥{(totalCost * 150).toFixed(1)}</p>
              <p className="text-gray-700 text-xs">${totalCost.toFixed(4)}</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-gray-600 text-xs">合計トークン</p>
              <p className="text-white text-lg font-semibold">{(totalTokens / 1000).toFixed(1)}K</p>
            </div>
          </div>
          {costs.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {[...costs].reverse().slice(0, 10).map((c, i) => (
                <div key={i} className="flex justify-between text-xs px-1">
                  <span className="text-gray-600 truncate">{c.model.split('-').slice(-2).join('-')}</span>
                  <span className="text-gray-500">{c.inputTokens + c.outputTokens} tok</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* iOSショートカット */}
      <Section id="shortcuts" label="iOS ショートカット" icon={<Smartphone size={14} />} open={section === 'shortcuts'} onToggle={() => toggle('shortcuts')} color="#38bdf8">
        <div className="space-y-2">
          <p className="text-gray-500 text-xs">URLをiOSショートカットに登録すると、ホーム画面から一発起動できます</p>
          {[
            { label: 'Bridge を開く', url: 'https://laruvisona.jp/laruHP/bridge' },
          ].map((s, i) => (
            <div key={i} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-gray-300 text-xs font-medium mb-1">{s.label}</p>
              <div className="flex items-center gap-2">
                <p className="text-sky-400 text-xs font-mono flex-1 truncate">{s.url}</p>
                <button onClick={() => navigator.clipboard?.writeText(s.url)}
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center active:scale-90"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <Copy size={11} className="text-gray-500" />
                </button>
              </div>
            </div>
          ))}
          <p className="text-gray-700 text-xs">設定: ショートカット → + → URLを開く → Bridge URL を貼り付け → ホーム画面に追加</p>
        </div>
      </Section>
    </div>
  );
}

function Section({ id, label, icon, open, onToggle, color, children }: {
  id: string; label: string; icon: React.ReactNode; open: boolean;
  onToggle: () => void; color: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${open ? color + '33' : 'rgba(255,255,255,0.06)'}` }}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 active:scale-99 transition-all"
        style={{ background: open ? `${color}0d` : 'rgba(255,255,255,0.02)' }}>
        <span style={{ color }}>{icon}</span>
        <span className="flex-1 text-sm font-medium text-left" style={{ color: open ? '#f3f4f6' : '#9ca3af' }}>{label}</span>
        {open ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}
