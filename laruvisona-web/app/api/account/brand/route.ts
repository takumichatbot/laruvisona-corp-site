import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { readContactBody } from '@/lib/contact-contract';

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data: profile } = await service.from('profiles').select('plan').eq('id', user.id).single();
  if (profile?.plan !== 'agency') {
    return NextResponse.json({ error: 'Agency plan required' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await readContactBody(req, 10_000); }
  catch { return NextResponse.json({ error: '入力を確認してください' }, { status: 400 }); }
  if (Object.keys(body).some(key => key !== 'brand_logo_url') || typeof body.brand_logo_url !== 'string' || body.brand_logo_url.length > 2_048) {
    return NextResponse.json({ error: 'ロゴURLを確認してください' }, { status: 400 });
  }
  let brandLogoUrl: string | null = null;
  if (body.brand_logo_url.trim()) {
    try {
      const url = new URL(body.brand_logo_url.trim());
      if (url.protocol !== 'https:' || url.username || url.password) throw Error('invalid');
      brandLogoUrl = url.toString();
    } catch {
      return NextResponse.json({ error: 'ロゴURLを確認してください' }, { status: 400 });
    }
  }
  const { error, data } = await service
    .from('profiles')
    .update({ brand_logo_url: brandLogoUrl })
    .eq('id', user.id)
    .select('id');

  if (error || data?.length !== 1) return NextResponse.json({ error: 'ロゴを保存できませんでした' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
