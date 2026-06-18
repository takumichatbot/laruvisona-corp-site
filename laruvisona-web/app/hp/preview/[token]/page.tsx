import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = { robots: 'noindex, nofollow' };

export default async function PreviewPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const { data: site } = await supabase
    .from('sites')
    .select('name, published_html, settings_json')
    .filter('settings_json->>previewToken', 'eq', token)
    .maybeSingle();

  if (!site) notFound();

  const html = site.published_html;
  if (!html) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#6b7280' }}>
        <p>このサイトはまだ公開されていません。ビルダーで「公開」してからプレビューリンクを発行してください。</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ background: '#fbbf24', color: '#1e3a8a', padding: '8px 16px', fontSize: '12px', fontWeight: 700, textAlign: 'center', position: 'sticky', top: 0, zIndex: 9999 }}>
        プレビューモード — このURLは関係者のみ共有してください
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

export const dynamic = 'force-dynamic';
