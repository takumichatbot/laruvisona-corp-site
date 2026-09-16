import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { exportToHTML } from '@/lib/html-export';
import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';
import { hasServiceAccess } from '@/lib/subscription-access';
import { canonicalBase } from '@/lib/public-site-url';
import { sitePublishedEmail } from '@/lib/site-published-email';
import { Resend } from 'resend';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Paywall: require active subscription to publish
  // 管理者はバイパス（ダッシュボードは管理者を「有効」表示するため、ここも揃えないと
  // 契約済み表示なのにプラン選択モーダルが出る不整合が起きる）
  const adminEmails = [process.env.ADMIN_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]
    .filter(Boolean).join(',')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isAdmin = adminEmails.includes((user.email || '').toLowerCase());

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();

  if (profileError) return NextResponse.json({ error: '契約を確認できませんでした' }, { status: 503 });

  // trialing も通す。ここだけ active 限定にしていたため、試用中の人は
  // サイトを作れるのに公開だけできなかった（lib/subscription-access.ts）。
  if (!isAdmin && !hasServiceAccess(profile?.subscription_status)) {
    return NextResponse.json(
      { error: 'subscription_required', message: 'サイトの公開にはサブスクリプションが必要です' },
      { status: 403 }
    );
  }

  const { data: site, error: fetchError } = await supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 503 });
  }
  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Handle both v1 (Block[]) and v2 ({ v: 2, pages: Page[] }) formats
  const rawBlocks = site.blocks_json as Block[] | { v: number; pages: Page[] };
  let pages: Page[];
  const seoSettings: SEOSettings = site.seo_json as SEOSettings;

  if (Array.isArray(rawBlocks)) {
    pages = [{ id: 'page-main', name: 'トップページ', path: '/', blocks: rawBlocks, seo: seoSettings }];
  } else if (rawBlocks?.v === 2 && rawBlocks.pages?.length) {
    pages = rawBlocks.pages;
  } else {
    pages = [{ id: 'page-main', name: 'トップページ', path: '/', blocks: [], seo: seoSettings }];
  }

  const html = exportToHTML(
    pages,
    seoSettings,
    site.settings_json as SiteSettings,
    site.name,
    { name: site.name, industry: site.industry ?? undefined, siteId: site.id, slug: site.slug ?? undefined }
  );

  const service = createServiceClient();
  const { data: updated, error: updateError } = await service
    .from('sites')
    .update({ published: true, published_html: html })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('slug')
    .single();

  if (updateError || !updated) return NextResponse.json({ error: 'サイトを公開できませんでした' }, { status: 500 });

  // Bust ISR cache for this slug
  if (updated?.slug) revalidatePath(`/hp/${updated.slug}`);

  // はじめての公開だけ、本人へURLを送る。
  // 公開できたのに何も残らないと、タブを閉じた時点で自分のサイトの場所が
  // 分からなくなる。公開そのものは終わっているので、送信の失敗で
  // 公開を失敗扱いにはしない。
  if (!site.published && user.email) {
    try {
      if (process.env.RESEND_API_KEY) {
        const mail = sitePublishedEmail({
          siteName: site.name,
          url: canonicalBase({ slug: updated.slug, custom_domain: site.custom_domain }),
        });
        await new Resend(process.env.RESEND_API_KEY).emails.send(
          { from: 'LARU HP <noreply@laruvisona.jp>', to: user.email, subject: mail.subject, html: mail.html },
          // 何度公開し直しても、最初の1通だけ。
          { idempotencyKey: `laruhp-site-published-${id}` },
        );
      }
    } catch (error) {
      console.error('[sites/publish] 公開のお知らせを送れませんでした', {
        name: error instanceof Error ? error.name : 'unknown',
      });
    }
  }

  // 公開自体は完了済みなので、履歴保存だけの失敗を公開失敗には戻さない。
  // 成否を返して、利用者と運用側が「履歴も保存済み」と誤認しないようにする。
  const versionResult = await service.from('site_versions').insert({
    site_id: id,
    label: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    blocks_json: site.blocks_json,
    seo_json: site.seo_json,
    settings_json: site.settings_json,
  });

  return NextResponse.json({
    success: true,
    versionSaved: !versionResult.error,
    ...versionResult.error ? { warning: '公開は完了しましたが、版履歴を保存できませんでした' } : {},
    slug: updated.slug,
    url: `/hp/${updated.slug}`,
  });
}

// Unpublish
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { data: owned, error: ownedError } = await supabase.from('sites').select('id').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (ownedError) return NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 503 });
  if (!owned) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const { data: unpublished, error } = await createServiceClient()
    .from('sites')
    .update({ published: false, published_html: null })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error || !unpublished) return NextResponse.json({ error: 'サイトを非公開にできませんでした' }, { status: 500 });
  return NextResponse.json({ success: true });
}
