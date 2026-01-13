export default function Estimator() {
  return (
    <section id="estimator" className="py-32 bg-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-900 to-slate-900"></div>
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16 gsap-fade-up">
          <span className="text-blue-500 font-bold text-xs tracking-[0.2em] uppercase mb-4 block font-en">AI ESTIMATION</span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">開発費用シミュレーター</h2>
          <p className="text-slate-400">プロジェクトの要件を選択するだけで、概算費用と工数をリアルタイム算出します。</p>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-8 space-y-8">
            {/* Q1: プロジェクトタイプ */}
            <div className="glass-panel p-8 rounded-3xl border border-slate-700/50">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded font-en">Q1</span> どのようなものを作りますか？
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { value: '50', icon: 'desktop', label: 'Webサイト / LP' },
                  { value: '150', icon: 'layer-group', label: 'Webアプリ / SaaS' },
                  { value: '300', icon: 'mobile-alt', label: 'モバイルアプリ' }
                ].map((item, idx) => (
                  <label key={idx} className="cursor-pointer group block">
                    <input type="radio" name="q_type" value={item.value} className="hidden peer" defaultChecked={idx === 0} />
                    <div className="estimator-btn">
                      <i className={`fas fa-${item.icon} text-2xl mb-1`}></i>
                      <span className="font-bold">{item.label}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Q2-Q10のその他の質問 */}
            <div className="glass-panel p-8 rounded-3xl border border-slate-700/50">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded font-en">Q2</span> 規模・ページ数
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { value: '10', label: '小 (1-5p)' },
                  { value: '40', label: '中 (10-20p)' },
                  { value: '80', label: '大 (30p〜)' },
                  { value: '150', label: '大規模PF' }
                ].map((item, idx) => (
                  <label key={idx} className="cursor-pointer block">
                    <input type="radio" name="q_scale" value={item.value} className="hidden peer" defaultChecked={idx === 0} />
                    <div className="estimator-btn">{item.label}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* 追加の質問項目... 簡略化 */}
          </div>

          {/* 見積もり結果表示 */}
          <div className="lg:col-span-4 relative">
            <div className="sticky top-28 space-y-6">
              <div className="glass-panel rounded-3xl p-8 border border-blue-500/30 shadow-2xl bg-slate-900/90 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                
                <p className="text-slate-400 text-sm font-bold tracking-widest text-center mb-6">概算お見積もり</p>
                
                <div className="text-center mb-8">
                  <div className="flex justify-center items-baseline gap-1 text-white">
                    <span className="text-2xl font-bold">¥</span>
                    <span id="estimate-price" className="text-6xl font-black font-en">70</span>
                    <span className="text-xl font-bold">万~</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">※税抜概算・初期費用</p>
                </div>

                <div className="space-y-3 mb-8 border-t border-white/10 pt-6 text-sm">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>基本開発費</span>
                    <span className="text-white font-en" id="detail-base">¥0</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>AI・機能OP</span>
                    <span className="text-blue-400 font-en" id="detail-opt">¥0</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>特急料金</span>
                    <span className="text-red-400 font-en" id="detail-speed">¥0</span>
                  </div>
                </div>

                <a href="#contact" className="block w-full py-4 bg-white text-slate-900 font-bold text-center rounded-full hover:bg-blue-50 transition-all shadow-lg group">
                  この内容で相談する <i className="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                </a>
              </div>

              <div className="bg-slate-800/50 rounded-2xl p-6 text-xs text-slate-500 leading-relaxed border border-slate-700">
                <p className="font-bold text-slate-400 mb-2">【ご注意事項】</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>本シミュレーションは目安であり、実際の費用を保証するものではありません。</li>
                  <li>要件定義の詳細により金額は変動します。</li>
                  <li>月額サーバー費用、保守費用は含まれておりません。</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
