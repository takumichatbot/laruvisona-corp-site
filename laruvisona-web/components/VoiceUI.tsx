'use client';

import { useState, useEffect } from 'react';
import { Mic } from 'lucide-react';

export default function VoiceUI() {
  const [isListening, setIsListening] = useState(false);
  const [text, setText] = useState("SYSTEM_STANDBY");

  const startListening = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setText("お使いのブラウザは音声認識に非対応です");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    
    recognition.onstart = () => {
      setIsListening(true);
      setText("LISTENING...");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setText(`「${transcript}」`);
      
      // 🌟 音声コマンドによるスクロールルーティング
      if (transcript.includes('サービス') || transcript.includes('事業')) {
        document.querySelector('#services')?.scrollIntoView({ behavior: 'smooth' });
      } else if (transcript.includes('問い合わせ') || transcript.includes('コンタクト')) {
        document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
      } else if (transcript.includes('見積')) {
        document.querySelector('#estimator')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        setTimeout(() => setText("COMMAND_NOT_FOUND"), 1000);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setTimeout(() => setText("SYSTEM_STANDBY"), 2500);
    };

    recognition.start();
  };

  return (
    <div className="flex flex-col items-center">
      <button 
        onClick={startListening}
        className={`relative w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all duration-500 z-10 
          ${isListening ? 'bg-rose-500 scale-110 shadow-[0_0_60px_rgba(244,63,94,0.6)]' : 'bg-gradient-to-br from-blue-500 to-indigo-600 hover:scale-105 shadow-[0_0_30px_rgba(59,130,246,0.4)]'}`}
      >
        <Mic className={`w-8 h-8 md:w-12 md:h-12 text-white ${isListening ? 'animate-pulse' : ''}`} />
        {/* レーダー波エフェクト */}
        <div className={`absolute inset-0 rounded-full border-2 border-white/30 ${isListening ? 'animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]' : 'hidden'}`}></div>
      </button>

      {/* 音声波形アニメーション */}
      <div className={`flex gap-1.5 h-12 mt-8 transition-opacity duration-300 ${isListening ? 'opacity-100' : 'opacity-0'}`}>
        {[0, 0.1, 0.2, 0.3, 0.1].map((delay, i) => (
          <div key={i} className="w-1.5 bg-white rounded-full animate-[wave_0.5s_infinite_alternate]" style={{animationDelay: `${delay}s`}}></div>
        ))}
      </div>

      <p className={`mt-4 font-mono text-sm font-bold tracking-widest transition-colors ${isListening || text.includes('「') ? 'text-white' : 'text-blue-400'}`}>
        {text}
      </p>

      <style dangerouslySetInnerHTML={{__html:`@keyframes wave { 0% { transform: scaleY(0.3); } 100% { transform: scaleY(1.2); } }`}} />
    </div>
  );
}