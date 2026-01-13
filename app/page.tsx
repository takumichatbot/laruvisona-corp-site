'use client';

import { useEffect } from 'react';
import Script from 'next/script';

export default function Home() {
  useEffect(() => {
    // プリローダーアニメーション
    const preloader = document.getElementById('preloader');
    const loaderBar = document.getElementById('loader-bar');
    const header = document.getElementById('header');
    
    if (preloader && loaderBar && header) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 100) progress = 100;
        loaderBar.style.width = progress + '%';
        
        if (progress === 100) {
          clearInterval(interval);
          setTimeout(() => {
            preloader.style.transform = 'translateY(-100%)';
            preloader.style.transition = 'transform 1s ease-in-out';
            header.style.opacity = '1';
            header.style.transform = 'translateY(0)';
          }, 500);
        }
      }, 100);
    }

    // Dev Mode トグル
    const devToggle = document.getElementById('dev-mode-toggle');
    if (devToggle) {
      devToggle.addEventListener('click', () => {
        document.body.classList.toggle('dev-mode');
        devToggle.classList.toggle('active');
      });
    }

    // 見積もり計算
    const calcEstimate = () => {
      const getVal = (name: string) => {
        const el = document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement;
        return el ? parseInt(el.value) : 0;
      };
      const getMultiVal = (name: string) => {
        let sum = 0;
        document.querySelectorAll(`input[name="${name}"]:checked`).forEach(el => {
          sum += parseInt((el as HTMLInputElement).value);
        });
        return sum;
      };

      let baseCost = getVal('q_type') + getVal('q_scale') + getVal('q_design') + 
                     getVal('q_auth') + getVal('q_admin') + getVal('q_infra');
      let optCost = getVal('q_ai') + getMultiVal('q_voice') + getMultiVal('q_ext');
      const multiplier = parseFloat((document.querySelector('input[name="q_speed"]:checked') as HTMLInputElement)?.value || '1.0');
      
      let total = Math.round((baseCost + optCost) * multiplier);
      const speedCost = Math.round((baseCost + optCost) * (multiplier - 1.0));

      const el = document.getElementById('estimate-price');
      if (el) el.innerText = total.toString();
      
      const detailBase = document.getElementById('detail-base');
      const detailOpt = document.getElementById('detail-opt');
      const detailSpeed = document.getElementById('detail-speed');
      if (detailBase) detailBase.innerText = `¥${baseCost}万`;
      if (detailOpt) detailOpt.innerText = `¥${optCost}万`;
      if (detailSpeed) detailSpeed.innerText = `¥${speedCost}万`;
    };

    // イベントリスナーを設定
    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', calcEstimate);
    });
    
    calcEstimate(); // 初期計算
  }, []);

  return (
    <>
      <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;900&family=Noto+Sans+JP:wght@300;400;500;700;900&family=Rajdhani:wght@500;700&family=Fira+Code:wght@400;600&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="/assets/css/style.css" />

      {/* プリローダー */}
      <div id="preloader" style={{position:'fixed', inset:0, zIndex:10000, display:'flex', justifyContent:'center', alignItems:'center', flexDirection:'column', background:'#020617'}}>
        <div style={{fontFamily:'Rajdhani', fontSize:'1.5rem', color:'white', letterSpacing:'0.2em', fontWeight:700}}>INITIALIZING SYSTEM</div>
        <div style={{width:'200px', height:'2px', background:'rgba(255,255,255,0.1)', marginTop:'20px', borderRadius:'4px', overflow:'hidden'}}>
          <div id="loader-bar" style={{width:'0%', height:'100%', background:'#3b82f6', transition:'width 0.5s'}}></div>
        </div>
      </div>

      {/* ヘッダー（改善版：スクロール時の透明度向上、ロゴサイズ微調整） */}
      <header className="fixed w-full z-50 py-4 transition-all duration-500 opacity-0" id="header" style={{transform: 'translateY(-20px)'}}>
        <div className="container mx-auto px-6 flex justify-between items-center glass-nav rounded-full p-3 pl-6 shadow-2xl shadow-black/20 border border-white/5">
          <a href="#" className="flex items-center gap-3 group shrink-0">
            <div className="relative w-11 h-11">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative w-full h-full bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-inner group-hover:rotate-12 transition-transform">L</div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white leading-none font-en">LARU<span className="font-light text-slate-300">Visona</span></span>
            </div>
          </a>
          
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 mr-2" title="Developer Mode">
              <i className="fas fa-code text-slate-400 text-xs"></i>
              <div className="dev-switch" id="dev-mode-toggle"></div>
            </div>

            <nav className="hidden md:flex items-center gap-1 font-bold text-xs text-slate-300 bg-black/20 rounded-full px-1 p-1 backdrop-blur-md">
              <a href="#about" className="hover:text-white hover:bg-white/10 px-5 py-2.5 rounded-full transition-all">About</a>
              <a href="#services" className="hover:text-white hover:bg-white/10 px-5 py-2.5 rounded-full transition-all">Services</a>
              <a href="#product" className="hover:text-white hover:bg-white/10 px-5 py-2.5 rounded-full transition-all">Product</a>
              <a href="#estimator" className="text-blue-400 hover:text-white hover:bg-blue-600 px-5 py-2.5 rounded-full transition-all flex items-center gap-2">
                <i className="fas fa-calculator"></i> 見積もり
              </a>
            </nav>

            <a href="#contact" className="hidden md:flex bg-white text-slate-900 px-7 py-3 rounded-full font-bold text-sm hover:bg-blue-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] transform hover:-translate-y-0.5 items-center gap-2 shrink-0 group">
              Contact <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
            </a>
          </div>
        </div>
      </header>

      {/* ヒーローセクション */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-slate-950" id="hero-section">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950 z-0"></div>
        
        <div className="container mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-3 border border-blue-500/30 bg-blue-900/10 backdrop-blur-md px-6 py-2 rounded-full mb-10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-xs font-bold tracking-[0.2em] text-blue-300 font-en">EST. 2025 TOKYO</span>
          </div>
          
          <h1 className="text-5xl md:text-8xl lg:text-[8rem] font-black tracking-tighter leading-[1.1] mb-8 text-white">
            「想像」を、<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
              「実装」する。
            </span>
          </h1>
          
          <p className="text-slate-400 text-lg md:text-xl leading-relaxed mb-12 max-w-2xl mx-auto font-medium">
            AIテクノロジーとクリエイティブの融合。<br/>
            LARUVisonaは、あなたのビジネスの「次」を実装します。
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <a href="#services" className="bg-white text-slate-900 px-12 py-5 rounded-full font-bold hover:bg-slate-200 transition-all shadow-[0_0_50px_-10px_rgba(255,255,255,0.4)] text-lg flex items-center justify-center gap-2 group">
              事業内容を見る <i className="fas fa-arrow-down group-hover:translate-y-1 transition-transform"></i>
            </a>
          </div>
        </div>
      </section>

      {/* フッター（簡略版） */}
      <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-800 relative z-10">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white text-sm">
              <i className="fas fa-robot"></i>
            </div>
            <span className="font-bold text-xl text-white font-en">LARU<span className="font-light text-slate-400">Visona</span></span>
          </div>
          <p className="text-sm mb-4">テクノロジーの力で、ビジネスの想像を実装する。</p>
          <div className="border-t border-slate-800 pt-8 text-center text-xs text-slate-600 font-en">
            &copy; 2025 LARUVisona Inc. All Rights Reserved. (Powered by Laru-Agent)
          </div>
        </div>
      </footer>
    </>
  );
}
