'use client';

import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Monitor, Layers, Smartphone, Mic, Volume2, Camera, CreditCard, MapPin, Database } from 'lucide-react';

// 🌟 親から「相談ボタンが押された時の処理」を受け取るように定義
interface EstimatorProps {
  onConsult: (estimateDetails: string) => void;
}

export default function Estimator({ onConsult }: EstimatorProps) {
  const [answers, setAnswers] = useState({
    type: 50, scale: 10, design: 20, auth: 0, ai: 0,
    voice: [] as number[], ext: [] as number[], admin: 0, infra: 10, speed: 1.0
  });

  const priceRef = useRef<HTMLSpanElement>(null);

  const sumArray = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const baseCost = answers.type + answers.scale + answers.design + answers.auth + answers.admin + answers.infra;
  const optCost = answers.ai + sumArray(answers.voice) + sumArray(answers.ext);
  const totalBase = baseCost + optCost;
  const total = Math.round(totalBase * answers.speed);
  const speedCost = Math.round(totalBase * (answers.speed - 1.0));

  useEffect(() => {
    if (priceRef.current) {
      gsap.to(priceRef.current, { innerText: total, duration: 0.6, snap: { innerText: 1 }, ease: "power2.out" });
    }
  }, [total]);

  const handleRadio = (key: string, val: number) => setAnswers(prev => ({ ...prev, [key]: val }));
  const handleCheck = (key: 'voice' | 'ext', val: number) => {
    setAnswers(prev => {
      const arr = prev[key];
      if (arr.includes(val)) return { ...prev, [key]: arr.filter(v => v !== val) };
      return { ...prev, [key]: [...arr, val] };
    });
  };

  // 🌟 「この内容で相談する」ボタンが押された時の処理
  const handleConsultClick = (e: React.MouseEvent) => {
    e.preventDefault(); // デフォルトのリンク移動を防ぐ

    // 選択された内容を分かりやすいテキストに変換
    const getTypeLabel = () => {
      if(answers.type === 50) return "Webサイト/LP";
      if(answers.type === 150) return "Webアプリ/SaaS";
      return "モバイルアプリ";
    };
    
    const details = `【AI見積もりシミュレーターからのご相談】
■ 概算費用: 約${total}万円
------------------------
■ 種類: ${getTypeLabel()}
■ 規模: ${answers.scale === 10 ? '小' : answers.scale === 40 ? '中' : answers.scale === 80 ? '大' : '大規模'}
■ AI機能: ${answers.ai === 0 ? 'なし' : answers.ai === 50 ? 'ボット' : answers.ai === 150 ? 'RAG' : 'エージェント'}
■ 希望納期: ${answers.speed === 1.0 ? '通常' : '特急'}
------------------------
ご要望や詳細をこちらにご追記ください：
`;
    // 親コンポーネントにテキストを渡す
    onConsult(details);
  };

  const btnBase = "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-white/5 transition-all duration-300 font-bold text-sm h-full w-full ";

  return (
    <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-start">
      {/* 左側：質問エリア (変更なしのため省略せずに書きます) */}
      <div className="lg:col-span-8 space-y-6">
        {/* Q1 */}
        <div className="bg-[#0f172a]/60 backdrop-blur-md p-6 md:p-8 rounded-[1.5rem] border border-white/5">
          <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-3"><span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[10px] px-2 py-0.5 rounded font-en">Q1</span> どのようなものを作りますか？</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[ { val: 50, label: 'Webサイト/LP', icon: <Monitor className="w-6 h-6 mb-1"/> }, { val: 150, label: 'Webアプリ/SaaS', icon: <Layers className="w-6 h-6 mb-1"/> }, { val: 300, label: 'モバイルアプリ', icon: <Smartphone className="w-6 h-6 mb-1"/> } ].map(item => (
              <button key={item.label} onClick={() => handleRadio('type', item.val)} className={`${btnBase} ${answers.type === item.val ? 'bg-blue-600/20 border-blue-500 text-white scale-105' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}>{item.icon} {item.label}</button>
            ))}
          </div>
        </div>
        {/* Q2 & Q3 */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-[1.5rem] border border-white/5">
            <h3 className="text-sm font-bold text-white mb-5"><span className="text-blue-400 mr-2 font-en">Q2</span> 規模・ページ数</h3>
            <div className="grid grid-cols-2 gap-3">
              {[ {val:10, l:'小 (1-5p)'}, {val:40, l:'中 (10-20p)'}, {val:80, l:'大 (30p~)'}, {val:150, l:'大規模PF'} ].map(i => (
                <button key={i.l} onClick={() => handleRadio('scale', i.val)} className={`${btnBase} !py-3 ${answers.scale === i.val ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{i.l}</button>
              ))}
            </div>
          </div>
          <div className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-[1.5rem] border border-white/5">
            <h3 className="text-sm font-bold text-white mb-5"><span className="text-blue-400 mr-2 font-en">Q3</span> デザイン・UI/UX</h3>
            <div className="flex flex-col gap-3">
              {[ {val:20, l:'テンプレート'}, {val:60, l:'オリジナル'}, {val:120, l:'ハイエンド演出'} ].map(i => (
                <button key={i.l} onClick={() => handleRadio('design', i.val)} className={`${btnBase} !py-3 !flex-row justify-start px-4 ${answers.design === i.val ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{i.l}</button>
              ))}
            </div>
          </div>
        </div>
        {/* Q5. AI */}
        <div className="bg-gradient-to-br from-indigo-900/40 to-[#0f172a] backdrop-blur-md p-6 md:p-8 rounded-[1.5rem] border border-indigo-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[8px] font-bold px-3 py-1 rounded-bl-lg font-en tracking-widest">RECOMMEND</div>
          <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-3"><span className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 text-[10px] px-2 py-0.5 rounded font-en">Q5</span> 生成AI・LLM連携</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[ {val:0, l:'なし'}, {val:50, l:'ボット(GPT等)'}, {val:150, l:'自社データ(RAG)'}, {val:300, l:'自律エージェント'} ].map(i => (
              <button key={i.l} onClick={() => handleRadio('ai', i.val)} className={`${btnBase} !py-3 ${answers.ai === i.val ? 'bg-indigo-500/30 border-indigo-400 text-white scale-105' : 'bg-black/20 text-slate-400 hover:bg-white/10'}`}>{i.l}</button>
            ))}
          </div>
        </div>
        {/* Q6 & Q7 */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-[1.5rem] border border-white/5">
            <h3 className="text-sm font-bold text-white mb-5"><span className="text-blue-400 mr-2 font-en">Q6</span> AIオプション (複数可)</h3>
            <div className="flex flex-col gap-3">
              {[ {val:50, l:'音声操作', ic:<Mic className="w-4 h-4"/>}, {val:40, l:'音声読上', ic:<Volume2 className="w-4 h-4"/>}, {val:60, l:'画像解析', ic:<Camera className="w-4 h-4"/>} ].map(i => (
                <button key={i.l} onClick={() => handleCheck('voice', i.val)} className={`${btnBase} !py-3 !flex-row justify-start px-4 ${answers.voice.includes(i.val) ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{i.ic} {i.l}</button>
              ))}
            </div>
          </div>
          <div className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-[1.5rem] border border-white/5">
            <h3 className="text-sm font-bold text-white mb-5"><span className="text-blue-400 mr-2 font-en">Q7</span> 外部連携 (複数可)</h3>
            <div className="flex flex-col gap-3">
              {[ {val:50, l:'決済 (Stripe等)', ic:<CreditCard className="w-4 h-4"/>}, {val:40, l:'Maps連携', ic:<MapPin className="w-4 h-4"/>}, {val:80, l:'基幹API連携', ic:<Database className="w-4 h-4"/>} ].map(i => (
                <button key={i.l} onClick={() => handleCheck('ext', i.val)} className={`${btnBase} !py-3 !flex-row justify-start px-4 ${answers.ext.includes(i.val) ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{i.ic} {i.l}</button>
              ))}
            </div>
          </div>
        </div>
        {/* Q10 */}
        <div className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-[1.5rem] border border-white/5">
          <h3 className="text-sm font-bold text-white mb-5"><span className="text-red-400 mr-2 font-en">Q10</span> 希望納期</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => handleRadio('speed', 1.0)} className={`${btnBase} !py-4 ${answers.speed === 1.0 ? 'bg-white/10 border-white/30 text-white' : 'bg-black/20 text-slate-400'}`}>通常 (2-3ヶ月)</button>
            <button onClick={() => handleRadio('speed', 1.3)} className={`${btnBase} !py-4 ${answers.speed === 1.3 ? 'bg-red-500/20 border-red-500 text-white scale-105 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-red-950/20 text-red-300 hover:bg-red-900/30'}`}>特急 (1ヶ月) x1.3</button>
          </div>
        </div>
      </div>

      {/* --- 右側：結果（固定追従パネル） --- */}
      <div className="lg:col-span-4 relative mt-8 lg:mt-0">
        <div className="lg:sticky lg:top-32">
          <div className="bg-[#030712]/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
            <p className="text-slate-500 text-[10px] font-bold tracking-[0.2em] font-en mb-6">ESTIMATED COST</p>
            <div className="flex justify-center items-baseline gap-1 text-white mb-8">
              <span className="text-xl font-bold text-slate-400">¥</span>
              <span ref={priceRef} className="text-6xl lg:text-7xl font-black font-mono tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">{total}</span>
              <span className="text-lg font-bold text-slate-400">万~</span>
            </div>
            <div className="space-y-4 mb-8 border-t border-white/5 pt-6 text-xs text-slate-400 font-medium">
              <div className="flex justify-between items-center"><span>基本開発費</span><span className="font-mono text-white">¥{baseCost}万</span></div>
              <div className="flex justify-between items-center"><span>AI・機能OP</span><span className="font-mono text-blue-400">¥{optCost}万</span></div>
              {answers.speed > 1.0 && (
                <div className="flex justify-between items-center bg-red-500/10 -mx-4 px-4 py-2 rounded-lg text-red-400 mt-2 border border-red-500/20">
                  <span>特急オプション</span><span className="font-mono">+¥{speedCost}万</span>
                </div>
              )}
            </div>

            {/* 🌟 クリックイベントを追加 */}
            <button onClick={handleConsultClick} className="block w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform text-sm shadow-[0_0_20px_rgba(255,255,255,0.2)] tracking-widest font-en">
              CONSULT NOW
            </button>
            <p className="text-[10px] text-slate-500 mt-4">※税抜概算です。要件により変動します。</p>
          </div>
        </div>
      </div>
    </div>
  );
}