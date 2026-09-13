import { createServiceClient } from '@/lib/supabase/server';
import { Award, Check, Circle, TriangleAlert } from 'lucide-react';
import { loyaltyTokenMatches, validLoyaltyCardId } from '@/lib/loyalty-contract';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

// Public page to display a customer's loyalty card
// Accessible via QR code link

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function LoyaltyCardPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { token } = await searchParams;
  const service = createServiceClient();

  const { data: card, error } = validLoyaltyCardId(id) ? await service
    .from('loyalty_cards')
    .select('id, customer_name, stamps, max_stamps, reward, card_name, site_id, created_at, last_stamped_at, public_token_hash')
    .eq('id', id)
    .single() : { data: null, error: null };

  const protectedCard = Boolean(card?.public_token_hash);
  const mayShowName = card ? loyaltyTokenMatches(token, card.public_token_hash) : false;

  if (error || !card || (protectedCard && !mayShowName)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full">
          <TriangleAlert className="mx-auto mb-3 h-10 w-10 text-amber-600" aria-hidden="true" />
          <h1 className="font-bold text-gray-900 mb-2">カードが見つかりません</h1>
          <p className="text-gray-500 text-sm">URLを確認してください</p>
        </div>
      </div>
    );
  }

  const { data: site } = await service.from('sites').select('name, industry').eq('id', card.site_id).single();

  const pct = Math.round((card.stamps / card.max_stamps) * 100);
  const isComplete = card.stamps >= card.max_stamps;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c1a3a] to-[#1a2f5e] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-indigo-600 px-6 py-8 text-center text-white">
          <div className="text-sm font-semibold opacity-80 mb-1">{site?.name || 'LARU HP'}</div>
          <div className="text-2xl font-black mb-0.5">{card.card_name}</div>
          {mayShowName && <div className="text-sm opacity-80">{card.customer_name} 様</div>}
        </div>

        {/* Stamps grid */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-700">スタンプ</span>
            <span className="text-sm text-gray-500">{card.stamps} / {card.max_stamps}</span>
          </div>

          <div className="grid grid-cols-5 gap-2 mb-5">
            {Array.from({ length: card.max_stamps }).map((_, i) => (
              <div
                key={i}
                className={`aspect-square rounded-full flex items-center justify-center text-xl transition-all ${
                  i < card.stamps
                    ? 'bg-sky-500 shadow-md shadow-sky-200'
                    : 'bg-gray-100'
                }`}
              >
                {i < card.stamps
                  ? <Check className="h-5 w-5 text-white" aria-hidden="true" />
                  : <Circle className="h-4 w-4 text-gray-300" aria-hidden="true" />}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Reward */}
          <div className={`rounded-2xl p-4 text-center ${isComplete ? 'bg-yellow-50 border-2 border-yellow-300' : 'bg-sky-50 border border-sky-200'}`}>
            {isComplete ? (
              <>
                <Award className="mx-auto mb-2 h-8 w-8 text-yellow-700" aria-hidden="true" />
                <div className="font-bold text-yellow-800 text-sm">達成おめでとうございます！</div>
                <div className="text-yellow-700 text-sm mt-0.5 font-semibold">{card.reward}</div>
                <div className="text-yellow-600 text-xs mt-1">スタッフにこの画面を見せてください</div>
              </>
            ) : (
              <>
                <div className="text-sky-600 text-xs font-semibold mb-0.5">あと {card.max_stamps - card.stamps} スタンプで</div>
                <div className="font-bold text-gray-900 text-sm">{card.reward}</div>
              </>
            )}
          </div>

          {card.last_stamped_at && (
            <div className="text-center text-[10px] text-gray-400 mt-3">
              最終スタンプ: {new Date(card.last_stamped_at).toLocaleDateString('ja-JP')}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 text-center text-[9px] text-gray-300">
          LARU HP デジタルポイントカード
        </div>
      </div>
    </div>
  );
}
