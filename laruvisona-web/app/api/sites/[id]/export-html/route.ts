import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exportToHTML } from '@/lib/html-export';
import { exportFileName, pagesFromBlocksJson, portableSettings } from '@/lib/site-export';
import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';

// GET /api/sites/[id]/export-html
// 自分の作ったページを、1枚のHTMLファイルとして持ち出すための入口。
// 契約状態では止めない。書いた文章と写真はお客さまのものなので、
// 解約したあと・支払いが止まったあとでも取り出せる必要がある。
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: site, error } = await supabase
    .from('sites')
    .select('id, name, blocks_json, seo_json, settings_json')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: 'サイトを読み込めませんでした' }, { status: 503 });
  }
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const seo = (site.seo_json || {}) as SEOSettings;
  const pages: Page[] = pagesFromBlocksJson(
    site.blocks_json as Block[] | { v: number; pages: Page[] },
    seo,
  );

  const html = exportToHTML(
    pages,
    seo,
    portableSettings(site.settings_json as SiteSettings),
    site.name,
  );

  const name = exportFileName(site.name || '');
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition':
        `attachment; filename="${name.ascii}"; filename*=UTF-8''${encodeURIComponent(name.utf8)}`,
      'Cache-Control': 'no-store',
    },
  });
}
