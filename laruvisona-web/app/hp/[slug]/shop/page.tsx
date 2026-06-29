import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ShopClient from './ShopClient';

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ payment?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = getServiceClient();
  const { data } = await supabase.from('sites').select('name').eq('slug', slug).eq('published', true).single();
  if (!data) return { title: 'Shop' };
  return { title: `${data.name} — ショップ` };
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  stock: number | null;
  active: boolean;
  category: string;
  variantLabel?: string;
  variants?: Array<{ id: string; name: string; priceDelta: number; stock: number | null }>;
}

export default async function PublicShopPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { payment } = await searchParams;
  const supabase = getServiceClient();

  const { data: site } = await supabase
    .from('sites')
    .select('id, name, settings_json')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (!site) notFound();

  const settings = (site.settings_json as Record<string, unknown>) || {};
  const allProducts = (settings.products as Product[]) || [];
  const products = allProducts.filter(p => p.active && (p.stock === null || p.stock > 0));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
  const shopUrl = `${appUrl}/hp/${slug}/shop`;

  // Product JSON-LD (ItemList + individual Product schemas)
  const productJsonLd = products.length > 0 ? JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${site.name} — ショップ`,
    url: shopUrl,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.name,
        description: p.description || undefined,
        offers: {
          '@type': 'Offer',
          price: p.price,
          priceCurrency: 'JPY',
          availability: (p.stock === null || p.stock > 0)
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: shopUrl,
        },
      },
    })),
  }) : null;

  return (
    <>
    {productJsonLd && (
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />
    )}
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '20px 24px', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>{site.name}</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>オンラインショップ</p>
        </div>
      </header>

      {/* Payment success banner */}
      {payment === 'success' && (
        <div style={{ background: '#f0fdf4', borderBottom: '1px solid #86efac', padding: '12px 24px', textAlign: 'center' }}>
          <p style={{ color: '#15803d', fontWeight: 700, fontSize: 14, margin: 0 }}>
            ✅ ご購入ありがとうございます！確認メールをお送りしました。
          </p>
        </div>
      )}

      {/* Body */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
        {products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🛍️</div>
            <p style={{ color: '#64748b', fontSize: 16, fontWeight: 600 }}>現在販売中の商品はありません</p>
            <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>しばらくしてからもう一度お確かめください</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 24 }}>
              {products.length}件の商品・サービス
            </p>
            <ShopClient products={products} siteId={site.id} shopUrl={shopUrl} />
          </>
        )}
      </main>

      <footer style={{ borderTop: '1px solid #e2e8f0', padding: '20px 24px', textAlign: 'center', marginTop: 40 }}>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Powered by LARU HP · Stripe による安全な決済</p>
      </footer>
    </div>
    </>
  );
}

export const revalidate = 300;
