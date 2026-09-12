// 編集画面のプレビューに、公開HTMLを安全に載せるための道具。
//
// なぜ必要か:
//   公開HTMLの中身は、人が打った文字だけとは限らない。AIの生成結果、他サイトの
//   取り込み、連携先の応答が同じ欄に入る。これを srcdoc にそのまま入れると、
//   srcdoc は親と同じ生成元なので、中で動いたものが親（＝ログイン済みの編集画面）の
//   window・Cookie・保存済みの認証情報へ手が届く。
//
//   そこで iframe に sandbox="allow-scripts" だけを付ける。allow-same-origin は
//   付けない。iframe は生成元を持たない別の箱になり、中からも外からも触れなくなる。
//   代わりに、節を選ぶ・位置を戻すといったやり取りは postMessage で行い、
//   受け取る側は必ず送信元の window そのものを確かめる（origin は "null" になる）。
//
// この橋渡しは編集画面のプレビューにだけ入る。公開HTMLには入らない。

/** プレビューの中だけで動く橋渡し */
const PREVIEW_BRIDGE = `<script data-lhp-studio-bridge="">
(function(){
  /* 生成元が無い箱では localStorage を読むだけで例外が出る。
     公開HTML側のスクリプト（買い物かご・A/B・お知らせ帯）を
     実物と同じように動かすため、その場限りの入れ物に置き換える。 */
  try { void window.localStorage.length; } catch (e) {
    var mem = function(){ var m = {}; return {
      getItem: function(k){ return Object.prototype.hasOwnProperty.call(m,k) ? m[k] : null; },
      setItem: function(k,v){ m[k] = String(v); },
      removeItem: function(k){ delete m[k]; },
      clear: function(){ m = {}; },
      key: function(i){ return Object.keys(m)[i] || null; },
      get length(){ return Object.keys(m).length; }
    }; };
    try { Object.defineProperty(window, 'localStorage', { value: mem(), configurable: true }); } catch (e2) {}
    try { Object.defineProperty(window, 'sessionStorage', { value: mem(), configurable: true }); } catch (e2) {}
  }

  var send = function(msg){ try { parent.postMessage(Object.assign({ source: 'lhp-studio-preview' }, msg), '*'); } catch (e) {} };

  var ready = function(){
    var st = document.createElement('style');
    st.setAttribute('data-studio', '');
    st.textContent = [
      '#lhp-cookie-banner{display:none!important}',
      '[data-lhp-block]{outline-offset:-2px}',
      '[data-lhp-block]:hover{outline:2px dashed rgba(37,99,235,.55)}',
      '[data-lhp-studio-selected]{outline:3px solid #2563eb !important}',
      'html{scroll-behavior:auto}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);

    document.addEventListener('click', function(e){
      var t = e.target;
      var act = t && t.closest ? t.closest('a,button') : null;
      if (act) { e.preventDefault(); e.stopPropagation(); }
      var holder = t && t.closest ? t.closest('[data-lhp-block]') : null;
      if (holder) send({ type: 'select', id: holder.getAttribute('data-lhp-block') || '', kind: t.closest('img,picture') ? 'image' : act ? 'button' : 'text' });
    }, true);
    document.querySelectorAll('[data-lhp-block]').forEach(function(el){
      el.setAttribute('tabindex','0');
      el.addEventListener('keydown',function(e){if(e.target!==el)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();send({type:'select',id:el.getAttribute('data-lhp-block')||'',kind:'text'});}});
    });
    document.addEventListener('submit', function(e){ e.preventDefault(); }, true);
    window.addEventListener('scroll', function(){ send({ type: 'scroll', y: window.scrollY }); }, { passive: true });
    send({ type: 'ready' });
  };

  window.addEventListener('message', function(e){
    if (e.source !== parent) return;
    var d = e.data;
    if (!d || d.source !== 'lhp-studio') return;
    if (d.type === 'scrollTo') { window.scrollTo(0, d.y || 0); return; }
    if (d.type === 'select') {
      var prev = document.querySelectorAll('[data-lhp-studio-selected]');
      for (var i = 0; i < prev.length; i++) prev[i].removeAttribute('data-lhp-studio-selected');
      if (!d.id) return;
      var el = document.querySelector('[data-lhp-block="' + String(d.id).replace(/["\\\\]/g, '\\\\$&') + '"]');
      if (el) { el.setAttribute('data-lhp-studio-selected', ''); if(d.scroll !== false) { var target=d.focus==='image' ? el.querySelector('img') : d.focus==='text' ? el.querySelector('h1,h2,h3') : el; (target||el).scrollIntoView({ block: d.align === 'start' ? 'start' : 'center', behavior: 'auto' }); } }
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
</script>`;

/** 橋渡しを、ページ本体のスクリプトより先に置く */
export function withPreviewBridge(html: string): string {
  const i = html.indexOf('<head>');
  if (i === -1) return PREVIEW_BRIDGE + html;
  return html.slice(0, i + 6) + PREVIEW_BRIDGE + html.slice(i + 6);
}

