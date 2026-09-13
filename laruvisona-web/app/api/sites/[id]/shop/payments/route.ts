import { rateLimit } from '@/lib/rate-limit';
import { merchantOnboarding, merchantStatus } from '@/lib/scheduling/merchant';
import { owner, reply } from '@/lib/scheduling/server';
import { stripeConnectAvailable } from '@/lib/scheduling/payments';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  const auth = await owner((await params).id);
  if (auth.response) return auth.response;
  try { return reply(await merchantStatus(auth.user.id, auth.db, undefined, 'shop')); }
  catch { return reply({ error: '入金先の状態を確認できませんでした' }, 503); }
}

export async function POST(_req: Request, { params }: Context) {
  const auth = await owner((await params).id);
  if (auth.response) return auth.response;
  if (!stripeConnectAvailable() || process.env.HP_SHOP_PAYMENTS_ENABLED !== '1') {
    return reply({ error: 'ショップ決済の接続を準備中です' }, 503);
  }
  if (!rateLimit(`shop-connect:${auth.user.id}`, 5, 60_000).ok) return reply({ error: '少し待ってからお試しください' }, 429);
  try { return reply(await merchantOnboarding({ id: auth.user.id }, auth.site.id, auth.db, undefined, 'shop')); }
  catch { return reply({ error: '接続の準備に失敗しました' }, 503); }
}
