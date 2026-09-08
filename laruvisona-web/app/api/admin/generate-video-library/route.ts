import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IMAGE_INDUSTRIES, getAdminStorage, getGeminiKey } from '@/lib/imagen';
import { generateVeoToStorage, listAvailableModels, videoStoragePath } from '@/lib/veo';
import {
  HERO_VIDEO_PATH, buildHeroVideoPrompt,
  HERO_VARIANTS, isHeroVariant, heroVariantPath, buildHeroVariantPrompt,
} from '@/lib/veo-prompt';

// 業種ショーケース用の短尺ループ動画を Veo で作って Supabase Storage に貯める。
//
// 用途は LARU HP 自身のLPのショーケースだけ。顧客サイトの生成では使わない
// （顧客向けは従来どおり Imagen の静止画）。動画を機能として売るものではない。
//
// 画像ライブラリ（/api/library-image）と違って自己修復方式にはしない。
// 動画は生成に数十秒〜数分かかり、単価も一桁上。表示のたびに走らせるのは危険なので、
// 管理画面から業種を1つずつ明示的に作る。
//
// 認証: 管理者セッション、または Bearer ADMIN_SECRET（既存の画像ライブラリ生成と同じ）。
// body: { industry: string, overwrite?: boolean, durationSeconds?: '4'|'6'|'8' }
//
// LPファーストビュー用:
//   { target: 'lp-hero' }                        … 決定版 videos/lp-hero.mp4 を作る
//   { target: 'lp-hero', variant: 'paper' }      … 候補 videos/lp-hero-paper.mp4 を作る
//   { action: 'list-hero-variants' }             … 候補の一覧と、あるかどうか（生成しない）
//   { action: 'promote-hero', variant: 'paper' } … 選んだ候補を lp-hero.mp4 にコピー（生成しない）

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

  const { industry, overwrite = false, durationSeconds = '4', model, action, target, variant } =
    await req.json().catch(() => ({})) as {
      industry?: string; overwrite?: boolean; durationSeconds?: '4' | '6' | '8';
      model?: string; action?: 'list-models' | 'list-hero-variants' | 'promote-hero';
      target?: 'lp-hero'; variant?: string;
    };

  // 診断: この鍵で使える動画モデルを確認する（モデルIDの取り違えを潰すため）
  if (action === 'list-models') return NextResponse.json(await listAvailableModels());

  // 候補の一覧。生成はしないので何度叩いても費用は出ない。
  if (action === 'list-hero-variants') {
    const admin0 = getAdminStorage();
    const { data: files } = await admin0.storage.from('site-images').list('videos');
    const names = new Set((files || []).map(f => f.name));
    return NextResponse.json({
      variants: (Object.keys(HERO_VARIANTS) as Array<keyof typeof HERO_VARIANTS>).map(v => ({
        variant: v,
        exists: names.has(`lp-hero-${v}.mp4`),
        url: admin0.storage.from('site-images').getPublicUrl(heroVariantPath(v)).data.publicUrl,
        prompt: buildHeroVariantPrompt(v),
      })),
      current: {
        exists: names.has('lp-hero.mp4'),
        url: admin0.storage.from('site-images').getPublicUrl(HERO_VIDEO_PATH).data.publicUrl,
      },
    });
  }

  // 選んだ候補を決定版にコピーする。生成しないので追加費用は出ない。
  if (action === 'promote-hero') {
    if (!variant || !isHeroVariant(variant)) {
      return NextResponse.json(
        { error: 'variant が必要です', allowed: Object.keys(HERO_VARIANTS) },
        { status: 400 },
      );
    }
    const admin0 = getAdminStorage();
    const from = heroVariantPath(variant);
    const { data: files } = await admin0.storage.from('site-images').list('videos');
    if (!(files || []).some(f => f.name === `lp-hero-${variant}.mp4`)) {
      return NextResponse.json({ error: 'その候補はまだ生成されていません', variant }, { status: 404 });
    }
    // copy は宛先が既にあると失敗するので、上書きは remove してから
    if ((files || []).some(f => f.name === 'lp-hero.mp4')) {
      await admin0.storage.from('site-images').remove([HERO_VIDEO_PATH]);
    }
    const { error } = await admin0.storage.from('site-images').copy(from, HERO_VIDEO_PATH);
    if (error) return NextResponse.json({ error: error.message, variant }, { status: 500 });
    return NextResponse.json({
      ok: true, promoted: variant,
      url: admin0.storage.from('site-images').getPublicUrl(HERO_VIDEO_PATH).data.publicUrl,
    });
  }

  // LPのファーストビュー用の1本。業種ライブラリとは別枠で1本だけ持つ。
  if (target === 'lp-hero') {
    // variant を渡すと候補として別名で作る。渡さなければ従来どおり決定版。
    if (variant !== undefined && !isHeroVariant(variant)) {
      return NextResponse.json(
        { error: 'variant が不正です', allowed: Object.keys(HERO_VARIANTS) },
        { status: 400 },
      );
    }
    const path = variant ? heroVariantPath(variant) : HERO_VIDEO_PATH;
    const fileName = path.split('/').pop()!;
    const prompt = variant ? buildHeroVariantPrompt(variant) : buildHeroVideoPrompt();

    const admin0 = getAdminStorage();
    const { data: heroFiles } = await admin0.storage.from('site-images').list('videos');
    if ((heroFiles || []).some(f => f.name === fileName) && !overwrite) {
      return NextResponse.json({
        target, variant: variant ?? null, skipped: true,
        url: admin0.storage.from('site-images').getPublicUrl(path).data.publicUrl,
        note: '既にあります。作り直すなら overwrite: true',
      });
    }
    const t0 = Date.now();
    const r = await generateVeoToStorage({
      industry: 'other',
      promptOverride: prompt,
      storagePathOverride: path,
      durationSeconds: durationSeconds || '8',
      model,
    });
    const sec = Math.round((Date.now() - t0) / 1000);
    if (!r.url) return NextResponse.json({ target, variant: variant ?? null, ok: false, reason: r.reason, detail: r.detail, elapsedSec: sec }, { status: 502 });
    return NextResponse.json({ target, variant: variant ?? null, ok: true, url: r.url, elapsedSec: sec, durationSeconds: durationSeconds || '8' });
  }

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
