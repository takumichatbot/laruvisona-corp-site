import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ShopBuyButton from './ShopBuyButton';

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

  const categoryEmoji: Record<string, string> = {
    'サービス': '⚙️',
    'コース・講座': '📚',
    'チケット': '🎟️',
    'デジタルコンテンツ': '💾',
    'その他': '📦',
  };

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {products.map(product => (
                <div key={product.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>
                    {categoryEmoji[product.category] ?? '📦'}
                  </div>

                  <div style={{ padding: '20px 20px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 11, background: '#f0f9ff', color: '#0369a1', padding: '3px 10px', borderRadius: 100, fontWeight: 700, border: '1px solid #bae6fd', display: 'inline-block', marginBottom: 10 }}>
                      {product.category}
                    </span>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 8px', lineHeight: 1.4 }}>{product.name}</h2>
                    {product.description && (
                      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 16px', lineHeight: 1.6, flex: 1 }}>{product.description}</p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <span style={{ fontSize: 24, fontWeight: 800, color: '#0369a1' }}>¥{product.price.toLocaleString()}</span>
                      {product.stock !== null && (
                        <span style={{ fontSize: 12, color: product.stock <= 5 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                          残り{product.stock}件
                        </span>
                      )}
                    </div>

                    <ShopBuyButton
                      siteId={site.id}
                      productId={product.id}
                      successUrl={`${shopUrl}?payment=success`}
                      cancelUrl={shopUrl}
                    />
                  </div>
                </div>
              ))}
            </div>
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
