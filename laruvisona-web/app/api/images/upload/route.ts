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
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const input = Buffer.from(await file.arrayBuffer());
  let buffer: Buffer;
  let contentType: string;
  let uploadExt: string;

  if (ext === 'gif') {
    // Keep GIFs as-is (animation)
    buffer = input;
    contentType = 'image/gif';
    uploadExt = 'gif';
  } else {
    // Convert to WebP with quality 85, max 2000px wide
    buffer = await sharp(input)
      .resize({ width: 2000, withoutEnlargement: true })
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
