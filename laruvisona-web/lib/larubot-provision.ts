import { createServiceClient } from '@/lib/supabase/server';

// LARUbot（AIチャットボット）が付くプラン。ここに含まれるプランへ切り替わったときに
// LARUbot 側のアカウントを自動登録する。登録後、LARUbot から /api/larubot/webhook に
// public_id がコールバックされ、サイトの settings_json に書き戻される。
const BOT_PLANS = new Set(['lite', 'hp-bot', 'hp-bot-seo', 'agency']);

export function isBotPlan(plan: string | null | undefined): boolean {
  return !!plan && BOT_PLANS.has(plan);
}

/**
 * プランが「LARUbotなし → LARUbotあり」へ切り替わったときだけ LARUbot 登録を叩く。
 * - newPlan が bot プランでなければ何もしない
 * - prevPlan が既に bot プランなら（bot→bot の変更）再登録しない＝冪等
 * - 新規契約時は prevPlan を渡さない（undefined）＝必ず登録
 *
 * 例外は握りつぶさず throw する（呼び出し側で try/catch し、決済処理自体は止めない）。
 */
export async function provisionLarubotOnPlan(params: {
  userId: string;
  email: string | null | undefined;
  plan: string;
  siteId?: string;
  prevPlan?: string | null;
}): Promise<void> {
  const { userId, email, plan, siteId, prevPlan } = params;

  if (!isBotPlan(plan)) return;
  if (isBotPlan(prevPlan)) return; // 既に LARUbot 利用中 → 再登録不要
  if (!process.env.LARU_HP_API_SECRET) return;

  const supabase = createServiceClient();

  let siteName = '';
  if (siteId) {
    const { data: site } = await supabase.from('sites').select('name').eq('id', siteId).single();
    siteName = site?.name || '';
  }

  const larubotPlan = plan === 'agency' ? 'hp-bot' : plan; // agency は hp-bot 相当で登録
  const base = process.env.LARUBOT_API_URL || 'https://larubot.tokyo';

  const res = await fetch(`${base}/api/hp/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-laru-secret': process.env.LARU_HP_API_SECRET,
    },
    body: JSON.stringify({
      email,
      plan: larubotPlan,
      site_name: siteName,
      user_id: userId,
      site_id: siteId || '',
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LARUbot register failed: ${res.status} ${detail}`);
  }
}
