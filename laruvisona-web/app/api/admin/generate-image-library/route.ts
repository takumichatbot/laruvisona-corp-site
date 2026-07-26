import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  IMAGE_INDUSTRIES, buildHeroPrompt, galleryScenesFor, buildGalleryPrompt,
  generateImagenToStorage, getAdminStorage, getGeminiKey,
} from '@/lib/imagen';

// 業種ごとの画像ライブラリを Imagen で一度だけ生成して Supabase Storage にプールする。
// 以降のサイト作成は /api/ai/site-images がこのプールから選ぶだけになり、生成コスト・待ち時間ゼロ。
//
// 認証: 管理者セッション、またはサーバー内部/手動実行用の Bearer ADMIN_SECRET。
// body: {
//   industry?: string,      // 指定なら1業種のみ。未指定なら全業種
//   heroCount?: number,     // 業種あたりのヒーロー枚数（既定3）
//   galleryCount?: number,  // 業種あたりのギャラリー枚数（既定6）
//   overwrite?: boolean,    // true で既存プールを無視して再生成（既定false=既に十分あればスキップ）
// }
//
// コスト注記: 全業種 × (heroCount + galleryCount) 枚を生成する高コスト処理。
// 既定で 16業種 × (3+6) = 144枚。overwrite しない限り、既に揃っている業種はスキップする。

// 同時実行数を制限しつつ全タスクを実行（レート制限で取りこぼさないため）
async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

export async function POST(req: Request) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const secretOk = !!process.env.ADMIN_SECRET && bearer === process.env.ADMIN_SECRET;

  if (!secretOk) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    // ADMIN_EMAIL と NEXT_PUBLIC_ADMIN_EMAIL の両方を許可（片方に別の値が入っていても弾かない）
    const adminEmails = [process.env.ADMIN_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]
      .filter(Boolean).join(',')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!user || !adminEmails.includes((user.email || '').toLowerCase())) {
      // 原因切り分け用のヒントを返す（メール本文は伏せる）
      return NextResponse.json({
        error: 'Forbidden',
        reason: !user ? 'no_session' : 'email_not_in_admin_list',
        loggedInAs: user?.email ? user.email.replace(/(.).*(@.*)/, '$1***$2') : null,
        adminConfigured: adminEmails.length > 0,
      }, { status: 403 });
    }
  }

  if (!getGeminiKey()) {
    return NextResponse.json({ error: 'GEMINI_API_KEY (or GOOGLE_AI_API_KEY) is not set' }, { status: 500 });
  }

  const { industry, heroCount = 3, galleryCount = 6, overwrite = false, only } =
    await req.json().catch(() => ({})) as {
      industry?: string; heroCount?: number; galleryCount?: number; overwrite?: boolean;
      only?: 'hero' | 'gallery'; // 指定時はその種別のみ生成（1リクエストを短くしてタイムアウト回避）
    };

  const industries = industry ? [industry] : [...IMAGE_INDUSTRIES];
  const admin = getAdminStorage();
  // hero/gallery = 生成後に実在する枚数, complete = 目標枚数に達したか
  const results: Record<string, { hero: number; gallery: number; complete: boolean; skipped?: boolean }> = {};

  for (const ind of industries) {
    const { data: existingHero } = await admin.storage.from('site-images').list(`library/${ind}/hero`);
    const { data: existingGal } = await admin.storage.from('site-images').list(`library/${ind}/gallery`);
    const haveHero = new Set((existingHero || []).map(f => f.name));
    const haveGal = new Set((existingGal || []).map(f => f.name));

    // 欠けているインデックスだけを生成する（再実行時に生成済み分のコストを消費しない）
    const heroIdx = only === 'gallery' ? [] : Array.from({ length: heroCount }, (_, i) => i)
      .filter(i => overwrite || !haveHero.has(`${i}.webp`));
    const galIdx = only === 'hero' ? [] : Array.from({ length: galleryCount }, (_, i) => i)
      .filter(i => overwrite || !haveGal.has(`${i}.webp`));

    if (heroIdx.length === 0 && galIdx.length === 0) {
      results[ind] = { hero: haveHero.size, gallery: haveGal.size, complete: haveHero.size >= heroCount && haveGal.size >= galleryCount, skipped: true };
      continue;
    }

    // ヒーローは世界観promptを少し振る（店名は入れない＝業種汎用）。
    // ギャラリーは業種のシーン配列から（足りなければ循環）。同時2枚まで（レート制限対策）。
    const scenes = galleryScenesFor(ind);
    const heroUrls = await runWithConcurrency(
      heroIdx.map(i => () => generateImagenToStorage(buildHeroPrompt(ind), '16:9', 1600, 900, `library/${ind}/hero/${i}.webp`)),
      2,
    );
    const galleryUrls = await runWithConcurrency(
      galIdx.map(i => () => generateImagenToStorage(buildGalleryPrompt(scenes[i % scenes.length]), '4:3', 1000, 750, `library/${ind}/gallery/${i}.webp`)),
      2,
    );

    const hero = haveHero.size + heroUrls.filter(Boolean).length;
    const gallery = haveGal.size + galleryUrls.filter(Boolean).length;
    results[ind] = { hero, gallery, complete: hero >= heroCount && gallery >= galleryCount };
  }

  return NextResponse.json({ industries: industries.length, results });
}
