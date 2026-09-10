import { notFound, permanentRedirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';

// 旧い内部ルート。
//
// 独自ドメインは proxy.ts が /hp/<slug><path> へ渡すようになったので、
// 表示処理はパス形式・サブドメイン形式と同じ /hp/[slug] に一本化した。
// このファイルは本文を持たない（同じページを2つ持たないため）。
// 直接開かれた場合だけ、そのサイトの正規URLへ転送する。

export const dynamic = 'force-dynamic';

export default async function ByDomainRedirect(
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;
  const supabase = createServiceClient();
  const { data: site } = await supabase
    .from('sites')
    .select('slug, custom_domain, published')
    .eq('custom_domain', domain)
    .eq('published', true)
    .single<{ slug: string | null; custom_domain: string | null; published: boolean }>();

  if (!site?.custom_domain) notFound();
  permanentRedirect(`https://${site.custom_domain}`);
}
