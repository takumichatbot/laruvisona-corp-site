import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { appOrigin } from '@/lib/public-site-url';
import { privateHeaders } from '@/lib/scheduling/server';
import { merchantOnboarding, merchantStatus } from '@/lib/scheduling/merchant';
import { uuidPattern } from '@/lib/scheduling/config';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  const query = new URL(req.url).searchParams;
  const siteId = query.get('siteId') || '';
  const redirect = (result: string) => NextResponse.redirect(
    `${appOrigin()}/laruHP/shop?${new URLSearchParams({ paymentConnect: result, ...(uuidPattern.test(siteId) ? { siteId } : {}) })}`,
    { status: 303, headers: privateHeaders },
  );
  if (!user || !uuidPattern.test(siteId)) return redirect('invalid');
  const { data: site } = await auth.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).maybeSingle();
  if (!site) return redirect('invalid');
  try {
    if (query.get('refresh') === '1') {
      const link = await merchantOnboarding({ id: user.id }, siteId, undefined, undefined, 'shop');
      return NextResponse.redirect(link.url, { status: 303, headers: privateHeaders });
    }
    const status = await merchantStatus(user.id, undefined, undefined, 'shop');
    return redirect(status.ready ? 'connected' : 'requirements');
  } catch { return redirect('failed'); }
}
