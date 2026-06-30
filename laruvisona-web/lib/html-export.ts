import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderBlockInner(block: Block, ctx?: { heroLayout: string; accentColor: string }): string {
  const d = block.data;
  const str = (key: string) => escapeHtml(String(d[key] ?? ''));
  const raw = (key: string) => String(d[key] ?? '');

  switch (block.type) {
    case 'nav': {
      const links = (d['links'] as { label: string; href: string }[] | undefined) || [];
      const linkHtml = links.map(l => `<a href="${escapeHtml(l.href)}" class="lhp-nav-link">${escapeHtml(l.label)}</a>`).join('');
      const cta = d['showCta'] ? `<a href="${raw('ctaLink')}" class="lhp-nav-cta">${str('ctaText')}</a>` : '';
      const sticky = d['sticky'] ? ' lhp-nav-sticky' : '';
      return `
<nav class="lhp-nav${sticky}" style="background-color:${raw('bgColor') || '#fff'};color:${raw('textColor') || '#111'}">
  <div class="lhp-nav-inner">
    <span class="lhp-nav-logo">${str('logo')}</span>
    <button class="lhp-nav-toggle" aria-label="メニュー">&#9776;</button>
    <div class="lhp-nav-links" id="lhp-nav-links">${linkHtml}${cta}</div>
  </div>
</nav>`;
    }

    case 'hero': {
      const abVariant = raw('abVariant');
      const abAttr = abVariant ? ` data-ab="${abVariant}"` : '';
      const layout = ctx?.heroLayout || 'center';
      const heroInnerStyle = layout === 'center'
        ? 'text-align:center;align-items:center'
        : 'text-align:left;align-items:flex-start';
      const imgCol = (layout === 'split' && raw('bgImage'))
        ? `<div class="lhp-hero-split-img"><img src="${raw('bgImage')}" alt="${str('heading')}" loading="eager"></div>`
        : layout === 'split'
          ? `<div class="lhp-hero-split-img" style="background:rgba(255,255,255,0.12)"></div>`
          : '';
      const bgStyle = layout === 'split'
        ? `background-color:${raw('bgColor') || '#1e293b'}`
        : `background-color:${raw('bgColor')};${raw('bgImage') ? `background-image:url(${raw('bgImage')});background-size:cover;background-position:center;` : ''}`;
      return `
<section data-lhp-anim class="lhp-hero lhp-hero-${layout}"${abAttr} style="${bgStyle};color:${raw('textColor')}">
  <div class="lhp-hero-inner" style="${heroInnerStyle}">
    <div class="lhp-hero-content">
      <h1>${str('heading')}</h1>
      <p class="lhp-hero-sub">${str('subheading')}</p>
      <a href="${raw('ctaLink')}" class="lhp-btn-primary">${str('ctaText')}</a>
    </div>
    ${imgCol}
  </div>
</section>`;
    }

    case 'heading': {
      const hFsMap: Record<string, string> = { sm: '0.875rem', base: '1rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem' };
      const hFwMap: Record<string, string> = { normal: '400', semibold: '600', bold: '700', extrabold: '800', black: '900' };
      const hStyle = `color:${raw('color') || '#111827'};font-size:${hFsMap[raw('fontSize')] || '1.875rem'};font-weight:${hFwMap[raw('fontWeight')] || '700'}`;
      return `
<section data-lhp-anim class="lhp-section" style="text-align:${raw('align') || 'left'}">
  <h2 style="${hStyle}">${str('text')}</h2>
  ${d['subtext'] ? `<p class="lhp-section-sub">${str('subtext')}</p>` : ''}
</section>`;
    }

    case 'paragraph': {
      const pFsMap: Record<string, string> = { sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem' };
      const pStyle = `color:${raw('color') || '#374151'};font-size:${pFsMap[raw('fontSize')] || '1rem'}`;
      return `
<section data-lhp-anim class="lhp-section lhp-text-block" style="text-align:${raw('align') || 'left'}">
  <p style="${pStyle}">${str('text')}</p>
</section>`;
    }

    case 'image':
      return d['src'] ? `
<section data-lhp-anim class="lhp-section">
  <img src="${raw('src')}" alt="${str('alt') || '画像'}" class="lhp-img" style="height:${raw('height')}px;object-fit:${raw('objectFit')}" loading="lazy" />
  ${d['caption'] ? `<p class="lhp-img-caption">${str('caption')}</p>` : ''}
</section>` : '';

    case 'two-col':
      return `
<section data-lhp-anim class="lhp-section">
  <div class="lhp-two-col">
    <div class="lhp-col"><h3>${str('col1Title')}</h3><p>${str('col1Text')}</p></div>
    <div class="lhp-col"><h3>${str('col2Title')}</h3><p>${str('col2Text')}</p></div>
  </div>
</section>`;

    case 'three-col':
      return `
<section data-lhp-anim class="lhp-section">
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
<section data-lhp-anim class="lhp-cta" style="background-color:${raw('bgColor')};color:${raw('textColor')}">
  <h2>${str('heading')}</h2>
  <p>${str('subtext')}</p>
  <a href="${raw('buttonLink')}" class="lhp-btn-cta">${str('buttonText')}</a>
</section>`;

    case 'services': {
      const items = (d['items'] as Array<{icon:string;title:string;description:string;price:string}>) ?? [];
      const cols = d['columns'] === '2' ? 2 : 3;
      return `
<section data-lhp-anim class="lhp-section">
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
<section data-lhp-anim class="lhp-section lhp-testimonials-bg">
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
<section data-lhp-anim class="lhp-section">
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

    case 'before-after': {
      const beforeImage = raw('beforeImage');
      const afterImage = raw('afterImage');
      if (!beforeImage && !afterImage) return '';
      return `
<section data-lhp-anim class="lhp-section">
  <h2 class="lhp-section-title">${str('heading')}</h2>
  <div style="position:relative;max-width:640px;margin:0 auto;border-radius:16px;overflow:hidden;background:#eee;min-height:200px;user-select:none">
    <img src="${escapeHtml(afterImage)}" alt="${str('afterLabel')}" style="display:block;width:100%;height:auto" />
    <img src="${escapeHtml(beforeImage)}" alt="${str('beforeLabel')}" data-ba style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;clip-path:inset(0 50% 0 0)" />
    <span style="position:absolute;top:10px;left:10px;background:rgba(0,0,0,.6);color:#fff;font-size:12px;font-weight:bold;padding:4px 8px;border-radius:6px">${str('beforeLabel')}</span>
    <span style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,.6);color:#fff;font-size:12px;font-weight:bold;padding:4px 8px;border-radius:6px">${str('afterLabel')}</span>
    <input type="range" min="0" max="100" value="50" aria-label="Before After"
      oninput="this.parentNode.querySelector('[data-ba]').style.clipPath='inset(0 '+(100-this.value)+'% 0 0)'"
      style="position:absolute;bottom:12px;left:5%;width:90%;cursor:ew-resize" />
  </div>
</section>`;
    }

    case 'tabs': {
      const items = (d['items'] as Array<{ label: string; body: string }>) ?? [];
      const heading = str('heading');
      return `
<section data-lhp-anim class="lhp-section">
  ${heading ? `<h2 class="lhp-section-title">${heading}</h2>` : ''}
  <div class="lhp-tabs" style="max-width:720px;margin:0 auto">
    <div role="tablist" style="display:flex;gap:8px;border-bottom:1px solid #e5e7eb;flex-wrap:wrap">
      ${items.map((it, i) => `<button type="button" data-tab-btn
        onclick="var w=this.closest('.lhp-tabs');w.querySelectorAll('[data-tab-btn]').forEach(function(b,j){b.style.borderBottomColor=j===${i}?'#2563eb':'transparent';b.style.color=j===${i}?'#2563eb':'#6b7280'});w.querySelectorAll('[data-tab-panel]').forEach(function(p,j){p.style.display=j===${i}?'block':'none'})"
        style="padding:10px 16px;font-weight:bold;font-size:14px;border:none;background:none;cursor:pointer;border-bottom:2px solid ${i === 0 ? '#2563eb' : 'transparent'};color:${i === 0 ? '#2563eb' : '#6b7280'}">${escapeHtml(it.label)}</button>`).join('')}
    </div>
    ${items.map((it, i) => `<div data-tab-panel style="display:${i === 0 ? 'block' : 'none'};padding:20px 4px;white-space:pre-wrap;color:#374151;line-height:1.7">${escapeHtml(it.body)}</div>`).join('')}
  </div>
</section>`;
    }

    case 'team': {
      const items = (d['items'] as Array<{ photo: string; name: string; role: string; bio: string }>) ?? [];
      return `
<section data-lhp-anim class="lhp-section">
  <h2 class="lhp-section-title">${str('heading')}</h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:24px;max-width:880px;margin:0 auto">
    ${items.map(m => `
    <div style="text-align:center">
      <div style="width:96px;height:96px;margin:0 auto 12px;border-radius:50%;overflow:hidden;background:#f3f4f6">${m.photo ? `<img src="${escapeHtml(m.photo)}" alt="${escapeHtml(m.name)}" style="width:100%;height:100%;object-fit:cover" />` : ''}</div>
      <p style="font-weight:bold;color:#1f2937;margin:0">${escapeHtml(m.name)}</p>
      <p style="color:#2563eb;font-size:12px;margin:2px 0">${escapeHtml(m.role)}</p>
      <p style="color:#6b7280;font-size:12px;margin:0">${escapeHtml(m.bio)}</p>
    </div>`).join('')}
  </div>
</section>`;
    }

    case 'free': {
      type El = { id: string; type: 'text' | 'image' | 'button'; x: number; y: number; w: number; text?: string; size?: number; color?: string; weight?: string; align?: string; src?: string; radius?: number; link?: string; bg?: string };
      const els = (d['elements'] as El[]) || [];
      const height = Number(d['height']) || 600;
      const renderEl = (el: El): string => {
        const base = `position:absolute;left:${el.x}%;top:${el.y}%`;
        if (el.type === 'text') {
          return `<div style="${base};width:${el.w}%;font-size:${(el.size || 16) / 10}cqw;color:${el.color || '#111'};font-weight:${el.weight || 400};text-align:${el.align || 'left'};line-height:1.4">${escapeHtml(el.text || '')}</div>`;
        }
        if (el.type === 'image') {
          return el.src ? `<img src="${escapeHtml(el.src)}" alt="" style="${base};width:${el.w}%;height:auto;border-radius:${el.radius || 0}px;object-fit:cover" />` : '';
        }
        const href = /^(https?:\/\/|\/|#|mailto:)/i.test(el.link || '') ? (el.link as string) : '#';
        return `<a href="${escapeHtml(href)}" style="${base};display:inline-block;background:${el.bg || '#2563eb'};color:${el.color || '#fff'};font-size:${(el.size || 16) / 10}cqw;font-weight:700;padding:.6em 1.2em;border-radius:.6em;text-decoration:none;text-align:center">${escapeHtml(el.text || '')}</a>`;
      };
      return `
<section class="lhp-section" style="padding:0">
  <div style="position:relative;width:100%;background:${raw('bg') || '#f8fafc'};aspect-ratio:1000 / ${height};container-type:inline-size;overflow:hidden">
    ${els.map(renderEl).join('')}
  </div>
</section>`;
    }

    case 'shop-grid': {
      const bid = block.id;
      return `
<section data-lhp-anim class="lhp-section" id="lhp-shop-${bid}">
  <h2 class="lhp-section-title" style="text-align:center">${str('heading')}</h2>
  ${raw('subtext') ? `<p class="lhp-section-sub" style="text-align:center">${str('subtext')}</p>` : ''}
  <div id="lhp-shop-list-${bid}" style="max-width:960px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px">
    <p style="grid-column:1/-1;text-align:center;color:#94a3b8">読み込み中...</p>
  </div>
</section>
<script>
(function(){
  var sid=window.__LHPSID; if(!sid)return;
  var root=document.getElementById('lhp-shop-list-${bid}'); if(!root)return;
  var KEY='laru_cart_'+sid, QB='width:36px;height:36px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font-size:18px;font-weight:700;cursor:pointer;color:#0f172a';
  var products=[], chosen={}, cart={};
  try{cart=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
  var EMO={'サービス':'⚙️','コース・講座':'📚','チケット':'🎟️','デジタルコンテンツ':'💾','その他':'📦'};
  function save(){try{localStorage.setItem(KEY,JSON.stringify(cart))}catch(e){}}
  function keyOf(p,v){return v?p+'::'+v:p;}
  function findP(id){for(var i=0;i<products.length;i++)if(products[i].id===id)return products[i];return null;}
  function variant(p,vid){if(!p.variants)return null;for(var i=0;i<p.variants.length;i++)if(p.variants[i].id===vid)return p.variants[i];return null;}
  function price(p,v){return p.price+((v&&v.priceDelta)||0);}
  function stock(p,v){var s=v?v.stock:p.stock;return (s===null||s===undefined)?Infinity:s;}
  function yen(n){return '¥'+n.toLocaleString();}
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  fetch('/api/hp/shop/products?siteId='+encodeURIComponent(sid)).then(function(r){return r.json()}).then(function(d){
    products=d.products||[];
    products.forEach(function(p){if(p.variants&&p.variants.length)chosen[p.id]=p.variants[0].id;});
    render();
  }).catch(function(){root.innerHTML='<p style="grid-column:1/-1;text-align:center;color:#94a3b8">商品を読み込めませんでした</p>';});
  function render(){
    if(!products.length){root.innerHTML='<p style="grid-column:1/-1;text-align:center;color:#94a3b8">現在販売中の商品はありません</p>';renderBar();return;}
    root.innerHTML=products.map(function(p){
      var hv=p.variants&&p.variants.length, vid=hv?chosen[p.id]:null, v=variant(p,vid);
      var pr=price(p,v), st=stock(p,v), inc=cart[keyOf(p.id,vid)]||0, sold=st<=0;
      var vhtml=hv?'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">'+p.variants.map(function(o){var os=(o.stock!==null&&o.stock!==undefined&&o.stock<=0),sel=vid===o.id;return '<button data-v="'+p.id+'|'+o.id+'" '+(os?'disabled':'')+' style="font-size:12px;font-weight:700;padding:5px 10px;border-radius:8px;cursor:'+(os?'not-allowed':'pointer')+';border:'+(sel?'2px solid #0369a1':'1px solid #cbd5e1')+';background:'+(os?'#f1f5f9':sel?'#eff6ff':'#fff')+';color:'+(os?'#cbd5e1':sel?'#0369a1':'#334155')+'">'+esc(o.name)+(o.priceDelta?'（'+(o.priceDelta>0?'+':'')+yen(o.priceDelta)+'）':'')+'</button>';}).join('')+'</div>':'';
      var img=(p.images&&p.images[0])?'<img src="'+esc(p.images[0])+'" alt="" style="width:100%;height:100%;object-fit:cover"/>':(EMO[p.category]||'📦');
      var ctrl=sold?'<button disabled style="width:100%;background:#e2e8f0;color:#94a3b8;border:none;border-radius:12px;padding:12px;font-weight:700">売り切れ</button>':inc>0?'<div style="display:flex;align-items:center;justify-content:center;gap:14px"><button data-m="'+p.id+'" style="'+QB+'">−</button><span style="font-weight:800;font-size:18px;min-width:22px;text-align:center">'+inc+'</span><button data-p="'+p.id+'" style="'+QB+'">＋</button></div>':'<button data-add="'+p.id+'" style="width:100%;background:#0369a1;color:#fff;border:none;border-radius:12px;padding:12px;font-weight:700;cursor:pointer">カートに追加</button>';
      return '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;display:flex;flex-direction:column"><div style="height:150px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);display:flex;align-items:center;justify-content:center;font-size:44px;overflow:hidden">'+img+'</div><div style="padding:16px;flex:1;display:flex;flex-direction:column"><span style="font-size:11px;background:#f0f9ff;color:#0369a1;padding:2px 8px;border-radius:100px;font-weight:700;border:1px solid #bae6fd;align-self:flex-start;margin-bottom:8px">'+esc(p.category)+'</span><h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 6px">'+esc(p.name)+'</h3>'+(p.description?'<p style="font-size:12px;color:#475569;margin:0 0 12px;flex:1">'+esc(p.description)+'</p>':'<div style="flex:1"></div>')+vhtml+'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-size:20px;font-weight:800;color:#0369a1">'+yen(pr)+'</span>'+(st!==Infinity?'<span style="font-size:12px;color:'+(st<=5?'#dc2626':'#64748b')+';font-weight:600">残り'+st+'件</span>':'')+'</div>'+ctrl+'</div></div>';
    }).join('');
    root.querySelectorAll('[data-v]').forEach(function(b){b.onclick=function(){var a=b.getAttribute('data-v').split('|');chosen[a[0]]=a[1];render();};});
    root.querySelectorAll('[data-add]').forEach(function(b){b.onclick=function(){addP(b.getAttribute('data-add'),1);};});
    root.querySelectorAll('[data-p]').forEach(function(b){b.onclick=function(){addP(b.getAttribute('data-p'),1);};});
    root.querySelectorAll('[data-m]').forEach(function(b){b.onclick=function(){addP(b.getAttribute('data-m'),-1);};});
    renderBar();
  }
  function addP(id,delta){var p=findP(id);if(!p)return;var vid=(p.variants&&p.variants.length)?chosen[id]:null;var v=variant(p,vid);var k=keyOf(id,vid);var n=(cart[k]||0)+delta;var mx=stock(p,v);if(n>mx)n=mx;if(n<=0)delete cart[k];else cart[k]=n;save();render();}
  function items(){var a=[];Object.keys(cart).forEach(function(k){var pp=k.split('::'),p=findP(pp[0]);if(!p)return;var v=variant(p,pp[1]);a.push({k:k,p:p,v:v,q:cart[k],unit:price(p,v)});});return a;}
  function renderBar(){
    var it=items(),bar=document.getElementById('lhp-shopbar-${bid}');
    var tq=it.reduce(function(s,x){return s+x.q},0),tp=it.reduce(function(s,x){return s+x.unit*x.q},0);
    if(!bar){bar=document.createElement('div');bar.id='lhp-shopbar-${bid}';bar.style.cssText='position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #e2e8f0;box-shadow:0 -2px 12px rgba(0,0,0,.08);padding:12px 24px;z-index:60;display:none';document.body.appendChild(bar);}
    if(tq<=0){bar.style.display='none';return;}
    bar.style.display='block';
    bar.innerHTML='<div style="max-width:960px;margin:0 auto;display:flex;align-items:center;gap:16px;flex-wrap:wrap"><span style="font-weight:700;color:#0f172a">🛒 カート '+tq+'点</span><span style="font-size:20px;font-weight:800;color:#0369a1;margin-left:auto">'+yen(tp)+'</span><button id="lhp-co-${bid}" style="background:#0f172a;color:#fff;border:none;border-radius:12px;padding:12px 28px;font-weight:700;cursor:pointer">レジに進む</button></div>';
    document.getElementById('lhp-co-${bid}').onclick=function(){var btn=this;btn.disabled=true;btn.textContent='処理中...';fetch('/api/shop/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({siteId:sid,items:it.map(function(x){return{productId:x.p.id,variantId:x.v?x.v.id:undefined,quantity:x.q}}),successUrl:location.href.split('?')[0]+'?payment=success',cancelUrl:location.href.split('?')[0]})}).then(function(r){return r.json()}).then(function(d){if(d.url){try{localStorage.removeItem(KEY)}catch(e){}location.href=d.url;}else{btn.disabled=false;btn.textContent='レジに進む';alert(d.error||'決済を開始できませんでした');}}).catch(function(){btn.disabled=false;btn.textContent='レジに進む';alert('通信エラー');});};
  }
})();
</script>`;
    }

    case 'shop-item': {
      const bid = block.id;
      const pid = raw('productId');
      if (!pid) return `<section class="lhp-section"><p style="text-align:center;color:#94a3b8">（商品が選択されていません）</p></section>`;
      return `
<section data-lhp-anim class="lhp-section" id="lhp-item-${bid}" style="background:${raw('bgColor') || '#fff'}">
  <div id="lhp-item-box-${bid}" style="max-width:480px;margin:0 auto"><p style="text-align:center;color:#94a3b8">読み込み中...</p></div>
</section>
<script>
(function(){
  var sid=window.__LHPSID; if(!sid)return;
  var box=document.getElementById('lhp-item-box-${bid}'); if(!box)return;
  var PID=${JSON.stringify(pid)}, BUY=${JSON.stringify(raw('buyText') || '購入する')}, QB='width:40px;height:40px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font-size:20px;font-weight:700;cursor:pointer;color:#0f172a';
  var p=null,vid=null,qty=1;
  var EMO={'サービス':'⚙️','コース・講座':'📚','チケット':'🎟️','デジタルコンテンツ':'💾','その他':'📦'};
  function yen(n){return '¥'+n.toLocaleString();}
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function variant(){if(!p.variants)return null;for(var i=0;i<p.variants.length;i++)if(p.variants[i].id===vid)return p.variants[i];return null;}
  function price(){var v=variant();return p.price+((v&&v.priceDelta)||0);}
  function stock(){var v=variant();var s=v?v.stock:p.stock;return (s===null||s===undefined)?Infinity:s;}
  fetch('/api/hp/shop/products?siteId='+encodeURIComponent(sid)).then(function(r){return r.json()}).then(function(d){
    var list=d.products||[];for(var i=0;i<list.length;i++)if(list[i].id===PID)p=list[i];
    if(!p){box.innerHTML='<p style="text-align:center;color:#94a3b8">商品が見つかりません</p>';return;}
    if(p.variants&&p.variants.length)vid=p.variants[0].id;
    render();
  }).catch(function(){box.innerHTML='<p style="text-align:center;color:#94a3b8">読み込めませんでした</p>';});
  function render(){
    var v=variant(),pr=price(),st=stock(),sold=st<=0,hv=p.variants&&p.variants.length;
    var vhtml=hv?'<div style="display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px">'+p.variants.map(function(o){var os=(o.stock!==null&&o.stock!==undefined&&o.stock<=0),sel=vid===o.id;return '<button data-v="'+o.id+'" '+(os?'disabled':'')+' style="font-size:13px;font-weight:700;padding:6px 12px;border-radius:8px;cursor:'+(os?'not-allowed':'pointer')+';border:'+(sel?'2px solid #0369a1':'1px solid #cbd5e1')+';background:'+(os?'#f1f5f9':sel?'#eff6ff':'#fff')+';color:'+(os?'#cbd5e1':sel?'#0369a1':'#334155')+'">'+esc(o.name)+(o.priceDelta?'（'+(o.priceDelta>0?'+':'')+yen(o.priceDelta)+'）':'')+'</button>';}).join('')+'</div>':'';
    var img=(p.images&&p.images[0])?'<img src="'+esc(p.images[0])+'" alt="" style="width:100%;height:100%;object-fit:cover"/>':(EMO[p.category]||'📦');
    box.innerHTML='<div style="border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;background:#fff"><div style="height:200px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);display:flex;align-items:center;justify-content:center;font-size:56px;overflow:hidden">'+img+'</div><div style="padding:24px"><h3 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">'+esc(p.name)+'</h3>'+(p.description?'<p style="font-size:14px;color:#475569;margin:0 0 16px;line-height:1.6">'+esc(p.description)+'</p>':'')+vhtml+'<div style="font-size:28px;font-weight:800;color:#0369a1;margin-bottom:8px">'+yen(pr)+'</div>'+(st!==Infinity?'<p style="font-size:13px;color:'+(st<=5?'#dc2626':'#64748b')+';margin:0 0 16px">残り'+st+'件</p>':'<div style="height:8px"></div>')+(sold?'<button disabled style="width:100%;background:#e2e8f0;color:#94a3b8;border:none;border-radius:12px;padding:14px;font-weight:700">売り切れ</button>':'<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px"><button id="qm-${bid}" style="'+QB+'">−</button><span style="font-weight:800;font-size:18px;min-width:24px;text-align:center">'+qty+'</span><button id="qp-${bid}" style="'+QB+'">＋</button></div><button id="buy-${bid}" style="width:100%;background:#0369a1;color:#fff;border:none;border-radius:12px;padding:14px;font-weight:700;cursor:pointer">'+esc(BUY)+'</button>')+'</div></div>';
    box.querySelectorAll('[data-v]').forEach(function(b){b.onclick=function(){vid=b.getAttribute('data-v');qty=1;render();};});
    var qm=document.getElementById('qm-${bid}'),qp=document.getElementById('qp-${bid}'),buy=document.getElementById('buy-${bid}');
    if(qm)qm.onclick=function(){if(qty>1){qty--;render();}};
    if(qp)qp.onclick=function(){if(qty<stock()){qty++;render();}};
    if(buy)buy.onclick=function(){buy.disabled=true;buy.textContent='処理中...';fetch('/api/shop/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({siteId:sid,items:[{productId:p.id,variantId:vid||undefined,quantity:qty}],successUrl:location.href.split('?')[0]+'?payment=success',cancelUrl:location.href.split('?')[0]})}).then(function(r){return r.json()}).then(function(d){if(d.url){location.href=d.url;}else{buy.disabled=false;buy.textContent=BUY;alert(d.error||'決済を開始できませんでした');}}).catch(function(){buy.disabled=false;buy.textContent=BUY;alert('通信エラー');});};
  }
})();
</script>`;
    }

    case 'contact': {
      const extraFields = (d['extraFields'] as string[]) || [];
      const typeOptions = (d['typeOptions'] as string[])?.filter(Boolean) || [];
      const conditionalMap: Record<string, string[]> = (d['conditionalFields'] as Record<string, string[]>) || {};
      const typeSelectHtml = typeOptions.length > 0 ? `
    <select name="inquiry_type" id="lhp-inquiry-type" onchange="lhpTypeChange(this.value)">
      <option value="">お問い合わせ種別を選択</option>
      ${typeOptions.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}
    </select>` : '';
      const conditionalHtml = typeOptions.length > 0 ? Object.entries(conditionalMap).map(([val, fields]) =>
        `<div id="lhp-cond-${escapeHtml(val)}" style="display:none">${fields.map(f => {
          if (f === 'date') return `<input type="datetime-local" name="cond_date" placeholder="希望日時" />`;
          if (f === 'budget') return `<select name="cond_budget"><option value="">ご予算</option><option>〜5万円</option><option>5〜10万円</option><option>10〜30万円</option><option>30万円以上</option></select>`;
          if (f === 'company') return `<input type="text" name="cond_company" placeholder="会社名・屋号" />`;
          return `<input type="text" name="cond_${escapeHtml(f)}" placeholder="${escapeHtml(f)}" />`;
        }).join('')}</div>`
      ).join('') : '';
      const conditionalScript = typeOptions.length > 0 ? `window.lhpTypeChange=function(v){${typeOptions.map(o => `document.getElementById('lhp-cond-${escapeHtml(o)}')&&(document.getElementById('lhp-cond-${escapeHtml(o)}').style.display=v===${JSON.stringify(o)}?'block':'none');`).join('')}};` : '';
      const extraFieldsHtml = extraFields.map(f => {
        if (f === 'company') return `<input type="text" name="company" placeholder="会社名" />`;
        if (f === 'date') return `<input type="datetime-local" name="date" />`;
        if (f === 'budget') return `<select name="budget"><option value="">ご予算を選択</option><option>〜5万円</option><option>5〜10万円</option><option>10〜30万円</option><option>30万円以上</option></select>`;
        if (f === 'prefer_contact') return `<select name="prefer_contact"><option value="">ご連絡方法</option><option value="email">メール</option><option value="phone">電話</option></select>`;
        return '';
      }).join('\n    ');
      const btnColor = raw('buttonColor') || '#1e3a8a';
      const btnText = str('buttonText') || '送信する';

      if (d['multiStep']) {
        return `
<section data-lhp-anim class="lhp-contact" id="contact" style="background-color:${raw('bgColor')}">
  <h2 class="lhp-section-title" style="text-align:center">${str('heading')}</h2>
  <p class="lhp-section-sub" style="text-align:center">${str('subtext')}</p>
  <div class="lhp-mform" id="lhp-mform">
    <div class="lhp-mform-steps" role="progressbar" aria-label="フォームステップ">
      <div class="lhp-mform-dot active" id="lhp-mdot-1" aria-label="ステップ1">1</div>
      <div class="lhp-mform-line" id="lhp-mline-1"></div>
      <div class="lhp-mform-dot" id="lhp-mdot-2" aria-label="ステップ2">2</div>
      <div class="lhp-mform-line" id="lhp-mline-2"></div>
      <div class="lhp-mform-dot" id="lhp-mdot-3" aria-label="確認">確認</div>
    </div>
    <div id="lhp-mstep-1" class="lhp-mstep">
      <p class="lhp-mstep-label">STEP 1 — お客様情報</p>
      <div class="lhp-form">
        <div class="lhp-form-row">
          <input type="text" id="lhp-mf-name" placeholder="お名前 *" aria-label="お名前" required />
          <input type="email" id="lhp-mf-email" placeholder="メールアドレス *" aria-label="メールアドレス" required />
        </div>
        <button type="button" onclick="lhpMNext(1)" style="background:${btnColor}" class="lhp-mform-btn">次へ →</button>
      </div>
    </div>
    <div id="lhp-mstep-2" class="lhp-mstep" style="display:none">
      <p class="lhp-mstep-label">STEP 2 — お問い合わせ内容</p>
      <div class="lhp-form">
        <input type="tel" id="lhp-mf-phone" placeholder="電話番号" aria-label="電話番号" />
        ${extraFieldsHtml.replace(/name="/g, 'id="lhp-mf-').replace(/name="/g, 'id="lhp-mf-')}
        <textarea id="lhp-mf-message" placeholder="メッセージ *" aria-label="メッセージ" rows="4" required></textarea>
        <div class="lhp-form-row">
          <button type="button" onclick="lhpMBack(2)" class="lhp-mform-btn lhp-mform-btn-back">← 戻る</button>
          <button type="button" onclick="lhpMNext(2)" style="background:${btnColor}" class="lhp-mform-btn">確認画面へ →</button>
        </div>
      </div>
    </div>
    <div id="lhp-mstep-3" class="lhp-mstep" style="display:none">
      <p class="lhp-mstep-label">STEP 3 — 送信確認</p>
      <div class="lhp-mform-confirm" id="lhp-mconfirm"></div>
      <div class="lhp-form">
        <div class="lhp-form-row">
          <button type="button" onclick="lhpMBack(3)" class="lhp-mform-btn lhp-mform-btn-back">← 戻る</button>
          <button type="button" onclick="lhpMSubmit()" id="lhp-mbtn-submit" style="background:${btnColor}" class="lhp-mform-btn">${btnText}</button>
        </div>
        <p class="lhp-form-note" id="lhp-mnote"></p>
      </div>
    </div>
  </div>
</section>
<script>
(function(){
  function v(id){return (document.getElementById(id)||{}).value||'';}
  function show(step){[1,2,3].forEach(function(s){var el=document.getElementById('lhp-mstep-'+s);if(el)el.style.display=s===step?'block':'none';document.getElementById('lhp-mdot-'+s)?.classList.toggle('active',s<=step);document.getElementById('lhp-mline-'+s)?.classList.toggle('active',s<step);});}
  window.lhpMNext=function(step){
    if(step===1){if(!v('lhp-mf-name')||!v('lhp-mf-email')){alert('お名前とメールアドレスを入力してください');return;}show(2);}
    if(step===2){if(!v('lhp-mf-message')){alert('メッセージを入力してください');return;}
      var html='<table class="lhp-mconfirm-table"><tbody>';
      [['お名前',v('lhp-mf-name')],['メール',v('lhp-mf-email')],['電話',v('lhp-mf-phone')],['メッセージ',v('lhp-mf-message')]].forEach(function(r){if(r[1])html+='<tr><th>'+r[0]+'</th><td>'+r[1]+'</td></tr>';});
      html+='</tbody></table>';
      document.getElementById('lhp-mconfirm').innerHTML=html;
      show(3);}
  };
  window.lhpMBack=function(step){show(step-1);};
  window.lhpMSubmit=async function(){
    var btn=document.getElementById('lhp-mbtn-submit');
    var note=document.getElementById('lhp-mnote');
    btn.textContent='送信中...';btn.disabled=true;
    try{
      var r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({siteId:window.__LHPSID||'',name:v('lhp-mf-name'),email:v('lhp-mf-email'),phone:v('lhp-mf-phone'),message:v('lhp-mf-message')})});
      var res=await r.json();
      if(res.ok){document.getElementById('lhp-mform').innerHTML='<div class="lhp-form-success">${escapeHtml(raw('thankYouMessage') || '✅ 送信完了！2営業日以内にご連絡いたします。')}</div>';${raw('redirectUrl') ? `setTimeout(function(){window.location.href='${escapeHtml(raw('redirectUrl') || '')}';},1500);` : ''}}
      else{btn.textContent='${btnText}';btn.disabled=false;note.textContent='送信に失敗しました。';}
    }catch(e){btn.textContent='${btnText}';btn.disabled=false;note.textContent='送信に失敗しました。';}
  };
})();
</script>`;
      }

      return `
<section data-lhp-anim class="lhp-contact" id="contact" style="background-color:${raw('bgColor')}">
  <h2 class="lhp-section-title" style="text-align:center">${str('heading')}</h2>
  <p class="lhp-section-sub" style="text-align:center">${str('subtext')}</p>
  <form class="lhp-form" id="lhp-form-contact" novalidate>
    <div class="lhp-form-row">
      <input type="text" name="name" placeholder="お名前" aria-label="お名前" required />
      <input type="email" name="email" placeholder="メールアドレス" aria-label="メールアドレス" required />
    </div>
    <input type="tel" name="phone" placeholder="電話番号" aria-label="電話番号" />
    ${typeSelectHtml}
    ${conditionalHtml}
    ${extraFieldsHtml}
    <textarea name="message" placeholder="お問い合わせ内容" aria-label="お問い合わせ内容" rows="5" required></textarea>
    <input type="text" name="_hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0" aria-hidden="true" />
    <button type="submit" id="lhp-btn-contact" style="background-color:${btnColor}">${btnText}</button>
    <p class="lhp-form-note" id="lhp-note-contact"></p>
  </form>
</section>
<script>
(function(){
  ${conditionalScript}
  var f=document.getElementById('lhp-form-contact');
  if(!f)return;
  f.addEventListener('submit',async function(e){
    e.preventDefault();
    if(f._hp&&f._hp.value)return;
    var btn=document.getElementById('lhp-btn-contact');
    var note=document.getElementById('lhp-note-contact');
    btn.textContent='送信中...';btn.disabled=true;
    try{
      var r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({siteId:window.__LHPSID||'',name:f.name.value,email:f.email.value,phone:f.phone?.value||'',message:f.message.value})});
      var d=await r.json();
      if(d.ok){
        f.innerHTML='<div class="lhp-form-success">${escapeHtml(raw('thankYouMessage') || '✅ 送信完了！2営業日以内にご連絡いたします。')}</div>';
        ${raw('redirectUrl') ? `setTimeout(function(){window.location.href='${escapeHtml(raw('redirectUrl') || '')}';},1500);` : ''}
      }
      else{btn.textContent='${btnText}';btn.disabled=false;note.textContent='送信に失敗しました。再度お試しください。';}
    }catch(err){btn.textContent='${btnText}';btn.disabled=false;note.textContent='送信に失敗しました。';}
  });
})();
</script>`;
    }

    case 'hours': {
      const schedule = (d['schedule'] as Array<{day:string;hours:string;closed:boolean}>) ?? [];
      return `
<section data-lhp-anim class="lhp-section">
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
      const blockId = `gal-${block.id.replace(/[^a-z0-9]/gi, '')}`;
      return `
<section data-lhp-anim class="lhp-section">
  <h2 class="lhp-section-title" style="text-align:center">${str('heading')}</h2>
  <div class="lhp-gallery lhp-gallery-${cols}" id="${blockId}">
    ${validImages.map((src, i) => `<img src="${src}" alt="ギャラリー画像 ${i + 1}" class="lhp-gallery-img lhp-lb-trigger" data-lhp-lb-src="${src}" data-lhp-lb-group="${blockId}" data-lhp-lb-idx="${i}" loading="lazy" style="cursor:zoom-in" />`).join('')}
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

    case 'video': {
      if (!d['url']) return '';
      const url = raw('url');
      const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
      const vmMatch = url.match(/vimeo\.com\/(\d+)/);
      const embedUrl = ytMatch
        ? `https://www.youtube.com/embed/${ytMatch[1]}`
        : vmMatch ? `https://player.vimeo.com/video/${vmMatch[1]}` : url;
      return `
<section data-lhp-anim class="lhp-section">
  ${d['heading'] ? `<h2 class="lhp-section-title">${str('heading')}</h2>` : ''}
  <div class="lhp-video-wrap" style="aspect-ratio:${raw('aspectRatio') || '16/9'}">
    <iframe src="${embedUrl}" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen loading="lazy" title="動画"></iframe>
  </div>
</section>`;
    }

    case 'map':
      if (!d['embedUrl']) return '';
      return `
<section data-lhp-anim class="lhp-section">
  ${d['heading'] ? `<h2 class="lhp-section-title">${str('heading')}</h2>` : ''}
  <iframe src="${raw('embedUrl')}" class="lhp-map" style="height:${raw('height') || 400}px" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>
</section>`;

    case 'countdown':
      return `
<section data-lhp-anim class="lhp-countdown" style="background-color:${raw('bgColor')};color:${raw('textColor')}">
  <h2>${str('heading')}</h2>
  <p>${str('subtext')}</p>
  <div class="lhp-countdown-timer" data-target="${raw('targetDate')}">
    <div class="lhp-cdt-box"><span class="lhp-cdt-n" id="cd-d">00</span><span class="lhp-cdt-l">日</span></div>
    <div class="lhp-cdt-box"><span class="lhp-cdt-n" id="cd-h">00</span><span class="lhp-cdt-l">時間</span></div>
    <div class="lhp-cdt-box"><span class="lhp-cdt-n" id="cd-m">00</span><span class="lhp-cdt-l">分</span></div>
    <div class="lhp-cdt-box"><span class="lhp-cdt-n" id="cd-s">00</span><span class="lhp-cdt-l">秒</span></div>
  </div>
</section>
<script>
(function(){
  var t=new Date("${raw('targetDate')}").getTime();
  function tick(){
    var d=t-Date.now();
    if(d<0)d=0;
    document.getElementById('cd-d').textContent=String(Math.floor(d/86400000)).padStart(2,'0');
    document.getElementById('cd-h').textContent=String(Math.floor(d%86400000/3600000)).padStart(2,'0');
    document.getElementById('cd-m').textContent=String(Math.floor(d%3600000/60000)).padStart(2,'0');
    document.getElementById('cd-s').textContent=String(Math.floor(d%60000/1000)).padStart(2,'0');
  }
  tick(); setInterval(tick,1000);
})();
</script>`;

    case 'price-table': {
      type PricePlan = { name:string; price:string; period:string; description:string; features:string[]; highlighted:boolean; buttonText:string; buttonLink:string };
      const plans = (d['plans'] as PricePlan[]) ?? [];
      return `
<section data-lhp-anim class="lhp-section">
  <h2 class="lhp-section-title" style="text-align:center">${str('heading')}</h2>
  ${d['subtext'] ? `<p class="lhp-section-sub" style="text-align:center">${str('subtext')}</p>` : ''}
  <div class="lhp-price-grid">
    ${plans.map(p => `
    <div class="lhp-price-card${p.highlighted ? ' lhp-price-featured' : ''}">
      ${p.highlighted ? '<div class="lhp-price-badge">おすすめ</div>' : ''}
      <div class="lhp-price-name">${escapeHtml(p.name)}</div>
      <div class="lhp-price-amount">${escapeHtml(p.price)}<span class="lhp-price-period">${escapeHtml(p.period)}</span></div>
      <div class="lhp-price-desc">${escapeHtml(p.description)}</div>
      <ul class="lhp-price-features">
        ${(p.features||[]).map(f => `<li>✓ ${escapeHtml(f)}</li>`).join('')}
      </ul>
      <a href="${escapeHtml(p.buttonLink)}" class="lhp-price-btn">${escapeHtml(p.buttonText)}</a>
    </div>`).join('')}
  </div>
</section>`;
    }

    case 'booking': {
      if ((raw('mode') || 'simple') === 'calendar') {
        return `
<section data-lhp-anim class="lhp-contact" id="booking" style="background-color:${raw('bgColor')}">
  <h2 class="lhp-section-title" style="text-align:center">${str('heading')}</h2>
  <p class="lhp-section-sub" style="text-align:center">${str('subtext')}</p>
  <div id="lhp-bk" style="max-width:560px;margin:0 auto">
    <div id="lhp-bk-loading" style="text-align:center;color:#94a3b8;padding:24px">空き状況を読み込み中...</div>
    <div id="lhp-bk-main" style="display:none">
      <div style="margin-bottom:16px">
        <label style="font-weight:700;font-size:.9rem;display:block;margin-bottom:8px">日付を選択</label>
        <div id="lhp-bk-dates" style="display:flex;gap:8px;flex-wrap:wrap"></div>
      </div>
      <div id="lhp-bk-times-wrap" style="margin-bottom:16px;display:none">
        <label style="font-weight:700;font-size:.9rem;display:block;margin-bottom:8px">時間を選択</label>
        <div id="lhp-bk-times" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px"></div>
      </div>
      <div id="lhp-bk-form" style="display:none">
        <div class="lhp-form-row">
          <input id="lhp-bk-name" type="text" placeholder="お名前" required />
          <input id="lhp-bk-phone" type="tel" placeholder="電話番号" />
        </div>
        <input id="lhp-bk-email" type="email" placeholder="メールアドレス" required style="width:100%;margin-bottom:8px" />
        <input id="lhp-bk-hp" type="text" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0" aria-hidden="true" />
        <p id="lhp-bk-prepay" style="font-size:.85rem;color:#7c3aed;margin:4px 0"></p>
        <button id="lhp-bk-submit" type="button" style="background-color:${raw('buttonColor')};width:100%">${str('buttonText')}</button>
        <p class="lhp-form-note" id="lhp-bk-note"></p>
      </div>
    </div>
    <div id="lhp-bk-empty" style="display:none;text-align:center;color:#94a3b8;padding:24px">現在予約可能な枠がありません</div>
    <div id="lhp-bk-success" style="display:none" class="lhp-form-success">✅ ご予約を受け付けました！確認メールをお送りします。</div>
  </div>
</section>
<script>
(function(){
  var sid=window.__LHPSID; if(!sid)return;
  var root=document.getElementById('lhp-bk'); if(!root)return;
  var state={slots:[],byDate:{},sel:null,prepay:false,prepayAmount:0};
  function pad(n){return (''+n).length<2?'0'+n:''+n;}
  function jst(iso){var d=new Date(iso);return new Date(d.getTime()+9*3600*1000);}
  function dateKey(iso){var d=jst(iso);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());}
  function dateLabel(key){var p=key.split('-');var d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2]));var days=['日','月','火','水','木','金','土'];return (+p[1])+'/'+(+p[2])+'('+days[d.getUTCDay()]+')';}
  function timeLabel(iso){var d=jst(iso);return pad(d.getUTCHours())+':'+pad(d.getUTCMinutes());}
  function show(id,v){var e=document.getElementById(id);if(e)e.style.display=v?'':'none';}
  fetch('/api/hp/booking/availability?siteId='+encodeURIComponent(sid)).then(function(r){return r.json();}).then(function(data){
    show('lhp-bk-loading',false);
    state.slots=data.slots||[];state.prepay=!!data.prepay;state.prepayAmount=data.prepayAmount||0;
    if(!state.slots.length){show('lhp-bk-empty',true);return;}
    show('lhp-bk-main',true);
    state.byDate={};state.slots.forEach(function(s){var k=dateKey(s.datetime);(state.byDate[k]=state.byDate[k]||[]).push(s);});
    var dc=document.getElementById('lhp-bk-dates');
    Object.keys(state.byDate).sort().forEach(function(k){
      var b=document.createElement('button');b.type='button';b.textContent=dateLabel(k);
      b.style.cssText='padding:8px 14px;border:1px solid #d1d5db;border-radius:10px;background:#fff;cursor:pointer;font-size:.9rem';
      b.onclick=function(){selDate(k,b);};dc.appendChild(b);
    });
    if(state.prepay&&state.prepayAmount>0){var p=document.getElementById('lhp-bk-prepay');p.textContent='※ ご予約時に予約金 ¥'+state.prepayAmount.toLocaleString()+' のお支払いが必要です';}
  }).catch(function(){show('lhp-bk-loading',false);show('lhp-bk-empty',true);});
  function selDate(k,btn){
    Array.prototype.forEach.call(document.querySelectorAll('#lhp-bk-dates button'),function(b){b.style.background='#fff';b.style.color='#111';b.style.borderColor='#d1d5db';});
    btn.style.background='#2563eb';btn.style.color='#fff';btn.style.borderColor='#2563eb';
    state.sel=null;show('lhp-bk-form',false);
    var tw=document.getElementById('lhp-bk-times');tw.innerHTML='';
    state.byDate[k].sort(function(a,b){return a.datetime.localeCompare(b.datetime);}).forEach(function(s){
      var b=document.createElement('button');b.type='button';b.textContent=timeLabel(s.datetime);
      b.style.cssText='padding:8px;border:1px solid #d1d5db;border-radius:10px;background:#fff;cursor:pointer;font-size:.9rem';
      b.onclick=function(){selTime(s,b);};tw.appendChild(b);
    });
    show('lhp-bk-times-wrap',true);
  }
  function selTime(s,btn){
    Array.prototype.forEach.call(document.querySelectorAll('#lhp-bk-times button'),function(b){b.style.background='#fff';b.style.color='#111';b.style.borderColor='#d1d5db';});
    btn.style.background='#2563eb';btn.style.color='#fff';btn.style.borderColor='#2563eb';
    state.sel=s;show('lhp-bk-form',true);
  }
  document.getElementById('lhp-bk-submit').addEventListener('click',function(){
    if(document.getElementById('lhp-bk-hp').value)return;
    if(!state.sel)return;
    var name=document.getElementById('lhp-bk-name').value.trim();
    var email=document.getElementById('lhp-bk-email').value.trim();
    var phone=document.getElementById('lhp-bk-phone').value.trim();
    var note=document.getElementById('lhp-bk-note');
    if(!name||!email){note.textContent='お名前とメールアドレスを入力してください';return;}
    var btn=this;btn.disabled=true;btn.textContent='送信中...';note.textContent='';
    fetch('/api/hp/booking/reserve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({siteId:sid,slotId:state.sel.id,name:name,email:email,phone:phone,service:state.sel.label})}).then(function(r){return r.json();}).then(function(d){
      if(d.url){location.href=d.url;return;}
      if(d.ok){show('lhp-bk-main',false);show('lhp-bk-success',true);return;}
      note.textContent=d.error||'予約に失敗しました';btn.disabled=false;btn.textContent='${str('buttonText')}';
    }).catch(function(){note.textContent='予約に失敗しました';btn.disabled=false;btn.textContent='${str('buttonText')}';});
  });
})();
</script>`;
      }
      return `
<section data-lhp-anim class="lhp-contact" id="booking" style="background-color:${raw('bgColor')}">
  <h2 class="lhp-section-title" style="text-align:center">${str('heading')}</h2>
  <p class="lhp-section-sub" style="text-align:center">${str('subtext')}</p>
  <form class="lhp-form" id="lhp-form-booking">
    <div style="margin-bottom:16px">
      <label style="font-weight:700;font-size:.9rem;display:block;margin-bottom:8px">サービスを選択</label>
      <select style="width:100%;padding:12px 16px;border:1px solid #d1d5db;border-radius:12px;font-size:1rem;font-family:inherit">
        ${((d['serviceTypes'] as string[]) || []).map(s => `<option>${escapeHtml(s)}</option>`).join('')}
      </select>
    </div>
    <div class="lhp-form-row">
      <div>
        <label style="font-weight:700;font-size:.9rem;display:block;margin-bottom:8px">ご希望の日程</label>
        <input type="date" />
      </div>
      <div>
        <label style="font-weight:700;font-size:.9rem;display:block;margin-bottom:8px">ご希望の時間</label>
        <select style="width:100%;padding:12px 16px;border:1px solid #d1d5db;border-radius:12px;font-size:1rem;font-family:inherit">
          ${((d['timeSlots'] as string[]) || []).map(t => `<option>${escapeHtml(t)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="lhp-form-row">
      <input type="text" placeholder="お名前" required />
      <input type="tel" placeholder="電話番号" />
    </div>
    <input type="email" placeholder="メールアドレス" />
    <input type="text" name="_hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0" aria-hidden="true" />
    <button type="submit" id="lhp-btn-booking" style="background-color:${raw('buttonColor')}">${str('buttonText')}</button>
    <p class="lhp-form-note" id="lhp-note-booking"></p>
  </form>
</section>
<script>
(function(){
  var f=document.getElementById('lhp-form-booking');
  if(!f)return;
  f.addEventListener('submit',async function(e){
    e.preventDefault();
    if(f._hp&&f._hp.value)return;
    var btn=document.getElementById('lhp-btn-booking');
    var note=document.getElementById('lhp-note-booking');
    btn.textContent='送信中...';btn.disabled=true;
    var sel=f.querySelector('select');
    var dt=f.querySelector('input[type=date]');
    var tsel=f.querySelectorAll('select')[1];
    try{
      var r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({siteId:window.__LHPSID||'',type:'booking',name:f.name.value,email:f.email.value,phone:f.phone.value,message:(sel?sel.value:'')+'\\n'+(dt?dt.value:'')+(tsel?' '+tsel.value:'')})});
      var d=await r.json();
      if(d.ok){f.innerHTML='<div class="lhp-form-success">✅ 予約リクエストを受け付けました！確認のご連絡をお送りします。</div>';}
      else{btn.textContent='${str('buttonText')}';btn.disabled=false;note.textContent='送信に失敗しました。';}
    }catch(err){btn.textContent='${str('buttonText')}';btn.disabled=false;note.textContent='送信に失敗しました。';}
  });
})();
</script>`;
    }

    case 'news': {
      const blockId = block.id;
      return `
<section data-lhp-anim class="lhp-section" id="lhp-news-${blockId}">
  <h2 class="lhp-section-title">${str('heading')}</h2>
  <div class="lhp-news" id="lhp-news-list-${blockId}"><div class="lhp-news-loading">読み込み中...</div></div>
</section>
<script>
(function(){
  var sid=window.__LHPSID;
  if(!sid)return;
  fetch('/api/sites/'+sid+'/posts').then(function(r){return r.json();}).then(function(data){
    var list=document.getElementById('lhp-news-list-${blockId}');
    if(!list)return;
    var posts=data.posts||[];
    if(!posts.length){list.innerHTML='<p style="color:#9ca3af;font-size:.9rem;text-align:center;padding:24px">投稿がありません</p>';return;}
    list.innerHTML=posts.map(function(p){
      var d=new Date(p.published_at);
      var ds=d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0')+'-'+d.getDate().toString().padStart(2,'0');
      return '<a class="lhp-news-item" href="/hp/post/'+p.id+'" style="text-decoration:none;color:inherit;cursor:pointer">'+(p.category?'<span class="lhp-news-tag">'+p.category+'</span>':'')+'<span class="lhp-news-date">'+ds+'</span><span class="lhp-news-title">'+p.title+'</span></a>';
    }).join('');
  }).catch(function(){});
})();
</script>`;
    }

    case 'popup': {
      const trigger = raw('trigger') || 'delay';
      const delay = raw('delay') || '3';
      const scrollPct = Number(raw('scrollPercent') || '50') / 100;
      const triggerJs = trigger === 'scroll'
        ? `window.addEventListener('scroll',function h(){if((window.scrollY+window.innerHeight)/(document.body.scrollHeight||1)>=${scrollPct}){show();window.removeEventListener('scroll',h);}});`
        : trigger === 'exit'
        ? `document.addEventListener('mouseleave',function h(e){if(e.clientY<0){show();document.removeEventListener('mouseleave',h);}});`
        : trigger === 'click'
        ? `document.addEventListener('click',function h(){show();document.removeEventListener('click',h);});`
        : `setTimeout(show,${Number(delay)*1000});`;
      return `
<div id="lhp-popup-overlay" style="display:none;position:fixed;inset:0;background:${raw('overlayColor')||'rgba(0,0,0,0.6)'};z-index:9990;align-items:center;justify-content:center;">
  <div style="background:${raw('bgColor')};color:${raw('textColor')};max-width:480px;width:90%;border-radius:20px;padding:40px 32px;position:relative;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <button onclick="document.getElementById('lhp-popup-overlay').style.display='none'" style="position:absolute;top:16px;right:16px;background:none;border:none;color:${raw('textColor')};font-size:1.25rem;cursor:pointer;opacity:.7">✕</button>
    <h2 style="font-size:1.4rem;font-weight:900;margin-bottom:12px">${str('heading')}</h2>
    <p style="opacity:.85;margin-bottom:28px;line-height:1.6">${str('text')}</p>
    <a href="${raw('buttonLink')}" style="display:inline-block;background:${raw('buttonColor')||'#fff'};color:${raw('buttonTextColor')||'#111'};padding:14px 40px;border-radius:9999px;font-weight:700;text-decoration:none;font-size:1rem">${str('buttonText')}</a>
  </div>
</div>
<script>
(function(){
  function show(){var o=document.getElementById('lhp-popup-overlay');if(o&&!sessionStorage.getItem('lhp-popup-shown')){o.style.display='flex';sessionStorage.setItem('lhp-popup-shown','1');}}
  ${triggerJs}
  document.getElementById('lhp-popup-overlay').addEventListener('click',function(e){if(e.target===this)this.style.display='none';});
})();
</script>`;
    }

    case 'newsletter':
      return `
<section data-lhp-anim class="lhp-section lhp-newsletter" style="background:${raw('bgColor')};text-align:center">
  <h2 class="lhp-section-title">${str('heading')}</h2>
  ${d['subtext'] ? `<p class="lhp-section-sub">${str('subtext')}</p>` : ''}
  <form class="lhp-nl-form" id="lhp-form-nl">
    <input type="email" name="email" placeholder="${str('placeholder') || 'メールアドレスを入力'}" required />
    <button type="submit" style="background:${raw('buttonColor')}">${str('buttonText')}</button>
    <p class="lhp-form-note" id="lhp-note-nl"></p>
  </form>
</section>
<script>
(function(){
  var f=document.getElementById('lhp-form-nl');if(!f)return;
  f.addEventListener('submit',async function(e){
    e.preventDefault();
    var btn=f.querySelector('button');var note=document.getElementById('lhp-note-nl');
    btn.textContent='送信中...';btn.disabled=true;
    try{
      var r=await fetch('/api/newsletter/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({siteId:window.__LHPSID||'',email:f.email.value})});
      var d=await r.json();
      if(d.ok){f.innerHTML='<div class="lhp-form-success">✅ 登録完了！メールをご確認ください。</div>';}
      else{btn.textContent='${str('buttonText')}';btn.disabled=false;note.textContent=d.error||'エラーが発生しました。';}
    }catch(err){btn.textContent='${str('buttonText')}';btn.disabled=false;note.textContent='送信に失敗しました。';}
  });
})();
</script>`;

    case 'share': {
      const pageUrl = 'window.location.href';
      const pageTitle = 'document.title';
      const buttons: string[] = [];
      if (d['showLine'] !== false) buttons.push(`<a href="#" onclick="window.open('https://social-plugins.line.me/lineit/share?url='+encodeURIComponent(${pageUrl}),'_blank');return false;" class="lhp-share-btn lhp-share-line">LINE</a>`);
      if (d['showTwitter'] !== false) buttons.push(`<a href="#" onclick="window.open('https://twitter.com/intent/tweet?url='+encodeURIComponent(${pageUrl})+'&text='+encodeURIComponent(${pageTitle}),'_blank');return false;" class="lhp-share-btn lhp-share-tw">X (Twitter)</a>`);
      if (d['showFacebook'] !== false) buttons.push(`<a href="#" onclick="window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(${pageUrl}),'_blank');return false;" class="lhp-share-btn lhp-share-fb">Facebook</a>`);
      return `
<section data-lhp-anim class="lhp-section" style="background:${raw('bgColor') || '#ffffff'}">
  ${d['heading'] ? `<h3 class="lhp-section-title" style="margin-bottom:1.5rem">${str('heading')}</h3>` : ''}
  <div class="lhp-share-row">${buttons.join('')}</div>
</section>`;
    }

    case 'stripe-buy':
      return d['priceId'] ? `
<section data-lhp-anim class="lhp-section" style="text-align:center">
  <div class="lhp-buy-card">
    ${d['label'] ? `<h3 class="lhp-buy-label">${str('label')}</h3>` : ''}
    ${d['description'] ? `<p class="lhp-buy-desc">${str('description')}</p>` : ''}
    <button id="lhp-buy-${str('priceId')}" class="lhp-btn-primary" style="background:${raw('buttonColor') || '#1e3a8a'}" onclick="lhpBuy(this,'${str('priceId')}')">${str('buttonText') || '今すぐ購入'}</button>
  </div>
</section>
<script>
async function lhpBuy(btn, priceId) {
  btn.disabled=true; btn.textContent='処理中...';
  try {
    var r=await fetch('/api/stripe/buy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({priceId:priceId,siteUrl:window.location.href})});
    var d=await r.json();
    if(d.url) window.location.href=d.url;
    else { btn.disabled=false; btn.textContent='${str('buttonText') || '今すぐ購入'}'; alert(d.error||'エラーが発生しました'); }
  } catch(e) { btn.disabled=false; btn.textContent='${str('buttonText') || '今すぐ購入'}'; alert('通信エラーが発生しました'); }
}
</script>` : '';

    case 'google-reviews': {
      type Review = { author_name: string; rating: number; text: string; relative_time_description: string };
      const reviews = ((d['reviews'] as Review[]) || []).slice(0, Number(d['maxReviews']) || 3);
      const rating = Number(d['rating'] || 0).toFixed(1);
      const totalRatings = d['totalRatings'] ? `（${d['totalRatings']}件）` : '';
      const stars = (r: number) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
      return `
<section data-lhp-anim class="lhp-section lhp-reviews">
  <h2 class="lhp-section-title">${str('heading')}</h2>
  ${d['rating'] ? `<div class="lhp-reviews-summary"><span class="lhp-reviews-score">${rating}</span><span class="lhp-reviews-stars">${stars(Number(d['rating']))}</span><span class="lhp-reviews-count">${totalRatings}</span></div>` : ''}
  <div class="lhp-reviews-grid">
    ${reviews.map(r => `
    <div class="lhp-review-card">
      <div class="lhp-review-stars">${stars(r.rating)}</div>
      <p class="lhp-review-text">${escapeHtml(r.text)}</p>
      <div class="lhp-review-author">${escapeHtml(r.author_name)} <span>${escapeHtml(r.relative_time_description)}</span></div>
    </div>`).join('')}
  </div>
</section>`;
    }

    case 'announcement-bar': {
      const closed = `document.getElementById('lhp-anbar-${block.id}').style.display='none';sessionStorage.setItem('lhp-anbar-${block.id}','1')`;
      const link = raw('link');
      const inner = link
        ? `<a href="${link}" style="color:inherit;text-decoration:underline;font-weight:700">${str('text')}</a>`
        : `<span>${str('text')}</span>`;
      return `<div id="lhp-anbar-${block.id}" style="background:${raw('bgColor')||'#1e40af'};color:${raw('textColor')||'#fff'};text-align:center;padding:10px 48px 10px 16px;font-size:.875rem;position:relative;z-index:100" data-lhp-anbar>
  ${inner}
  ${(raw('closeable')||'true') !== 'false' ? `<button onclick="${closed}" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:inherit;font-size:1.25rem;cursor:pointer;opacity:.7;line-height:1">✕</button>` : ''}
</div>
<script>(function(){if(sessionStorage.getItem('lhp-anbar-${block.id}'))document.getElementById('lhp-anbar-${block.id}').style.display='none';})();</script>`;
    }

    case 'instagram': {
      const username = str('username').replace('@', '');
      if (!username) return '';
      const photos = (d['photos'] as string[])?.filter(Boolean) ?? [];
      const cols = d['columns'] === '4' ? 4 : 3;
      return `
<section data-lhp-anim class="lhp-section" style="text-align:center">
  ${d['heading'] ? `<h2 class="lhp-section-title">${str('heading')}</h2>` : ''}
  ${photos.length > 0 ? `<div class="lhp-gallery lhp-gallery-${cols}" style="margin-bottom:24px">
    ${photos.map((src, i) => `<a href="https://instagram.com/${username}" target="_blank" rel="noopener noreferrer"><img src="${src}" alt="Instagram ${i + 1}" class="lhp-gallery-img lhp-lb-trigger" data-lhp-lb-src="${src}" data-lhp-lb-group="ig-${block.id}" data-lhp-lb-idx="${i}" loading="lazy" style="cursor:zoom-in" /></a>`).join('')}
  </div>` : ''}
  <a href="https://instagram.com/${username}" target="_blank" rel="noopener noreferrer" class="lhp-btn" style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;padding:12px 28px;border-radius:9999px;font-weight:700;text-decoration:none;font-size:.9rem">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
    @${username} をフォロー
  </a>
</section>`;
    }

    default:
      return '';
  }
}

function renderBlock(block: Block, ctx?: { heroLayout: string; accentColor: string }): string {
  const html = renderBlockInner(block, ctx);
  if (!html) return '';
  const d = block.data;

  const padMap: Record<string, string> = { none: '0', sm: '24px', md: '48px', lg: '72px', xl: '96px' };
  const pt = d['paddingTop'] as string;
  const pb = d['paddingBottom'] as string;
  const anim = (d['animation'] as string) || 'fade';
  const dur = (d['animationDuration'] as string) || '600';

  // Replace boolean data-lhp-anim with value + duration attributes (or remove if none)
  let inner: string;
  if (anim === 'none') {
    inner = html.replace(' data-lhp-anim', '');
  } else {
    inner = html.replace(' data-lhp-anim', ` data-lhp-anim="${anim}" data-lhp-dur="${dur}"`);
  }

  // Wrap in padding div only when non-default values are set
  const wrapStyles: string[] = [];
  if (pt && pt !== 'md') wrapStyles.push(`padding-top:${padMap[pt] || '48px'}`);
  if (pb && pb !== 'md') wrapStyles.push(`padding-bottom:${padMap[pb] || '48px'}`);
  if (wrapStyles.length) inner = `<div style="${wrapStyles.join(';')}">${inner}</div>`;

  const classes = [
    d['hideOnMobile'] ? 'lhp-hide-mobile' : '',
    d['hideOnDesktop'] ? 'lhp-hide-desktop' : '',
  ].filter(Boolean).join(' ');

  return classes ? `<div class="${classes}">${inner}</div>` : inner;
}

const DESIGN_STYLES: Record<string, string> = {
  // modern: 丸みのあるカード・ピル型ボタン・中央寄せ。万能スタンダード
  modern:   '--lhp-r:16px;--lhp-btn-r:9999px;--lhp-img-r:12px;--lhp-hero-h:420px;--lhp-hero-pd:80px 24px;--lhp-hero-ta:center;--lhp-h1-w:700;--lhp-h1-lh:1.2;--lhp-sec-pd:64px 24px;--lhp-ttl-w:700;--lhp-ttl-ls:0em;--lhp-ttl-tt:none;--lhp-ttl-dec:none;--lhp-card-bd:1px solid #e5e7eb;--lhp-card-sh:0 4px 24px rgba(0,0,0,.08);--lhp-card-pd:24px;--lhp-card-bg:#fff;--lhp-testimonial-sh:0 2px 8px rgba(0,0,0,.06);--lhp-cta-pd:80px 24px',
  // minimal: フラット・左寄せ・テキスト重視。士業・コンサルに
  minimal:  '--lhp-r:6px;--lhp-btn-r:6px;--lhp-img-r:4px;--lhp-hero-h:360px;--lhp-hero-pd:56px 24px;--lhp-hero-ta:left;--lhp-h1-w:500;--lhp-h1-lh:1.3;--lhp-sec-pd:48px 24px;--lhp-ttl-w:500;--lhp-ttl-ls:0.02em;--lhp-ttl-tt:none;--lhp-ttl-dec:2px solid #111;--lhp-card-bd:1px solid #e5e7eb;--lhp-card-sh:none;--lhp-card-pd:20px;--lhp-card-bg:#f9fafb;--lhp-testimonial-sh:none;--lhp-cta-pd:56px 24px',
  // bold: 背丈のあるヒーロー・極太文字・力強い影。建設・製造・スポーツに
  bold:     '--lhp-r:8px;--lhp-btn-r:6px;--lhp-img-r:8px;--lhp-hero-h:600px;--lhp-hero-pd:96px 24px;--lhp-hero-ta:center;--lhp-h1-w:800;--lhp-h1-lh:1.0;--lhp-sec-pd:80px 24px;--lhp-ttl-w:800;--lhp-ttl-ls:-0.02em;--lhp-ttl-tt:none;--lhp-ttl-dec:4px solid currentColor;--lhp-card-bd:none;--lhp-card-sh:0 8px 40px rgba(0,0,0,.14);--lhp-card-pd:32px;--lhp-card-bg:#fff;--lhp-testimonial-sh:0 4px 16px rgba(0,0,0,.1);--lhp-cta-pd:96px 24px',
  // elegant: 細みフォント・広い余白・シャープな枠線。美容・ブライダル・高級サービスに
  elegant:  '--lhp-r:2px;--lhp-btn-r:2px;--lhp-img-r:0px;--lhp-hero-h:520px;--lhp-hero-pd:120px 24px;--lhp-hero-ta:center;--lhp-h1-w:300;--lhp-h1-lh:1.4;--lhp-sec-pd:96px 24px;--lhp-ttl-w:300;--lhp-ttl-ls:0.14em;--lhp-ttl-tt:none;--lhp-ttl-dec:1px solid #ccc;--lhp-card-bd:1px solid #e5e7eb;--lhp-card-sh:none;--lhp-card-pd:32px;--lhp-card-bg:#fff;--lhp-testimonial-sh:none;--lhp-cta-pd:96px 24px',
  // rounded: 大きな丸み・ポップな影・ふんわりカード。飲食・子ども・福祉に
  rounded:  '--lhp-r:28px;--lhp-btn-r:9999px;--lhp-img-r:24px;--lhp-hero-h:460px;--lhp-hero-pd:88px 24px;--lhp-hero-ta:center;--lhp-h1-w:700;--lhp-h1-lh:1.2;--lhp-sec-pd:72px 24px;--lhp-ttl-w:700;--lhp-ttl-ls:0em;--lhp-ttl-tt:none;--lhp-ttl-dec:none;--lhp-card-bd:none;--lhp-card-sh:0 12px 48px rgba(0,0,0,.1);--lhp-card-pd:32px;--lhp-card-bg:#fff;--lhp-testimonial-sh:0 6px 24px rgba(0,0,0,.08);--lhp-cta-pd:80px 24px',
  // sharp: 完全な角型・左寄せ・大文字。IT・不動産・エディトリアルに
  sharp:    '--lhp-r:0px;--lhp-btn-r:0px;--lhp-img-r:0px;--lhp-hero-h:540px;--lhp-hero-pd:88px 24px;--lhp-hero-ta:left;--lhp-h1-w:800;--lhp-h1-lh:1.05;--lhp-sec-pd:72px 24px;--lhp-ttl-w:700;--lhp-ttl-ls:0.06em;--lhp-ttl-tt:uppercase;--lhp-ttl-dec:4px solid #111;--lhp-card-bd:2px solid #111;--lhp-card-sh:none;--lhp-card-pd:24px;--lhp-card-bg:#fff;--lhp-testimonial-sh:none;--lhp-cta-pd:80px 24px',
};

/* ─── Per-style visual extras ───────────────────────────────────────────── */
const STYLE_EXTRAS: Record<string, string> = {
  modern: `
/* modern: smooth hover lift + pulse CTA */
.lhp-card{transition:transform .35s cubic-bezier(.34,1.56,.64,1),box-shadow .35s ease}
.lhp-card:hover{transform:translateY(-10px);box-shadow:0 32px 72px rgba(0,0,0,.14)!important}
@keyframes lhpPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,.5)}70%{box-shadow:0 0 0 14px rgba(255,255,255,0)}}
.lhp-btn-primary{animation:lhpPulse 2.8s ease-in-out infinite}
/* subtle gradient overlay on hero */
.lhp-hero{position:relative;overflow:hidden}
.lhp-hero::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(0,0,0,.25) 0%,transparent 55%);pointer-events:none;z-index:0}
.lhp-hero-inner,.lhp-hero>*:not(.lhp-hero::before){position:relative;z-index:1}
/* stagger sections */
[data-lhp-anim]:nth-child(2){transition-delay:.08s}
[data-lhp-anim]:nth-child(3){transition-delay:.16s}
[data-lhp-anim]:nth-child(4){transition-delay:.24s}
[data-lhp-anim]:nth-child(5){transition-delay:.32s}`,

  minimal: `
/* minimal: underline expand on title, left-accent card hover */
.lhp-section-title{display:inline-block;position:relative}
.lhp-section-title::after{content:'';position:absolute;bottom:-6px;left:0;width:0;height:2px;background:currentColor;transition:width .5s cubic-bezier(.4,0,.2,1)}
.lhp-visible .lhp-section-title::after{width:56px}
.lhp-card{position:relative;overflow:hidden;transition:transform .2s ease,border-color .2s}
.lhp-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#111;transform:scaleY(0);transform-origin:top;transition:transform .3s cubic-bezier(.4,0,.2,1)}
.lhp-card:hover{transform:translateX(5px)}
.lhp-card:hover::before{transform:scaleY(1)}`,

  bold: `
/* bold: diagonal hero, animated gradient, 3D cards, glow CTA */
.lhp-hero{clip-path:polygon(0 0,100% 0,100% 87%,0 100%);padding-bottom:130px!important;margin-bottom:-65px;position:relative;z-index:2;overflow:hidden}
.lhp-hero::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,.1) 40%,rgba(255,255,255,.08) 100%);pointer-events:none;z-index:0;animation:lhpHeroShimmer 6s ease-in-out infinite}
.lhp-hero-inner{position:relative;z-index:1}
@keyframes lhpHeroShimmer{0%,100%{opacity:1}50%{opacity:.75}}
.lhp-card{transition:transform .3s cubic-bezier(.25,.8,.25,1),box-shadow .3s ease;transform-style:preserve-3d;will-change:transform}
.lhp-card:hover{transform:translateY(-18px) perspective(700px) rotateX(5deg) rotateY(-3deg);box-shadow:0 40px 80px rgba(0,0,0,.28)!important}
@keyframes lhpGlow{0%,100%{box-shadow:0 0 12px rgba(255,255,255,.2),0 6px 24px rgba(0,0,0,.2)}50%{box-shadow:0 0 36px rgba(255,255,255,.55),0 6px 24px rgba(0,0,0,.2)}}
.lhp-btn-primary{animation:lhpGlow 2.2s ease-in-out infinite;font-size:1.05rem;padding:16px 48px}
.lhp-cta{clip-path:polygon(0 7%,100% 0,100% 93%,0 100%);padding:100px 24px!important;margin:-35px 0!important;position:relative;z-index:1}`,

  elegant: `
