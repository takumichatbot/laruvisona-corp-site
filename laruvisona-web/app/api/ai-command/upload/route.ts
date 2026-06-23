import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function isAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === process.env.ADMIN_EMAIL;
}

export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 });
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const path = `ai-commands/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const service = await createServiceClient();
  const { error } = await service.storage
    .from('ai-command-images')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: { publicUrl } } = service.storage.from('ai-command-images').getPublicUrl(path);
  return NextResponse.json({ url: publicUrl });
}
