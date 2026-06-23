import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import sharp from 'sharp';

function getAdminStorage() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: 'サポートされていないファイル形式です' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'ファイルサイズは10MB以下にしてください' }, { status: 400 });
  }

  const input = Buffer.from(await file.arrayBuffer());

  // Verify file magic bytes (first 12 bytes)
  const MAGIC: Array<{ bytes: number[]; mask?: number[] }> = [
    { bytes: [0xff, 0xd8, 0xff] },                          // JPEG
    { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }, // PNG
    { bytes: [0x47, 0x49, 0x46] },                          // GIF
    { bytes: [0x52, 0x49, 0x46, 0x46] },                    // WebP (RIFF)
  ];
  const isValidMagic = MAGIC.some(m => m.bytes.every((b, i) => input[i] === b));
  // AVIF starts with 'ftyp' at offset 4
  const isAvif = input[4] === 0x66 && input[5] === 0x74 && input[6] === 0x79 && input[7] === 0x70;
  if (!isValidMagic && !isAvif) {
    return NextResponse.json({ error: 'ファイルの形式が正しくありません' }, { status: 400 });
  }

  let buffer: Buffer;
  let contentType: string;
  let uploadExt: string;

  if (ext === 'gif') {
    // Keep GIFs as-is (animation)
    buffer = input;
    contentType = 'image/gif';
    uploadExt = 'gif';
  } else {
    // Convert to WebP with quality 85, fit inside 2000×2000px (prevents memory explosion from tall images)
    buffer = await sharp(input)
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    contentType = 'image/webp';
    uploadExt = 'webp';
  }

  const path = `${user.id}/${Date.now()}.${uploadExt}`;
  const admin = getAdminStorage();

  const { error } = await admin.storage
    .from('site-images')
    .upload(path, buffer, { contentType, upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage
    .from('site-images')
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