/* elegant: glassmorphism cards, slow refined animations, hero vertical line */
.lhp-hero{position:relative;overflow:hidden}
.lhp-hero::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.3) 0%,rgba(0,0,0,.05) 100%);pointer-events:none;z-index:0}
.lhp-hero-inner{position:relative;z-index:1}
.lhp-hero-inner::before{content:'';display:block;width:1px;height:48px;background:rgba(255,255,255,.45);margin:0 auto 28px;opacity:0;transform:scaleY(0);transform-origin:top;transition:opacity .8s,transform .8s}
.lhp-hero .lhp-visible .lhp-hero-inner::before,.lhp-hero .lhp-hero-inner::before{opacity:1;transform:scaleY(1)}
.lhp-card{background:rgba(255,255,255,.65)!important;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.45)!important;transition:transform .5s cubic-bezier(.16,1,.3,1),box-shadow .5s,background .4s}
.lhp-card:hover{transform:translateY(-6px);background:rgba(255,255,255,.9)!important;box-shadow:0 20px 56px rgba(0,0,0,.09)!important}
[data-lhp-anim]{transition-duration:1s!important;transition-timing-function:cubic-bezier(.16,1,.3,1)!important}
.lhp-section-title{letter-spacing:.14em;transition:letter-spacing .6s cubic-bezier(.16,1,.3,1)}
/* testimonial glassmorphism */
.lhp-testimonial{background:rgba(255,255,255,.5)!important;backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.3)!important}`,

  rounded: `
