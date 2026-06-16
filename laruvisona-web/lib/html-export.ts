import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';

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
  <form class="lhp-form" id="lhp-form-contact">
    <div class="lhp-form-row">
      <input type="text" name="name" placeholder="お名前" required />
      <input type="email" name="email" placeholder="メールアドレス" required />
    </div>
    <input type="tel" name="phone" placeholder="電話番号" />
    <textarea name="message" placeholder="お問い合わせ内容" rows="5" required></textarea>
    <button type="submit" id="lhp-btn-contact" style="background-color:${raw('buttonColor')}">${str('buttonText')}</button>
    <p class="lhp-form-note" id="lhp-note-contact"></p>
  </form>
</section>
<script>
(function(){
  var f=document.getElementById('lhp-form-contact');
  if(!f)return;
  f.addEventListener('submit',async function(e){
    e.preventDefault();
    var btn=document.getElementById('lhp-btn-contact');
    var note=document.getElementById('lhp-note-contact');
    btn.textContent='送信中...';btn.disabled=true;
    try{
      var r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({siteId:window.__LHPSID||'',name:f.name.value,email:f.email.value,phone:f.phone.value,message:f.message.value})});
      var d=await r.json();
      if(d.ok){f.innerHTML='<div class="lhp-form-success">✅ 送信完了！2営業日以内にご連絡いたします。</div>';}
      else{btn.textContent='${str('buttonText')}';btn.disabled=false;note.textContent='送信に失敗しました。再度お試しください。';}
    }catch(err){btn.textContent='${str('buttonText')}';btn.disabled=false;note.textContent='送信に失敗しました。';}
  });
})();
</script>`;

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

    case 'video': {
      if (!d['url']) return '';
      const url = raw('url');
      const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
      const vmMatch = url.match(/vimeo\.com\/(\d+)/);
      const embedUrl = ytMatch
        ? `https://www.youtube.com/embed/${ytMatch[1]}`
        : vmMatch ? `https://player.vimeo.com/video/${vmMatch[1]}` : url;
      return `
<section class="lhp-section">
  ${d['heading'] ? `<h2 class="lhp-section-title">${str('heading')}</h2>` : ''}
  <div class="lhp-video-wrap" style="aspect-ratio:${raw('aspectRatio') || '16/9'}">
    <iframe src="${embedUrl}" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>
  </div>
</section>`;
    }

    case 'map':
      if (!d['embedUrl']) return '';
      return `
<section class="lhp-section">
  ${d['heading'] ? `<h2 class="lhp-section-title">${str('heading')}</h2>` : ''}
  <iframe src="${raw('embedUrl')}" class="lhp-map" style="height:${raw('height') || 400}px" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>
</section>`;

    case 'countdown':
      return `
<section class="lhp-countdown" style="background-color:${raw('bgColor')};color:${raw('textColor')}">
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
<section class="lhp-section">
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

    case 'booking':
      return `
<section class="lhp-contact" id="booking" style="background-color:${raw('bgColor')}">
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

    case 'news': {
      type NewsItem = { date:string; tag:string; title:string };
      const items = (d['items'] as NewsItem[]) ?? [];
      return `
<section class="lhp-section">
  <h2 class="lhp-section-title">${str('heading')}</h2>
  <div class="lhp-news">
    ${items.map(item => `
    <div class="lhp-news-item">
      <span class="lhp-news-date">${escapeHtml(item.date)}</span>
      <span class="lhp-news-tag">${escapeHtml(item.tag)}</span>
      <span class="lhp-news-title">${escapeHtml(item.title)}</span>
    </div>`).join('')}
  </div>
</section>`;
    }

    default:
      return '';
  }
}

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif;color:#111;line-height:1.6}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
.lhp-navbar{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-bottom:1px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.lhp-navbar-inner{max-width:1100px;margin:0 auto;padding:0 24px;height:56px;display:flex;align-items:center;gap:24px}
.lhp-navbar-brand{font-weight:900;font-size:1rem;background:none;border:none;cursor:pointer;padding:0;font-family:inherit;color:#111}
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
.lhp-form input,.lhp-form select,.lhp-form textarea{width:100%;padding:12px 16px;border:1px solid #d1d5db;border-radius:12px;font-size:16px;font-family:inherit;margin-bottom:12px;outline:none;transition:border-color .2s;background:#fff;color:#111;appearance:auto}
.lhp-form input:focus,.lhp-form select:focus,.lhp-form textarea:focus{border-color:#3b82f6}
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
.lhp-video-wrap{width:100%;border-radius:12px;overflow:hidden}
.lhp-video-wrap iframe{width:100%;height:100%;border:none;display:block}
.lhp-map{width:100%;border:none;border-radius:12px;display:block}
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
.lhp-price-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:28px;display:flex;flex-direction:column;position:relative}
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
  businessInfo?: { name?: string; address?: string; phone?: string; email?: string; industry?: string; siteId?: string }
): string {
  const firstPage = pages[0] ?? { blocks: [], seo: {} as SEOSettings };
  const effectiveSeo = firstPage.seo?.title ? firstPage.seo : seo;
  const title = effectiveSeo.title || siteName;
  const desc = effectiveSeo.description || '';
  const multiPage = pages.length > 1;

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
function lhpPage(e,id){
  if(e)e.preventDefault();
  document.querySelectorAll('.lhp-page').forEach(function(el){el.hidden=true;});
  var pg=document.getElementById(id);if(pg)pg.hidden=false;
  document.querySelectorAll('.lhp-nav-link').forEach(function(a){a.classList.remove('lhp-nav-active');});
  var lnk=document.querySelector('[data-page="'+id+'"]');if(lnk)lnk.classList.add('lhp-nav-active');
  document.getElementById('lhp-nav-menu').classList.remove('lhp-nav-open');
  window.scrollTo(0,0);
  window.history.pushState({},'','#'+id);
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
    const blocksHtml = page.blocks.map(renderBlock).filter(Boolean).join('\n');
    return multiPage
      ? `<div id="${page.id}" class="lhp-page"${idx > 0 ? ' hidden' : ''}>${blocksHtml}</div>`
      : blocksHtml;
  }).join('\n');

  const siteIdScript = businessInfo?.siteId
    ? `<script>window.__LHPSID='${businessInfo.siteId}';</script>`
    : '';

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
${siteIdScript}
${gaScript}
<style>${CSS}</style>
</head>
<body>
${navBar}
${pagesHtml}
${laruBotScript}
</body>
</html>`;
}
