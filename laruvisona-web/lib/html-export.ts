import type { Block, SEOSettings, SiteSettings } from '@/types/laruHP';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderBlock(block: Block): string {
  const d = block.data;
  const str = (key: string) => escapeHtml(String(d[key] ?? ''));
  const raw = (key: string) => String(d[key] ?? '');

  switch (block.type) {
    case 'hero':
      return `
<section class="lhp-hero" style="background-color:${raw('bgColor')};color:${raw('textColor')};${raw('bgImage') ? `background-image:url(${raw('bgImage')});background-size:cover;background-position:center;` : ''}">
  <div class="lhp-hero-inner">
    <h1>${str('heading')}</h1>
    <p class="lhp-hero-sub">${str('subheading')}</p>
    <a href="${raw('ctaLink')}" class="lhp-btn-primary">${str('ctaText')}</a>
  </div>
</section>`;

    case 'heading':
      return `
<section class="lhp-section" style="text-align:${raw('align')}">
  <h2 class="lhp-section-title">${str('text')}</h2>
  ${d['subtext'] ? `<p class="lhp-section-sub">${str('subtext')}</p>` : ''}
</section>`;

    case 'paragraph':
      return `
<section class="lhp-section lhp-text-block" style="text-align:${raw('align')}">
  <p>${str('text')}</p>
</section>`;

    case 'image':
      return d['src'] ? `
<section class="lhp-section">
  <img src="${raw('src')}" alt="${str('alt')}" class="lhp-img" style="height:${raw('height')}px;object-fit:${raw('objectFit')}" />
  ${d['caption'] ? `<p class="lhp-img-caption">${str('caption')}</p>` : ''}
</section>` : '';

    case 'two-col':
      return `
<section class="lhp-section">
  <div class="lhp-two-col">
    <div class="lhp-col"><h3>${str('col1Title')}</h3><p>${str('col1Text')}</p></div>
    <div class="lhp-col"><h3>${str('col2Title')}</h3><p>${str('col2Text')}</p></div>
  </div>
</section>`;

    case 'three-col':
      return `
<section class="lhp-section">
  <div class="lhp-three-col">
    ${[1,2,3].map(n => `<div class="lhp-col lhp-col-card"><div class="lhp-col-icon">${raw(`col${n}Icon`)}</div><h3>${str(`col${n}Title`)}</h3><p>${str(`col${n}Text`)}</p></div>`).join('')}
  </div>
</section>`;

    case 'divider': {
      const label = raw('label');
      return label
        ? `<div class="lhp-divider lhp-divider-label"><span>${escapeHtml(label)}</span></div>`
        : `<div class="lhp-divider"><hr style="border-color:${raw('color')};border-top-width:${raw('thickness')}px;border-style:${raw('style')};margin:${raw('margin')}rem 0" /></div>`;
    }

    case 'cta':
      return `
<section class="lhp-cta" style="background-color:${raw('bgColor')};color:${raw('textColor')}">
  <h2>${str('heading')}</h2>
  <p>${str('subtext')}</p>
  <a href="${raw('buttonLink')}" class="lhp-btn-cta">${str('buttonText')}</a>
</section>`;

    case 'services': {
      const items = (d['items'] as Array<{icon:string;title:string;description:string;price:string}>) ?? [];
      const cols = d['columns'] === '2' ? 2 : 3;
      return `
<section class="lhp-section">
  <h2 class="lhp-section-title" style="text-align:center">${str('heading')}</h2>
  ${d['subtext'] ? `<p class="lhp-section-sub" style="text-align:center">${str('subtext')}</p>` : ''}
  <div class="lhp-grid lhp-grid-${cols}">
    ${items.map(item => `
    <div class="lhp-card">
      <div class="lhp-card-icon">${escapeHtml(item.icon)}</div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
      ${item.price ? `<span class="lhp-price">${escapeHtml(item.price)}</span>` : ''}
    </div>`).join('')}
  </div>
</section>`;
    }

    case 'testimonials': {
      const items = (d['items'] as Array<{name:string;age:string;rating:number;text:string}>) ?? [];
      return `
<section class="lhp-section lhp-testimonials-bg">
  <h2 class="lhp-section-title" style="text-align:center">${str('heading')}</h2>
  <div class="lhp-grid lhp-grid-3">
    ${items.map(t => `
    <div class="lhp-testimonial">
      <div class="lhp-stars">${'★'.repeat(t.rating)}</div>
      <p>${escapeHtml(t.text)}</p>
      <div class="lhp-testimonial-name">${escapeHtml(t.name)} <span>(${escapeHtml(t.age)})</span></div>
    </div>`).join('')}
  </div>
</section>`;
    }

    case 'faq': {
      const items = (d['items'] as Array<{q:string;a:string}>) ?? [];
      return `
<section class="lhp-section">
  <h2 class="lhp-section-title">${str('heading')}</h2>
  <div class="lhp-faq">
    ${items.map(item => `
    <details class="lhp-faq-item">
      <summary class="lhp-faq-q">Q. ${escapeHtml(item.q)}</summary>
      <div class="lhp-faq-a">A. ${escapeHtml(item.a)}</div>
    </details>`).join('')}
  </div>
</section>`;
    }

    case 'contact':
      return `
<section class="lhp-contact" id="contact" style="background-color:${raw('bgColor')}">
  <h2 class="lhp-section-title" style="text-align:center">${str('heading')}</h2>
  <p class="lhp-section-sub" style="text-align:center">${str('subtext')}</p>
  <form class="lhp-form" onsubmit="return false">
    <div class="lhp-form-row">
      <input type="text" name="name" placeholder="お名前" required />
      <input type="email" name="email" placeholder="メールアドレス" required />
    </div>
    <input type="tel" name="phone" placeholder="電話番号" />
    <textarea name="message" placeholder="お問い合わせ内容" rows="5" required></textarea>
    <button type="submit" style="background-color:${raw('buttonColor')}">${str('buttonText')}</button>
    <p class="lhp-form-note">※このフォームはデモです。実際の送信にはバックエンド連携が必要です。</p>
  </form>
</section>`;

    case 'hours': {
      const schedule = (d['schedule'] as Array<{day:string;hours:string;closed:boolean}>) ?? [];
      return `
<section class="lhp-section">
  <h2 class="lhp-section-title">${str('heading')}</h2>
  <table class="lhp-hours">
    <tbody>
      ${schedule.map(row => `
      <tr class="${row.closed ? 'lhp-closed' : ''}">
        <th>${escapeHtml(row.day)}</th>
        <td>${row.closed ? '<span class="lhp-holiday">定休日</span>' : escapeHtml(row.hours)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  ${d['note'] ? `<p class="lhp-hours-note">${str('note')}</p>` : ''}
</section>`;
    }

    case 'gallery': {
      const images = (d['images'] as string[]) ?? [];
      const cols = d['columns'] === '3' ? 3 : 2;
      const validImages = images.filter(Boolean);
      if (!validImages.length) return '';
      return `
<section class="lhp-section">
  <h2 class="lhp-section-title" style="text-align:center">${str('heading')}</h2>
  <div class="lhp-gallery lhp-gallery-${cols}">
    ${validImages.map(src => `<img src="${src}" alt="ギャラリー" class="lhp-gallery-img" />`).join('')}
  </div>
</section>`;
    }

    case 'larubot':
      return `<!-- LARUbot widget -->
<script>
(function(){
  var s=document.createElement('div');
  s.id='larubot-widget';
  s.style='position:fixed;bottom:24px;${raw('position')==='bottom-left'?'left':'right'}:24px;z-index:9999;';
  s.innerHTML='<div style="width:56px;height:56px;border-radius:50%;background:${raw('primaryColor')};display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.2);">🤖</div>';
  document.body.appendChild(s);
})();
</script>`;

    default:
      return '';
  }
}

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif;color:#111;line-height:1.6}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
.lhp-hero{min-height:420px;display:flex;align-items:center;justify-content:center;text-align:center;padding:80px 24px;position:relative;background-size:cover;background-position:center}
.lhp-hero-inner{position:relative;z-index:1;max-width:720px;margin:0 auto}
.lhp-hero h1{font-size:clamp(2rem,5vw,4rem);font-weight:900;margin-bottom:16px;line-height:1.1}
.lhp-hero-sub{font-size:1.2rem;margin-bottom:32px;opacity:.9}
.lhp-btn-primary{display:inline-block;background:#fff;color:#111;padding:14px 40px;border-radius:9999px;font-weight:700;font-size:1rem;transition:opacity .2s}
.lhp-btn-primary:hover{opacity:.85}
.lhp-section{padding:64px 24px;max-width:1100px;margin:0 auto}
.lhp-section-title{font-size:clamp(1.5rem,3vw,2.5rem);font-weight:900;margin-bottom:12px}
.lhp-section-sub{color:#666;font-size:1rem;margin-bottom:40px}
.lhp-text-block p{max-width:720px;margin:0 auto;color:#444;line-height:1.8;font-size:1rem}
.lhp-img{width:100%;border-radius:12px;object-fit:cover}
.lhp-img-caption{text-align:center;color:#888;font-size:.85rem;margin-top:8px}
.lhp-two-col,.lhp-three-col{display:grid;gap:24px}
.lhp-two-col{grid-template-columns:repeat(2,1fr)}
.lhp-three-col{grid-template-columns:repeat(3,1fr)}
@media(max-width:768px){.lhp-two-col,.lhp-three-col{grid-template-columns:1fr}}
.lhp-col{background:#f9fafb;border-radius:12px;padding:24px}
.lhp-col h3{font-size:1.1rem;font-weight:700;margin-bottom:8px}
.lhp-col p{color:#555;font-size:.9rem;white-space:pre-line}
.lhp-col-card{text-align:center}
.lhp-col-icon{font-size:2.5rem;margin-bottom:12px}
.lhp-divider{padding:16px 24px;max-width:1100px;margin:0 auto}
.lhp-divider-label{display:flex;align-items:center;gap:16px;color:#888;font-size:.85rem}
.lhp-divider-label::before,.lhp-divider-label::after{content:'';flex:1;height:1px;background:#e5e7eb}
.lhp-cta{padding:80px 24px;text-align:center}
.lhp-cta h2{font-size:clamp(1.5rem,3vw,2.5rem);font-weight:900;margin-bottom:12px}
.lhp-cta p{opacity:.9;margin-bottom:32px;font-size:1rem}
.lhp-btn-cta{display:inline-block;background:#fff;color:#111;padding:14px 48px;border-radius:9999px;font-weight:700;font-size:1rem}
.lhp-grid{display:grid;gap:20px;margin-top:40px}
.lhp-grid-2{grid-template-columns:repeat(2,1fr)}
.lhp-grid-3{grid-template-columns:repeat(3,1fr)}
@media(max-width:768px){.lhp-grid-2,.lhp-grid-3{grid-template-columns:1fr}}
.lhp-card{border:1px solid #e5e7eb;border-radius:16px;padding:24px;text-align:center;transition:box-shadow .2s}
.lhp-card:hover{box-shadow:0 4px 24px rgba(0,0,0,.08)}
.lhp-card-icon{font-size:2rem;margin-bottom:12px}
.lhp-card h3{font-size:1.1rem;font-weight:700;margin-bottom:8px}
.lhp-card p{color:#555;font-size:.875rem;margin-bottom:12px}
.lhp-price{background:#eff6ff;color:#1d4ed8;padding:4px 12px;border-radius:9999px;font-size:.875rem;font-weight:700}
.lhp-testimonials-bg{background:#f9fafb;padding:64px 24px}
.lhp-testimonials-bg .lhp-section-title{text-align:center}
.lhp-testimonial{background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.lhp-stars{color:#f59e0b;font-size:1.1rem;margin-bottom:12px}
.lhp-testimonial p{color:#444;font-size:.9rem;line-height:1.7;margin-bottom:12px}
.lhp-testimonial-name{font-weight:700;font-size:.875rem;color:#111}
.lhp-testimonial-name span{color:#888;font-weight:400}
.lhp-faq{max-width:720px;margin:32px auto 0}
.lhp-faq-item{border:1px solid #e5e7eb;border-radius:12px;margin-bottom:8px;overflow:hidden}
.lhp-faq-q{padding:16px 20px;font-weight:700;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center}
.lhp-faq-q::after{content:'+';font-size:1.25rem;color:#888}
details[open] .lhp-faq-q::after{content:'−'}
.lhp-faq-a{padding:16px 20px;background:#f9fafb;color:#444;font-size:.9rem;border-top:1px solid #e5e7eb}
.lhp-contact{padding:80px 24px}
.lhp-form{max-width:560px;margin:40px auto 0}
.lhp-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
@media(max-width:600px){.lhp-form-row{grid-template-columns:1fr}}
.lhp-form input,.lhp-form textarea{width:100%;padding:12px 16px;border:1px solid #d1d5db;border-radius:12px;font-size:1rem;font-family:inherit;margin-bottom:12px;outline:none;transition:border-color .2s}
.lhp-form input:focus,.lhp-form textarea:focus{border-color:#3b82f6}
.lhp-form textarea{resize:vertical}
.lhp-form button{width:100%;padding:14px;border:none;border-radius:12px;color:#fff;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .2s}
.lhp-form button:hover{opacity:.85}
.lhp-form-note{font-size:.75rem;color:#9ca3af;text-align:center;margin-top:8px}
.lhp-hours{width:100%;max-width:400px;margin:24px auto 0;border-collapse:collapse}
.lhp-hours th,.lhp-hours td{padding:10px 16px;border-bottom:1px solid #f3f4f6;text-align:left;font-size:.9rem}
.lhp-hours th{width:4rem;font-weight:700;color:#374151}
.lhp-closed th,.lhp-closed td{color:#9ca3af;background:#fafafa}
.lhp-holiday{color:#ef4444;font-weight:600}
.lhp-hours-note{text-align:center;color:#9ca3af;font-size:.8rem;margin-top:8px}
.lhp-gallery{display:grid;gap:8px;margin-top:24px}
.lhp-gallery-2{grid-template-columns:repeat(2,1fr)}
.lhp-gallery-3{grid-template-columns:repeat(3,1fr)}
.lhp-gallery-img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}
@media(max-width:600px){.lhp-gallery-2,.lhp-gallery-3{grid-template-columns:1fr 1fr}}
`;

export function exportToHTML(
  blocks: Block[],
  seo: SEOSettings,
  settings: SiteSettings,
  siteName: string,
  businessInfo?: { name?: string; address?: string; phone?: string; email?: string; industry?: string }
): string {
  const title = seo.title || siteName;
  const desc = seo.description || '';
  const blocksHtml = blocks.map(renderBlock).filter(Boolean).join('\n');

  const schemaType = businessInfo?.industry === 'restaurant' ? 'Restaurant'
    : businessInfo?.industry === 'beauty' ? 'BeautySalon'
    : businessInfo?.industry === 'clinic' ? 'MedicalClinic'
    : businessInfo?.industry === 'fitness' ? 'ExerciseGym'
    : businessInfo?.industry === 'hotel' ? 'Hotel'
    : 'LocalBusiness';

  const schema = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: businessInfo?.name || siteName,
    address: {
      '@type': 'PostalAddress',
      streetAddress: businessInfo?.address || '',
      addressCountry: 'JP',
    },
    telephone: businessInfo?.phone || '',
    email: businessInfo?.email || '',
    url: '',
  };

  const laruBotScript = settings.larubot ? `
<script>
(function(){
  var b=document.createElement('div');
  b.style='position:fixed;bottom:24px;right:24px;z-index:9999;cursor:pointer;';
  b.innerHTML='<div style="width:56px;height:56px;border-radius:50%;background:#4f46e5;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 4px 20px rgba(0,0,0,.25);" title="LARUbot チャット">🤖</div>';
  document.body.appendChild(b);
})();
</script>` : '';

  const gaScript = settings.gaTrackingId ? `
<script async src="https://www.googletagmanager.com/gtag/js?id=${settings.gaTrackingId}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${settings.gaTrackingId}');</script>` : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
${seo.keywords ? `<meta name="keywords" content="${escapeHtml(seo.keywords)}">` : ''}
<meta property="og:title" content="${escapeHtml(seo.ogTitle || title)}">
<meta property="og:description" content="${escapeHtml(seo.ogDescription || desc)}">
<meta property="og:type" content="website">
<meta name="robots" content="index,follow">
<link rel="canonical" href="">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
${gaScript}
<style>${CSS}</style>
</head>
<body>
${blocksHtml}
${laruBotScript}
</body>
</html>`;
}
