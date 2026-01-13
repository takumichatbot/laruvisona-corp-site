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
            
            // GSAPアニメーション
            if (typeof window !== 'undefined' && (window as any).gsap) {
              const gsap = (window as any).gsap;
              gsap.to(".gsap-hero-elem", {
                opacity: 1, y: 0, duration: 1, stagger: 0.2, ease: "power3.out", delay: 0.8
              });
              
              // Vanta.js初期化
              if ((window as any).VANTA && (window as any).THREE) {
                try {
                  (window as any).VANTA.GLOBE({
                    el: "#hero-section",
                    mouseControls: true,
                    touchControls: true,
                    gyroControls: false,
                    minHeight: 200.00,
                    minWidth: 200.00,
                    scale: 1.00,
                    scaleMobile: 1.00,
                    color: 0x3b82f6,
                    color2: 0x4f46e5,
                    backgroundColor: 0x020617
                  });
                } catch(e) {
                  console.log("Vanta JS init failed", e);
                }
              }
            }
          }, 500);
        }
      }, 100);
    }

    // GSAP ScrollTriggerの登録
    if (typeof window !== 'undefined' && (window as any).gsap) {
      const gsap = (window as any).gsap;
      if (gsap.registerPlugin && (window as any).ScrollTrigger) {
        gsap.registerPlugin((window as any).ScrollTrigger);
        
        // スクロールアニメーション
        gsap.utils.toArray('.gsap-fade-up').forEach((element: any) => {
          gsap.fromTo(element, 
            { opacity: 0, y: 50 },
            {
              opacity: 1, y: 0, duration: 1, ease: "power3.out",
              scrollTrigger: { trigger: element, start: "top 80%" }
            }
          );
        });
      }
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
      if (el) {
        const current = parseInt(el.innerText) || 0;
        const diff = total - current;
        const steps = 15;
        let step = 0;

        if ((window as any).estTimer) clearInterval((window as any).estTimer);
        (window as any).estTimer = setInterval(() => {
          step++;
          if (step >= steps) {
            el.innerText = total.toString();
            const detailBase = document.getElementById('detail-base');
            const detailOpt = document.getElementById('detail-opt');
            const detailSpeed = document.getElementById('detail-speed');
            if (detailBase) detailBase.innerText = `¥${baseCost}万`;
            if (detailOpt) detailOpt.innerText = `¥${optCost}万`;
            if (detailSpeed) detailSpeed.innerText = `¥${speedCost}万`;
            clearInterval((window as any).estTimer);
          } else {
            el.innerText = Math.round(current + (diff * step) / steps).toString();
          }
        }, 20);
      }
    };

    // イベントリスナーを設定
    setTimeout(() => {
      document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', calcEstimate);
      });
      calcEstimate(); // 初期計算
    }, 1000);

    // Voice UI Logic
    const voiceBtn = document.getElementById('voice-trigger-btn');
    const voiceStatus = document.getElementById('voice-status-text');
    const voiceWaves = document.getElementById('voice-waves');
    
    if (voiceBtn && voiceStatus && voiceWaves && 'webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.lang = 'ja-JP';
      recognition.continuous = false;
      recognition.interimResults = false;

      voiceBtn.addEventListener('click', () => {
        voiceBtn.classList.add('active');
        voiceWaves.classList.add('active');
        voiceStatus.innerText = "お話しください...";
        voiceStatus.classList.add("text-white");
        recognition.start();
      });

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        voiceStatus.innerText = `「${transcript}」`;
        
        if (transcript.includes('サービス') || transcript.includes('事業')) {
          document.querySelector('#services')?.scrollIntoView({ behavior: 'smooth' });
        } else if (transcript.includes('問い合わせ') || transcript.includes('コンタクト')) {
          document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
        } else if (transcript.includes('トップ') || transcript.includes('最初')) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (transcript.includes('見積') || transcript.includes('いくら')) {
          document.querySelector('#estimator')?.scrollIntoView({ behavior: 'smooth' });
        } else {
          setTimeout(() => { voiceStatus.innerText = "すみません、聞き取れませんでした"; }, 1000);
        }
        
        const stopListening = () => {
          voiceBtn.classList.remove('active');
          voiceWaves.classList.remove('active');
          setTimeout(() => {
            voiceStatus.innerText = "待機中...";
            voiceStatus.classList.remove("text-white");
          }, 3000);
        };
        stopListening();
      };

      recognition.onend = () => {
        voiceBtn.classList.remove('active');
        voiceWaves.classList.remove('active');
      };
    } else if (voiceBtn) {
      voiceBtn.style.display = 'none';
    }

    // モバイルメニュー
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuBtn && mobileMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
      });
    }
  }, []);

  return (
    <>
      <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />

      {/* プリローダー */}
      <div id="preloader" style={{position:'fixed', inset:0, zIndex:10000, display:'flex', justifyContent:'center', alignItems:'center', flexDirection:'column', background:'#020617'}}>
        <div style={{fontFamily:'Rajdhani', fontSize:'1.5rem', color:'white', letterSpacing:'0.2em', fontWeight:700}}>INITIALIZING SYSTEM</div>
        <div style={{width:'200px', height:'2px', background:'rgba(255,255,255,0.1)', marginTop:'20px', borderRadius:'4px', overflow:'hidden'}}>
          <div id="loader-bar" style={{width:'0%', height:'100%', background:'#3b82f6', transition:'width 0.5s'}}></div>
        </div>
      </div>

      {/* ヘッダー（改善版） */}
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
            
            <button id="mobile-menu-btn" className="md:hidden text-white text-xl w-10 h-10 flex items-center justify-center bg-white/10 rounded-full">
              <i className="fas fa-bars"></i>
            </button>
          </div>
        </div>
        
        <div id="mobile-menu" className="hidden md:hidden glass-panel m-4 rounded-2xl p-6 shadow-2xl absolute w-[calc(100%-2rem)] top-24 border border-white/10 backdrop-blur-xl z-50 bg-slate-900/95">
          <div className="flex flex-col space-y-4 font-bold text-slate-300 text-center">
            <a href="#about" className="block py-3 hover:text-white hover:bg-white/5 rounded-xl">About</a>
            <a href="#services" className="block py-3 hover:text-white hover:bg-white/5 rounded-xl">Services</a>
            <a href="#product" className="block py-3 hover:text-white hover:bg-white/5 rounded-xl">Product</a>
            <a href="#estimator" className="block py-3 text-blue-400 hover:bg-white/5 rounded-xl">AI見積もり</a>
            <a href="#contact" className="block py-4 bg-white text-slate-900 rounded-xl shadow-lg">お問い合わせ</a>
          </div>
        </div>
      </header>

      {/* ヒーローセクション */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-slate-950" id="hero-section">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950 z-0"></div>
        
        <div className="container mx-auto px-6 relative z-10 text-center">
          <div className="gsap-hero-elem opacity-0 translate-y-10">
            <div className="inline-flex items-center gap-3 border border-blue-500/30 bg-blue-900/10 backdrop-blur-md px-6 py-2 rounded-full mb-10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span className="text-xs font-bold tracking-[0.2em] text-blue-300 font-en">EST. 2025 TOKYO</span>
            </div>
          </div>
          
          <h1 className="gsap-hero-elem opacity-0 translate-y-10 text-5xl md:text-8xl lg:text-[8rem] font-black tracking-tighter leading-[1.1] mb-8 text-white">
            「想像」を、<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
              「実装」する。
            </span>
          </h1>
          
          <p className="gsap-hero-elem opacity-0 translate-y-10 text-slate-400 text-lg md:text-xl leading-relaxed mb-12 max-w-2xl mx-auto font-medium">
            AIテクノロジーとクリエイティブの融合。<br/>
            LARUVisonaは、あなたのビジネスの「次」を実装します。
          </p>
          
          <div className="gsap-hero-elem opacity-0 translate-y-10 flex flex-col sm:flex-row justify-center gap-6">
            <a href="#services" className="bg-white text-slate-900 px-12 py-5 rounded-full font-bold hover:bg-slate-200 transition-all shadow-[0_0_50px_-10px_rgba(255,255,255,0.4)] text-lg flex items-center justify-center gap-2 group">
              事業内容を見る <i className="fas fa-arrow-down group-hover:translate-y-1 transition-transform"></i>
            </a>
          </div>
        </div>
      </section>

      {/* マーキーテックスタック */}
      <section className="py-12 border-y border-white/5 bg-black/20 backdrop-blur-sm overflow-hidden relative z-20">
        <div className="marquee-track">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-16">
              <div className="marquee-item"><i className="fab fa-python text-blue-400"></i> Python</div>
              <div className="marquee-item"><i className="fab fa-react text-cyan-400"></i> React</div>
              <div className="marquee-item"><i className="fas fa-robot text-green-400"></i> OpenAI</div>
              <div className="marquee-item"><i className="fab fa-aws text-orange-400"></i> AWS</div>
              <div className="marquee-item"><i className="fab fa-docker text-blue-500"></i> Docker</div>
              <div className="marquee-item"><i className="fas fa-database text-yellow-400"></i> PostgreSQL</div>
              <div className="marquee-item"><i className="fab fa-js text-yellow-300"></i> TypeScript</div>
              <div className="marquee-item"><i className="fab fa-google text-red-400"></i> Vertex AI</div>
            </div>
          ))}
        </div>
      </section>

      {/* About セクション - 完全版HTMLから */}
      <section id="about" className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="gsap-fade-up">
              <span className="text-blue-500 font-bold text-xs tracking-[0.2em] uppercase mb-4 block font-en">WHO WE ARE</span>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-8 leading-tight">
                未来の景色を、<br/>
                テクノロジーで描く。
              </h2>
              <p className="text-slate-400 leading-relaxed mb-6">
                LARUVisona（ラルビゾナ）は、「Vision（展望）」と「Persona（人格）」を掛け合わせた造語です。
              </p>
              <p className="text-slate-400 leading-relaxed mb-8">
                私たちは単なるシステム開発会社ではありません。AIという新たな「人格」をビジネスに宿らせ、御社が描く「展望」を最短距離で実現するパートナーです。
              </p>
              <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/10">
                <table className="w-full text-left text-sm">
                  <tbody>
                    <tr className="border-b border-slate-800">
                      <th className="py-3 text-slate-500 w-32">会社名</th>
                      <td className="py-3 text-slate-200">株式会社LARUVisona</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <th className="py-3 text-slate-500">設立</th>
                      <td className="py-3 text-slate-200">2026年1月（予定）</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <th className="py-3 text-slate-500">代表者</th>
                      <td className="py-3 text-slate-200">代表取締役 CEO</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <th className="py-3 text-slate-500">事業内容</th>
                      <td className="py-3 text-slate-200">
                        AI SaaS事業（LARUbot）<br/>
                        Webシステム受託開発<br/>
                        DXコンサルティング
                      </td>
                    </tr>
                    <tr>
                      <th className="py-3 text-slate-500">所在地</th>
                      <td className="py-3 text-slate-200">東京都（詳細住所）</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="relative gsap-fade-up">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] blur-2xl opacity-30"></div>
              <div className="glass-panel rounded-[2rem] p-1 h-96 w-full flex items-center justify-center relative bg-black/60">
                <div className="text-center">
                  <i className="fas fa-layer-group text-6xl text-white/20 mb-4"></i>
                  <p className="text-slate-500 font-en text-lg tracking-widest">VISUALIZING...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services セクション - 完全版 */}
      <section id="services" className="py-40 relative bg-slate-900">
        <div className="container mx-auto px-6">
          <div className="md:flex md:justify-between md:items-end mb-24 gsap-fade-up">
            <div>
              <span className="text-blue-500 font-bold text-xs tracking-[0.2em] uppercase mb-4 block font-en">WHAT WE DO</span>
              <h2 className="text-5xl md:text-7xl font-black text-white leading-[1.2]">
                論理と、<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">感情。</span>
              </h2>
            </div>
            <p className="text-slate-400 text-lg max-w-md mt-8 md:mt-0 leading-relaxed border-l-2 border-slate-700 pl-6">
              論理的なシステム構築と、感情に響くUXデザイン。<br/>
              この両輪で、選ばれ続けるプロダクトを生み出します。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass-panel rounded-[2rem] p-10 hover:bg-white/5 transition-all duration-500 group gsap-fade-up border border-white/5 hover:border-white/20">
              <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center text-3xl mb-10 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                <i className="fas fa-code"></i>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Web開発・制作</h3>
              <p className="text-slate-400 leading-relaxed mb-10">
                モダンな技術選定により、高速かつ拡張性の高いWebサイト・アプリケーションを構築します。SaaS開発もお任せください。
              </p>
              <ul className="space-y-3 text-sm text-slate-500 font-bold">
                <li className="flex items-center"><i className="fas fa-arrow-right text-blue-500 mr-3 text-xs"></i>コーポレートサイト / LP</li>
                <li className="flex items-center"><i className="fas fa-arrow-right text-blue-500 mr-3 text-xs"></i>Webアプリ / SaaS構築</li>
              </ul>
            </div>

            <div className="glass-panel rounded-[2rem] p-10 bg-gradient-to-br from-blue-900/20 to-transparent border border-blue-500/30 hover:border-blue-500/60 transition-all duration-500 group gsap-fade-up relative overflow-hidden transform md:-translate-y-4 shadow-2xl shadow-blue-900/20">
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl tracking-widest">MAIN</div>
              <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center text-3xl mb-10 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                <i className="fas fa-brain"></i>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">AIソリューション</h3>
              <p className="text-slate-400 leading-relaxed mb-10">
                自社SaaS「LARUbot」のノウハウを活かし、ChatGPT等のLLMを組み込んだ業務効率化システムを開発します。
              </p>
              <ul className="space-y-3 text-sm text-slate-500 font-bold">
                <li className="flex items-center"><i className="fas fa-arrow-right text-indigo-500 mr-3 text-xs"></i>チャットボット導入支援</li>
                <li className="flex items-center"><i className="fas fa-arrow-right text-indigo-500 mr-3 text-xs"></i>社内ナレッジ検索AI</li>
              </ul>
            </div>

            <div className="glass-panel rounded-[2rem] p-10 hover:bg-white/5 transition-all duration-500 group gsap-fade-up border border-white/5 hover:border-white/20">
              <div className="w-16 h-16 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center text-3xl mb-10 group-hover:scale-110 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300">
                <i className="fas fa-lightbulb"></i>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">DXコンサルティング</h3>
              <p className="text-slate-400 leading-relaxed mb-10">
                「何から始めればいいかわからない」という課題に対し、業務フローの整理からツールの選定・定着まで伴走します。
              </p>
              <ul className="space-y-3 text-sm text-slate-500 font-bold">
                <li className="flex items-center"><i className="fas fa-arrow-right text-purple-500 mr-3 text-xs"></i>業務フロー可視化</li>
                <li className="flex items-center"><i className="fas fa-arrow-right text-purple-500 mr-3 text-xs"></i>デジタルツール選定</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* AI開発実績セクション - NEW */}
      <section id="ai-expertise" className="py-32 bg-gradient-to-b from-slate-900 to-black relative overflow-hidden border-t border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_rgba(59,130,246,0.1),transparent_50%)]"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-20 gsap-fade-up">
            <div className="inline-flex items-center gap-3 border border-blue-500/30 bg-blue-900/10 backdrop-blur-md px-6 py-2 rounded-full mb-6">
              <i className="fas fa-certificate text-blue-400"></i>
              <span className="text-xs font-bold tracking-[0.2em] text-blue-300 font-en">PROVEN TRACK RECORD</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
              AI開発の<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">実績が証明する</span>、<br/>
              確かな技術力。
            </h2>
            <p className="text-slate-400 text-lg max-w-3xl mx-auto leading-relaxed">
              自社SaaS「LARUbot」の開発・運用実績が、私たちの技術力を物語ります。<br/>
              実際に稼働するプロダクトを持つからこそ、お客様に最高のAIソリューションを提供できます。
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            {/* 実績1: マルチテナントSaaS */}
            <div className="glass-panel rounded-3xl p-8 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-500 group gsap-fade-up">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-all duration-300 shadow-lg shadow-blue-900/50">
                <i className="fas fa-building text-white"></i>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">マルチテナントSaaS</h3>
              <p className="text-slate-400 leading-relaxed mb-6">
                LARUbotは複数企業が同時利用可能なマルチテナント設計。データ分離とセキュリティを確保しながら、スケーラブルなアーキテクチャを実現。
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-3 py-1 bg-blue-900/30 text-blue-300 rounded-full border border-blue-500/30">Flask</span>
                <span className="text-xs px-3 py-1 bg-blue-900/30 text-blue-300 rounded-full border border-blue-500/30">PostgreSQL</span>
                <span className="text-xs px-3 py-1 bg-blue-900/30 text-blue-300 rounded-full border border-blue-500/30">Redis</span>
              </div>
            </div>

            {/* 実績2: AI統合 */}
            <div className="glass-panel rounded-3xl p-8 border border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-500 group gsap-fade-up bg-gradient-to-br from-indigo-900/10 to-transparent">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-all duration-300 shadow-lg shadow-indigo-900/50">
                <i className="fas fa-robot text-white"></i>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">AIチャットボット技術</h3>
              <p className="text-slate-400 leading-relaxed mb-6">
                OpenAI GPT-4、Claude APIを活用した自然な対話。RAG技術により企業独自データを学習し、精度の高い回答を実現。
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-3 py-1 bg-indigo-900/30 text-indigo-300 rounded-full border border-indigo-500/30">GPT-4</span>
                <span className="text-xs px-3 py-1 bg-indigo-900/30 text-indigo-300 rounded-full border border-indigo-500/30">RAG</span>
                <span className="text-xs px-3 py-1 bg-indigo-900/30 text-indigo-300 rounded-full border border-indigo-500/30">Vector DB</span>
              </div>
            </div>

            {/* 実績3: CRM/SFA */}
            <div className="glass-panel rounded-3xl p-8 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-500 group gsap-fade-up">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-all duration-300 shadow-lg shadow-purple-900/50">
                <i className="fas fa-chart-line text-white"></i>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">CRM/SFA統合</h3>
              <p className="text-slate-400 leading-relaxed mb-6">
                顧客管理（CRM）と営業支援（SFA）機能を完全統合。リアルタイムダッシュボードで営業活動を可視化し、成果を最大化。
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-3 py-1 bg-purple-900/30 text-purple-300 rounded-full border border-purple-500/30">WebSocket</span>
                <span className="text-xs px-3 py-1 bg-purple-900/30 text-purple-300 rounded-full border border-purple-500/30">Real-time</span>
                <span className="text-xs px-3 py-1 bg-purple-900/30 text-purple-300 rounded-full border border-purple-500/30">Analytics</span>
              </div>
            </div>
          </div>

          {/* 実績数値 */}
          <div className="grid md:grid-cols-4 gap-8 gsap-fade-up">
            <div className="text-center">
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 mb-2 font-en">99.9%</div>
              <div className="text-slate-400 font-bold">稼働率</div>
              <div className="text-xs text-slate-600 mt-1">高可用性を保証</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-300 mb-2 font-en">&lt;2s</div>
              <div className="text-slate-400 font-bold">平均応答速度</div>
              <div className="text-xs text-slate-600 mt-1">AI応答時間</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-300 mb-2 font-en">100+</div>
              <div className="text-slate-400 font-bold">同時接続数</div>
              <div className="text-xs text-slate-600 mt-1">スケーラブル設計</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-red-300 mb-2 font-en">SSL</div>
              <div className="text-slate-400 font-bold">セキュリティ</div>
              <div className="text-xs text-slate-600 mt-1">GDPR対応済み</div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16 gsap-fade-up">
            <p className="text-slate-300 text-lg mb-6">この実績と技術力を、あなたのビジネスに。</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a href="https://larubot.tokyo" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 px-10 rounded-full transition-all shadow-lg shadow-blue-900/50">
                <i className="fas fa-external-link-alt"></i>
                LARUbotを見る
              </a>
              <a href="#contact" className="inline-flex items-center gap-3 border-2 border-white/20 hover:border-white/40 text-white font-bold py-4 px-10 rounded-full transition-all backdrop-blur-sm">
                <i className="fas fa-envelope"></i>
                お問い合わせ
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Voice Demo セクション */}
      <section id="voice-demo" className="py-32 bg-black relative overflow-hidden flex items-center justify-center">
        <div className="container mx-auto px-6 relative z-10 text-center">
          <span className="text-blue-500 font-bold text-xs tracking-[0.2em] uppercase mb-4 block font-en">VOICE INTERFACE</span>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-8">声で操る、<br/>未来のUI体験。</h2>
          <p className="text-slate-400 mb-12 max-w-xl mx-auto">
            LARUVisonaは、クリック操作を超えた体験を提案します。<br/>
            下のボタンを押し、「サービス」「問い合わせ」と話しかけてみてください。
          </p>

          <div className="flex flex-col items-center">
            <div id="voice-trigger-btn" className="voice-circle">
              <i className="fas fa-microphone text-4xl text-white"></i>
            </div>
            
            <div id="voice-waves" className="voice-waves">
              <div className="wave-bar"></div><div className="wave-bar"></div><div className="wave-bar"></div><div className="wave-bar"></div><div className="wave-bar"></div>
            </div>
            
            <p id="voice-status-text" className="mt-6 text-blue-300 font-bold text-lg min-h-[30px]">待機中...</p>
          </div>
        </div>
      </section>

      {/* Product セクション */}
      <section id="product" className="py-32 bg-slate-900 text-white relative overflow-hidden border-t border-slate-800">
        <div className="absolute inset-0 bg-blue-900/10"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="md:w-1/2 gsap-fade-up">
              <div className="inline-block bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full mb-4">FLAGSHIP PRODUCT</div>
              <h2 className="text-4xl md:text-5xl font-black mb-8">
                LARUbot<br/>
                <span className="text-slate-400 text-2xl md:text-3xl font-bold">24時間働く、AI営業アシスタント</span>
              </h2>
              <p className="text-slate-300 leading-relaxed mb-12 text-lg">
                LARUbot（ラルボット）は、私たちが提供するNo.1ブランドです。<br/>
                問い合わせ対応の自動化から顧客管理(CRM)、営業支援(SFA)までを一元化。専門知識がなくても、誰でも簡単にAIをビジネスに導入できるプラットフォームです。
              </p>
              <div className="flex flex-wrap gap-6">
                <a href="https://larubot.tokyo" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 px-10 rounded-full transition-all shadow-lg flex items-center gap-3 text-lg">
                  サービスサイトへ <i className="fas fa-external-link-alt text-sm"></i>
                </a>
                <div className="flex items-center gap-3 text-slate-400 font-bold">
                  <i className="fas fa-check-circle text-green-400 text-xl"></i> 10日間無料トライアル
                </div>
              </div>
            </div>
            <div className="md:w-1/2 gsap-fade-up">
              <div className="glass-panel border border-white/10 rounded-3xl p-8 shadow-2xl transform rotate-2 hover:rotate-0 transition-all duration-700 bg-black/40">
                <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-6">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                </div>
                <div className="space-y-6 font-medium">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0">AI</div>
                    <div className="bg-white/10 rounded-tr-2xl rounded-b-2xl p-4 text-base backdrop-blur-md">
                      御社の課題を教えてください。
                    </div>
                  </div>
                  <div className="flex gap-4 flex-row-reverse">
                    <div className="bg-blue-600/80 rounded-tl-2xl rounded-b-2xl p-4 text-base backdrop-blur-md">
                      サイトからの離脱率を改善したいです。
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0">AI</div>
                    <div className="bg-white/10 rounded-tr-2xl rounded-b-2xl p-4 text-base backdrop-blur-md">
                      それなら、私の出番ですね。<br/>自動接客でCV率を向上させましょう。
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* News セクション */}
      <section className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="flex justify-between items-end mb-12">
            <h2 className="text-3xl font-bold text-white">News</h2>
            <a href="#" className="text-blue-400 hover:text-blue-300 text-sm font-bold">一覧を見る <i className="fas fa-arrow-right ml-1"></i></a>
          </div>
          <div className="space-y-4">
            <a href="#" className="block glass-panel p-6 rounded-xl hover:bg-white/5 transition-colors group">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <span className="text-slate-500 font-en text-sm">2025.12.20</span>
                <span className="bg-blue-900/50 text-blue-300 px-3 py-1 rounded text-xs font-bold w-fit border border-blue-500/20">PRESS</span>
                <p className="text-slate-200 group-hover:text-white transition-colors">株式会社LARUVisonaとして法人化に向けた準備を開始しました。</p>
              </div>
            </a>
            <a href="#" className="block glass-panel p-6 rounded-xl hover:bg-white/5 transition-colors group">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <span className="text-slate-500 font-en text-sm">2025.12.01</span>
                <span className="bg-indigo-900/50 text-indigo-300 px-3 py-1 rounded text-xs font-bold w-fit border border-indigo-500/20">PRODUCT</span>
                <p className="text-slate-200 group-hover:text-white transition-colors">AIチャットボットサービス「LARUbot」のβ版をリリースしました。</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Estimator セクション - 簡略版 */}
      <section id="estimator" className="py-32 bg-slate-900 relative overflow-hidden">
        <div className="container mx-auto px-6 text-center">
          <span className="text-blue-500 font-bold text-xs tracking-[0.2em] uppercase mb-4 block font-en">AI ESTIMATION</span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">開発費用シミュレーター</h2>
          <p className="text-slate-400 mb-12">プロジェクトの要件を選択するだけで、概算費用をリアルタイム算出します。</p>
          <p className="text-slate-300 text-lg mb-8">※完全版は既存HTMLに実装済み。Next.jsで簡略版を表示しています。</p>
          <a href="#contact" className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-10 rounded-full transition-all shadow-lg">
            お見積もりのご相談はこちら <i className="fas fa-arrow-right ml-2"></i>
          </a>
        </div>
      </section>

      {/* Contact セクション */}
      <section id="contact" className="py-40 bg-white relative z-10">
        <div className="container mx-auto px-6 max-w-4xl text-center gsap-fade-up">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">お問い合わせ</h2>
          <p className="text-slate-600 mb-16 text-lg">未来を共に創るパートナーとして、<br/>まずはお気軽にご相談ください。</p>
          
          <form className="text-left bg-slate-50 p-10 md:p-16 rounded-[3rem] border border-slate-200 shadow-xl space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">お名前 <span className="text-red-500">*</span></label>
                <input type="text" required className="w-full bg-white border-2 border-slate-200 rounded-xl p-4 focus:border-blue-500 focus:ring-0 focus:outline-none transition-colors font-medium" placeholder="山田 太郎" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">メールアドレス <span className="text-red-500">*</span></label>
                <input type="email" required className="w-full bg-white border-2 border-slate-200 rounded-xl p-4 focus:border-blue-500 focus:ring-0 focus:outline-none transition-colors font-medium" placeholder="example@laruvisona.jp" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3">ご相談種別 <span className="text-red-500">*</span></label>
              <select required className="w-full bg-white border-2 border-slate-200 rounded-xl p-4 focus:border-blue-500 focus:ring-0 focus:outline-none transition-colors font-medium appearance-none">
                <option value="">選択してください</option>
                <option>LARUbot導入について</option>
                <option>Webサイト・システム開発の依頼</option>
                <option>パートナー協業について</option>
                <option>その他</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3">メッセージ <span className="text-red-500">*</span></label>
              <textarea rows={5} required className="w-full bg-white border-2 border-slate-200 rounded-xl p-4 focus:border-blue-500 focus:ring-0 focus:outline-none transition-colors font-medium" placeholder="具体的なご相談内容をご記入ください"></textarea>
            </div>
            <div className="text-center pt-8">
              <button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-5 px-16 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all w-full md:w-auto text-lg">
                送信する <i className="fas fa-paper-plane ml-2"></i>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* フッター（完全版） */}
      <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-800 relative z-10">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white text-sm">
                  <i className="fas fa-robot"></i>
                </div>
                <span className="font-bold text-xl text-white font-en">LARU<span className="font-light text-slate-400">Visona</span></span>
              </div>
              <p className="text-sm leading-relaxed mb-6">
                テクノロジーの力で、<br/>
                ビジネスの想像を実装する。
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"><i className="fab fa-twitter"></i></a>
                <a href="#" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"><i className="fab fa-instagram"></i></a>
                <a href="#" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"><i className="fab fa-linkedin-in"></i></a>
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Service</h4>
              <ul className="space-y-4 text-sm">
                <li><a href="https://larubot.tokyo" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">LARUbot (AIチャット)</a></li>
                <li><a href="#services" className="hover:text-blue-400 transition-colors">Webシステム開発</a></li>
                <li><a href="#services" className="hover:text-blue-400 transition-colors">DXコンサルティング</a></li>
                <li><a href="#estimator" className="hover:text-blue-400 transition-colors">AI見積もり</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Company</h4>
              <ul className="space-y-4 text-sm">
                <li><a href="#about" className="hover:text-blue-400 transition-colors">私たちについて</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">ニュース</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">プライバシーポリシー</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">利用規約</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Contact</h4>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <i className="fas fa-map-marker-alt mt-1 text-slate-600"></i>
                  <span>東京都</span>
                </li>
                <li className="flex items-center gap-3">
                  <i className="fas fa-envelope text-slate-600"></i>
                  <span>info@laruvisona.jp</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-xs text-slate-600 font-en">
            &copy; 2026 LARUVisona Inc. All Rights Reserved. (Powered by Laru-Agent)
          </div>
        </div>
      </footer>
    </>
  );
}
