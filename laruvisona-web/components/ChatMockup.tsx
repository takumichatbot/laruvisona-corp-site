'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';

export default function ChatMockup() {
  const [step, setStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // IntersectionObserverで画面内に入ったらアニメーション開始
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && step === 0) {
          setTimeout(() => setStep(1), 500); // ユーザーの質問
          setTimeout(() => setStep(2), 1500); // AI考え中
          setTimeout(() => setStep(3), 2500); // AI回答
          setTimeout(() => setStep(4), 4000); // ユーザー追加質問
          setTimeout(() => setStep(5), 5000); // AI考え中
          setTimeout(() => setStep(6), 6500); // AI回答（完）
        }
      },
      { threshold: 0.5 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [step]);

  return (
    <div ref={containerRef} className="bg-[#0f172a]/80 backdrop-blur-md rounded-[1.5rem] p-6 md:p-8 border border-white/10 shadow-2xl relative overflow-hidden h-[400px] flex flex-col">
      <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl tracking-widest font-en z-20">LIVE DEMO</div>
      <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <span className="text-xs font-mono text-slate-500">larubot-engine.sh</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-2 hide-scrollbar flex flex-col justify-end">
        {step >= 1 && (
          <div className="flex gap-4 flex-row-reverse animate-[fadeIn_0.3s_ease-out]">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-white"/></div>
            <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm p-3 text-sm">サイトからの離脱率を改善したいです。</div>
          </div>
        )}
        
        {step === 2 || step === 5 ? (
          <div className="flex gap-4 animate-[fadeIn_0.3s_ease-out]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-white"/></div>
            <div className="bg-white/10 border border-white/5 text-slate-200 rounded-2xl rounded-tl-sm p-3 text-sm flex gap-1 items-center">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: "0.1s"}}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></div>
            </div>
          </div>
        ) : null}

        {step >= 3 && (
          <div className="flex gap-4 animate-[fadeIn_0.3s_ease-out]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-white"/></div>
            <div className="bg-white/10 border border-white/5 text-slate-200 rounded-2xl rounded-tl-sm p-3 text-sm">それなら、私の出番ですね。<br/>プロアクティブ話しかけ機能で、離脱前のユーザーを接客しましょう。</div>
          </div>
        )}

        {step >= 4 && (
          <div className="flex gap-4 flex-row-reverse animate-[fadeIn_0.3s_ease-out]">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-white"/></div>
            <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm p-3 text-sm">設定は難しいですか？</div>
          </div>
        )}

        {step >= 6 && (
          <div className="flex gap-4 animate-[fadeIn_0.3s_ease-out]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-white"/></div>
            <div className="bg-white/10 border border-white/5 text-slate-200 rounded-2xl rounded-tl-sm p-3 text-sm">いいえ、管理画面から1クリックで有効化できます。すべて私にお任せください！</div>
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html:`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}} />
    </div>
  );
}