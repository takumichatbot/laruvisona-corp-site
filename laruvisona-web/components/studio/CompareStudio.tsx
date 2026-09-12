'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import './compare-studio.css';

/** A visual proof only: remove executable content and permit just our scrolling bridge. */
function comparisonDocument(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv],audio,link[rel="preload"],link[rel="modulepreload"]').forEach(el => el.remove());
  doc.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
  });
  doc.querySelectorAll('video').forEach(el => {
    const poster = el.getAttribute('poster');
    if (poster) { const image = doc.createElement('img'); image.src = poster; image.className = el.className; image.alt = ''; el.replaceWith(image); }
    else el.remove();
  });
  doc.querySelectorAll('a').forEach(el => { el.removeAttribute('href'); el.removeAttribute('target'); });
  doc.querySelectorAll('button,input,textarea,select').forEach(el => el.setAttribute('disabled', ''));
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' https: http:; img-src https: http: data: blob:; font-src https: http: data:; connect-src 'none'; form-action 'none'; base-uri 'none'`;
  doc.head.prepend(policy);
  const style = doc.createElement('style');
  style.textContent = '*{animation:none!important;transition:none!important;scroll-behavior:auto!important}[data-lhp-anim],.lhp-fade{opacity:1!important;transform:none!important}#lhp-cookie-banner,.lhp-sticky-cta{display:none!important}';
  doc.head.append(style);
  const script = doc.createElement('script');
  script.setAttribute('nonce', nonce);
  script.textContent = `
    function focusSection(id){
      var el=Array.from(document.querySelectorAll('[data-lhp-block]')).find(function(el){return el.getAttribute('data-lhp-block')===id;});
      window.scrollTo(0,el?el.getBoundingClientRect().top+window.scrollY:0);
    }
    window.addEventListener('message',function(e){if(e.source!==parent||!e.data||e.data.source!=='lhp-compare')return;focusSection(String(e.data.id||''));});
    window.addEventListener('load',function(){parent.postMessage({source:'lhp-compare-ready'},'*');});
  `;
  doc.body.append(script);
  return '<!doctype html>' + doc.documentElement.outerHTML;
}

function CompareFrame({ html, device, section, title }: { html: string; device: 'pc'|'sp'; section: string; title: string }) {
  const box = useRef<HTMLDivElement>(null), frame = useRef<HTMLIFrameElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const srcDoc = useMemo(() => comparisonDocument(html), [html]);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const send = () => frame.current?.contentWindow?.postMessage({ source: 'lhp-compare', id: section }, '*');
    send();
    const ready = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && e.data?.source === 'lhp-compare-ready') send(); };
    window.addEventListener('message', ready);
    return () => window.removeEventListener('message', ready);
  }, [section, srcDoc, device]);
  const width = device === 'pc' ? 1100 : 390;
  const scale = Math.min(1, size.width / width) || 1;
  return <div className="sc-frame" ref={box}><iframe ref={frame} title={title} sandbox="allow-scripts" srcDoc={srcDoc} style={{ width, height: Math.max(200, size.height / scale), transform: `scale(${scale})`, left: Math.max(0, (size.width-width*scale)/2) }}/></div>;
}

export interface ComparisonSection { id: string; label: string; before: boolean; current: boolean }
export function CompareStudio({ beforeHtml, currentHtml, sections, changes, device, onClose, onRestore, onReplace }: {
  beforeHtml: string; currentHtml: string; sections: ComparisonSection[]; changes: string[];
  device: 'pc'|'sp'; onClose: () => void; onRestore: () => void; onReplace: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<'before'|'current'>('current');
  const [view, setView] = useState(device);
  const [section, setSection] = useState('');
  const [replaceAsked, setReplaceAsked] = useState(false);
  useEffect(() => {
    const el = dialog.current!;
    const focus = document.activeElement as HTMLElement | null;
    el.showModal();
    return () => { el.close(); focus?.focus(); };
  }, []);
  const part = sections.find(s => s.id === section);
  return <dialog ref={dialog} className="sc-dialog" aria-labelledby="sc-title" onCancel={onClose} onClose={onClose}>
    <div className="sc-layout">
      <header className="sc-header"><div><span className="sc-eyebrow">トップページの完成像を比較</span><h2 id="sc-title">自分らしい方を、選ぼう。</h2></div><button className="sc-close" type="button" onClick={onClose} aria-label="比較を閉じる">×</button></header>
      <div className="sc-toolbar">
        <label>比べる場所<select value={section} onChange={e=>setSection(e.target.value)}><option value="">ページの先頭</option>{sections.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <div className="sc-devices" aria-label="比較の画面幅">{(['pc','sp'] as const).map(v=><button key={v} type="button" aria-pressed={view===v} onClick={()=>setView(v)}>{v==='pc'?'パソコン':'スマホ'}</button>)}</div>
      </div>
      <div className="sc-changes" aria-label="案の違い">{changes.length ? changes.map(c=><span key={c}>{c}</span>) : <span>内容は同じです。閉じて、色や写真を試してみましょう。</span>}</div>
      <div className="sc-tabs" aria-label="表示する案">{(['before','current'] as const).map(v=><button key={v} type="button" aria-pressed={active===v} onClick={()=>setActive(v)}>{v==='before'?'残した案':'編集中の案'}</button>)}</div>
      <div className="sc-comparison" data-active={active}>
        {(['before','current'] as const).map(v=><section key={v} className="sc-pane" data-side={v}><div className="sc-pane-heading"><span>{v==='before'?'残した案':'編集中の案'}</span><small>{v==='before'?'比較用に残した時点':'いまの文章・写真・設定'}</small></div>
          {part && !part[v] ? <div className="sc-missing">この案には、この節はありません。</div> : <CompareFrame html={v==='before'?beforeHtml:currentHtml} device={view} section={section} title={v==='before'?'残した案の完成像':'編集中の完成像'}/>}
        </section>)}
      </div>
      <footer className="sc-footer">
        <p>戻す対象は文章・写真・設定を含むサイト全体。保存・公開は自動で行いません。比較用の案は制作画面を読み直すと消えます。</p>
        <div className="sc-decisions"><button type="button" className="sc-restore" disabled={!changes.length} onClick={onRestore}>残した案に戻す</button><button type="button" className="sc-keep" onClick={onClose}>今の案で続ける<span aria-hidden="true">↗</span></button></div>
        {replaceAsked ? <div className="sc-replace-confirm"><span>比較用の案を、今の内容で置き換えますか？</span><button type="button" onClick={onReplace}>置き換える</button><button type="button" onClick={()=>setReplaceAsked(false)}>やめる</button></div> : <button type="button" className="sc-replace" onClick={()=>setReplaceAsked(true)}>今の案を、新しい比較用の案にする</button>}
      </footer>
    </div>
  </dialog>;
}
