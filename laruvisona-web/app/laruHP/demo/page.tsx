'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const INDUSTRIES = [
  { id: 'beauty',       label: '美容室・サロン',     emoji: '💇', color: 'from-pink-50 to-rose-50',   accent: 'border-pink-200 hover:border-pink-400',   hero: 'カット・カラーならお任せください', sub: 'シャンプー・ブロー込み／完全予約制', services: ['カット ¥4,400', 'カラー ¥8,800', 'パーマ ¥11,000'] },
  { id: 'restaurant',   label: '飲食店・カフェ',     emoji: '🍽', color: 'from-amber-50 to-orange-50', accent: 'border-amber-200 hover:border-amber-400',   hero: '地元素材にこだわった本格料理', sub: 'ランチ・ディナー・テイクアウト対応', services: ['ランチセット ¥1,200', 'ディナーコース ¥3,800', 'テイクアウト ¥900'] },
  { id: 'clinic',       label: '整体・接骨院',        emoji: '🏥', color: 'from-blue-50 to-cyan-50',    accent: 'border-blue-200 hover:border-blue-400',    hero: 'つらい痛みを根本から改善', sub: '交通事故・スポーツ外傷・慢性痛に対応', services: ['初診 ¥2,200', '整体 ¥6,600', '鍼灸 ¥4,400'] },
  { id: 'fitness',      label: 'フィットネス・ジム',  emoji: '🏋', color: 'from-green-50 to-emerald-50', accent: 'border-green-200 hover:border-green-400',  hero: '理想のカラダへ、最短ルートで', sub: 'パーソナルトレーニング・グループレッスン', services: ['体験レッスン ¥0', '月会費 ¥8,800', 'パーソナル ¥12,000'] },
  { id: 'legal',        label: '弁護士・士業',        emoji: '⚖️', color: 'from-slate-50 to-gray-50',   accent: 'border-slate-200 hover:border-slate-400',  hero: '難しい問題、一緒に解決します', sub: '相続・離婚・企業法務・無料相談あり', services: ['無料相談 30分', '着手金 ¥110,000〜', '成功報酬制あり'] },
  { id: 'construction', label: '工務店・建設',        emoji: '🏗', color: 'from-yellow-50 to-amber-50',  accent: 'border-yellow-200 hover:border-yellow-400', hero: '地域に根ざした安心の家づくり', sub: '新築・リフォーム・メンテナンスまで', services: ['無料見積り', 'リフォーム ¥500,000〜', '新築 ¥2,500万〜'] },
  { id: 'realestate',   label: '不動産会社',          emoji: '🏠', color: 'from-indigo-50 to-purple-50', accent: 'border-indigo-200 hover:border-indigo-400', hero: '理想の住まいを一緒に探します', sub: '売買・賃貸・管理・リノベーション', services: ['無料相談', '売買仲介 3%+6万', '賃貸管理 月額5%'] },
  { id: 'retail',       label: '小売店・ショップ',    emoji: '🛍', color: 'from-purple-50 to-pink-50',   accent: 'border-purple-200 hover:border-purple-400', hero: '毎日の暮らしを豊かにする品揃え', sub: '送料無料・全国対応・ポイント還元', services: ['送料無料 ¥5,000〜', '会員割引 10%', 'ポイント制度あり'] },
  { id: 'hotel',        label: 'ホテル・旅館',        emoji: '🏨', color: 'from-sky-50 to-blue-50',      accent: 'border-sky-200 hover:border-sky-400',       hero: '心ゆくまでくつろぎのひとときを', sub: '全室オーシャンビュー・温泉付き', services: ['素泊まり ¥8,800〜', '朝食付き ¥12,000〜', '温泉プラン ¥18,000〜'] },
  { id: 'dental',       label: '歯科クリニック',      emoji: '🦷', color: 'from-teal-50 to-cyan-50',     accent: 'border-teal-200 hover:border-teal-400',    hero: '笑顔あふれる毎日のために', sub: '一般歯科・矯正・ホワイトニング', services: ['初診 ¥3,300', 'クリーニング ¥5,500', 'ホワイトニング ¥33,000'] },
  { id: 'education',    label: '教育・スクール',      emoji: '🎓', color: 'from-orange-50 to-amber-50',  accent: 'border-orange-200 hover:border-orange-400', hero: '可能性を引き出す、本物の教育', sub: '英語・プログラミング・音楽など', services: ['体験授業 ¥0', '月謝 ¥13,200〜', '年間契約 10%割引'] },
  { id: 'wedding',      label: 'ウェディング',        emoji: '💍', color: 'from-rose-50 to-pink-50',     accent: 'border-rose-200 hover:border-rose-400',    hero: '世界に一つの特別な一日を', sub: '少人数・家族婚・フォトウェディング対応', services: ['相談無料', 'フォト婚 ¥220,000〜', 'パーティー ¥550,000〜'] },
  { id: 'pet',          label: 'ペットサロン',        emoji: '🐾', color: 'from-lime-50 to-green-50',    accent: 'border-lime-200 hover:border-lime-400',    hero: '大切な家族を最高の状態に', sub: 'トリミング・爪切り・お風呂', services: ['シャンプー ¥3,300〜', 'カット込 ¥6,600〜', '爪切り ¥550'] },
  { id: 'photo',        label: 'フォトスタジオ',      emoji: '📸', color: 'from-violet-50 to-purple-50', accent: 'border-violet-200 hover:border-violet-400', hero: '大切な瞬間を美しく残す', sub: '七五三・成人式・家族写真・証明写真', services: ['証明写真 ¥1,100', '家族写真 ¥22,000〜', '七五三 ¥33,000〜'] },
  { id: 'accounting',   label: '税理士・会計士',      emoji: '📊', color: 'from-gray-50 to-slate-50',    accent: 'border-gray-200 hover:border-gray-400',    hero: '経営の不安を数字で解決', sub: '法人・個人事業主・相続税対応', services: ['無料相談', '記帳代行 ¥22,000〜/月', '確定申告 ¥55,000〜'] },
];

