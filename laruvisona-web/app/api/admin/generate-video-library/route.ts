import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IMAGE_INDUSTRIES, getAdminStorage, getGeminiKey } from '@/lib/imagen';
import { generateVeoToStorage, listAvailableModels, videoStoragePath } from '@/lib/veo';

// 業種ショーケース用の短尺ループ動画を Veo で作って Supabase Storage に貯める。
//
// 画像ライブラリ（/api/library-image）と違って自己修復方式にはしない。
// 動画は生成に数十秒〜数分かかり、単価も一桁上。表示のたびに走らせるのは危険なので、
// 管理画面から業種を1つずつ明示的に作る。
//
// 認証: 管理者セッション、または Bearer ADMIN_SECRET（既存の画像ライブラリ生成と同じ）。
// body: { industry: string, overwrite?: boolean, durationSeconds?: '4'|'6'|'8' }

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const secretOk = !!process.env.ADMIN_SECRET && bearer === process.env.ADMIN_SECRET;

  if (!secretOk) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const adminEmails = [process.env.ADMIN_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]
      .filter(Boolean).join(',')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!user || !adminEmails.includes((user.email || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (!getGeminiKey()) {
    return NextResponse.json({ error: 'GEMINI_API_KEY (or GOOGLE_AI_API_KEY) is not set' }, { status: 500 });
  }

  const { industry, overwrite = false, durationSeconds = '4', model, action } =
    await req.json().catch(() => ({})) as {
      industry?: string; overwrite?: boolean; durationSeconds?: '4' | '6' | '8';
      model?: string; action?: 'list-models';
    };

  // 診断: この鍵で使える動画モデルを確認する（モデルIDの取り違えを潰すため）
  if (action === 'list-models') return NextResponse.json(await listAvailableModels());

  // 一括生成は用意しない。1リクエスト1業種に固定して、事故で全業種ぶんの費用が出ないようにする。
  if (!industry || !(IMAGE_INDUSTRIES as readonly string[]).includes(industry)) {
    return NextResponse.json(
      { error: 'industry が必要です（1リクエストにつき1業種）', allowed: IMAGE_INDUSTRIES },
      { status: 400 },
    );
  }
  if (!['4', '6', '8'].includes(durationSeconds)) {
    return NextResponse.json({ error: 'durationSeconds は 4 / 6 / 8 のいずれか' }, { status: 400 });
  }

  const admin = getAdminStorage();
  const path = videoStoragePath(industry);
  const { data: files } = await admin.storage.from('site-images').list('videos');
  const exists = (files || []).some(f => f.name === `${industry}.mp4`);
  if (exists && !overwrite) {
    return NextResponse.json({
      industry, skipped: true,
      url: admin.storage.from('site-images').getPublicUrl(path).data.publicUrl,
      note: '既にあります。作り直すなら overwrite: true',
    });
  }

  // 既存のヒーロー画像を種にして、静止画と絵柄を揃える（無ければ text-to-video）
  const { data: heroFiles } = await admin.storage.from('site-images').list(`library/${industry}/hero`);
  const seedName = (heroFiles || []).map(f => f.name).sort()[0];
  const seedImageUrl = seedName
    ? admin.storage.from('site-images').getPublicUrl(`library/${industry}/hero/${seedName}`).data.publicUrl
    : null;

  const startedAt = Date.now();
  const { url, reason, detail, usedSeed } = await generateVeoToStorage({ industry, seedImageUrl, durationSeconds, model });
  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);

  if (!url) return NextResponse.json({ industry, ok: false, reason, detail, elapsedSec, seedUsed: !!seedImageUrl }, { status: 502 });
  return NextResponse.json({ industry, ok: true, url, elapsedSec, durationSeconds, seedUsed: !!usedSeed });
}
