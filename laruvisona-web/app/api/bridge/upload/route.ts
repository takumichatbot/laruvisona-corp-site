import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { readBridgeForm } from '@/lib/bridge-input';

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const formData = await readBridgeForm(req, 8 * 1024 * 1024);
    const file = formData.get('file') as File | null;
    if (!file || file.size < 1 || file.size > 6 * 1024 * 1024
      || !/^(image\/(?:jpeg|png|webp|gif)|audio\/(?:webm|ogg|mpeg|mp4))$/i.test(file.type)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return NextResponse.json({
      name: file.name.replace(/[\r\n\u0000]/g, '').slice(0, 200),
      mimeType: file.type,
      size: file.size,
      base64,
    });
  } catch {
    return NextResponse.json({ error: 'upload failed' }, { status: 400 });
  }
}
