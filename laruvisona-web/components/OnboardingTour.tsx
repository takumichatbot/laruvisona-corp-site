'use client';

import { useState, useEffect } from 'react';

interface Step {
  target: string;
  title: string;
  body: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: Step[] = [
  {
    target: '[data-tour="sites"]',
    title: 'サイト一覧',
    body: 'ここにあなたのサイトが表示されます。編集・公開・分析もここから行えます。',
    placement: 'bottom',
  },
  {
    target: '[data-tour="new-site"]',
    title: '新しいサイトを作る',
    body: 'ボタンをクリックしてAIによるサイト自動生成を開始。最短5分で公開できます。',
    placement: 'bottom',
  },
  {
    target: '[data-tour="contacts"]',
    title: '問い合わせ管理',
    body: 'サイトへの問い合わせをここで確認。未読バッジで見逃しを防ぎます。',
    placement: 'bottom',
  },
  {
    target: '[data-tour="search-console"]',
    title: 'アクセス解析',
    body: 'Googleサーチコンソールを連携すると、検索順位・クリック数をここで確認できます。',
    placement: 'top',
  },
];

const STORAGE_KEY = 'laruhp_tour_done';

export default function OnboardingTour() {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      setTimeout(() => setStep(0), 800);
    }
  }, []);

  useEffect(() => {
    if (step === null) return;
    const target = STEPS[step]?.target;
    if (!target) return;
    const el = document.querySelector(target);
    if (!el) { next(); return; }
    const r = el.getBoundingClientRect();
    setRect(r);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [step]);

  const next = () => {
    if (step === null) return;
    if (step >= STEPS.length - 1) {
      finish();
    } else {
      setStep(step + 1);
    }
  };

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setStep(null);
  };

  if (step === null || !rect) return null;

  const current = STEPS[step];
  const margin = 12;
  const popW = 280;
  const popH = 130;

  let top = 0;
  let left = 0;

  if (current.placement === 'bottom') {
    top = rect.bottom + margin + window.scrollY;
    left = Math.max(8, Math.min(rect.left + rect.width / 2 - popW / 2, window.innerWidth - popW - 8));
  } else if (current.placement === 'top') {
    top = rect.top - popH - margin + window.scrollY;
    left = Math.max(8, Math.min(rect.left + rect.width / 2 - popW / 2, window.innerWidth - popW - 8));
  } else if (current.placement === 'right') {
    top = rect.top + rect.height / 2 - popH / 2 + window.scrollY;
    left = rect.right + margin;
  } else {
    top = rect.top + rect.height / 2 - popH / 2 + window.scrollY;
    left = rect.left - popW - margin;
  }

  return (
    <>
      {/* Highlight overlay */}
      <div className="fixed inset-0 z-[90] pointer-events-none" aria-hidden="true">
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <mask id="spotlight">
              <rect width="100%" height="100%" fill="white"/>
              <rect
                x={rect.left - 4}
                y={rect.top - 4}
                width={rect.width + 8}
                height={rect.height + 8}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#spotlight)"/>
        </svg>
      </div>

      {/* Popover */}
      <div
        className="fixed z-[91] w-[280px] bg-white rounded-2xl shadow-2xl p-4 border border-gray-200"
        style={{ top, left }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${i === step ? 'w-4 bg-sky-500' : 'w-1.5 bg-gray-200'}`}
              />
            ))}
          </div>
          <button
            onClick={finish}
            className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
          >
            スキップ
          </button>
        </div>

        <h4 className="font-bold text-gray-900 text-sm mb-1">{current.title}</h4>
        <p className="text-xs text-gray-500 leading-relaxed mb-4">{current.body}</p>

        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-400">{step + 1} / {STEPS.length}</span>
          <button
            onClick={next}
            className="bg-sky-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-sky-500 transition-colors"
          >
            {step === STEPS.length - 1 ? '完了 ✓' : '次へ →'}
          </button>
        </div>
      </div>
    </>
  );
}