/* rounded: bouncy cards, wave hero, CSS blobs, bouncing button */
.lhp-hero{padding-bottom:100px!important;margin-bottom:-50px;position:relative;z-index:2;overflow:hidden}
.lhp-hero::after{content:'';position:absolute;bottom:0;left:-2px;right:-2px;height:80px;background:#ffffff;clip-path:ellipse(52% 100% at 50% 100%)}
body::before{content:'';position:fixed;top:-25vh;left:-15vw;width:60vw;height:60vw;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,.07) 0%,transparent 65%);pointer-events:none;z-index:0;animation:lhpBlob 9s ease-in-out infinite;will-change:transform}
body::after{content:'';position:fixed;bottom:-15vh;right:-15vw;width:50vw;height:50vw;border-radius:50%;background:radial-gradient(circle,rgba(236,72,153,.05) 0%,transparent 65%);pointer-events:none;z-index:0;animation:lhpBlob 11s ease-in-out infinite reverse;will-change:transform}
@keyframes lhpBlob{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(24px,-18px) scale(1.06)}66%{transform:translate(-16px,12px) scale(.94)}}
.lhp-card{transition:transform .45s cubic-bezier(.34,1.56,.64,1),box-shadow .35s ease}
.lhp-card:hover{transform:translateY(-14px) scale(1.025);box-shadow:0 28px 64px rgba(0,0,0,.13)!important}
@keyframes lhpBounce{0%,100%{transform:translateY(0)}45%{transform:translateY(-5px)}55%{transform:translateY(-4px)}}
.lhp-btn-primary{animation:lhpBounce 2.4s ease-in-out infinite}
.lhp-section-title{background:linear-gradient(90deg,currentColor 0%,currentColor 100%);-webkit-background-clip:text;background-clip:text}`,

  sharp: `
