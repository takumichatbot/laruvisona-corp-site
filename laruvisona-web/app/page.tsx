'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Estimator from '@/components/Estimator';
import ChatMockup from '@/components/ChatMockup';
import VoiceUI from '@/components/VoiceUI';
import Contact from '@/components/Contact'; // 🌟 これを追加

// 3D背景（SSRオフ）
const Scene = dynamic(() => import('@/components/Canvas/Scene'), { ssr: false });

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  
  // 🌟 追加: フォームに渡す初期メッセージを管理するState
  const [contactMessage, setContactMessage] = useState('');

  // 🌟 追加: Estimatorから結果を受け取って、Contactへスクロールする関数
  const handleConsult = (details: string) => {
    setContactMessage(details); // メッセージをセット
    // 少し待ってからContactセクションへスクロール
    setTimeout(() => {
      document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    // 🌟 GSAPの初期化
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
    gsap.utils.toArray('.gsap-fade-up').forEach((elem: any) => {
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
      };
    }
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden selection:bg-blue-500 selection:text-white">
      
      {/* 🌟 1. カスタムカーソル (CSSはglobals.cssに追記を推奨) */}
      <div className="fixed top-0 left-0 w-2 h-2 bg-white rounded-full pointer-events-none mix-blend-difference z-[10000] hidden md:block" id="cursor-dot" />
      <div className="fixed top-0 left-0 w-10 h-10 border border-white/50 rounded-full pointer-events-none z-[9999] hidden md:block transition-transform duration-150 ease-out" id="cursor-outline" />

      {/* 🌟 2. 3D背景レイヤー */}
      <Scene />

      {/* 🌟 3. UIレイヤー */}
      <div className="relative z-10">
        
        {/* --- Header --- */}
        <header className="fixed w-full z-50 p-4 md:p-6 transition-all duration-500">
          <div className="container mx-auto max-w-7xl flex justify-between items-center bg-[#030712]/60 backdrop-blur-xl rounded-2xl p-3 pl-5 md:pl-6 border border-white/10 shadow-2xl">
            <a href="#" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black text-xl transition-transform duration-300 group-hover:rotate-12 font-en">L</div>
              <span className="text-lg md:text-xl font-bold tracking-tight text-white font-en">LARU<span className="font-light text-slate-400">Visona</span></span>
            </a>
            
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-2 font-bold text-xs text-slate-300">
                <a href="#about" className="hover:text-white px-4 py-2 transition-colors">ABOUT</a>
                <a href="#services" className="hover:text-white px-4 py-2 transition-colors">SERVICES</a>
                <a href="#product" className="hover:text-white px-4 py-2 transition-colors">PRODUCT</a>
                <a href="#estimator" className="text-blue-400 hover:text-blue-300 px-4 py-2 transition-colors">ESTIMATOR</a>
              </nav>
              <a href="#contact" className="hidden md:flex bg-white text-black px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all items-center gap-2">
                CONTACT <i className="fas fa-arrow-right"></i>
              </a>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className="md:hidden text-white w-12 h-12 flex items-center justify-center bg-white/5 rounded-xl border border-white/10 z-[60]"
              >
                <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-bars'} text-xl transition-all`}></i>
              </button>
            </div>
          </div>
        </header>

        {/* --- Mobile Menu --- */}
        <div className={`fixed inset-0 bg-[#030712]/95 backdrop-blur-2xl z-[55] flex flex-col justify-center items-center transition-all duration-500 ease-in-out ${isMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
          <div className="flex flex-col space-y-8 font-black text-4xl text-center tracking-tighter w-full px-6 font-en">
            <a href="#about" onClick={() => setIsMenuOpen(false)} className="text-white hover:text-blue-500 transition-colors">ABOUT</a>
            <a href="#services" onClick={() => setIsMenuOpen(false)} className="text-white hover:text-blue-500 transition-colors">SERVICES</a>
            <a href="#product" onClick={() => setIsMenuOpen(false)} className="text-white hover:text-blue-500 transition-colors">PRODUCT</a>
            <a href="#estimator" onClick={() => setIsMenuOpen(false)} className="text-blue-400 transition-colors">ESTIMATOR</a>
            <a href="#contact" onClick={() => setIsMenuOpen(false)} className="text-pink-500 mt-4 transition-colors">CONTACT</a>
          </div>
        </div>

        {/* --- Hero Section --- */}
        <section className="h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
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
          
          <p className="gsap-hero opacity-0 translate-y-10 text-slate-400 text-base md:text-xl font-medium mt-4 max-w-2xl leading-relaxed">
            「想像」を「実装」する。<br />
            AIとモダンWeb技術を駆使し、あなたのビジネスを次の次元へ。
          </p>
          
          <div className="gsap-hero opacity-0 translate-y-10 mt-12">
            <a href="#services" className="bg-white text-black px-10 py-4 rounded-full font-bold hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.2)] text-lg inline-flex items-center gap-3">
              Discover <i className="fas fa-arrow-down animate-bounce"></i>
            </a>
          </div>
        </section>

        {/* --- Tech Stack Marquee --- */}
        <section className="py-10 border-y border-white/5 bg-white/5 backdrop-blur-md overflow-hidden relative">
          <div className="flex gap-16 w-max animate-[marquee_25s_linear_infinite]">
            {['PYTHON', 'REACT', 'NEXT.JS', 'GENERATIVE AI', 'AWS', 'POSTGRESQL', 'TYPESCRIPT', 'PYTHON', 'REACT', 'NEXT.JS', 'GENERATIVE AI', 'AWS'].map((tech, i) => (
              <div key={i} className="text-2xl md:text-3xl font-black font-en text-transparent" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>
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
                  <span className="text-blue-500 font-bold text-xs tracking-[0.3em] uppercase font-en">WHO WE ARE</span>
                </div>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-8 leading-tight tracking-tight">
                  未来の景色を、<br />テクノロジーで描く。
                </h2>
                <p className="text-slate-400 leading-relaxed mb-6 text-base md:text-lg">
                  LARUVisona（ラルビゾナ）は、「Vision（展望）」と「Persona（人格）」を掛け合わせた造語です。
                </p>
                <p className="text-slate-400 leading-relaxed mb-10 text-base md:text-lg">
                  私たちは単なるシステム開発会社ではありません。AIという新たな「人格」をビジネスに宿らせ、御社が描く「展望」を最短距離で実現するパートナーです。
                </p>
                
                <div className="bg-white/5 rounded-2xl p-6 md:p-8 border border-white/5 backdrop-blur-xl">
                  <table className="w-full text-left text-sm md:text-base">
                    <tbody>
                      <tr className="border-b border-white/5">
                        <th className="py-4 text-slate-500 w-32 font-normal">会社名</th>
                        <td className="py-4 text-white font-bold">株式会社LARUVisona</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <th className="py-4 text-slate-500 font-normal">設立</th>
                        <td className="py-4 text-white">2026年4月1日</td>
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
                 {/* 3Dが奥にいることを強調するグラスパネル */}
                 <div className="w-full aspect-square max-w-md rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-500/10 to-transparent backdrop-blur-md p-8 flex items-center justify-center">
                    <div className="text-center">
                      <i className="fas fa-cube text-6xl text-white/30 mb-4"></i>
                      <p className="text-slate-400 font-en tracking-widest text-sm">3D CORE INTERFACE</p>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- Services (Horizontal Scroll) --- */}
        <section id="services" className="py-32 relative bg-[#030712] border-y border-white/5 overflow-hidden">
          <div className="container mx-auto px-6 max-w-7xl mb-16 gsap-fade-up">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-[1px] w-12 bg-blue-500"></div>
              <span className="text-blue-500 font-bold text-xs tracking-[0.3em] uppercase font-en">WHAT WE DO</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white leading-[1.1] tracking-tight">
              論理と、<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">感情。</span>
            </h2>
          </div>

          <div 
            ref={horizontalScrollRef}
            className="pl-6 md:pl-10 lg:pl-0 lg:ml-[calc((100vw-1280px)/2)] pb-10 overflow-x-auto hide-scrollbar cursor-grab flex gap-6 md:gap-8"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* Service Card 1 */}
            <div className="min-w-[320px] md:min-w-[400px] h-[450px] flex-shrink-0 bg-[#0f172a] rounded-[1.5rem] p-8 border border-white/5 relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center text-2xl mb-8 border border-blue-500/20"><i className="fas fa-code"></i></div>
                <h3 className="text-2xl font-bold text-white mb-4">Web / SaaS 開発</h3>
                <p className="text-slate-400 leading-relaxed text-sm mb-8 flex-grow">Next.jsやPythonを用いたモダンな技術選定により、高速かつ拡張性の高いWebアプリケーションを構築します。</p>
                <ul className="space-y-3 text-sm text-slate-300 font-medium">
                  <li className="flex items-center"><i className="fas fa-check text-blue-500 mr-3"></i>モダンフロントエンド (React)</li>
                  <li className="flex items-center"><i className="fas fa-check text-blue-500 mr-3"></i>堅牢なバックエンド (Python)</li>
                </ul>
              </div>
            </div>

            {/* Service Card 2 */}
            <div className="min-w-[320px] md:min-w-[400px] h-[450px] flex-shrink-0 bg-gradient-to-br from-indigo-900/40 to-[#0f172a] rounded-[1.5rem] p-8 border border-indigo-500/20 relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300">
              <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl tracking-widest font-en">MAIN</div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-16 h-16 bg-indigo-500/20 text-indigo-300 rounded-2xl flex items-center justify-center text-2xl mb-8 border border-indigo-400/30"><i className="fas fa-brain"></i></div>
                <h3 className="text-2xl font-bold text-white mb-4">AIソリューション</h3>
                <p className="text-indigo-200/80 leading-relaxed text-sm mb-8 flex-grow">自社SaaS「LARUbot」のノウハウを活かし、Gemini APIなどのLLMを組み込んだ業務効率化システムを開発。</p>
                <ul className="space-y-3 text-sm text-indigo-100 font-medium">
                  <li className="flex items-center"><i className="fas fa-check text-indigo-400 mr-3"></i>チャットボット導入支援</li>
                  <li className="flex items-center"><i className="fas fa-check text-indigo-400 mr-3"></i>社内ナレッジ検索AI (RAG)</li>
                </ul>
              </div>
            </div>

            {/* Service Card 3 */}
            <div className="min-w-[320px] md:min-w-[400px] h-[450px] flex-shrink-0 bg-[#0f172a] rounded-[1.5rem] p-8 border border-white/5 relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-16 h-16 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center text-2xl mb-8 border border-purple-500/20"><i className="fas fa-chart-line"></i></div>
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

        {/* --- Product (LARUbot) Section --- */}
        <section id="product" className="py-32 relative bg-[#030712]/90 border-t border-white/5 z-10 overflow-hidden">
          <div className="container mx-auto px-6 max-w-7xl relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
              <div className="lg:w-1/2 gsap-fade-up text-center lg:text-left">
                <div className="inline-block bg-white/10 text-white text-[10px] font-bold px-3 py-1 rounded-full mb-4 border border-white/10 font-en tracking-widest">FLAGSHIP PRODUCT</div>
                <h2 className="text-5xl lg:text-7xl font-black mb-4 font-en tracking-tight text-white">LARUbot</h2>
                <p className="text-blue-400 text-xl font-bold mb-6">24時間働く、AI営業アシスタント</p>
                <p className="text-slate-400 leading-relaxed mb-10 text-sm md:text-base">
                  問い合わせ対応の自動化から顧客管理(CRM)、チャット内決済までを一元化。<br />専門知識がなくても、誰でも簡単にAIをビジネスに導入できるSaaSプラットフォームです。
                </p>
                <a href="https://larubot.tokyo" target="_blank" rel="noopener noreferrer" className="bg-white text-black font-bold py-4 px-8 rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)] inline-flex items-center gap-2">
                  公式サイトへ <i className="fas fa-external-link-alt"></i>
                </a>
              </div>
              <div className="lg:w-1/2 w-full gsap-fade-up">
                {/* 🌟 ライブデモ・チャットコンポーネントを呼び出し */}
                <ChatMockup />
              </div>
            </div>
          </div>
        </section>

        {/* --- Voice UI Demo Section --- */}
        <section id="voice" className="py-40 relative flex items-center justify-center min-h-[60vh] border-t border-white/5 z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#030712] to-[#030712] pointer-events-none"></div>
          <div className="container mx-auto px-6 relative z-10 text-center gsap-fade-up">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">声で操る、未来のUI。</h2>
            <p className="text-slate-400 mb-16 max-w-xl mx-auto text-base">
              下のコアをクリックし、「サービス」や「見積もり」と話しかけてみてください。<br/>（※マイクの許可が必要です）
            </p>
            {/* 🌟 音声UIコンポーネントを呼び出し */}
            <VoiceUI />
          </div>
        </section>

        {/* --- AI Estimator Section --- */}
        {/* ▼ これを追記！ */}
        <section id="estimator" className="py-32 relative bg-[#030712] border-t border-white/5 z-10">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-16 gsap-fade-up">
              <span className="text-blue-500 font-bold text-xs tracking-[0.3em] uppercase mb-4 block font-en">AI ESTIMATION</span>
              <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">開発費用シミュレーター</h2>
              <p className="text-slate-400 text-base md:text-lg">プロジェクトの要件を選択するだけで、概算費用をリアルタイム算出します。</p>
            </div>
            
            <div className="gsap-fade-up">
              {/* 🌟 修正: onConsult を渡す */}
              <Estimator onConsult={handleConsult} />
            </div>
          </div>
        </section>

        {/* --- Contact & Footer --- */}
        <section id="contact" className="py-32 relative bg-transparent z-10">
          <div className="container mx-auto px-6 max-w-4xl text-center gsap-fade-up">
            <h2 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight font-en">Contact Us</h2>
            <p className="text-slate-400 mb-16 text-lg">未来を共に創るパートナーとして、まずはお気軽にご相談ください。</p>
            
            {/* 🌟 修正: 先ほど作ったContactコンポーネントに置き換え、メッセージを渡す */}
            <Contact initialMessage={contactMessage} />
            
          </div>
        </section>

        <footer className="bg-[#030712] text-slate-500 py-12 border-t border-white/5 relative z-10 text-center">
          <div className="text-2xl font-black tracking-tight font-en text-white mb-6">LARU<span className="font-light text-slate-600">Visona</span></div>
          <p className="text-xs font-mono text-slate-600">&copy; 2026 LARUVisona Inc. Tokyo. All Rights Reserved.</p>
        </footer>

      </div>
      
      {/* 🌟 Custom Cursor CSS (インライン) */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    ` }} />
    </main>
  );
}