'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Estimator from '@/components/Estimator';
import VoiceUI from '@/components/VoiceUI';
import { WORKS, ACCENT_STYLES } from '@/lib/works-data';
import InquiryForm from '@/components/InquiryForm';
import Intro from '@/components/Intro';

// 3D背景（SSRオフ）
const Scene = dynamic(() => import('@/components/Canvas/Scene'), { ssr: false });

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [inquiryPrefill, setInquiryPrefill] = useState('');
  const horizontalScrollRef = useRef<HTMLDivElement>(null);

  // 見積もりシミュレーターの内容を問い合わせフォームに引き継いでスクロール
  const handleConsult = (estimateDetails: string) => {
    setInquiryPrefill(estimateDetails);
    setTimeout(() => {
      document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    // カーソル追従
    let cleanupCursor: (() => void) | undefined;
    if (window.innerWidth > 768) {
      const dot = document.getElementById('cursor-dot');
      const outline = document.getElementById('cursor-outline');
      const onMove = (e: MouseEvent) => {
        if (dot) { dot.style.left = `${e.clientX}px`; dot.style.top = `${e.clientY}px`; }
        if (outline) outline.animate({ left: `${e.clientX}px`, top: `${e.clientY}px` }, { duration: 500, fill: 'forwards' });
      };
      window.addEventListener('mousemove', onMove);
      cleanupCursor = () => window.removeEventListener('mousemove', onMove);
    }

    // GSAPの初期化
    gsap.registerPlugin(ScrollTrigger);

    // 🌟 ヒーローセクションのシネマティック登場アニメーション
    const tl = gsap.timeline();
    tl.to('.gsap-hero', {
      y: 0,
      opacity: 1,
      duration: 1.2,
      stagger: 0.15,
      ease: 'power4.out',
      delay: 0.2
    });

    // 🌟 スクロール連動のフェードアップアニメーション
    gsap.utils.toArray<HTMLElement>('.gsap-fade-up').forEach((elem) => {
      gsap.fromTo(elem, 
        { y: 50, opacity: 0 },
        { 
          scrollTrigger: {
            trigger: elem,
            start: "top 85%",
          },
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out"
        }
      );
    });

    // 🌟 疑似横スクロール（ドラッグ操作）の設定
    const slider = horizontalScrollRef.current;
    let isDown = false;
    let startX: number;
    let scrollLeft: number;

    if (slider) {
      const onMouseDown = (e: MouseEvent) => {
        isDown = true;
        slider.style.cursor = 'grabbing';
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
      };
      const onMouseLeave = () => { isDown = false; slider.style.cursor = 'grab'; };
      const onMouseUp = () => { isDown = false; slider.style.cursor = 'grab'; };
      const onMouseMove = (e: MouseEvent) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2;
        slider.scrollLeft = scrollLeft - walk;
      };

      slider.addEventListener('mousedown', onMouseDown);
      slider.addEventListener('mouseleave', onMouseLeave);
      slider.addEventListener('mouseup', onMouseUp);
      slider.addEventListener('mousemove', onMouseMove);

      return () => {
        slider.removeEventListener('mousedown', onMouseDown);
        slider.removeEventListener('mouseleave', onMouseLeave);
        slider.removeEventListener('mouseup', onMouseUp);
        slider.removeEventListener('mousemove', onMouseMove);
        cleanupCursor?.();
      };
    }
    return () => { cleanupCursor?.(); };
  }, []);

  return (
    <>
    {showIntro && <Intro onComplete={() => setShowIntro(false)} />}
    {/* bg必須: globals.css の非レイヤー body{background:#fff} が Tailwind v4 のレイヤー化
        ユーティリティ(bodyのbg-[#030712])に勝つため、LPはここで暗背景を敷く */}
    <main className="relative min-h-screen bg-[#030712] [overflow-x:clip] selection:bg-blue-500 selection:text-white">
      
      {/* カスタムカーソル */}
      <div className="hidden md:block" id="cursor-dot" style={{ position: 'fixed', top: 0, left: 0, width: 8, height: 8, background: 'white', borderRadius: '50%', pointerEvents: 'none', zIndex: 10000, transform: 'translate(-50%,-50%)', mixBlendMode: 'difference' }} />
      <div className="hidden md:block" id="cursor-outline" style={{ position: 'fixed', top: 0, left: 0, width: 40, height: 40, border: '1px solid rgba(255,255,255,0.5)', borderRadius: '50%', pointerEvents: 'none', zIndex: 9999, transform: 'translate(-50%,-50%)' }} />

      {/* 🌟 2. 3D背景レイヤー（球体スクロールストーリー。イントロ終了で誕生シーン開始） */}
      <Scene introDone={!showIntro} />

      {/* 🌟 3. UIレイヤー */}
      <div className="relative z-10">
        
        {/* --- Header --- */}
        <header className="fixed w-full z-50 p-4 md:p-6 transition-all duration-500">
          <div className="container mx-auto max-w-7xl flex justify-between items-center bg-[#030712]/60 backdrop-blur-xl rounded-2xl p-3 pl-5 md:pl-6 border border-white/10 shadow-2xl">
            <a href="/" className="flex items-center group">
              <img src="/images/logo_dark.png" alt="LaruVisona" className="h-10 w-auto transition-transform duration-300 group-hover:scale-105" />
            </a>
            
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-2 font-bold text-xs text-slate-300">
                <a href="#about" className="hover:text-white px-4 py-2 transition-colors">会社概要</a>
                <a href="#services" className="hover:text-white px-4 py-2 transition-colors">サービス</a>
                <a href="#works" className="hover:text-white px-4 py-2 transition-colors">実績</a>
                <a href="#estimator" className="text-blue-400 hover:text-blue-300 px-4 py-2 transition-colors">見積もり</a>
                <a href="#product" className="hover:text-white px-4 py-2 transition-colors">プロダクト</a>
                <a href="/laruHP" className="text-cyan-400 hover:text-cyan-300 px-4 py-2 transition-colors border border-cyan-500/30 rounded-lg">LARU HP ✨</a>
              </nav>
              <a href="#contact" className="hidden md:flex bg-white text-black px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all items-center gap-2">
                お問い合わせ <i className="fas fa-arrow-right"></i>
              </a>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`md:hidden flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-xl border z-[60] transition-all active:scale-95 ${isMenuOpen ? 'bg-white/25 border-white/50' : 'bg-white/15 border-white/30 hover:bg-white/25'}`}
                aria-label={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
              >
                <div className="relative w-5 h-4 flex flex-col justify-between" aria-hidden="true">
                  <span className={`block h-[2px] rounded-full bg-white transition-all duration-300 origin-center ${isMenuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} style={{ width: '100%' }} />
                  <span className={`block h-[2px] rounded-full bg-white transition-all duration-300 ${isMenuOpen ? 'opacity-0 scale-x-0' : ''}`} style={{ width: '100%' }} />
                  <span className={`block h-[2px] rounded-full bg-white transition-all duration-300 origin-center ${isMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} style={{ width: isMenuOpen ? '100%' : '70%' }} />
                </div>
                <span className="text-[9px] font-bold tracking-widest leading-none text-white/90">
                  {isMenuOpen ? 'CLOSE' : 'MENU'}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* --- Mobile Menu --- */}
        <div className={`fixed inset-0 bg-[#030712]/97 backdrop-blur-2xl z-[55] flex flex-col justify-center items-center transition-all duration-500 ease-in-out ${isMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
          {/* Close button */}
          <button
            onClick={() => setIsMenuOpen(false)}
            className="absolute top-5 right-5 w-14 h-14 flex items-center justify-center bg-white/10 border border-white/20 rounded-2xl text-white hover:bg-white/20 transition-all active:scale-95"
            aria-label="メニューを閉じる"
          >
            <i className="fas fa-times text-2xl"></i>
          </button>
          <div className="flex flex-col space-y-6 font-bold text-3xl text-center tracking-tight w-full px-8">
            <a href="#about" onClick={() => setIsMenuOpen(false)} className="text-white hover:text-blue-400 transition-colors py-2">会社概要</a>
            <a href="#services" onClick={() => setIsMenuOpen(false)} className="text-white hover:text-blue-400 transition-colors py-2">サービス</a>
            <a href="#works" onClick={() => setIsMenuOpen(false)} className="text-white hover:text-blue-400 transition-colors py-2">実績</a>
            <a href="#estimator" onClick={() => setIsMenuOpen(false)} className="text-blue-400 hover:text-blue-300 transition-colors py-2">見積もり</a>
            <a href="#product" onClick={() => setIsMenuOpen(false)} className="text-white hover:text-blue-400 transition-colors py-2">プロダクト</a>
            <a href="#contact" onClick={() => setIsMenuOpen(false)} className="bg-white text-black px-8 py-4 rounded-2xl font-bold text-xl mt-4 hover:bg-blue-50 transition-colors">お問い合わせ</a>
          </div>
        </div>

        {/* --- Hero Section --- */}
        <section className="relative h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
          {/* 3D球の上で文字を読みやすくする暗いスクリム（セクションのz-10内＝背景3Dより前面） */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 65% 55% at 50% 45%, rgba(3,7,18,0.78) 0%, rgba(3,7,18,0.45) 45%, transparent 72%)' }} aria-hidden="true" />
          <div className="relative z-10 flex flex-col items-center">
          <div className="gsap-hero opacity-0 translate-y-10 inline-flex items-center gap-3 border border-white/10 bg-white/5 backdrop-blur-md px-5 py-2 rounded-full mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-xs font-bold tracking-[0.2em] text-slate-300 font-en">EST. 2026 TOKYO</span>
          </div>
          
          <h1 className="text-6xl sm:text-7xl md:text-[9rem] font-black tracking-tighter leading-[1.1] mb-6 font-en">
            <span className="gsap-hero opacity-0 translate-y-10 block text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-blue-500">IMAGINE.</span>
            <span className="gsap-hero opacity-0 translate-y-10 block text-white drop-shadow-[0_0_40px_rgba(59,130,246,0.3)]">IMPLEMENT.</span>
          </h1>
          
          <p className="gsap-hero opacity-0 translate-y-10 text-slate-200 text-base md:text-xl font-medium mt-4 max-w-2xl leading-relaxed [text-shadow:0_2px_16px_rgba(3,7,18,0.95),0_0_4px_rgba(3,7,18,0.9)]">
            「想像」を「実装」する。<br />
            AI・Webアプリの受託開発パートナー。<br className="hidden sm:block" />
            あなたのビジネスを次の次元へ。
          </p>
          
          <div className="gsap-hero opacity-0 translate-y-10 mt-12">
            <a href="#services" className="bg-white text-black px-10 py-4 rounded-full font-bold hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.2)] text-lg inline-flex items-center gap-3">
              Discover <i className="fas fa-arrow-down animate-bounce"></i>
            </a>
          </div>
          </div>
        </section>

        {/* --- Tech Stack Marquee --- */}
        <section className="py-10 border-y border-white/5 bg-white/5 backdrop-blur-md overflow-hidden relative">
          <div className="flex gap-16 w-max animate-[marquee_25s_linear_infinite]">
            {['PYTHON', 'REACT', 'NEXT.JS', 'GENERATIVE AI', 'AWS', 'POSTGRESQL', 'TYPESCRIPT', 'PYTHON', 'REACT', 'NEXT.JS', 'GENERATIVE AI', 'AWS'].map((tech, i) => (
              <div key={i} className="text-2xl md:text-3xl font-bold font-en text-transparent" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>
                {tech}
              </div>
            ))}
          </div>
        </section>

        {/* --- About Section --- */}
        <section id="about" className="py-32 relative bg-[#030712]/80 backdrop-blur-lg">
          <div className="container mx-auto px-6 max-w-7xl">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="gsap-fade-up">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-[1px] w-12 bg-blue-500"></div>
                  <span className="text-blue-500 font-bold text-xs tracking-[0.3em]">私たちについて</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-8 leading-tight tracking-tight">
                  未来の景色を、<br />テクノロジーで描く。
                </h2>
                <p className="text-slate-400 leading-relaxed mb-6 text-base md:text-lg">
                  LaruVisona（ラルビゾナ）は、「Vision（展望）」と「Persona（人格）」を掛け合わせた造語です。
                </p>
                <p className="text-slate-400 leading-relaxed mb-10 text-base md:text-lg">
                  私たちは単なるシステム開発会社ではありません。AIという新たな「人格」をビジネスに宿らせ、御社が描く「展望」を最短距離で実現するパートナーです。
                </p>
                
                <div className="bg-white/5 rounded-2xl p-6 md:p-8 border border-white/5 backdrop-blur-xl">
                  <table className="w-full text-left text-sm md:text-base">
                    <tbody>
                      <tr className="border-b border-white/5">
                        <th className="py-4 text-slate-500 w-32 font-normal">会社名</th>
                        <td className="py-4 text-white font-bold">株式会社LaruVisona</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <th className="py-4 text-slate-500 font-normal">代表取締役</th>
                        <td className="py-4 text-white">齋藤匠</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <th className="py-4 text-slate-500 font-normal">設立</th>
                        <td className="py-4 text-white">2026年4月1日</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <th className="py-4 text-slate-500 align-top font-normal">所在地</th>
                        <td className="py-4 text-white leading-relaxed text-sm">東京都板橋区南常盤台1丁目11-6<br />101号室</td>
                      </tr>
                      <tr>
                        <th className="py-4 text-slate-500 align-top font-normal">事業内容</th>
                        <td className="py-4 text-white leading-relaxed">AI SaaS事業（LARUbot）<br />Webシステム・アルゴリズム開発</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="gsap-fade-up lg:mt-0 mt-12 flex justify-center items-center">
                 <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-500/10 to-transparent backdrop-blur-md p-10 flex flex-col items-center gap-8">
                   <img src="/images/logo_dark.png" alt="LaruVisona" className="w-44 h-auto drop-shadow-[0_0_30px_rgba(255,255,255,0.15)]" />
                   <div className="grid grid-cols-2 gap-3 w-full">
                     {[
                       { value: 'AI', label: 'AI駆動' },
                       { value: '3+', label: 'プロダクト' },
                       { value: '24/7', label: '稼働率' },
                       { value: '∞', label: 'スケール' },
                     ].map(({ value, label }) => (
                       <div key={label} className="text-center p-4 bg-white/5 rounded-xl border border-white/5">
                         <div className="text-2xl font-bold text-white">{value}</div>
                         <div className="text-slate-500 text-[10px] tracking-widest mt-1">{label}</div>
                       </div>
                     ))}
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- Services (Horizontal Scroll) --- */}
        <section id="services" className="py-32 relative bg-[#030712]/70 border-y border-white/5 [overflow-y:clip]">
          <div className="container mx-auto px-6 max-w-7xl mb-16 gsap-fade-up">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-[1px] w-12 bg-blue-500"></div>
              <span className="text-blue-500 font-bold text-xs tracking-[0.3em]">サービス内容</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-white leading-[1.1] tracking-tight">
              論理と、<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">感情。</span>
            </h2>
          </div>

          <div 
            ref={horizontalScrollRef}
            className="pl-6 md:pl-10 lg:pl-0 lg:ml-[calc((100vw-1280px)/2)] pb-10 overflow-x-auto hide-scrollbar cursor-grab flex gap-6 md:gap-8"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* Service Card 1 */}
            <div data-lv-card="0" className="w-[72vw] max-w-[260px] sm:max-w-none sm:min-w-[320px] md:min-w-[400px] h-[450px] flex-shrink-0 bg-[#0f172a] rounded-[1.5rem] p-8 border border-white/5 relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mb-8 border border-blue-500/20">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Web / SaaS 開発</h3>
                <p className="text-slate-400 leading-relaxed text-sm mb-8 flex-grow">Next.jsやPythonを用いたモダンな技術選定により、高速かつ拡張性の高いWebアプリケーションを構築します。</p>
                <ul className="space-y-3 text-sm text-slate-300 font-medium">
                  <li className="flex items-center"><i className="fas fa-check text-blue-500 mr-3"></i>モダンフロントエンド (React)</li>
                  <li className="flex items-center"><i className="fas fa-check text-blue-500 mr-3"></i>堅牢なバックエンド (Python)</li>
                </ul>
              </div>
            </div>

            {/* Service Card 2 */}
            <div data-lv-card="1" className="w-[72vw] max-w-[260px] sm:max-w-none sm:min-w-[320px] md:min-w-[400px] h-[450px] flex-shrink-0 bg-gradient-to-br from-indigo-900/40 to-[#0f172a] rounded-[1.5rem] p-8 border border-indigo-500/20 relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300">
              <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl tracking-widest">主力事業</div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-16 h-16 bg-indigo-500/20 text-indigo-300 rounded-2xl flex items-center justify-center mb-8 border border-indigo-400/30">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.4 2.1-1.1 2.8A5 5 0 0 1 17 13v1a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-1a5 5 0 0 1 2.1-4.2A4 4 0 0 1 8 6a4 4 0 0 1 4-4z"/>
                    <line x1="9" y1="16" x2="9" y2="21"/><line x1="15" y1="16" x2="15" y2="21"/>
                    <line x1="7" y1="21" x2="17" y2="21"/>
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">AIソリューション</h3>
                <p className="text-indigo-200/80 leading-relaxed text-sm mb-8 flex-grow">自社SaaS「LARUbot」のノウハウを活かし、Gemini APIなどのLLMを組み込んだ業務効率化システムを開発。</p>
                <ul className="space-y-3 text-sm text-indigo-100 font-medium">
                  <li className="flex items-center"><i className="fas fa-check text-indigo-400 mr-3"></i>チャットボット導入支援</li>
                  <li className="flex items-center"><i className="fas fa-check text-indigo-400 mr-3"></i>社内ナレッジ検索AI (RAG)</li>
                </ul>
              </div>
            </div>

            {/* Service Card 3 */}
            <div data-lv-card="2" className="w-[72vw] max-w-[260px] sm:max-w-none sm:min-w-[320px] md:min-w-[400px] h-[450px] flex-shrink-0 bg-[#0f172a] rounded-[1.5rem] p-8 border border-white/5 relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-16 h-16 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center mb-8 border border-purple-500/20">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                    <polyline points="16 7 22 7 22 13"/>
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">アルゴリズム・HFT</h3>
                <p className="text-slate-400 leading-relaxed text-sm mb-8 flex-grow">Hyperliquid等のプラットフォームに向けた、高速処理が求められるアルゴリズムトレードシステムの設計と実装。</p>
                <ul className="space-y-3 text-sm text-slate-300 font-medium">
                  <li className="flex items-center"><i className="fas fa-check text-purple-500 mr-3"></i>ボット戦略構築</li>
                  <li className="flex items-center"><i className="fas fa-check text-purple-500 mr-3"></i>データ解析・バックテスト</li>
                </ul>
              </div>
            </div>
            
            {/* Spacer for scroll */}
            <div className="min-w-[20px] md:min-w-[100px] flex-shrink-0"></div>
          </div>
        </section>

        {/* --- Works Section（開発実績 — 受託営業用ポートフォリオ） --- */}
        <section id="works" className="py-32 relative bg-[#030712]/80 border-t border-white/5 z-10">
          <div className="container mx-auto px-6 max-w-7xl">
            <div className="gsap-fade-up mb-16">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-[1px] w-12 bg-blue-500"></div>
                <span className="text-blue-500 font-bold text-xs tracking-[0.3em]">開発実績</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-bold text-white leading-[1.1] tracking-tight">
                WORKS<span className="text-blue-500">.</span>
              </h2>
              <p className="text-slate-400 text-base md:text-lg mt-6">企画から運用まで、1名フルスタックで作り切った自社プロダクト。</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {WORKS.map(work => {
                const accent = ACCENT_STYLES[work.accent];
                return (
                  <a key={work.slug} href={`/works/${work.slug}`} className={`gsap-fade-up group bg-[#0f172a] rounded-[1.5rem] p-8 border border-white/5 ${accent.border} hover:-translate-y-2 transition-all duration-300 flex flex-col`}>
                    <div className="flex items-center gap-2 mb-6">
                      <span className={`inline-flex border text-[10px] font-bold px-3 py-1 rounded-full tracking-widest ${accent.chip}`}>{work.category}</span>
                      {work.placeholder && <span className="inline-flex bg-white/5 border border-white/10 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-full tracking-widest">準備中</span>}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold font-en tracking-tight text-white mb-2">{work.name}</h3>
                    <p className={`text-sm font-bold mb-4 ${accent.text}`}>{work.tagline}</p>
                    <p className="text-slate-400 text-sm leading-relaxed flex-grow mb-6 line-clamp-3">{work.overview}</p>
                    <div className="flex flex-wrap gap-1.5 mb-6">
                      {work.tech.slice(0, 4).map(t => (
                        <span key={t} className="bg-white/5 text-slate-400 text-[10px] font-bold px-2.5 py-1 rounded-full font-en">{t}</span>
                      ))}
                    </div>
                    <span className="text-white font-bold text-sm inline-flex items-center gap-2 group-hover:gap-3 transition-all">
                      詳細を見る <i className="fas fa-arrow-right text-xs"></i>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        {/* --- AI Estimator Section（受託開発の主動線） --- */}
        <section id="estimator" className="py-32 relative bg-[#030712]/70 border-t border-white/5 z-10">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-16 gsap-fade-up">
              <span className="text-blue-500 font-bold text-xs tracking-[0.3em] mb-4 block">AI 開発費見積もり</span>
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">開発費用シミュレーター</h2>
              <p className="text-slate-400 text-base md:text-lg">プロジェクトの要件を選択するだけで、概算費用をリアルタイム算出します。</p>
            </div>

            <div className="gsap-fade-up">
              <Estimator onConsult={handleConsult} />
            </div>
          </div>
        </section>

        {/* --- Products Section（自社プロダクトは外部送客のカードに簡素化） --- */}
        <section id="product" className="py-32 relative bg-[#030712]/90 border-t border-white/5 z-10 overflow-hidden">
          <div className="container mx-auto px-6 max-w-6xl relative z-10">
            <div className="text-center mb-16 gsap-fade-up">
              <span className="text-blue-500 font-bold text-xs tracking-[0.3em] mb-4 block">自社プロダクト</span>
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">プロダクト</h2>
              <p className="text-slate-400 text-base md:text-lg">受託開発で培った技術を、誰でも使えるSaaSに。</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 md:gap-8">
              {/* LARUbot card */}
              <a href="https://larubot.tokyo" target="_blank" rel="noopener noreferrer" className="gsap-fade-up group bg-[#0f172a] rounded-[1.5rem] p-8 md:p-10 border border-white/5 hover:border-indigo-400/40 hover:-translate-y-2 transition-all duration-300 flex flex-col text-left">
                <div className="inline-flex self-start bg-indigo-500/15 text-indigo-300 text-[10px] font-bold px-3 py-1 rounded-full mb-6 border border-indigo-400/20 tracking-widest">AIチャットボットSaaS</div>
                <h3 className="text-3xl md:text-4xl font-bold font-en tracking-tight text-white mb-2">LARUbot</h3>
                <p className="text-blue-400 font-bold mb-4">24時間働く、AI営業アシスタント</p>
                <p className="text-slate-400 leading-relaxed text-sm mb-8 flex-grow">
                  問い合わせ対応の自動化から顧客管理(CRM)、チャット内決済までを一元化するSaaSプラットフォーム。
                </p>
                <span className="text-white font-bold text-sm inline-flex items-center gap-2 group-hover:gap-3 transition-all">
                  公式サイトへ <i className="fas fa-external-link-alt text-xs"></i>
                </span>
              </a>
              {/* LARU HP card */}
              <a href="/laruHP" className="gsap-fade-up group bg-[#0f172a] rounded-[1.5rem] p-8 md:p-10 border border-white/5 hover:border-cyan-400/40 hover:-translate-y-2 transition-all duration-300 flex flex-col text-left">
                <div className="inline-flex self-start bg-cyan-500/15 text-cyan-300 text-[10px] font-bold px-3 py-1 rounded-full mb-6 border border-cyan-400/20 tracking-widest">AIホームページビルダー</div>
                <h3 className="text-3xl md:text-4xl font-bold font-en tracking-tight text-white mb-2">LARU<span className="text-cyan-400">HP</span></h3>
                <p className="text-cyan-400 font-bold mb-4">月額999円、AIで最高のHPを最短で</p>
                {/* ミニブラウザモック（球体ストーリーScene4の吸い込み先） */}
                <div data-lv-mock className="rounded-xl overflow-hidden border border-white/10 mb-6">
                  <div className="bg-[#0b1222] border-b border-white/10 px-3 py-2 flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500/60" />
                      <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                      <div className="w-2 h-2 rounded-full bg-green-500/60" />
                    </div>
                    <div className="flex-1 bg-white/10 rounded px-2 py-0.5 text-[10px] text-slate-500 font-mono">your-shop.laruvisona.jp</div>
                    <span className="text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold">公開中</span>
                  </div>
                  <div className="relative bg-gradient-to-r from-blue-700 to-indigo-700 px-4 py-5 text-white text-center">
                    {/* 球体が吸い込まれた後に残る「青いドット」（Scene4）。
                        外側で表示切替（inline opacity）、内側でpulse — 競合させない */}
                    <span data-lv-dot className="pointer-events-none absolute top-2 right-2 opacity-0 transition-opacity duration-500" aria-hidden="true">
                      <span className="block w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)] animate-pulse" />
                    </span>
                    <div className="text-sm font-black">〇〇整体院</div>
                    <div className="text-[10px] opacity-80">AIが5分でホームページを自動生成</div>
                  </div>
                </div>
                <p className="text-slate-400 leading-relaxed text-sm mb-8 flex-grow">
                  業種情報を入力するだけでAIがホームページを自動生成。SEO・予約・集客までこれひとつ。
                </p>
                <span className="text-white font-bold text-sm inline-flex items-center gap-2 group-hover:gap-3 transition-all">
                  詳しく見る <i className="fas fa-arrow-right text-xs"></i>
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* --- Voice UI Demo Section（遊びのデモはページ下部へ） --- */}
        <section id="voice" className="py-40 relative flex items-center justify-center min-h-[60vh] border-t border-white/5 z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#030712] to-[#030712] pointer-events-none"></div>
          {/* 見出し・説明文の背後を暗くするスクリム（球体が透けても可読性を保つ） */}
          <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 35%, rgba(3,7,18,0.85) 0%, rgba(3,7,18,0.4) 55%, transparent 78%)' }} aria-hidden="true"></div>
          <div className="container mx-auto px-6 relative z-10 text-center gsap-fade-up">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight [text-shadow:0_2px_16px_rgba(3,7,18,0.95)]">声で操る、未来のUI。</h2>
            <p className="text-slate-200 mb-16 max-w-xl mx-auto text-base [text-shadow:0_2px_12px_rgba(3,7,18,0.95),0_0_4px_rgba(3,7,18,0.9)]">
              下のコアをクリックし、「サービス」や「見積もり」と話しかけてみてください。<br/>（※マイクの許可が必要です）
            </p>
            {/* 🌟 音声UIコンポーネントを呼び出し */}
            <VoiceUI />
          </div>
        </section>

        {/* --- Contact & Footer --- */}
        <section id="contact" className="py-32 relative z-10 bg-black/55 backdrop-blur-sm">
          <div className="container mx-auto px-6 max-w-4xl text-center gsap-fade-up">
            <h2 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">お問い合わせ</h2>
            <p className="text-slate-400 mb-16 text-lg">未来を共に創るパートナーとして、まずはお気軽にご相談ください。</p>
            
            <InquiryForm dark prefillMessage={inquiryPrefill} />

          </div>
        </section>

        <footer className="bg-[#000] text-slate-500 py-12 md:py-16 border-t border-white/5 relative z-10 text-center">
          <div className="flex flex-col items-center">
            <div className="bg-white/5 p-3 rounded-2xl mb-8 opacity-80 hover:opacity-100 transition-opacity">
              <img src="/images/logo_dark.png" alt="LaruVisona" className="h-8 w-auto object-contain" />
            </div>
            <div className="flex flex-wrap justify-center gap-8 text-xs font-bold mb-10 tracking-widest uppercase">
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms</a>
              <a href="#about" className="hover:text-white transition-colors">Company</a>
            </div>
            <p className="text-xs font-mono text-slate-600">&copy; 2026 株式会社LaruVisona All Rights Reserved.</p>
          </div>
        </footer>

      </div>
      
      {/* 🌟 Custom Cursor CSS (インライン) */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    ` }} />
    </main>
    </>
  );
}