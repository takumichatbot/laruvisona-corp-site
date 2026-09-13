import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isAdminRequest } from '@/lib/adminAuth';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';

export async function POST(req: Request) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: '入力を確認してください' }, { status: 400 });
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 });
  if (file.size < 1 || file.size > 10 * 1024 * 1024 || !file.type.startsWith('image/')) {
    return NextResponse.json({ error: '10MB以下の画像を選んでください' }, { status: 400 });
  }
  let image: Buffer;
  try {
    image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 })
      .rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88 }).toBuffer();
  } catch {
    return NextResponse.json({ error: '画像を読み取れませんでした' }, { status: 400 });
  }
  const path = `ai-commands/${Date.now()}-${randomUUID()}.webp`;
  const service = await createServiceClient();
  const { error } = await service.storage
    .from('ai-command-images')
    .upload(path, image, { contentType: 'image/webp', upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: { publicUrl } } = service.storage.from('ai-command-images').getPublicUrl(path);
  return NextResponse.json({ url: publicUrl });
}
