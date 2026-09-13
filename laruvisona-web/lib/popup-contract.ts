export type PublicPopup = {
  id: string; title: string; body: string; buttonText: string; buttonUrl: string;
  trigger: 'exit' | 'scroll' | 'timer'; triggerValue: number;
  bgColor: string; textColor: string; maxShows: number; hideForDays: number;
};

const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const int = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
const color = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

export function popupButtonUrl(value: unknown) {
  const raw = text(value, 500);
  if (!raw) return '#';
  if (raw.startsWith('#') || (raw.startsWith('/') && !raw.startsWith('//'))) return raw;
  try {
    const url = new URL(raw);
    return ['https:', 'mailto:', 'tel:'].includes(url.protocol) ? raw : '#';
  } catch { return '#'; }
}

export function sanitizePopup(value: unknown): PublicPopup | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (p.enabled !== true) return null;
  const id = text(p.id, 80);
  const title = text(p.title, 120);
  if (!id || !title) return null;
  const trigger = ['exit', 'scroll', 'timer'].includes(String(p.trigger))
    ? p.trigger as PublicPopup['trigger'] : 'timer';
  return {
    id, title, body: text(p.body, 500), buttonText: text(p.buttonText, 80) || 'くわしく見る',
    buttonUrl: popupButtonUrl(p.buttonUrl), trigger,
    triggerValue: trigger === 'scroll' ? int(p.triggerValue, 1, 100, 50) : trigger === 'timer' ? int(p.triggerValue, 1, 120, 10) : 0,
    bgColor: color(p.bgColor, '#0c1a3a'), textColor: color(p.textColor, '#ffffff'),
    maxShows: int(p.maxShows, 0, 1000, 0), hideForDays: int(p.hideForDays, 0, 365, 7),
  };
}

export function popupScript(siteId: string, popups: PublicPopup[]) {
  const encoded = JSON.stringify({ siteId, popups }).replace(/</g, '\\u003c');
  return `(function(){
var DATA=${encoded},sessionKey='laruhp:popup:'+DATA.siteId+':session',shown=false;if(sessionStorage.getItem(sessionKey))return;
function storageKey(p){return 'laruhp:popup:'+DATA.siteId+':'+p.id}function stateFor(p){var state={count:0,last:0};try{state=JSON.parse(localStorage.getItem(storageKey(p))||'{}')||state}catch(e){}state.count=Number(state.count)||0;state.last=Number(state.last)||0;return state}
function eligible(p){var state=stateFor(p);return !(p.maxShows>0&&state.count>=p.maxShows)&&!(p.hideForDays>0&&Date.now()-state.last<p.hideForDays*86400000)}
function show(popup){if(shown||document.getElementById('laruhp-popup-overlay')||!eligible(popup))return;shown=true;sessionStorage.setItem(sessionKey,'1');var state=stateFor(popup);state={count:state.count+1,last:Date.now()};try{localStorage.setItem(storageKey(popup),JSON.stringify(state))}catch(e){}
var previous=document.activeElement,overlay=document.createElement('div'),card=document.createElement('div');overlay.id='laruhp-popup-overlay';overlay.setAttribute('role','presentation');overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-labelledby','laruhp-popup-title');card.style.cssText='position:relative;max-width:400px;width:100%;border-radius:16px;padding:24px;box-shadow:0 25px 50px rgba(0,0,0,.3)';card.style.backgroundColor=popup.bgColor;card.style.color=popup.textColor;
var close=document.createElement('button');close.type='button';close.setAttribute('aria-label','閉じる');close.textContent='×';close.style.cssText='position:absolute;top:10px;right:14px;background:none;border:none;cursor:pointer;font-size:24px;line-height:1;color:inherit';
var title=document.createElement('h2');title.id='laruhp-popup-title';title.textContent=popup.title;title.style.cssText='font-size:18px;font-weight:700;margin:0 28px 8px 0';var body=document.createElement('p');body.textContent=popup.body;body.style.cssText='font-size:14px;opacity:.9;margin:0 0 16px;line-height:1.6';
var link=document.createElement('a');link.textContent=popup.buttonText;link.href=popup.buttonUrl;link.style.cssText='display:block;text-align:center;padding:12px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none';link.style.backgroundColor=popup.textColor;link.style.color=popup.bgColor;
function dismiss(){overlay.remove();if(previous&&previous.focus)previous.focus()}close.onclick=dismiss;overlay.onclick=function(e){if(e.target===overlay)dismiss()};overlay.onkeydown=function(e){if(e.key==='Escape'){e.preventDefault();dismiss();return}if(e.key==='Tab'){var items=[close,link],i=items.indexOf(document.activeElement),n=e.shiftKey?(i<=0?items.length-1:i-1):(i>=items.length-1?0:i+1);e.preventDefault();items[n].focus()}};
card.append(close,title,body,link);overlay.append(card);document.body.append(overlay);close.focus()}
DATA.popups.filter(eligible).forEach(function(popup){if(popup.trigger==='exit'){document.addEventListener('mouseleave',function h(e){if(e.clientY<10){show(popup);document.removeEventListener('mouseleave',h)}})}else if(popup.trigger==='timer')setTimeout(function(){show(popup)},popup.triggerValue*1000);else{window.addEventListener('scroll',function h(){var room=Math.max(1,document.documentElement.scrollHeight-innerHeight),pct=scrollY/room*100;if(pct>=popup.triggerValue){show(popup);window.removeEventListener('scroll',h)}},{passive:true})}})
})();`;
}