export default function DemoPage() {
  const [selected, setSelected] = useState<typeof INDUSTRIES[0] | null>(null);

  return (
    <div className="min-h-screen bg-sky-50">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-sky-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/laruHP" className="flex items-center gap-3">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={32} width={160} className="h-8 w-auto" />
          </Link>
          <Link href="/laruHP/onboarding" className="bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-sky-500 transition-all">
            無料で始める →
          </Link>
        </div>
      </header>

      <main className="pt-28 pb-20 px-6">
        <div className="max-w-5xl mx-auto">

          {!selected ? (
            <>
              <div className="text-center mb-12">
                <span className="inline-block bg-sky-100 text-sky-600 text-xs font-bold px-4 py-1.5 rounded-full mb-4 tracking-wider">DEMO</span>
                <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
                  業種を選んでプレビュー
                </h1>
                <p className="text-gray-500 text-base max-w-xl mx-auto">
                  あなたのお店・事務所の業種を選ぶと、AIが作るサイトのイメージをプレビューできます。
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind.id}
                    onClick={() => setSelected(ind)}
                    className={`bg-white border-2 ${ind.accent} rounded-2xl p-4 text-center transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer`}
                  >
                    <div className="text-3xl mb-2">{ind.emoji}</div>
                    <div className="text-xs font-semibold text-gray-700 leading-tight">{ind.label}</div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelected(null)}
                className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1 transition-colors"
              >
                ← 業種を変える
              </button>

              <div className="grid md:grid-cols-2 gap-8 items-start">
                {/* Site preview */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
                  {/* Browser chrome */}
                  <div className="bg-gray-100 px-4 py-3 flex items-center gap-2 border-b border-gray-200">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 bg-white rounded-lg px-3 py-1 text-xs text-gray-400 ml-2">
                      laruvisona.jp/hp/your-shop
                    </div>
                  </div>

                  {/* Site content mock */}
                  <div className={`bg-gradient-to-br ${selected.color} p-6`}>
                    {/* Nav */}
                    <div className="flex justify-between items-center mb-6">
                      <div className="font-black text-gray-800 text-sm">Your Shop</div>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>サービス</span><span>料金</span><span>お問合せ</span>
                      </div>
                    </div>

                    {/* Hero */}
                    <div className="mb-6">
                      <div className="text-xs text-sky-600 font-bold mb-1">✦ {selected.label}</div>
                      <h2 className="text-xl font-black text-gray-900 leading-tight mb-2">{selected.hero}</h2>
                      <p className="text-xs text-gray-500 mb-4">{selected.sub}</p>
                      <button className="bg-sky-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl">
                        無料相談・お問い合わせ →
                      </button>
                    </div>

                    {/* Services */}
                    <div className="bg-white/70 backdrop-blur rounded-xl p-4">
                      <div className="text-xs font-bold text-gray-600 mb-3">サービス・料金</div>
                      <div className="space-y-2">
                        {selected.services.map((s, i) => (
                          <div key={i} className="flex justify-between items-center text-xs text-gray-700 py-1.5 border-b border-gray-100 last:border-0">
                            <span>{s.split(' ')[0]}</span>
                            <span className="font-semibold text-sky-700">{s.split(' ').slice(1).join(' ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* LARUbot badge */}
                    <div className="mt-4 flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-3 py-2 text-xs">
                      <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center font-bold text-[10px]">AI</div>
                      <span>AIチャットボットがお客様の質問に24時間対応</span>
                    </div>
                  </div>
                </div>

                {/* CTA panel */}
                <div className="space-y-5">
                  <div>
                    <div className="text-2xl mb-1">{selected.emoji}</div>
                    <h2 className="text-2xl font-black text-gray-900 mb-2">{selected.label}向け<br />サイトを作る</h2>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      AIが業種に合わせたコンテンツを自動生成。
                      あなたの情報を入力するだけで、プロ品質のサイトが完成します。
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      'AI がコンテンツを自動生成',
                      'チャットボットが24時間対応',
                      'SEO対策・Googleマップ連携',
                      '問い合わせ・予約をまとめて管理',
                    ].map(f => (
                      <div key={f} className="flex items-center gap-3 text-sm text-gray-700">
                        <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-emerald-600 text-xs font-bold">✓</span>
                        </div>
                        {f}
                      </div>
                    ))}
                  </div>

                  <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                    <div className="text-2xl font-black text-sky-600 mb-0.5">¥999<span className="text-base font-normal text-gray-500">/月〜</span></div>
                    <div className="text-xs text-gray-500">初月無料 · 最低6ヶ月契約 · いつでも解約可</div>
                  </div>

                  <Link
                    href={`/laruHP/onboarding?industry=${selected.id}`}
                    className="flex items-center justify-center gap-2 w-full bg-sky-600 text-white font-black text-base py-4 rounded-2xl hover:bg-sky-500 transition-all shadow-md"
                  >
                    {selected.emoji} この業種でサイトを作る →
                  </Link>
                  <p className="text-center text-xs text-gray-400">クレジットカード登録のみ。初月は0円。</p>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
