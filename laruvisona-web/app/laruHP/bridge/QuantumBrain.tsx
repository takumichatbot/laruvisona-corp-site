'use client';
import { useState, useEffect, useRef } from 'react';
import { X as XIcon, Copy, Zap, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import type { QuantumBranch } from '@/app/api/bridge/quantum/route';

interface Props {
  goal: string;
  onClose: () => void;
  onApply: (text: string) => void;
  project: string;
  adminSecret: string;
}

// ── Bloch Sphere (SVG 3D illusion) ────────────────────────────────────────────
function BlochSphere({ phase, collapsed }: { phase: string; collapsed: boolean }) {
  const r = 52;
  const cx = 60; const cy = 60;
  const col = collapsed ? '#34D399' : '#38BDF8';

  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" style={{ filter: `drop-shadow(0 0 12px ${col}60)` }}>
      {/* Equatorial ellipse */}
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.28} fill="none" stroke={col} strokeWidth="0.8" strokeDasharray="4 3" opacity="0.5" />
      {/* Sphere outline */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="0.9" opacity="0.6" />
      {/* Axes */}
      <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={col} strokeWidth="0.6" opacity="0.35" />
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={col} strokeWidth="0.6" opacity="0.35" />
      {/* State vector — rotates in superposition */}
      <line
        x1={cx} y1={cy}
        x2={cx + (collapsed ? 0 : r * 0.6)}
        y2={cy - r * 0.8}
        stroke={col} strokeWidth="1.5"
        strokeLinecap="round"
        style={{ transformOrigin: `${cx}px ${cy}px`, animation: phase === 'superpos' || phase === 'entangle' ? 'blochSpin 2s linear infinite' : 'none' }}
      />
      {/* State label */}
      <text x={cx} y={cy - r - 6} textAnchor="middle" fill={col} fontSize="7" fontFamily="monospace">
        {collapsed ? '|final⟩' : phase === 'superpos' ? '|ψ⟩' : phase === 'collapse' ? '⟩collapse' : '|0⟩'}
      </text>
      {/* North/South poles */}
      <circle cx={cx} cy={cy - r} r="2.5" fill={col} opacity="0.8" />
      <circle cx={cx} cy={cy + r} r="2.5" fill={col} opacity="0.4" />
      <text x={cx + 5} y={cy - r + 2} fill={col} fontSize="6" opacity="0.7">|1⟩</text>
      <text x={cx + 5} y={cy + r + 8} fill={col} fontSize="6" opacity="0.7">|0⟩</text>
    </svg>
  );
}