/* sharp: hard diagonal cuts, offset-shadow 3D, scan line, glitch CTA */
.lhp-hero{clip-path:polygon(0 0,100% 0,100% 84%,0 100%);padding-bottom:110px!important;margin-bottom:-55px;position:relative;z-index:2;overflow:hidden}
.lhp-hero::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:rgba(255,255,255,.35);animation:lhpScan 2.8s linear infinite;pointer-events:none;z-index:3}
@keyframes lhpScan{0%{transform:translateY(0)}100%{transform:translateY(100vh)}}
.lhp-card{transition:transform .18s ease,box-shadow .18s ease;border:2px solid #111!important}
.lhp-card:hover{transform:translate(6px,-6px);box-shadow:8px 14px 0 #111!important}
.lhp-cta{clip-path:polygon(0 10%,100% 0,100% 90%,0 100%);padding:100px 24px!important;margin:-40px 0!important;position:relative;z-index:1}
@keyframes lhpGlitch{0%,88%,100%{transform:none;clip-path:none}90%{transform:translateX(3px);clip-path:polygon(0 20%,100% 20%,100% 40%,0 40%)}92%{transform:translateX(-3px);clip-path:polygon(0 60%,100% 60%,100% 80%,0 80%)}94%{transform:none;clip-path:none}}
.lhp-btn-primary{animation:lhpGlitch 4.5s ease-in-out infinite;font-family:monospace!important;letter-spacing:.12em!important;text-transform:uppercase!important;font-size:.9rem}
.lhp-section-title{position:relative}
.lhp-section-title::before{content:'//';margin-right:8px;opacity:.35;font-weight:400}`,
};

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans JP',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;line-height:1.6}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
.lhp-navbar{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-bottom:1px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.lhp-navbar-inner{max-width:1100px;margin:0 auto;padding:0 24px;height:56px;display:flex;align-items:center;gap:24px}
.lhp-navbar-brand{font-weight:700;font-size:.9375rem;background:none;border:none;cursor:pointer;padding:0;font-family:inherit;color:#111}
.lhp-nav-menu{list-style:none;display:flex;gap:4px;margin-left:auto}
.lhp-nav-link{background:none;border:none;cursor:pointer;font-family:inherit;font-size:.875rem;padding:6px 14px;border-radius:9999px;color:#555;transition:all .2s;font-weight:500}
.lhp-nav-link:hover{background:#f3f4f6;color:#111}
.lhp-nav-active{background:#111!important;color:#fff!important}
.lhp-nav-toggle{display:none;background:none;border:none;cursor:pointer;font-size:1.3rem;padding:4px 8px;margin-left:auto;color:#111}
@media(max-width:600px){
  .lhp-nav-toggle{display:block}
  .lhp-nav-menu{display:none;position:absolute;top:56px;left:0;right:0;background:#fff;flex-direction:column;padding:12px 16px;gap:4px;border-bottom:1px solid #e5e7eb;box-shadow:0 4px 12px rgba(0,0,0,.08)}
  .lhp-nav-menu.lhp-nav-open{display:flex}
  .lhp-nav-link{text-align:left;width:100%}
}
.lhp-nav{border-bottom:1px solid rgba(0,0,0,.08);position:relative;z-index:100}
.lhp-nav-sticky{position:sticky;top:0;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.lhp-nav-inner{max-width:1100px;margin:0 auto;padding:0 24px;height:60px;display:flex;align-items:center;gap:32px}
.lhp-nav-logo{font-weight:700;font-size:1rem;letter-spacing:-.01em;flex-shrink:0}
.lhp-nav-links{display:flex;align-items:center;gap:4px;margin-left:auto;flex-wrap:wrap}
.lhp-nav-links .lhp-nav-link{text-decoration:none;font-size:.875rem;padding:6px 12px;border-radius:6px;opacity:.75;transition:opacity .2s,background .2s;background:none;border:none;cursor:pointer;font-family:inherit;color:inherit;font-weight:500}
.lhp-nav-links .lhp-nav-link:hover{opacity:1;background:rgba(0,0,0,.05)}
.lhp-nav-cta{display:inline-flex;align-items:center;text-decoration:none;font-size:.8125rem;font-weight:700;padding:7px 18px;border-radius:var(--lhp-btn-r);background:#2563eb;color:#fff;margin-left:8px;transition:opacity .2s}
.lhp-nav-cta:hover{opacity:.88}
.lhp-nav-toggle{display:none;background:none;border:none;cursor:pointer;font-size:1.4rem;padding:4px 8px;margin-left:auto;color:inherit;line-height:1}
@media(max-width:640px){
  .lhp-nav-toggle{display:block}
  .lhp-nav-links{display:none;position:absolute;top:60px;left:0;right:0;flex-direction:column;align-items:stretch;padding:12px 16px;gap:4px;border-bottom:1px solid rgba(0,0,0,.08);background:inherit;box-shadow:0 4px 12px rgba(0,0,0,.08);z-index:99}
  .lhp-nav-links.lhp-nav-open{display:flex}
  .lhp-nav-links .lhp-nav-link{text-align:left;width:100%;border-radius:8px;opacity:1}
  .lhp-nav-cta{margin:4px 0;text-align:center}
}
.lhp-hero{min-height:var(--lhp-hero-h);display:flex;align-items:center;justify-content:var(--lhp-hero-jc,center);text-align:var(--lhp-hero-ta,center);padding:var(--lhp-hero-pd);position:relative;background-size:cover;background-position:center}
.lhp-hero-inner{position:relative;z-index:1;max-width:720px;margin:0 auto;text-align:var(--lhp-hero-ta,center);width:100%}
[style*="--lhp-hero-ta:left"] .lhp-hero-inner,[style*="--lhp-hero-ta: left"] .lhp-hero-inner{margin:0}
.lhp-hero h1{font-size:clamp(1.75rem,4vw,3.25rem);font-weight:var(--lhp-h1-w);margin-bottom:16px;line-height:var(--lhp-h1-lh)}
.lhp-hero-sub{font-size:1.05rem;opacity:.88;margin-bottom:32px;line-height:1.7}
.lhp-btn-primary{display:inline-block;background:#fff;color:#111;padding:13px 36px;border-radius:var(--lhp-btn-r);font-weight:600;font-size:.9375rem;transition:opacity .2s}
.lhp-btn-primary:hover{opacity:.85}
.lhp-section{padding:var(--lhp-sec-pd);max-width:1100px;margin:0 auto}
.lhp-section-title{font-size:clamp(1.25rem,2.5vw,2rem);font-weight:var(--lhp-ttl-w);letter-spacing:var(--lhp-ttl-ls);text-transform:var(--lhp-ttl-tt);margin-bottom:12px;padding-bottom:12px;border-bottom:var(--lhp-ttl-dec,none)}
.lhp-section-sub{color:#666;font-size:1rem;margin-bottom:40px}
.lhp-text-block p{max-width:720px;margin:0 auto;color:#444;line-height:1.8;font-size:1rem}
.lhp-img{width:100%;border-radius:var(--lhp-img-r);object-fit:cover}
.lhp-img-caption{text-align:center;color:#888;font-size:.85rem;margin-top:8px}
.lhp-two-col,.lhp-three-col{display:grid;gap:24px}
.lhp-two-col{grid-template-columns:repeat(2,1fr)}
.lhp-three-col{grid-template-columns:repeat(3,1fr)}
@media(max-width:768px){.lhp-two-col,.lhp-three-col{grid-template-columns:1fr}}
.lhp-col{background:#f9fafb;border-radius:var(--lhp-r);padding:24px}
.lhp-col h3{font-size:1.1rem;font-weight:700;margin-bottom:8px}
.lhp-col p{color:#555;font-size:.9rem;white-space:pre-line}
.lhp-col-card{text-align:center}
.lhp-col-icon{font-size:2.5rem;margin-bottom:12px}
.lhp-divider{padding:16px 24px;max-width:1100px;margin:0 auto}
.lhp-divider-label{display:flex;align-items:center;gap:16px;color:#888;font-size:.85rem}
.lhp-divider-label::before,.lhp-divider-label::after{content:'';flex:1;height:1px;background:#e5e7eb}
.lhp-cta{padding:var(--lhp-cta-pd);text-align:center}
.lhp-cta h2{font-size:clamp(1.25rem,2.5vw,2rem);font-weight:var(--lhp-ttl-w);letter-spacing:var(--lhp-ttl-ls);margin-bottom:12px}
.lhp-cta p{opacity:.9;margin-bottom:32px;font-size:1rem}
.lhp-btn-cta{display:inline-block;background:#fff;color:#111;padding:14px 48px;border-radius:var(--lhp-btn-r);font-weight:700;font-size:1rem}
.lhp-grid{display:grid;gap:20px;margin-top:40px}
.lhp-grid-2{grid-template-columns:repeat(2,1fr)}
.lhp-grid-3{grid-template-columns:repeat(3,1fr)}
@media(max-width:768px){.lhp-grid-2,.lhp-grid-3{grid-template-columns:1fr}}
.lhp-card{border:var(--lhp-card-bd);border-radius:var(--lhp-r);padding:var(--lhp-card-pd);text-align:center;transition:box-shadow .2s;background:var(--lhp-card-bg,#fff)}
.lhp-card:hover{box-shadow:var(--lhp-card-sh)}
.lhp-card-icon{font-size:2rem;margin-bottom:12px}
.lhp-card h3{font-size:1.1rem;font-weight:700;margin-bottom:8px}
.lhp-card p{color:#555;font-size:.875rem;margin-bottom:12px}
.lhp-price{background:#eff6ff;color:#1d4ed8;padding:4px 12px;border-radius:9999px;font-size:.875rem;font-weight:700}
.lhp-testimonials-bg{background:#f9fafb;padding:var(--lhp-sec-pd)}
.lhp-testimonials-bg .lhp-section-title{text-align:center}
.lhp-testimonial{background:#fff;border-radius:var(--lhp-r);padding:24px;box-shadow:var(--lhp-testimonial-sh)}
.lhp-stars{color:#f59e0b;font-size:1.1rem;margin-bottom:12px}
.lhp-testimonial p{color:#444;font-size:.9rem;line-height:1.7;margin-bottom:12px}
.lhp-testimonial-name{font-weight:700;font-size:.875rem;color:#111}
.lhp-testimonial-name span{color:#888;font-weight:400}
.lhp-faq{max-width:720px;margin:32px auto 0}
.lhp-faq-item{border:1px solid #e5e7eb;border-radius:var(--lhp-r);margin-bottom:8px;overflow:hidden}
.lhp-faq-q{padding:16px 20px;font-weight:700;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center}
.lhp-faq-q::after{content:'+';font-size:1.25rem;color:#888}
details[open] .lhp-faq-q::after{content:'−'}
.lhp-faq-a{padding:16px 20px;background:#f9fafb;color:#444;font-size:.9rem;border-top:1px solid #e5e7eb}
.lhp-contact{padding:var(--lhp-cta-pd)}
.lhp-form{max-width:560px;margin:40px auto 0}
.lhp-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
@media(max-width:600px){.lhp-form-row{grid-template-columns:1fr}}
.lhp-form input,.lhp-form select,.lhp-form textarea{width:100%;padding:12px 16px;border:1px solid #d1d5db;border-radius:var(--lhp-r);font-size:16px;font-family:inherit;margin-bottom:12px;outline:none;transition:border-color .2s;background:#fff;color:#111;appearance:auto}
.lhp-form input:focus,.lhp-form select:focus,.lhp-form textarea:focus{border-color:#3b82f6}
.lhp-form textarea{resize:vertical}
.lhp-form button{width:100%;padding:14px;border:none;border-radius:var(--lhp-btn-r);color:#fff;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .2s}
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
.lhp-gallery-img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--lhp-img-r)}
@media(max-width:600px){.lhp-gallery-2,.lhp-gallery-3{grid-template-columns:1fr 1fr}}
#lhp-lb{display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;align-items:center;justify-content:center}
#lhp-lb.lhp-lb-open{display:flex}
#lhp-lb-img{max-width:90vw;max-height:85vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.5)}
#lhp-lb-close{position:fixed;top:16px;right:20px;color:#fff;font-size:2rem;cursor:pointer;line-height:1;opacity:.8}
#lhp-lb-close:hover{opacity:1}
.lhp-lb-arrow{position:fixed;top:50%;transform:translateY(-50%);color:#fff;font-size:2.5rem;cursor:pointer;opacity:.7;padding:16px;user-select:none;line-height:1}
.lhp-lb-arrow:hover{opacity:1}
#lhp-lb-prev{left:4px}
#lhp-lb-next{right:4px}
#lhp-lb-counter{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.6);font-size:.75rem}
.lhp-video-wrap{width:100%;border-radius:var(--lhp-r);overflow:hidden}
.lhp-video-wrap iframe{width:100%;height:100%;border:none;display:block}
.lhp-map{width:100%;border:none;border-radius:var(--lhp-r);display:block}
.lhp-countdown{padding:80px 24px;text-align:center}
.lhp-countdown h2{font-size:clamp(1.5rem,3vw,2.5rem);font-weight:900;margin-bottom:8px}
.lhp-countdown p{opacity:.8;margin-bottom:40px}
.lhp-countdown-timer{display:flex;justify-content:center;gap:32px}
.lhp-cdt-box{text-align:center}
.lhp-cdt-n{font-size:clamp(3rem,8vw,5rem);font-weight:900;line-height:1;display:block;font-variant-numeric:tabular-nums}
.lhp-cdt-l{font-size:.9rem;opacity:.7;margin-top:4px;display:block}
@media(max-width:480px){.lhp-countdown-timer{gap:16px}.lhp-cdt-n{font-size:2.5rem}}
.lhp-price-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:40px;max-width:900px;margin-left:auto;margin-right:auto;align-items:start}
@media(max-width:768px){.lhp-price-grid{grid-template-columns:1fr}}
.lhp-price-card{background:#fff;border:1px solid #e5e7eb;border-radius:var(--lhp-r);padding:28px;display:flex;flex-direction:column;position:relative}
.lhp-price-featured{background:#2563eb;color:#fff;border-color:#2563eb;transform:scale(1.04);box-shadow:0 8px 40px rgba(37,99,235,.3)}
.lhp-price-badge{font-size:.7rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:#93c5fd;margin-bottom:8px}
.lhp-price-name{font-size:.9rem;font-weight:700;margin-bottom:4px;color:inherit;opacity:.7}
.lhp-price-amount{font-size:2.2rem;font-weight:900;margin-bottom:4px;line-height:1}
.lhp-price-period{font-size:.9rem;font-weight:400;opacity:.6}
.lhp-price-desc{font-size:.8rem;opacity:.6;margin-bottom:20px}
.lhp-price-features{list-style:none;margin-bottom:24px;flex:1;display:flex;flex-direction:column;gap:8px}
.lhp-price-features li{font-size:.85rem;display:flex;align-items:center;gap:8px}
.lhp-price-btn{display:block;text-align:center;padding:12px;border-radius:12px;font-weight:700;font-size:.9rem;text-decoration:none;background:#2563eb;color:#fff;transition:opacity .2s}
.lhp-price-featured .lhp-price-btn{background:#fff;color:#2563eb}
.lhp-price-btn:hover{opacity:.85}
.lhp-news{max-width:720px;margin:32px auto 0}
.lhp-news-item{display:flex;align-items:flex-start;gap:12px;padding:14px 12px;border-bottom:1px solid #f3f4f6;transition:background .2s;flex-wrap:wrap}
.lhp-news-item:hover{background:#f9fafb}
.lhp-news-date{font-size:.8rem;color:#9ca3af;white-space:nowrap;margin-top:2px;font-family:monospace;flex-shrink:0}
.lhp-news-tag{font-size:.7rem;font-weight:700;background:#eff6ff;color:#2563eb;padding:2px 10px;border-radius:9999px;white-space:nowrap;flex-shrink:0}
.lhp-news-title{font-size:.9rem;font-weight:600;color:#111;line-height:1.5;flex:1;min-width:200px}
.lhp-form-success{text-align:center;padding:40px 24px;color:#16a34a;font-weight:700;font-size:1.1rem;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0}
.lhp-share-row{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
.lhp-share-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:9999px;font-size:.85rem;font-weight:700;text-decoration:none;transition:opacity .2s}
.lhp-share-btn:hover{opacity:.8}
.lhp-share-line{background:#06c755;color:#fff}
.lhp-share-tw{background:#000;color:#fff}
.lhp-share-fb{background:#1877f2;color:#fff}
.lhp-buy-card{max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:var(--lhp-r);padding:32px;text-align:center}
.lhp-buy-label{font-size:1.4rem;font-weight:900;margin-bottom:8px;color:#111}
.lhp-buy-desc{font-size:.9rem;color:#6b7280;margin-bottom:24px}
.lhp-news-loading{color:#9ca3af;font-size:.9rem;padding:24px;text-align:center}
.lhp-mform{max-width:560px;margin:40px auto 0}
.lhp-mform-steps{display:flex;align-items:center;margin-bottom:32px;gap:0}
.lhp-mform-dot{width:32px;height:32px;border-radius:50%;background:#e5e7eb;color:#9ca3af;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;flex-shrink:0;transition:all .3s}
.lhp-mform-dot.active{background:#2563eb;color:#fff}
.lhp-mform-line{flex:1;height:2px;background:#e5e7eb;transition:background .3s}
.lhp-mform-line.active{background:#2563eb}
.lhp-mstep-label{font-size:.8rem;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:20px}
.lhp-mform-btn{width:100%;padding:14px;border:none;border-radius:var(--lhp-btn-r);color:#fff;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .2s}
.lhp-mform-btn:hover{opacity:.85}
.lhp-mform-btn-back{background:#f3f4f6!important;color:#374151!important}
.lhp-mform-confirm{background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:20px}
.lhp-mconfirm-table{width:100%;border-collapse:collapse}
.lhp-mconfirm-table th{width:8rem;text-align:left;font-size:.85rem;color:#6b7280;font-weight:600;padding:8px 0;border-bottom:1px solid #e5e7eb;vertical-align:top}
.lhp-mconfirm-table td{font-size:.9rem;color:#111;padding:8px 0;border-bottom:1px solid #e5e7eb;white-space:pre-line}
.lhp-reviews-summary{display:flex;align-items:center;gap:10px;margin-bottom:28px}
.lhp-reviews-score{font-size:2.5rem;font-weight:900;color:#111;line-height:1}
.lhp-reviews-stars{color:#f59e0b;font-size:1.3rem}
.lhp-reviews-count{color:#9ca3af;font-size:.9rem}
.lhp-reviews-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:8px}
@media(max-width:768px){.lhp-reviews-grid{grid-template-columns:1fr}}
.lhp-review-card{background:#f9fafb;border-radius:var(--lhp-r);padding:20px}
.lhp-review-stars{color:#f59e0b;font-size:.95rem;margin-bottom:8px}
.lhp-review-text{color:#444;font-size:.875rem;line-height:1.6;margin-bottom:12px}
.lhp-review-author{font-size:.8rem;font-weight:700;color:#111}
.lhp-review-author span{font-weight:400;color:#9ca3af;margin-left:6px}
@media(max-width:600px){.lhp-hide-mobile{display:none!important}}
@media(min-width:601px){.lhp-hide-desktop{display:none!important}}
@media(max-width:768px){
  .lhp-hero{min-height:300px;padding:56px 20px}
  .lhp-hero h1{font-size:clamp(1.6rem,7vw,3rem)}
  .lhp-hero-sub{font-size:1rem}
  .lhp-section{padding:48px 20px}
  .lhp-section-title{font-size:clamp(1.4rem,5vw,2rem)}
  .lhp-cta{padding:56px 20px}
  .lhp-contact{padding:56px 20px}
  .lhp-grid-3{grid-template-columns:1fr}
  .lhp-price-grid{grid-template-columns:1fr}
  .lhp-price-featured{transform:none}
  .lhp-countdown-timer{gap:16px}
  .lhp-cdt-n{font-size:2.8rem}
  .lhp-testimonials-bg{padding:48px 20px}
  .lhp-hours{max-width:100%}
  .lhp-map{height:280px!important}
}
@media(max-width:480px){
  .lhp-hero{min-height:260px;padding:48px 16px}
  .lhp-hero h1{font-size:clamp(1.4rem,8vw,2.4rem)}
  .lhp-hero-sub{font-size:.95rem}
  .lhp-btn-primary{padding:12px 28px;font-size:.95rem}
  .lhp-section{padding:40px 16px}
  .lhp-cta{padding:48px 16px}
  .lhp-contact{padding:48px 16px}
  .lhp-cdt-n{font-size:2.2rem}
  .lhp-countdown-timer{gap:12px}
  .lhp-news-title{min-width:0;width:100%}
  .lhp-news-item{gap:8px}
  .lhp-card{padding:18px}
  .lhp-col{padding:16px}
  .lhp-price-card{padding:20px}
  .lhp-testimonial{padding:16px}
  .lhp-faq-q{padding:14px 16px}
  .lhp-faq-a{padding:12px 16px}
}
`;

export function exportToHTML(
  pages: Page[],
  seo: SEOSettings,
  settings: SiteSettings,
  siteName: string,
  businessInfo?: { name?: string; address?: string; phone?: string; email?: string; industry?: string; siteId?: string; slug?: string }
): string {
  const firstPage = pages[0] ?? { blocks: [], seo: {} as SEOSettings };
  const effectiveSeo = firstPage.seo?.title ? firstPage.seo : seo;
  const title = effectiveSeo.title || siteName;
  const desc = effectiveSeo.description || '';
  const multiPage = pages.length > 1;

  // Per-page SEO data for dynamic title/description switching
  const pageSeoMap = pages.reduce<Record<string, { title: string; desc: string }>>((acc, p) => {
    acc[p.id] = {
      title: escapeHtml(p.seo?.title || seo.title || siteName),
      desc: escapeHtml(p.seo?.description || seo.description || ''),
    };
    return acc;
  }, {});

  // Navigation bar (multi-page only)
  const navBar = multiPage ? `
<nav class="lhp-navbar" id="lhp-navbar">
  <div class="lhp-navbar-inner">
    <button class="lhp-navbar-brand" onclick="lhpPage(event,'${firstPage.id}')">${escapeHtml(siteName)}</button>
    <button class="lhp-nav-toggle" aria-label="メニュー" onclick="document.getElementById('lhp-nav-menu').classList.toggle('lhp-nav-open')">☰</button>
    <ul class="lhp-nav-menu" id="lhp-nav-menu">
      ${pages.map(p => `<li><button class="lhp-nav-link" data-page="${p.id}" onclick="lhpPage(event,'${p.id}')">${escapeHtml(p.name)}</button></li>`).join('')}
    </ul>
  </div>
</nav>
<script>
var LHP_SEO=${JSON.stringify(pageSeoMap)};
function lhpPage(e,id){
  if(e)e.preventDefault();
  document.querySelectorAll('.lhp-page').forEach(function(el){el.hidden=true;});
  var pg=document.getElementById(id);if(pg)pg.hidden=false;
  document.querySelectorAll('.lhp-nav-link').forEach(function(a){a.classList.remove('lhp-nav-active');});
  var lnk=document.querySelector('[data-page="'+id+'"]');if(lnk)lnk.classList.add('lhp-nav-active');
  document.getElementById('lhp-nav-menu').classList.remove('lhp-nav-open');
  window.scrollTo(0,0);
  window.history.pushState({},'','#'+id);
  var s=LHP_SEO[id];
  if(s){
    document.title=s.title;
    var m=document.querySelector('meta[name="description"]');
    if(m)m.setAttribute('content',s.desc);
  }
}
window.addEventListener('DOMContentLoaded',function(){
  var hash=window.location.hash.slice(1);
  var startId=hash||'${firstPage.id}';
  lhpPage(null,startId);
});
window.addEventListener('popstate',function(){
  var hash=window.location.hash.slice(1)||'${firstPage.id}';
  lhpPage(null,hash);
});
</script>` : '';

  // Page sections
  const pagesHtml = pages.map((page, idx) => {
    const blocksHtml = page.blocks.map(b => renderBlock(b, { heroLayout, accentColor })).filter(Boolean).join('\n');
    return multiPage
      ? `<div id="${page.id}" class="lhp-page"${idx > 0 ? ' hidden' : ''}>${blocksHtml}</div>`
      : blocksHtml;
  }).join('\n');

  const siteIdScript = businessInfo?.siteId
    ? `<script>window.__LHPSID='${businessInfo.siteId}';</script>`
    : '';

  // Dynamic OGP image via /api/og, falling back to hero bgImage if available
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.com';
  const heroBgImage = firstPage.blocks.find(b => b.type === 'hero')?.data?.bgImage as string | undefined;
  const ogImageUrl = heroBgImage && heroBgImage.startsWith('http')
    ? heroBgImage
    : `${appUrl}/api/og?title=${encodeURIComponent(title.slice(0, 40))}&desc=${encodeURIComponent(desc.slice(0, 60))}${businessInfo?.industry ? `&industry=${businessInfo.industry}` : ''}`;

  // A/B test: detect if any page has both A and B hero variants
  const hasABTest = pages.some(p =>
    p.blocks.some(b => b.type === 'hero' && b.data.abVariant === 'b')
  );
  const abScript = hasABTest ? `<script>
(function(){
  var k='laru_ab_'+(window.__LHPSID||'x');
  var v=sessionStorage.getItem(k);
  var isNew=!v;
  if(!v){v=Math.random()<0.5?'a':'b';sessionStorage.setItem(k,v);}
  document.querySelectorAll('[data-ab]').forEach(function(el){
    if(el.getAttribute('data-ab')!==v)el.style.display='none';
  });
  if(isNew&&window.__LHPSID){
    fetch('/api/sites/ab-track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({siteId:window.__LHPSID,variant:v})}).catch(function(){});
  }
})();
</script>` : '';

  const pwScript = settings.sitePassword ? `<script>(function(){
  var pw=${JSON.stringify(settings.sitePassword)};
  var key='lhp-pw-ok';
  if(sessionStorage.getItem(key)===pw)return;
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:#0f172a;z-index:99999;display:flex;align-items:center;justify-content:center;font-family:sans-serif';
  ov.innerHTML='<div style="background:#1e293b;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:40px 32px;max-width:360px;width:90%;text-align:center"><div style="font-size:2rem;margin-bottom:12px">🔒</div><h2 style="color:#fff;font-size:1.25rem;font-weight:700;margin:0 0 8px">このサイトはパスワード保護されています</h2><p style="color:#94a3b8;font-size:.875rem;margin:0 0 24px">パスワードを入力してください</p><input id="lhp-pw-in" type="password" placeholder="パスワード" style="width:100%;box-sizing:border-box;background:#0f172a;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:12px 16px;color:#fff;font-size:1rem;outline:none;margin-bottom:12px"><button id="lhp-pw-btn" style="width:100%;background:#3b82f6;color:#fff;border:none;border-radius:10px;padding:12px;font-size:1rem;font-weight:700;cursor:pointer">入る</button><p id="lhp-pw-err" style="color:#f87171;font-size:.8rem;margin:8px 0 0;display:none">パスワードが違います</p></div>';
  document.body.appendChild(ov);
  document.getElementById('lhp-pw-btn').onclick=check;
  document.getElementById('lhp-pw-in').addEventListener('keydown',function(e){if(e.key==='Enter')check();});
  function check(){
    var v=document.getElementById('lhp-pw-in').value;
    if(v===pw){sessionStorage.setItem(key,pw);ov.remove();}
    else{document.getElementById('lhp-pw-err').style.display='block';}
  }
  document.body.style.overflow='hidden';
})();</script>` : '';

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

  const laruBotScript = (settings.larubot && settings.larubotPublicId)
    ? `<script src="https://larubot.tokyo/static/embed.js" data-public-id="${settings.larubotPublicId}" defer></script>`
    : '';

  const laruSeoScript = (settings.laruseo && settings.laruseoPublicId)
    ? `<script src="https://larubot.tokyo/embed/blog.js" data-id="${settings.laruseoPublicId}" data-limit="6" defer></script>`
    : '';

  const gaScript = settings.gaTrackingId ? `
<script async src="https://www.googletagmanager.com/gtag/js?id=${settings.gaTrackingId}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${settings.gaTrackingId}');</script>` : '';

  const clarityScript = settings.clarityId ? `<script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${settings.clarityId}");</script>` : '';

  const gaEventScript = settings.gaTrackingId ? `<script>
(function(){
  if(typeof gtag!=='function')return;
  /* Form submit events */
  ['lhp-form-contact','lhp-form-booking'].forEach(function(id){
    var form=document.getElementById(id);
    if(!form)return;
    form.addEventListener('submit',function(){
      gtag('event','form_submit',{event_category:'contact',event_label:id==='lhp-form-booking'?'booking':'contact'});
    });
  });
  /* CTA button click events */
  document.querySelectorAll('.lhp-btn-primary,.lhp-cta a,.lhp-nav-cta').forEach(function(el){
    el.addEventListener('click',function(){
      gtag('event','cta_click',{event_category:'engagement',event_label:(el.textContent||'').trim().slice(0,50)});
    });
  });
  /* Scroll depth events (25/50/75/100%) */
  var depths=[25,50,75,100];var fired={};
  window.addEventListener('scroll',function(){
    var scrolled=(window.scrollY+window.innerHeight)/document.documentElement.scrollHeight*100;
    depths.forEach(function(d){
      if(!fired[d]&&scrolled>=d){
        fired[d]=true;
        gtag('event','scroll_depth',{event_category:'engagement',event_label:d+'%',non_interaction:true});
      }
    });
  },{passive:true});
})();
</script>` : '';

  // Font selection
  const FONT_MAP: Record<string, { url: string; family: string }> = {
    'noto':     { url: 'Noto+Sans+JP:wght@400;500;700;900', family: "'Noto Sans JP'" },
    'zen':      { url: 'Zen+Kaku+Gothic+New:wght@400;500;700;900', family: "'Zen Kaku Gothic New'" },
    'mincho':   { url: 'Shippori+Mincho:wght@400;500;700;800', family: "'Shippori Mincho'" },
    'rounded':  { url: 'M+PLUS+Rounded+1c:wght@400;500;700;900', family: "'M PLUS Rounded 1c'" },
    'biz':      { url: 'BIZ+UDPGothic:wght@400;700', family: "'BIZ UDPGothic'" },
    'kaisei':   { url: 'Kaisei+Opti:wght@400;500;700;800', family: "'Kaisei Opti'" },
  };
  const fontKey = settings.fontFamily || 'noto';
  const font = FONT_MAP[fontKey] || FONT_MAP['noto'];
  const fontCss = `body,input,textarea,select,button{font-family:${font.family},-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}`;

  const designStyle = settings.designStyle || 'modern';
  const accentColor = settings.accentColor || '#f59e0b';
  const heroLayout  = settings.heroLayout  || 'center';
  const headerStyle = settings.headerStyle || 'transparent';
  const animLevel   = settings.animLevel   || 'full';

  // Scroll animation + typewriter + counter script
  const animScript = `<script>
(function(){
  /* ── scroll reveal ── */
  var animLevel='${animLevel}';
  var els=document.querySelectorAll('[data-lhp-anim]');
  if(animLevel==='none'){
    els.forEach(function(el){el.classList.add('lhp-visible');});
  } else if(els.length){
    els.forEach(function(el){var dur=el.getAttribute('data-lhp-dur');if(dur)el.style.transitionDuration=dur+'ms';${animLevel === 'subtle' ? "el.style.transform='none';" : ''}});
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('lhp-visible');io.unobserve(e.target);}});
    },{threshold:0.08});
    els.forEach(function(el){io.observe(el);});
  }

  /* ── typewriter (bold / sharp styles) ── */
  var style='${designStyle}';
  if(style==='bold'||style==='sharp'){
    var h1=document.querySelector('.lhp-hero h1');
    if(h1){
      var txt=h1.textContent||'';
      h1.textContent='';
      h1.style.borderRight='3px solid rgba(255,255,255,.7)';
      h1.style.minHeight='1.2em';
      var i=0;
      var type=function(){
        if(i<txt.length){h1.textContent+=txt[i++];setTimeout(type,55+Math.random()*35);}
        else{setTimeout(function(){h1.style.borderRight='none';},900);}
      };
      setTimeout(type,400);
    }
  }

  /* ── count-up for numbers ── */
  function animCount(el,target,prefix,suffix){
    var start=Date.now(),dur=1600;
    var tick=function(){
      var p=Math.min((Date.now()-start)/dur,1);
      var eased=1-Math.pow(1-p,3);
      el.textContent=prefix+Math.round(eased*target).toLocaleString('ja-JP')+suffix;
      if(p<1)requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  var cio=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting)return;
      var el=e.target;
      var n=parseFloat((el.textContent||'').replace(/[^0-9.]/g,''));
      if(!isNaN(n)&&n>9){
        var raw=el.textContent||'';
        var prefix=raw.match(/^[^0-9]*/)?raw.match(/^[^0-9]*/)[0]:'';
        var suffix=raw.match(/[^0-9]*$/)?raw.match(/[^0-9]*$/)[0]:'';
        animCount(el,n,prefix,suffix);
      }
      cio.unobserve(el);
    });
  },{threshold:0.6});
  document.querySelectorAll('.lhp-price-amount,.lhp-stat-num,.lhp-three-col-title').forEach(function(el){
    if((el.textContent||'').match(/[0-9]{2,}/))cio.observe(el);
  });
})();
</script>`;

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
<meta property="og:image" content="${escapeHtml(seo.ogImage || ogImageUrl)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(seo.ogTitle || title)}">
<meta name="twitter:description" content="${escapeHtml(seo.ogDescription || desc)}">
<meta name="twitter:image" content="${escapeHtml(seo.ogImage || ogImageUrl)}">
<meta name="robots" content="index,follow">
${businessInfo?.slug ? `<link rel="canonical" href="${appUrl}/hp/${escapeHtml(businessInfo.slug)}">` : ''}
<script type="application/ld+json">${JSON.stringify(schema)}</script>
${siteIdScript}
${abScript}
${gaScript}
${clarityScript}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=${font.url}&display=swap" rel="stylesheet">
<style>:root{${DESIGN_STYLES[designStyle] ?? DESIGN_STYLES.modern}--lhp-accent:${accentColor};}${CSS}</style>
<style>${fontCss}
${animLevel === 'none' ? '[data-lhp-anim]{opacity:1!important;transform:none!important}' : `[data-lhp-anim]{opacity:0;transition-property:opacity,transform;transition-timing-function:ease;transition-duration:${animLevel === 'subtle' ? '.4s' : '.6s'}}
[data-lhp-anim="fade"]{transform:none}
[data-lhp-anim="slide-up"]{transform:translateY(32px)}
[data-lhp-anim="slide-left"]{transform:translateX(-32px)}
[data-lhp-anim="slide-right"]{transform:translateX(32px)}
[data-lhp-anim="zoom"]{transform:scale(0.92)}
[data-lhp-anim].lhp-visible{opacity:1;transform:none}`}
${headerStyle === 'solid' ? '.lhp-nav{background:#1e293b!important;border-bottom:1px solid rgba(255,255,255,0.1)!important}' : ''}
${headerStyle === 'colored' ? `.lhp-nav{background:var(--lhp-primary)!important}` : ''}
${heroLayout === 'split' ? `.lhp-hero-split .lhp-hero-inner{display:flex;flex-direction:row;align-items:center;gap:40px}.lhp-hero-split .lhp-hero-content{flex:1}.lhp-hero-split-img{flex:0 0 42%;border-radius:16px;overflow:hidden;aspect-ratio:4/3}.lhp-hero-split-img img{width:100%;height:100%;object-fit:cover}@media(max-width:768px){.lhp-hero-split .lhp-hero-inner{flex-direction:column}.lhp-hero-split-img{width:100%;flex:none;aspect-ratio:16/9}}` : ''}
${STYLE_EXTRAS[designStyle] ?? ''}
</style>
${settings.customCss ? `<style>${settings.customCss}</style>` : ''}
</head>
<body class="lhp-style-${designStyle}">
${pwScript}
${navBar}
${pagesHtml}
${laruBotScript}
${laruSeoScript}
${animScript}
<div id="lhp-cookie-banner" style="display:none;position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#1e293b;border-top:1px solid rgba(255,255,255,0.1);padding:14px 20px;font-family:inherit">
  <div style="max-width:800px;margin:0 auto;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
    <p style="margin:0;font-size:13px;color:#cbd5e1;flex:1;min-width:240px">
      このサイトはCookieを使用してユーザー体験を向上させています。続けることで同意したとみなします。
      <a href="/privacy" style="color:#60a5fa;text-decoration:underline;margin-left:4px">プライバシーポリシー</a>
    </p>
    <div style="display:flex;gap:8px;flex-shrink:0">
      <button id="lhp-cookie-reject" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:#94a3b8;font-size:13px;cursor:pointer;font-family:inherit">拒否</button>
      <button id="lhp-cookie-accept" style="padding:8px 20px;border-radius:8px;border:none;background:#3b82f6;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">同意する</button>
    </div>
  </div>
</div>
<script>
(function(){
  var KEY='lhp_cookie_consent';
  if(!localStorage.getItem(KEY)){
    var b=document.getElementById('lhp-cookie-banner');
    if(b)b.style.display='block';
  }
  function dismiss(val){
    localStorage.setItem(KEY,val);
    var b=document.getElementById('lhp-cookie-banner');
    if(b)b.style.display='none';
  }
  var acc=document.getElementById('lhp-cookie-accept');
  var rej=document.getElementById('lhp-cookie-reject');
  if(acc)acc.addEventListener('click',function(){dismiss('accepted');});
  if(rej)rej.addEventListener('click',function(){dismiss('rejected');});
})();
</script>
<script>
(function(){
  /* Nav hamburger toggle */
  var toggles=document.querySelectorAll('.lhp-nav-toggle');
  toggles.forEach(function(btn){
    btn.addEventListener('click',function(){
      var nav=btn.closest('.lhp-nav');
      if(!nav)return;
      var links=nav.querySelector('.lhp-nav-links');
      if(links)links.classList.toggle('lhp-nav-open');
    });
  });
  /* Smooth scroll for anchor links */
  document.querySelectorAll('.lhp-nav-links a[href^="#"]').forEach(function(a){
    a.addEventListener('click',function(e){
      var id=(a.getAttribute('href')||'').slice(1);
      var el=document.getElementById(id);
      if(el){e.preventDefault();el.scrollIntoView({behavior:'smooth',block:'start'});}
      document.querySelectorAll('.lhp-nav-links').forEach(function(l){l.classList.remove('lhp-nav-open');});
    });
  });
})();
</script>
<script>
(function(){
  var els=document.querySelectorAll('.lhp-section-wrap,.lhp-cta,.lhp-testimonials-bg,.lhp-col,.lhp-card,.lhp-review-card,.lhp-faq-item,.lhp-gallery-img,.lhp-price-card,.lhp-buy-card,.lhp-hero-inner');
  if(!('IntersectionObserver' in window))return;
  var style=document.createElement('style');
  style.textContent='.lhp-fade{opacity:0;transform:translateY(28px);transition:opacity .6s ease,transform .6s ease}.lhp-fade.lhp-visible{opacity:1;transform:none}.lhp-fade-d1{transition-delay:.08s}.lhp-fade-d2{transition-delay:.16s}.lhp-fade-d3{transition-delay:.24s}.lhp-fade-d4{transition-delay:.32s}.lhp-fade-d5{transition-delay:.40s}';
  document.head.appendChild(style);
  els.forEach(function(el){el.classList.add('lhp-fade');});
  /* stagger children inside multi-col layouts */
  document.querySelectorAll('.lhp-grid,.lhp-3col').forEach(function(grid){
    var children=grid.children;
    for(var i=0;i<Math.min(children.length,5);i++){
      children[i].classList.add('lhp-fade','lhp-fade-d'+(i+1));
    }
  });
  var obs=new IntersectionObserver(function(entries){
    entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('lhp-visible');obs.unobserve(e.target);}});
  },{threshold:0.12,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.lhp-fade').forEach(function(el){obs.observe(el);});
  /* hero always visible */
  document.querySelectorAll('.lhp-hero-inner').forEach(function(el){el.classList.add('lhp-visible');});
})();
</script>
${gaEventScript}
<div id="lhp-lb" role="dialog" aria-modal="true" aria-label="画像ビューア">
  <span id="lhp-lb-close" aria-label="閉じる">&#x2715;</span>
  <span class="lhp-lb-arrow" id="lhp-lb-prev" aria-label="前の画像">&#8249;</span>
  <img id="lhp-lb-img" src="" alt="拡大画像" />
  <span class="lhp-lb-arrow" id="lhp-lb-next" aria-label="次の画像">&#8250;</span>
  <div id="lhp-lb-counter"></div>
</div>
<script>(function(){
  var lb=document.getElementById('lhp-lb');
  var lbImg=document.getElementById('lhp-lb-img');
  var lbCounter=document.getElementById('lhp-lb-counter');
  if(!lb||!lbImg)return;
  var current=[],idx=0;
  function show(){lbImg.src=current[idx];lbCounter.textContent=(idx+1)+' / '+current.length;lb.classList.add('lhp-lb-open');document.body.style.overflow='hidden';}
  function close(){lb.classList.remove('lhp-lb-open');document.body.style.overflow='';}
  function prev(){idx=(idx-1+current.length)%current.length;show();}
  function next(){idx=(idx+1)%current.length;show();}
  document.getElementById('lhp-lb-close').onclick=close;
  document.getElementById('lhp-lb-prev').onclick=function(e){e.stopPropagation();prev();};
  document.getElementById('lhp-lb-next').onclick=function(e){e.stopPropagation();next();};
  lb.onclick=function(e){if(e.target===lb)close();};
  document.addEventListener('keydown',function(e){if(!lb.classList.contains('lhp-lb-open'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')prev();if(e.key==='ArrowRight')next();});
  document.querySelectorAll('.lhp-lb-trigger').forEach(function(el){
    el.addEventListener('click',function(){
      var group=el.getAttribute('data-lhp-lb-group');
      var i=parseInt(el.getAttribute('data-lhp-lb-idx')||'0',10);
      current=Array.from(document.querySelectorAll('[data-lhp-lb-group="'+group+'"]')).map(function(x){return x.getAttribute('data-lhp-lb-src')||'';});
      idx=i;show();
    });
  });
})();</script>
${settings.globalFooter?.enabled ? `<footer style="background:${settings.globalFooter.bgColor};color:${settings.globalFooter.textColor}">
<div style="max-width:1100px;margin:0 auto;padding:40px 32px">
<div style="display:flex;flex-wrap:wrap;gap:32px;margin-bottom:24px">
<div style="flex:1;min-width:180px">
<div style="font-weight:900;font-size:1.1rem;color:#fff;margin-bottom:4px">${escapeHtml(settings.globalFooter.logo)}</div>
${settings.globalFooter.tagline ? `<div style="font-size:.875rem;opacity:.6">${escapeHtml(settings.globalFooter.tagline)}</div>` : ''}
</div>
${settings.globalFooter.links.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:16px 24px;align-items:start">
${settings.globalFooter.links.map(l => `<a href="${escapeHtml(l.href)}" style="color:inherit;opacity:.7;font-size:.875rem;text-decoration:none">${escapeHtml(l.label)}</a>`).join('')}
</div>` : ''}
</div>
<div style="border-top:1px solid rgba(255,255,255,.1);padding-top:16px;font-size:.75rem;opacity:.5">${escapeHtml(settings.globalFooter.copyright)}</div>
</div>
</footer>` : ''}
</body>
</html>`;
}
