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

  const { industry, heroCount = 3, galleryCount = 6, overwrite = false } =
    await req.json().catch(() => ({})) as { industry?: string; heroCount?: number; galleryCount?: number; overwrite?: boolean };

  const industries = industry ? [industry] : [...IMAGE_INDUSTRIES];
  const admin = getAdminStorage();
  const results: Record<string, { hero: number; gallery: number; skipped?: boolean }> = {};

  for (const ind of industries) {
    // 既に十分な枚数があればスキップ（overwrite時は無視して再生成）
    if (!overwrite) {
      const { data: existingHero } = await admin.storage.from('site-images').list(`library/${ind}/hero`);
      const { data: existingGal } = await admin.storage.from('site-images').list(`library/${ind}/gallery`);
      if ((existingHero?.length || 0) >= heroCount && (existingGal?.length || 0) >= galleryCount) {
        results[ind] = { hero: existingHero!.length, gallery: existingGal!.length, skipped: true };
        continue;
      }
    }

    // ヒーロー: 世界観promptを少し振って heroCount 枚（店名は入れない＝業種汎用）
    const heroPrompts = Array.from({ length: heroCount }, () => buildHeroPrompt(ind));
    // ギャラリー: 業種のシーン配列から galleryCount 個（足りなければ循環）
    const scenes = galleryScenesFor(ind);
    const galleryPrompts = Array.from({ length: galleryCount }, (_, i) => buildGalleryPrompt(scenes[i % scenes.length]));

    // 同時3枚までに制限（レート制限回避）。ヒーロー→ギャラリーの順で実行。
    const heroUrls = await runWithConcurrency(
      heroPrompts.map((p, i) => () => generateImagenToStorage(p, '16:9', 1600, 900, `library/${ind}/hero/${i}.webp`)),
      3,
    );
    const galleryUrls = await runWithConcurrency(
      galleryPrompts.map((p, i) => () => generateImagenToStorage(p, '4:3', 1000, 750, `library/${ind}/gallery/${i}.webp`)),
      3,
    );

    results[ind] = {
      hero: heroUrls.filter(Boolean).length,
      gallery: galleryUrls.filter(Boolean).length,
    };
  }

  return NextResponse.json({ industries: industries.length, results });
}