// ── Quantum Particle Canvas ────────────────────────────────────────────────────
function ParticleField({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const W = canvas.width; const H = canvas.height;
    type P = { x: number; y: number; vx: number; vy: number; r: number; hue: number; phase: number };
    const particles: P[] = Array.from({ length: active ? 60 : 20 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 2 + 0.5,
      hue: [195, 270, 340, 150, 45][Math.floor(Math.random() * 5)],
      phase: Math.random() * Math.PI * 2,
    }));
    let frame = 0;
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      frame++;
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.phase += 0.02;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        const alpha = (Math.sin(p.phase) * 0.3 + 0.5) * (active ? 0.8 : 0.3);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${alpha})`;
        ctx.fill();
      });
      // Draw entanglement lines between nearby particles
      if (active) {
        particles.forEach((a, i) => {
          particles.slice(i + 1).forEach(b => {
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < 80) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = `hsla(200, 80%, 70%, ${(1 - d / 80) * 0.12})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          });
        });
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// ── Coherence Bar ──────────────────────────────────────────────────────────────
function CoherenceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full" style={{ width: `${value * 100}%`, background: color, transition: 'width 1s ease', boxShadow: `0 0 6px ${color}` }} />
      </div>
      <span className="text-[9px] font-mono tabular-nums" style={{ color, minWidth: 28 }}>{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

// ── Branch Card ────────────────────────────────────────────────────────────────
function BranchCard({ branch, index, revealed }: { branch: QuantumBranch; index: number; revealed: boolean }) {
  const [exp, setExp] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: revealed ? `linear-gradient(135deg, ${branch.color}10, rgba(2,8,20,0.6))` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${revealed ? branch.color + '40' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: revealed ? `0 0 20px ${branch.color}18` : 'none',
        animation: revealed ? `branchReveal 0.4s cubic-bezier(0.34,1.56,0.64,1) ${index * 0.1}s both` : 'none',
      }}>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        {revealed
          ? <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: branch.color, boxShadow: `0 0 8px ${branch.color}` }} />
          : <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }} />
        }
        <span className="font-mono text-[10px]" style={{ color: revealed ? branch.color : 'rgba(255,255,255,0.3)' }}>{branch.glyph}</span>
        <span className="text-xs font-semibold flex-1" style={{ color: revealed ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)' }}>{branch.name}</span>
        {revealed && (
          <>
            <CoherenceBar value={branch.coherence} color={branch.color} />
            <button onClick={() => setExp(v => !v)} style={{ color: 'rgba(255,255,255,0.3)' }}>
              {exp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </>
        )}
        {!revealed && (
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>探索中...</span>
        )}
      </div>
      {revealed && exp && (
        <div className="px-3.5 pb-3 pt-1" style={{ borderTop: `1px solid ${branch.color}20` }}>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{branch.insight}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
type Phase = 'init' | 'superpos' | 'entangle' | 'collapse' | 'done' | 'error';

export default function QuantumBrain({ goal, onClose, onApply, project, adminSecret }: Props) {
  const [phase, setPhase] = useState<Phase>('init');
  const [branches, setBranches] = useState<QuantumBranch[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [synthesis, setSynthesis] = useState('');
  const [collapseProgress, setCollapseProgress] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Run the quantum computation
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setPhase('superpos');
        const res = await fetch('/api/bridge/quantum', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal, project, secret: adminSecret, numBranches: 3 }),
        });
        if (cancelled) return;
        const data = await res.json() as { branches?: QuantumBranch[]; synthesis?: string; error?: string };
        if (data.error) throw new Error(data.error);
        if (!data.branches || !data.synthesis) throw new Error('Invalid response');

        setBranches(data.branches);
        setPhase('entangle');

        // Reveal branches one by one
        for (let i = 0; i < data.branches.length; i++) {
          if (cancelled) return;
          await new Promise(r => setTimeout(r, 350));
          setRevealedCount(i + 1);
        }

        // Collapse phase
        await new Promise(r => setTimeout(r, 600));
        if (cancelled) return;
        setPhase('collapse');

        // Animate collapse progress
        const start = Date.now();
        const duration = 1800;
        const tick = () => {
          const p = Math.min((Date.now() - start) / duration, 1);
          setCollapseProgress(Math.round(p * 100));
          if (p < 1) requestAnimationFrame(tick);
          else {
            setSynthesis(data.synthesis!);
            setPhase('done');
          }
        };
        requestAnimationFrame(tick);
      } catch (e) {
        if (!cancelled) { setError(String(e)); setPhase('error'); }
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const phaseLabel: Record<Phase, string> = {
    init: '初期化中...',
    superpos: '量子重ね合わせを展開中...',
    entangle: '量子もつれを形成中...',
    collapse: `波動関数収束中 ${collapseProgress}%`,
    done: '観測完了 — 最終状態が収束しました',
    error: 'デコヒーレンス発生',
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: '#020814' }}>
      {/* Particle background */}
      <div className="absolute inset-0">
        <ParticleField active={phase === 'superpos' || phase === 'entangle'} />
      </div>

      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: phase === 'done'
          ? 'radial-gradient(ellipse at 50% 40%, rgba(52,211,153,0.06) 0%, transparent 70%)'
          : 'radial-gradient(ellipse at 50% 30%, rgba(56,189,248,0.07) 0%, transparent 60%)',
        transition: 'background 1.5s ease',
      }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #38BDF8, #818CF8)', boxShadow: '0 0 16px rgba(56,189,248,0.3)' }}>
            <Activity size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>量子思考エンジン</p>
            <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{goal.slice(0, 55)}{goal.length > 55 ? '…' : ''}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <XIcon size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        {/* Phase indicator */}
        <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex gap-1">
            {(['superpos', 'entangle', 'collapse', 'done'] as Phase[]).map((p, i) => {
              const phases: Phase[] = ['superpos', 'entangle', 'collapse', 'done'];
              const current = phases.indexOf(phase);
              const isCurrent = phase === p;
              const isDone = current > i;
              return (
                <div key={p} className="h-1 rounded-full transition-all duration-500"
                  style={{
                    width: isCurrent ? 20 : 6,
                    background: isDone ? '#34D399' : isCurrent ? '#38BDF8' : 'rgba(255,255,255,0.12)',
                  }} />
              );
            })}
          </div>
          <p className="text-[11px] font-mono" style={{ color: phase === 'done' ? '#34D399' : '#38BDF8' }}>
            {phaseLabel[phase]}
          </p>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>

          {/* Bloch sphere + branches layout */}
          <div className="flex gap-3">
            {/* Bloch sphere */}
            <div className="w-24 h-24 flex-shrink-0 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(56,189,248,0.15)' }}>
              <div className="w-20 h-20">
                <BlochSphere phase={phase} collapsed={phase === 'done'} />
              </div>
            </div>

            {/* Branch cards */}
            <div className="flex-1 space-y-2">
              {phase === 'init' || phase === 'superpos' ? (
                [0, 1, 2].map(i => (
                  <div key={i} className="h-9 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
                ))
              ) : (
                branches.slice(0, 3).map((b, i) => (
                  <BranchCard key={b.id} branch={b} index={i} revealed={i < revealedCount} />
                ))
              )}
            </div>
          </div>

          {/* Wave function collapse progress */}
          {(phase === 'collapse' || phase === 'done') && (
            <div className="rounded-2xl p-3.5" style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.18)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono" style={{ color: '#38BDF8' }}>波動関数収束</span>
                <span className="text-[11px] font-mono tabular-nums" style={{ color: '#38BDF8' }}>{collapseProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-none"
                  style={{ width: `${collapseProgress}%`, background: 'linear-gradient(90deg, #38BDF8, #34D399)', boxShadow: '0 0 8px rgba(56,189,248,0.5)' }} />
              </div>
            </div>
          )}

          {/* Synthesis result */}
          {synthesis && (
            <div className="rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(56,189,248,0.06))',
                border: '1px solid rgba(52,211,153,0.25)',
                boxShadow: '0 0 30px rgba(52,211,153,0.08)',
                animation: 'synthReveal 0.6s cubic-bezier(0.34,1.56,0.64,1)',
              }}>
              <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ borderBottom: '1px solid rgba(52,211,153,0.12)' }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#34D399', boxShadow: '0 0 6px #34D399' }} />
                <span className="text-xs font-bold font-mono" style={{ color: '#34D399' }}>|FINAL⟩ 量子収束解</span>
              </div>
              <div className="px-3.5 py-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.82)' }}>{synthesis}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-2xl p-3.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-xs" style={{ color: '#F87171' }}>デコヒーレンスエラー: {error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 flex gap-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
          {synthesis && (
            <>
              <button onClick={() => { onApply(synthesis); onClose(); }}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #34D399, #0EA5E9)', boxShadow: '0 4px 20px rgba(52,211,153,0.25)' }}>
                <Zap size={14} />
                収束解をコードに適用
              </button>
              <button onClick={async () => { await navigator.clipboard.writeText(synthesis); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="px-4 py-3.5 rounded-2xl text-sm font-medium active:scale-95 transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                {copied ? '✓' : <Copy size={14} />}
              </button>
            </>
          )}
          {!synthesis && (
            <div className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#38BDF8 transparent transparent transparent' }} />
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>量子演算中...</span>
            </div>
          )}
          <button onClick={onClose}
            className="px-4 py-3.5 rounded-2xl text-sm font-medium active:scale-95 transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}>
            閉じる
          </button>
        </div>
      </div>

      <style>{`
        @keyframes blochSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes branchReveal {
          from { opacity: 0; transform: translateX(-12px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0)    scale(1);    }
        }
        @keyframes synthReveal {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}
