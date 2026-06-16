import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PUT /api/sites/[id]/domain — set or clear custom domain
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { customDomain } = await req.json().catch(() => ({}));

  // Basic domain format validation
  const trimmed = (customDomain as string | undefined)?.trim() || null;
  if (trimmed && !/^[a-zA-Z0-9][a-zA-Z0-9.-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return NextResponse.json({ error: 'ドメイン形式が正しくありません（例: example.com）' }, { status: 400 });
  }

  const { error } = await supabase
    .from('sites')
    .update({ custom_domain: trimmed })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, customDomain: trimmed });
}
