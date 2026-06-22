import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET /api/popup?slug=xxx — returns popup JS for embedding in published sites
// This is a public endpoint that returns the popup configuration as JS

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const siteId = searchParams.get('siteId');

  if (!slug && !siteId) {
    return new NextResponse('// No slug or siteId', {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }

  const service = await createServiceClient();

  let resolvedSiteId = siteId;
  if (!resolvedSiteId && slug) {
    const { data: site } = await service.from('sites').select('id').eq('slug', slug).single();
    resolvedSiteId = site?.id ?? null;
  }

  if (!resolvedSiteId) {
    return new NextResponse('// Site not found', {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }

  const { data: site } = await service
    .from('sites')
    .select('settings_json')
    .eq('id', resolvedSiteId)
    .single();

  const settings = (site?.settings_json as Record<string, unknown>) || {};
  const popups = (settings.popups as Array<{
    id: string;
    title: string;
    body: string;
    buttonText: string;
    buttonUrl: string;
    trigger: 'exit' | 'scroll' | 'timer';
    triggerValue: number;
    bgColor: string;
    textColor: string;
    enabled: boolean;
  }>) || [];

  const enabledPopups = popups.filter(p => p.enabled);

  if (enabledPopups.length === 0) {
    return new NextResponse('// No active popups', {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }

  // Generate minimal popup JS
  const popupJs = `(function() {
  var POPUPS = ${JSON.stringify(enabledPopups)};
  var SHOWN_KEY = 'laruhp_popup_shown';

  if (sessionStorage.getItem(SHOWN_KEY)) return;

  function showPopup(popup) {
    sessionStorage.setItem(SHOWN_KEY, '1');
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';

    var card = document.createElement('div');
    card.style.cssText = 'max-width:400px;width:100%;border-radius:16px;padding:24px;box-shadow:0 25px 50px rgba(0,0,0,0.3);';
    card.style.backgroundColor = popup.bgColor || '#0c1a3a';
    card.style.color = popup.textColor || '#ffffff';

    var close = document.createElement('button');
    close.textContent = '×';
    close.style.cssText = 'position:absolute;top:12px;right:16px;background:none;border:none;cursor:pointer;font-size:20px;line-height:1;opacity:0.7;color:inherit;';
    close.onclick = function() { document.body.removeChild(overlay); };
    card.style.position = 'relative';
    card.appendChild(close);

    var title = document.createElement('h3');
    title.textContent = popup.title;
    title.style.cssText = 'font-size:18px;font-weight:700;margin:0 0 8px;';
    card.appendChild(title);

    var body = document.createElement('p');
    body.textContent = popup.body;
    body.style.cssText = 'font-size:14px;opacity:0.85;margin:0 0 16px;line-height:1.6;';
    card.appendChild(body);

    var btn = document.createElement('a');
    btn.textContent = popup.buttonText || 'くわしく見る';
    btn.href = popup.buttonUrl || '#';
    btn.style.cssText = 'display:block;text-align:center;padding:12px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;';
    btn.style.backgroundColor = popup.textColor || '#ffffff';
    btn.style.color = popup.bgColor || '#0c1a3a';
    card.appendChild(btn);

    overlay.appendChild(card);
    overlay.onclick = function(e) { if (e.target === overlay) document.body.removeChild(overlay); };
    document.body.appendChild(overlay);
  }

  var popup = POPUPS[0];
  if (!popup) return;

  if (popup.trigger === 'exit') {
    document.addEventListener('mouseleave', function handler(e) {
      if (e.clientY < 10) { showPopup(popup); document.removeEventListener('mouseleave', handler); }
    });
  } else if (popup.trigger === 'timer') {
    setTimeout(function() { showPopup(popup); }, (popup.triggerValue || 10) * 1000);
  } else if (popup.trigger === 'scroll') {
    window.addEventListener('scroll', function handler() {
      var pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      if (pct >= (popup.triggerValue || 50)) { showPopup(popup); window.removeEventListener('scroll', handler); }
    });
  }
})();`;

  return new NextResponse(popupJs, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
