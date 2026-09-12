'use client';
/**
 * 制作画面（スタジオ）。
 *
 * これまでの編集画面は、機能の一覧が先に来て、はじめての人がどこから触れば
 * よいか分からなかった。ここでは順番を「きく → えらぶ → ととのえる → 出す」に
 * 変え、真ん中に大きな実物のプレビューを置く。
 *
 * 大事にしていること:
 *  - プレビューは公開用のHTMLそのもの。編集画面だけの描き方を持たない。
 *    （持つと、編集画面で整えたのに公開したら崩れる、が起きる）
 *  - 色・書体・余白・角の丸みは、CSSを書かずに設定で決まる。
 *  - 保存できなかったときに「保存済み」と出さない。
 *  - 既存のサイトをそのまま開ける。従来の編集画面にもいつでも戻れる。
 */
import { useState, useContext, useEffect, useCallback, useMemo, useRef, useSyncExternalStore, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { readDesignChoice, saveDesignChoice, clearDesignChoice } from '@/lib/design-handoff';
import Link from 'next/link';
import { exportToHTML } from '@/lib/html-export';
import { canRecoverStudioDraft } from '@/lib/studio-draft';
import { makeStarterSite, exampleFor } from '@/lib/studio-start';
import { StudioIntake, StudioMood } from '@/components/studio/StudioStart';
import {
  DESIGN_PRESETS, DEFAULT_DESIGN, normalizeDesign, type SiteDesign,
} from '@/lib/site-design';
import {
  BLOCK_DEFS, INDUSTRY_CHOICES, blockLabel,
  type FieldDef, type IntakeAnswers,
} from '@/lib/studio-schema';
import { createClient as createBrowserSupabase } from '@/lib/supabase/client';
import { cleanIncomingText } from '@/lib/safe-markup';
import { checkPublishReadiness, blockingItems, type ReadyItem } from '@/lib/publish-readiness';
import { withPreviewBridge } from '@/lib/preview-frame';
import { ImageField, FocalField, ImageUploadContext } from '@/components/studio/ImageField';
import { editStudioBlock } from '@/lib/studio-image';
import { STUDIO_PALETTES } from '@/lib/studio-palettes';
import { CompareStudio, type ComparisonSection } from '@/components/studio/CompareStudio';
import { studioChanges } from '@/lib/studio-comparison';
import { useStudioHistory } from '@/components/studio/useStudioHistory';
import BlockList, { BlockIcon } from '@/components/studio/BlockList';
import { Plus, Film, ChevronUp, ChevronDown, Check } from 'lucide-react';
import SectionCraft from '@/components/studio/SectionCraft';
import SectionAssistant from '@/components/studio/SectionAssistant';
import {applySectionProposal, type SectionProposal} from '@/lib/studio-ai';
import {readComposition,clearComposition,buildComposition} from '@/lib/studio-composition';
import './studio-editor.css';
import type { Block, Page, SEOSettings } from '@/types/laruHP';

/* ─────────────────────────────────────────────────────────────────────── */

const EMPTY_SEO: SEOSettings = { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' };

interface StudioSettings {
  colorScheme: string;
  designStyle: string;
  fontFamily: string;
  accentColor: string;
  heroLayout: 'center' | 'left' | 'split';
  headerStyle: 'transparent' | 'solid' | 'colored';
  animLevel: 'none' | 'subtle' | 'full';
  larubot: boolean;
  laruseo: boolean;
  notifyEmail: string;
  customCss: string;
  /* 「サイト全体の設定」。null は未設定。
     以前からある作品には、この設定そのものが無い。無いものに既定値を入れて
     保存すると、色・余白・角丸・写真の比率が新しく指定され、見え方が変わる。
     利用者が使いはじめると決めたときだけ入る。 */
  design: SiteDesign | null;
  designPreset: string;
  globalFooter?: Record<string, unknown>;
}

interface StudioSite {
  name: string;
  pages: Page[];
  settings: StudioSettings;
}

type SaveState =
  | { kind: 'clean'; at: Date | null }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'failed'; message: string };

const FONTS = [
  { value: 'noto', label: 'すっきり（ゴシック）' },
  { value: 'mincho', label: '落ち着き（明朝）' },
  { value: 'rounded', label: 'やわらかい（丸ゴシック）' },
  { value: 'zen', label: 'はっきり（太めのゴシック）' },
  { value: 'biz', label: '読みやすさ優先' },
  { value: 'kaisei', label: '和の趣き' },
];

/** 見た目の設定を、公開HTMLが受け取る形にそろえる */
function toExportSettings(s: StudioSettings) {
  return {
    colorScheme: s.colorScheme,
    style: 'clean',
    designStyle: s.designStyle,
    fontFamily: s.fontFamily,
    accentColor: s.design?.accent || s.accentColor,
    heroLayout: s.heroLayout,
    headerStyle: s.headerStyle,
    animLevel: s.animLevel,
    larubot: s.larubot,
    laruseo: s.laruseo,
    notifyEmail: s.notifyEmail,
    customCss: s.customCss,
    /* 未設定なら、鍵ごと送らない。settings_json_patch は差分の合成なので、
       送らなければ保存されている状態（未設定）のまま残る。 */
    ...(s.design ? { design: s.design as unknown as Record<string, unknown> } : {}),
    designPreset: s.designPreset,
    globalFooter: s.globalFooter,
  };
}

/* ── プレビュー ─────────────────────────────────────────────────────────
   公開用のHTMLを iframe に流し込む。

   以前は srcdoc をそのまま使っていた。srcdoc は親と同じ生成元なので、
   中で動いたスクリプトが親（＝ログイン済みの編集画面）の window に手が届く。
   公開HTMLの中身は、人が打った文字だけとは限らない（AI生成・取り込み・連携先の
   応答が同じ欄に入る）。中で何かが動いたとしても、編集画面には届かない形にする。

   そのため sandbox="allow-scripts" だけを付ける。allow-same-origin は付けない。
   こうすると iframe は生成元を持たない別の箱になり、
     ・中から親の DOM・Cookie・localStorage へ触れない
     ・親からも中の document へ触れない
   代わりに、節を選ぶ／位置を戻すといったやり取りは postMessage で行う。
   受け取る側は必ず送信元（window オブジェクトそのもの）を確認する。 */

function Preview({ html, device, selectedId, selectedField, onSelect }: {
  html: string;
  device: 'pc' | 'sp';
  selectedId: string | null;
  selectedField: string;
  onSelect: (id: string, kind?: string) => void;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const scrollRef = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({width:0,height:0});
  const selectedRef = useRef(selectedId);
  const selectedFieldRef=useRef(selectedField);
  useEffect(()=>{selectedFieldRef.current=selectedField},[selectedField]);
  useEffect(()=>{selectedRef.current=selectedId},[selectedId]);
  useEffect(() => { const el=box.current; if(!el)return; const ro=new ResizeObserver(([e])=>setSize({width:e.contentRect.width,height:e.contentRect.height}));ro.observe(el);return()=>ro.disconnect(); }, []);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const post = useCallback((msg: Record<string, unknown>) => {
    const win = ref.current?.contentWindow;
    if (!win) return;
    win.postMessage({ source: 'lhp-studio', ...msg }, '*');
  }, []);

  /* 受け取るのは、この iframe の window から来たものだけ。
     生成元は「無し」になるので、origin ではなく送信元そのもので確かめる。 */
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      const d = e.data as { source?: string; type?: string; id?: string; kind?: string; y?: number } | null;
      if (!d || d.source !== 'lhp-studio-preview') return;
      if (d.type === 'ready') { if(selectedRef.current)post({type:'select',id:selectedRef.current,focus:selectedFieldRef.current==='bgImage'?'image':'text',align:'start'});else post({type:'scrollTo',y:scrollRef.current}); return; }
      if (d.type === 'scroll') { scrollRef.current = Number(d.y) || 0; return; }
      if (d.type === 'select') { onSelectRef.current(String(d.id || ''),String(d.kind||'')); return; }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post]);

  useEffect(() => { post({ type: 'select', id: selectedId || '', focus:selectedField==='bgImage'?'image':'text',align:'start' }); }, [selectedId, selectedField, size.height, post]);

  const srcDoc = useMemo(() => withPreviewBridge(html), [html]);

  const frameWidth=device==='sp'?390:1100;
  const scale=Math.min(1,size.width/frameWidth)||1;
  // srcDoc の再ナビゲーションは親の「戻る」履歴を増やす。新しい隔離フレームの
  // 初期文書として置き換え、選択・スクロールは上の ready 往復で戻す。
  return <div ref={box} className="se-frame-box"><iframe key={srcDoc} ref={ref} title="できあがりの見え方" sandbox="allow-scripts" srcDoc={srcDoc}
    style={{width:frameWidth,height:Math.max(200,size.height/scale),transform:`scale(${scale})`,transformOrigin:'top left',left:Math.max(0,(size.width-frameWidth*scale)/2)}}/></div>;

}

/* ── 入力の部品 ───────────────────────────────────────────────────────── */

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-[13px] font-bold text-slate-700 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500 mt-1 leading-relaxed">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-400/60';

function Field({ def, value, onChange }: {
  def: FieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const uploadState=useContext(ImageUploadContext);
  if (def.type === 'toggle') {
    return (
      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-sky-600" />
        <span className="text-[13px] font-bold text-slate-700">{def.label}</span>
      </label>
    );
  }
  if (def.type === 'list') {
    const arr = Array.isArray(value) ? value : [];
    if (def.ofStrings) {
      return (
        <fieldset className="mb-4">
          <legend className="text-[13px] font-bold text-slate-700 mb-1.5">{def.label}</legend>
          <div className="space-y-2">
            {arr.map((v, i) => (
              <div key={i} className="flex gap-2">
                {def.key==='images' ? <div className="min-w-0 flex-1"><ImageField label={`写真 ${i+1}`} value={v} onChange={url=>onChange(arr.map((x,j)=>j===i?url:x))}/></div> : <input className={inputCls} aria-label={`${def.label} ${i+1}`} value={String(v ?? '')}
                  onChange={e => onChange(arr.map((x, j) => j === i ? e.target.value : x))} />}
                <button type="button" disabled={uploadState.pending} className="px-2 text-slate-400 hover:text-red-600"
                  onClick={() => onChange(arr.filter((_, j) => j !== i))}>削除</button>
              </div>
            ))}
            <button type="button" disabled={uploadState.pending} className="text-[12px] font-bold text-sky-700 hover:underline"
              onClick={() => onChange([...arr, ''])}>＋ 追加する</button>
          </div>
          {def.hint && <p className="text-[11px] text-slate-500 mt-1">{def.hint}</p>}
        </fieldset>
      );
    }
    return (
      <div className="mb-5">
        <div className="text-[13px] font-bold text-slate-700 mb-2">{def.label}</div>
        <div className="space-y-3">
          {arr.map((item, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold text-slate-500">{i + 1}件目</span>
                <div className="flex gap-2 text-[11px]">
                  {i > 0 && <button type="button" disabled={uploadState.pending} className="text-slate-500 hover:text-slate-900"
                    onClick={() => { const a = [...arr]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); }}>上へ</button>}
                  {i < arr.length - 1 && <button type="button" disabled={uploadState.pending} className="text-slate-500 hover:text-slate-900"
                    onClick={() => { const a = [...arr]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; onChange(a); }}>下へ</button>}
                  <button type="button" disabled={uploadState.pending} className="text-red-600 hover:underline"
                    onClick={() => onChange(arr.filter((_, j) => j !== i))}>削除</button>
                </div>
              </div>
              {(def.item || []).map(sub => (
                <Field key={sub.key} def={sub}
                  value={(item as Record<string, unknown>)?.[sub.key]}
                  onChange={next => onChange(arr.map((x, j) => j === i ? { ...(x as object), [sub.key]: next } : x))} />
              ))}
            </div>
          ))}
          <button type="button" disabled={uploadState.pending} className="text-[12px] font-bold text-sky-700 hover:underline"
            onClick={() => onChange([...arr, { ...(def.itemDefault || {}) }])}>＋ 追加する</button>
        </div>
      </div>
    );
  }
  if (def.type === 'color') {
    return (
      <Row label={def.label} hint={def.hint}>
        <div className="flex gap-2 items-center">
          <input type="color" value={String(value || '#ffffff')} onChange={e => onChange(e.target.value)}
            className="w-9 h-9 rounded border border-slate-300 bg-transparent cursor-pointer" />
          <input className={inputCls} value={String(value ?? '')} placeholder="#ffffff"
            onChange={e => onChange(e.target.value)} />
        </div>
      </Row>
    );
  }
  if (def.key === 'bgImagePosition' || def.key === 'bgImagePositionSp') return <FocalField label={def.label} value={value} onChange={onChange}/>;
  if (def.type === 'select') {
    return (
      <Row label={def.label} hint={def.hint}>
        <select className={inputCls} value={String(value ?? '')} onChange={e => onChange(e.target.value)}>
          {(def.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Row>
    );
  }
  if (def.type === 'number') {
    return (
      <Row label={def.label} hint={def.hint}>
        <input type="number" className={inputCls} value={String(value ?? '')} min={def.min} max={def.max}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
      </Row>
    );
  }
  if (def.type === 'multiline') {
    return (
      <Row label={def.label} hint={def.hint}>
        <textarea className={`${inputCls} min-h-[92px] leading-relaxed`} value={String(value ?? '')}
          placeholder={def.placeholder}
          onChange={e => onChange(cleanIncomingText(e.target.value))} />
      </Row>
    );
  }
  if (def.type === 'image') return <ImageField label={def.label} value={value} onChange={onChange}/>;

  return (
    <Row label={def.label} hint={def.hint}>
      <input className={inputCls} value={String(value ?? '')} placeholder={def.placeholder}
        onChange={e => onChange(cleanIncomingText(e.target.value, 400))} />
    </Row>
  );
}

/* ── 本体 ─────────────────────────────────────────────────────────────── */

/* 保存できていない内容の控え。
 *
 * ログインが切れた・契約が要ると言われた・回線が切れた――そのどれでも、
 * 打った内容が消えないようにする。前の版は次の3つで失敗していた:
 *   ・保存済みサイト（siteId あり）では控えを消していた。いちばん失いたくない
 *     「保存に失敗した既存サイトの編集」がまさに消えていた
 *   ・戻り先に siteId が無く、入り直すと4つの質問からやり直しになっていた
 *   ・保存に成功したときに、その保存に含まれていない**あとの編集**まで捨てていた
 *
 * 置き場は localStorage。別のタブで入り直す人がいるので、タブ内だけの
 * sessionStorage では足りない。代わりに次を守る:
 *   ・鍵にサイトIDを入れ、中に「どのアカウントのものか」を書く
 *   ・別のアカウントで開いたら使わない（他人の下書きを見せない）
 *   ・1日で捨てる
 *   ・保存できたら消す（ただし保存中に足した編集が残っているときは消さない）
 */
const DRAFT_PREFIX = 'laruhp.studio.draft:';

interface StudioDraft {
  /** どのアカウントのものか。分からないときは null（その場合は誰でも使える＝未ログインで作りかけたもの） */
  account: string | null;
  /** どのサイトのものか。まだ保存していないものは null */
  siteId: string | null;
  intake: IntakeAnswers;
  site: StudioSite;
  step: 'intake' | 'mood' | 'edit';
  at: number;
}

const draftKey = (siteId: string | null) => `${DRAFT_PREFIX}${siteId || 'new'}`;

function readDraft(siteId: string | null, account: string | null): StudioDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(draftKey(siteId));
    if (!raw) return null;
    const d = JSON.parse(raw) as StudioDraft;
    if (!canRecoverStudioDraft(d, siteId, account)) return null;
    return d;
  } catch { return null; }
}

/** 控えを書く。書けたかどうかを返す（書けていないのに「残した」と言わないため） */
function writeDraft(d: StudioDraft): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(draftKey(d.siteId), JSON.stringify(d));
    return true;
  } catch { return false; }
}

function clearDraft(siteId: string | null): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(draftKey(siteId)); } catch { /* 消せなくても困らない */ }
}

const studioMobile = () => window.matchMedia('(max-width:900px)').matches;
const studioServerMobile = () => false;
const subscribeStudioMobile = (notify:()=>void) => {const mq=window.matchMedia('(max-width:900px)');mq.addEventListener('change',notify);return()=>mq.removeEventListener('change',notify)};
function StudioInner() {
  const params = useSearchParams();
  const siteIdParam = params.get('siteId');
  const creationParam = params.get('creation');
  // 下書きは初期描画では読まず、利用者の照合が済んだ後にだけ復元する。

  /* 案内ページなどで見せ方を選んでから来た場合、その選択を引き継ぐ。
     引き継ぐのは見せ方の名前だけ。既にあるサイトを開いたときは読まない
     （別のサイト・別のアカウントの設定が混ざらないようにするため）。 */
  const designParam = params.get('mood') || params.get('design') || '';
  const [handoff, setHandoff] = useState('');
  useEffect(() => {
    if (siteIdParam) return;
    const fromUrl = DESIGN_PRESETS.some(p => p.id === designParam) ? designParam : '';
    // ログインを挟むとURLの印は消える。端末に置き直してから読む
    if (fromUrl) saveDesignChoice(fromUrl);
    const kept = readDesignChoice();
    setHandoff(DESIGN_PRESETS.some(p => p.id === kept) ? kept : '');
  }, [siteIdParam, designParam]);

  const [siteId, setSiteId] = useState<string | null>(siteIdParam);
  // この画面で作成した直後の URL 更新では読み込み直さない。
  // 保存中の追加編集と履歴を保ち、実際の再読み込み時には通常の所有者 API を通す。
  const createdHere = useRef<string | null>(null);
  const [step, restoreStep] = useState<'intake' | 'mood' | 'edit'>(
    siteIdParam ? 'edit' : 'intake',
  );
  const setStep = useCallback((next: 'intake' | 'mood' | 'edit') => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('step') !== next) {
      url.searchParams.set('step', next);
      window.history.pushState(null, '', url);
    }
    restoreStep(next);
  }, []);
  const [loading, setLoading] = useState(!!siteIdParam);
  const [loadError, setLoadError] = useState('');

  const [intake, setIntake] = useState<IntakeAnswers>(() => {
    const requested = !siteIdParam ? params.get('industry') : null;
    const industry = INDUSTRY_CHOICES.some(c => c.value === requested) ? requested! : 'beauty';
    return {industry, name: '', area: '', audience: '', goal: exampleFor(industry).goal, description: ''};
  });

  const { site, setSite, resetSite: resetHistory, undo, redo, canUndo, canRedo, breakGroup } = useStudioHistory<StudioSite>(() => ({
    name: '', pages: [], settings: {
      colorScheme: 'professional-blue', designStyle: 'modern', fontFamily: 'noto',
      accentColor: '#2563eb', heroLayout: 'center', headerStyle: 'solid', animLevel: 'subtle',
      larubot: false, laruseo: false, notifyEmail: '', customCss: '',
      design: { ...DEFAULT_DESIGN }, designPreset: '',
    },
  }));

  const [comparisonBase,setComparisonBase]=useState<StudioSite|null>(null);
  const [comparison,setComparison]=useState<{beforeHtml:string;currentHtml:string;sections:ComparisonSection[];changes:string[]}|null>(null);
  const resetSite=useCallback((value:StudioSite)=>{resetHistory(value);setComparisonBase(null);setComparison(null);},[resetHistory]);

  const stepContent = useRef({ hasPages: false, hasName: false });
  useEffect(() => { stepContent.current = { hasPages: site.pages.length > 0, hasName: !!intake.name.trim() }; }, [site.pages.length, intake.name]);
  useEffect(() => {
    const onBack = () => {
      const requested = new URL(window.location.href).searchParams.get('step');
      const next = requested === 'edit' && stepContent.current.hasPages ? 'edit'
        : requested === 'mood' && stepContent.current.hasName ? 'mood'
        : siteIdParam && stepContent.current.hasPages ? 'edit' : 'intake';
      restoreStep(next);
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, [siteIdParam]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('step') !== step) {
      url.searchParams.set('step', step);
      window.history.replaceState(null, '', url);
    }
  }, [step]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deviceChoice, setDevice] = useState<'pc' | 'sp' | null>(null);
  const mobile=useSyncExternalStore(subscribeStudioMobile,studioMobile,studioServerMobile);
  const device=deviceChoice??(mobile?'sp':'pc');
  const [panel, setPanel] = useState<'block' | 'design' | 'ready'>('block');
  const [mobileTool,setMobileTool]=useState<'preview'|'blocks'|'settings'>('preview');
  const [widePreview,setWidePreview]=useState(false);
  const [historyNote,setHistoryNote]=useState('');
  const [fieldFocus,setFieldFocus]=useState('');
  const [craftTab,setCraftTab]=useState<'content'|'appearance'|'assistant'>('content');
  const [sheetExpanded,setSheetExpanded]=useState(false);
  const [creationNote,setCreationNote]=useState('');
  const [focusRequest,setFocusRequest]=useState(0);
  const [uploads,setUploads]=useState(0);
  const undoEdit=useCallback(()=>{if(uploads||!canUndo)return;undo();setHistoryNote('変更を取り消しました。保存すると反映されます。');},[uploads,canUndo,undo]);
  const redoEdit=useCallback(()=>{if(uploads||!canRedo)return;redo();setHistoryNote('変更をやり直しました。保存すると反映されます。');},[uploads,canRedo,redo]);
  useEffect(()=>{
    if(step!=='edit'||loading||loadError||comparison)return;
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){setWidePreview(false);return;}
      const target=e.target as HTMLElement;
      if(target.closest('input,textarea,select,[contenteditable]')||!(e.metaKey||e.ctrlKey)||e.altKey)return;
      if(e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redoEdit();else undoEdit();}
      else if(e.key.toLowerCase()==='y'){e.preventDefault();redoEdit();}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[step,loading,loadError,comparison,undoEdit,redoEdit]);
  const reportUpload=useCallback((active:boolean)=>setUploads(n=>Math.max(0,n+(active?1:-1))),[]);
  const settingsPane=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!fieldFocus)settingsPane.current?.scrollTo({top:0});},[selectedId,craftTab,fieldFocus]);
  useEffect(()=>{if(!fieldFocus)return; const frame=requestAnimationFrame(()=>{const el=settingsPane.current?.querySelector<HTMLElement>(`[data-field-key="${fieldFocus}"]`);if(el)settingsPane.current?.scrollTo({top:el.offsetTop-80,behavior:'instant'});});return()=>cancelAnimationFrame(frame)},[fieldFocus,focusRequest]);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'clean', at: null });
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [savedSincePublish, setSavedSincePublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishNote, setPublishNote] = useState('');
  /** ログイン中の利用者。控えの持ち主の照合と、通知先の案内に使う */
  const [account, setAccount] = useState<{ id: string; email: string | null } | null>(null);
  /** 利用者が誰か（または分からないこと）が決まったか。控えを戻す前に必ず待つ */
  const [accountResolved, setAccountResolved] = useState(false);
  /** 控えをこの端末に書けているか。書けていないのに「残した」と言わない */
  const [draftKept, setDraftKept] = useState(false);
  /** 読み込み後に、保存できていなかった編集を戻したとき */
  const [restoredDraft, setRestoredDraft] = useState(false);

  /* 保存できない理由のうち、利用者の側で手当てが要るもの。
     端末への保存結果は draftKept を見て案内する。
       login … ログインが切れている（401）
       plan  … 契約が無い / 件数の上限（403）*/
  const [blocked, setBlocked] = useState<null | { kind: 'login' | 'plan'; message: string }>(null);

  const siteRef = useRef(site);
  useEffect(() => { siteRef.current = site; }, [site]);
  /* 押した瞬間の状態で判断したいので、控えを持つ。
     useCallback の中の saveState は、作られた時点の値のまま古くなる。 */
  const saveStateRef = useRef<SaveState>({ kind: 'clean', at: null });
  useEffect(() => { saveStateRef.current = saveState; }, [saveState]);
  const publishingRef = useRef(false);
  const editSeq = useRef(0);
  /** サーバが最後に保存した時刻。これより後の控えだけを戻す */
  const serverSavedAt = useRef(0);
  const serverHadContent = useRef(false);
  /** 控えを戻す処理を1回だけにする */
  const restoreDone = useRef(false);
  // 読み込みで入れ替えた分は「編集」ではない。
  // ここを時間差（setTimeout）で打ち消すと、順番によって未保存のまま残る。
  const hydrating = useRef(true);

  useEffect(() => {
    if (hydrating.current) { hydrating.current = false; return; }
    editSeq.current += 1;
    setSaveState(prev => (prev.kind === 'saving' ? prev : { kind: 'dirty' }));
  }, [site]);

  /* ログイン中の利用者を1度だけ調べる。
     控えの持ち主の照合（別アカウントの下書きを見せない）と、
     通知先の案内（専用の届け先が空のとき、どこへ届くか）に使う。
     取れなくても画面は動く。 */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        /* この端末に残っている手形（cookie）から読む。
           控えの持ち主を見分けるのが目的なので、サーバへ問い合わせる必要はない。
           手形が無効でも「誰の控えか」の照合はできる。 */
        const sb = createBrowserSupabase();
        const { data: sess } = await sb.auth.getSession();
        let u = sess?.session?.user ?? null;
        if (!u) {
          const { data } = await sb.auth.getUser();
          u = data?.user ?? null;
        }
        if (!alive) return;
        setAccount(u ? { id: u.id, email: u.email ?? null } : null);
      } catch { /* 分からないままにする */ } finally {
        if (alive) setAccountResolved(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  /* 保存できないまま残っていた編集を戻す。
     利用者が誰か決まってから、1回だけ行う。
       ・別のアカウントの控えは使わない（消す）
       ・サーバの保存より前の控えは使わない
       ・中身が空の控えで、保存済みの中身を上書きしない
     戻したものは「未保存」のままにする（勝手に保存はしない）。 */
  useEffect(() => {
    if (!accountResolved || loading || loadError || restoreDone.current) return;
    restoreDone.current = true;
    const kept = readDraft(siteIdParam, account?.id ?? null);
    if (!kept) {
      // 別アカウントのものが残っていれば、ここで消す
      try {
        const foreign = JSON.parse(localStorage.getItem(draftKey(siteIdParam)) || 'null');
        if (foreign?.account && account && foreign.account !== account.id) clearDraft(siteIdParam);
      } catch { /* 壊れた控えは使わない */ }
      const choice=!siteIdParam?readComposition(creationParam):null;
      if(choice){const built=buildComposition(choice);resetSite(built.site);setIntake(built.intake);setSelectedId(built.site.pages[0]?.blocks[0]?.id??null);restoreStep('edit');hydrating.current=false;clearComposition();setCreationNote('案内ページでつくった内容を引き継ぎました。写真と情報を確かめて、続きを仕上げましょう。');}
      return;
    }
    if (!siteIdParam) {
      resetSite(kept.site); setIntake(kept.intake); restoreStep(kept.step);
      if(creationParam){setCreationNote('前回の下書きを優先しました。案内ページの見本で上書きしていません。');clearComposition();}
      setRestoredDraft(true); hydrating.current = false; return;
    }
    if (kept.siteId !== siteIdParam) return;
    if (kept.at <= serverSavedAt.current) return;
    const keptHasContent = kept.site?.pages?.some(pg => (pg.blocks ?? []).length > 0);
    if (!keptHasContent && serverHadContent.current) return;
    resetSite(kept.site);
    setIntake(kept.intake);
    setRestoredDraft(true);
    hydrating.current = false;                      // これは「未保存の編集」として扱う
  }, [accountResolved, loading, loadError, account, siteIdParam, creationParam, resetSite]);

  /* 保存できていない内容を、この端末に控える。
     保存済みのサイトでも控える（保存に失敗した編集こそ失いたくない）。
     保存できたときだけ、下の save() が消す。

     控えるのは「保存できていない状態のとき」だけ。
     読み込みの途中や、保存済みでそのままのときに書くと、
     まだ中身が入っていない画面の姿を控えてしまい、次に開いたときに
     それを戻して**保存済みの中身を空で上書きする**。 */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loading || loadError || !accountResolved || !restoreDone.current) return;
    if (saveState.kind === 'clean' && !(!siteId && intake.name.trim())) return;
    if (step === 'intake' && site.pages.length === 0 && !intake.name.trim()) return;
    const kept = writeDraft({
      account: account?.id ?? null, siteId, intake, site, step, at: Date.now(),
    });
    setDraftKept(kept);
  }, [siteId, site, intake, step, account, accountResolved, saveState.kind, loading, loadError]);

  /* 保存できていないまま閉じようとしたら、ブラウザに確認させる。
     未保存（dirty）だけでなく、保存中（saving）と保存失敗（failed）も止める。
     失敗したまま閉じるのが、いちばん失いやすい。 */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const k = saveStateRef.current.kind;
      if (k !== 'dirty' && k !== 'saving' && k !== 'failed') return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  /* ── 読み込み ── */
  useEffect(() => {
    if (!siteIdParam) return;
    if (createdHere.current === siteIdParam) {
      createdHere.current = null;
      return;
    }
    let alive = true;
    (async () => {
      try {
        // 保存されている内容をそのまま見たい。ブラウザの控えを使わせない
        const res = await fetch(`/api/sites/${siteIdParam}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status === 401 ? 'ログインが必要です' : `サイトを開けませんでした (${res.status})`);
        const { site: s } = await res.json();
        if (!alive || !s) return;
        const raw = s.blocks_json;
        const pages: Page[] = raw?.v === 2 && Array.isArray(raw.pages) && raw.pages.length
          ? raw.pages
          : [{ id: 'page-main', name: 'トップページ', path: '/', blocks: Array.isArray(raw) ? raw : [], seo: { ...EMPTY_SEO, ...(s.seo_json || {}) } }];
        const st = (s.settings_json || {}) as Record<string, unknown>;
        resetSite({
          name: s.name || '',
          pages,
          settings: {
            colorScheme: (st.colorScheme as string) || 'professional-blue',
            designStyle: (st.designStyle as string) || 'modern',
            fontFamily: (st.fontFamily as string) || 'noto',
            accentColor: (st.accentColor as string) || '#2563eb',
            heroLayout: (st.heroLayout as StudioSettings['heroLayout']) || 'center',
            headerStyle: (st.headerStyle as StudioSettings['headerStyle']) || 'solid',
            animLevel: (st.animLevel as StudioSettings['animLevel']) || 'subtle',
            larubot: !!st.larubot, laruseo: !!st.laruseo,
            notifyEmail: (st.notifyEmail as string) || '',
            customCss: (st.customCss as string) || '',
            // 無いものは無いまま持つ。既定値を入れて保存すると見え方が変わる
            design: st.design ? normalizeDesign(st.design) : null,
            designPreset: (st.designPreset as string) || '',
            globalFooter: st.globalFooter as Record<string, unknown> | undefined,
          },
        });
        setPublishedAt(s.published ? (s.updated_at as string) : null);
        setSelectedId(pages[0]?.blocks?.[0]?.id ?? null);
        hydrating.current = true;   // この差し替えは編集ではない

        /* 控えを戻すのは、利用者が誰か分かってから（下の useEffect）。
           誰のものか確かめる前に画面へ出すと、別のアカウントの下書きを
           見せてしまう。ここでは、サーバがいつ保存したかだけ控える。 */
        serverSavedAt.current = Date.parse(String(s.updated_at ?? '')) || 0;
        serverHadContent.current = pages.some(pg => (pg.blocks ?? []).length > 0);
        /* 中身がまだ何も無いサイト（一覧から「新しいサイト」で作った直後）は、
           空の編集画面ではなく4つの質問から始める。答えたあとは、この
           サイトにそのまま書き込む（新しいサイトは作らない）。 */
        if (!pages.some(pg => (pg.blocks ?? []).length > 0)) {
          setIntake(prev => ({ ...prev, name: s.name && s.name !== '新しいサイト' ? s.name : prev.name }));
          restoreStep('intake');
        }
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : '読み込みに失敗しました');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [siteIdParam, resetSite]);

  const page = site.pages[0];
  const blocks = useMemo(() => page?.blocks ?? [], [page]);

  const updateBlocks = useCallback((next: Block[]) => {
    setSite(prev => ({ ...prev, pages: prev.pages.map((p, i) => i === 0 ? { ...p, blocks: next } : p) }));
  }, [setSite]);

  const updateBlockData = useCallback((id: string, key: string, value: unknown) => {
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map((p, i) => i === 0
        ? { ...p, blocks: p.blocks.map(b => b.id === id ? editStudioBlock(b, key, value) : b) }
        : p),
    }), typeof value==='string'||typeof value==='number'?`${id}:${key}`:undefined);
  }, [setSite]);

  const setDesign = useCallback((patch: Partial<SiteDesign>) => {
    setSite(prev => prev.settings.design
      ? { ...prev, settings: { ...prev.settings, design: { ...prev.settings.design, ...patch } } }
      : prev, `design:${Object.keys(patch).join(',')}`);   // 使いはじめる前は、触っても何も入れない
  }, [setSite]);

  /** 「サイト全体の設定」を使いはじめる。ここで初めて design が入る */
  const adoptDesign = useCallback((base: SiteDesign, presetId = '') => {
    setSite(prev => ({
      ...prev,
      settings: { ...prev.settings, design: { ...base }, accentColor: base.accent, designPreset: presetId },
    }));
  }, [setSite]);

  /* ── プレビューのHTML ── */
  const [previewHtml, setPreviewHtml] = useState('');
  useEffect(() => {
    if (!page) { setPreviewHtml(''); return; }
    const t = setTimeout(() => {
      try {
        setPreviewHtml(exportToHTML(
          site.pages,
          page.seo || EMPTY_SEO,
          toExportSettings(site.settings) as never,
          site.name || '店名',
          { name: site.name, industry: intake.industry, siteId: siteId || 'studio-preview', slug: '' },
        ));
      } catch (e) {
        setPreviewHtml(`<p style="font-family:sans-serif;padding:24px">プレビューを作れませんでした: ${String(e)}</p>`);
      }
    }, 140);
    return () => clearTimeout(t);
  }, [site, page, intake.industry, siteId]);

  const keepComparison=()=>{
    if(uploads||!accountResolved)return;
    setComparisonBase(structuredClone(site));
    breakGroup();
    setHistoryNote('比較用の案を残しました。別の色や写真を試して、見比べられます。');
  };
  const openComparison=()=>{
    if(!comparisonBase||uploads)return;
    // Generate both views from exact snapshots now, not the debounced editor preview.
    const render=(value:StudioSite)=>exportToHTML(value.pages,value.pages[0]?.seo||EMPTY_SEO,toExportSettings(value.settings) as never,value.name||'店名',{name:value.name,industry:intake.industry,siteId:siteId||'studio-preview',slug:''});
    try {
      const old=comparisonBase.pages[0]?.blocks||[],now=site.pages[0]?.blocks||[];
      const sections=[...new Map([...old,...now].map(b=>[b.id,b])).values()].map(b=>({id:b.id,label:blockLabel(b),before:old.some(x=>x.id===b.id),current:now.some(x=>x.id===b.id)}));
      setComparison({beforeHtml:render(comparisonBase),currentHtml:render(site),sections,changes:studioChanges(comparisonBase,site)});
    } catch {setHistoryNote('比較の表示を作れませんでした。編集内容はそのまま残っています。');}
  };

  /* ── 保存 ── */
  const save = useCallback(async () => {
    breakGroup();
    const s = siteRef.current;
    const seq = editSeq.current;
    /* 新規のときの控えは 'new' の鍵で置いてある。保存できたら、
       新しいサイトIDの鍵とあわせて、そちらも消す。 */
    const wasNew = !siteId;
    setSaveState({ kind: 'saving' });
    const payload = {
      name: s.name || '無題のサイト',
      blocks_json: { v: 2, pages: s.pages },
      seo_json: s.pages[0]?.seo || EMPTY_SEO,
      settings_json_patch: toExportSettings(s.settings),
    };
    try {
      let id = siteId;
      if (id) {
        const res = await fetch(`/api/sites/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          if (res.status === 401) setBlocked({ kind: 'login', message: '' });
          throw new Error(res.status === 401
            ? 'ログインが切れています。下の案内で下書きの保存状態を確認してください'
            : (b.error as string) || `保存できませんでした (${res.status})`);
        }
      } else {
        const { settings_json_patch, ...rest } = payload;
        const res = await fetch('/api/sites', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...rest, settings_json: settings_json_patch, industry: intake.industry }),
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          if (res.status === 401) setBlocked({ kind: 'login', message: '' });
          if (res.status === 403 && (b.code === 'no_plan' || b.code === 'site_limit')) {
            setBlocked({ kind: 'plan', message: (b.error as string) || '' });
          }
          throw new Error(res.status === 401
            ? 'ログインするとサイトを保存できます。下の案内で下書きの保存状態を確認してください'
            : (b.error as string) || `保存できませんでした (${res.status})`);
        }
        const { site: created } = await res.json();
        id = created?.id ?? null;
        if (!id) throw new Error('保存先を確認できませんでした。サイト一覧を確認してください');
        createdHere.current = id;
        setSiteId(id);
        const url = new URL(window.location.href);
        url.searchParams.set('siteId', id);
        url.searchParams.set('step', 'edit');
        window.history.replaceState(null, '', url);
      }
      setBlocked(null);
      setSavedSincePublish(true);
      setRestoredDraft(false);
      /* 送っているあいだに続きを編集していたら、保存済みにはしない。
         控えも消さない（この保存に入っていない編集が、そこにしか無いため）。
         消すのは「送った内容がそのまま最新」のときだけ。 */
      if (editSeq.current === seq) {
        clearDraft(id);
        if (wasNew) clearDraft(null);
        setSaveState({ kind: 'clean', at: new Date() });
      } else {
        setSaveState({ kind: 'dirty' });
      }
    } catch (e) {
      setSaveState({ kind: 'failed', message: e instanceof Error ? e.message : '保存できませんでした' });
    }
  }, [siteId, intake.industry, breakGroup]);

  // 保存されている内容を、サーバから取り直す。
  // 別の画面や別の端末で直したあと、こちらの画面を最新にそろえるため。
  // 画面内の遷移ではなく、読み込みからやり直す必要がある。
  const reload = useCallback(() => {
    if (!siteId) return;
    const st = saveStateRef.current;
    if (st.kind === 'saving') { alert('保存しています。終わってから読み直してください'); return; }
    // 失敗したときも、直した内容は画面にしか無い。読み直せば消える。
    if (st.kind === 'dirty' && !confirm('保存していない変更があります。読み直すと消えます。よろしいですか')) return;
    if (st.kind === 'failed' && !confirm('保存できていない変更があります。読み直すと消えます。よろしいですか')) return;
    window.location.reload();
  }, [siteId]);

  /* 公開は「保存されている内容」を出す処理。
     画面の内容がまだ保存されていないと、見ているものと違うものが出る。
     だから、保存が済んでいるときだけ押せるようにする。 */
  const publish = useCallback(async () => {
    if (!siteId) return;
    if (publishingRef.current) return;              // 二重押し
    const st = saveStateRef.current;
    if (st.kind === 'saving') { setPublishNote('保存しています。終わってから公開してください'); return; }
    if (st.kind === 'dirty') { setPublishNote('先に保存してください。公開されるのは、保存された内容です'); return; }
    if (st.kind === 'failed') { setPublishNote('保存できていません。保存し直してから公開してください'); return; }

    publishingRef.current = true;
    const seq = editSeq.current;
    setPublishing(true);
    setPublishNote('');
    try {
      const res = await fetch(`/api/sites/${siteId}/publish`, { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b.error as string) || `公開できませんでした (${res.status})`);
      setPublishedAt(new Date().toISOString());
      // 公開しているあいだに続きを直していたら、「いまの内容が出ている」とは書かない
      setSavedSincePublish(editSeq.current !== seq);
      setPublishNote('公開しました');
    } catch (e) {
      setPublishNote(e instanceof Error ? e.message : '公開できませんでした');
    }
    publishingRef.current = false;
    setPublishing(false);
  }, [siteId]);

  /* ── ヒアリングから、はじめの形を作る ── */
  const buildFromIntake = useCallback((presetId: string) => {
    if (site.pages.length && !confirm('入力したお店の情報と選んだ見せ方から作り直します。編集した内容を置き換えてもよろしいですか？')) return;
    // 使ったら持ち越さない
    clearDesignChoice();
    const made = makeStarterSite(intake, presetId);
    resetSite(made);
    setSelectedId(made.pages[0].blocks[0]?.id ?? null);
    setStep('edit');
  }, [intake, resetSite, setStep, site.pages.length]);

  /* ── 公開準備の確認 ──
     判定は lib/publish-readiness.ts に寄せてある。編集画面（ビルダー）と
     同じ関数を呼ぶので、どちらで開いても「準備できている」の意味が変わらない。 */
  const readiness = useMemo<ReadyItem[]>(() => checkPublishReadiness({
    name: site.name,
    pages: site.pages,
    notifyEmail: site.settings.notifyEmail,
    /* 専用の届け先が空のとき、実APIはこのアカウントのメールへ送る。
       分かっている画面なので、どこへ届くかまで出す。 */
    ownerEmail: account?.email ?? undefined,
  }), [site.name, site.pages, site.settings.notifyEmail, account?.email]);

  /* ── 画面 ── */

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-slate-500">開いています…</div>;
  }
  if (loadError) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md text-center">
          <p className="text-slate-800 font-bold mb-2">{loadError}</p>
          <Link href="/laruHP/dashboard" className="text-sky-700 underline text-sm">サイト一覧へ戻る</Link>
        </div>
      </div>
    );
  }

  if (step === 'intake') return <>{creationNote&&<p className="sc-creation-note" role="status">{creationNote}</p>}<StudioIntake intake={intake} setIntake={setIntake} onNext={() => setStep('mood')} /></>;
  if (step === 'mood') return <>{creationNote&&<p className="sc-creation-note" role="status">{creationNote}</p>}<StudioMood intake={intake} onBack={() => setStep('intake')} onPick={buildFromIntake} fromLp={handoff} /></>;

  const adoptProposal=(proposal:SectionProposal,keys:string[]):boolean=>{
    const current=siteRef.current;const block=current.pages[0]?.blocks.find(b=>b.id===proposal.id);
    const changed=block?applySectionProposal(block,proposal,keys):null;
    if(!changed){setHistoryNote('提案後に文章が変わりました。新しい内容から提案を作り直してください。');return false;}
    setSite({...current,pages:current.pages.map((p,i)=>i===0?{...p,blocks:p.blocks.map(b=>b.id===changed.id?changed:b)}:p)});
    setHistoryNote('選んだ文章だけを採用しました。「取り消す」で戻せます。');return true;
  };
  const selected = blocks.find(b => b.id === selectedId) || null;
  const def = selected ? BLOCK_DEFS[selected.type] : null;

  return (
    <ImageUploadContext.Provider value={{pending:uploads>0,report:reportUpload}}><div className="se-editor h-screen flex flex-col bg-slate-100 text-slate-900" data-mobile-tool={mobileTool} data-wide-preview={widePreview} data-sheet-expanded={sheetExpanded} onBlurCapture={breakGroup}>
      {/* 上の帯 */}
      <header className="se-editor-header flex items-center gap-3 px-4 h-14 bg-white border-b border-slate-200 flex-shrink-0">
        <Link href="/laruHP/dashboard" className="text-sm font-bold text-slate-500 hover:text-slate-900">← 一覧</Link>
        <input
          className="font-bold text-slate-900 border border-transparent hover:border-slate-300 focus:border-sky-400 rounded px-2 py-1 text-sm w-56 focus:outline-none"
          value={site.name} placeholder="店名"
          onChange={e => setSite(prev => ({ ...prev, name: cleanIncomingText(e.target.value, 120) }), 'site-name')}
        />
        <div className="se-devices flex bg-slate-100 rounded-lg p-0.5 ml-2">
          {(['pc', 'sp'] as const).map(k => (
            <button key={k} onClick={() => setDevice(k)}
              className={`px-3 py-1 rounded-md text-xs font-bold ${device === k ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
              {k === 'pc' ? 'パソコン' : 'スマホ'}
            </button>
          ))}
        </div>

        <div className="se-header-actions ml-auto flex items-center gap-3">
          <SaveBadge state={saveState} />
          <button onClick={reload} disabled={!siteId || saveState.kind === 'saving'}
            className="text-xs font-bold text-slate-500 hover:text-slate-900 disabled:opacity-30">読み直す</button>
          <button onClick={save} disabled={saveState.kind === 'saving'}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-50">
            {saveState.kind === 'saving' ? '保存中…' : '保存'}
          </button>
          <button onClick={() => {setPanel('ready');setMobileTool('settings');}}
            className="px-4 py-1.5 rounded-lg bg-sky-600 text-white text-sm font-bold">公開の準備</button>
        </div>
      </header>

      {creationNote&&<p className="sc-creation-note" role="status">{creationNote}</p>}
      {restoredDraft && !blocked && (
        <div className="bg-sky-50 border-b border-sky-200 px-4 py-2 flex flex-wrap items-center gap-x-3">
          <span className="text-[13px] font-bold text-sky-900">
            前回、保存できていなかった編集をこの端末から戻しました。
          </span>
          <span className="text-[11px] text-sky-800">まだ保存していません。内容を確かめて「保存」を押してください。</span>
        </div>
      )}

      {blocked && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[13px] font-bold text-amber-900">
            {blocked.kind === 'login' ? '保存するにはログインが必要です。' : (blocked.message || '保存するには契約が必要です。')}
            {draftKept
              ? ' 打った内容は、この端末に残してあります。'
              : ' この端末に控えを残せませんでした。この画面を閉じると消えます。'}
          </span>
          <a
            href={blocked.kind === 'login'
              ? `/laruHP/auth/login?redirectTo=${encodeURIComponent(
                  siteId ? `/laruHP/studio?siteId=${siteId}` : '/laruHP/studio')}`
              : '/laruHP/plans'}
            className="text-[13px] font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-md px-3 py-1">
            {blocked.kind === 'login' ? 'ログインして戻る' : '料金を見る'}
          </a>
          <span className="text-[11px] text-amber-800">
            {draftKept
              ? '戻ってきたら、もう一度「保存」を押してください。同じサイトの続きから直せます。'
              : 'この画面を開いたまま、別のタブで手当てしてから、もう一度「保存」を押してください。'}
          </span>
        </div>
      )}

      <div className="se-session-bar">
        <div className="se-history-controls" aria-label="編集履歴">
          <button type="button" onClick={undoEdit} disabled={!canUndo||uploads>0} title="取り消す（⌘ / Ctrl Z）"><span aria-hidden="true">↶</span>取り消す</button>
          <button type="button" onClick={redoEdit} disabled={!canRedo||uploads>0} title="やり直す（⌘ / Ctrl Shift Z）"><span aria-hidden="true">↷</span>やり直す</button>
        </div>
        <span className="se-history-note" role="status">{historyNote||'自由に試して、ひとつ前に戻せます'}</span>
        <button className="se-compare-toggle" type="button" disabled={uploads>0||!accountResolved} onClick={comparisonBase?openComparison:keepComparison}>{comparisonBase?'案を見比べる':'いまの案を残す'}<span aria-hidden="true">◫</span></button>
        <button className="se-wide-toggle" type="button" aria-pressed={widePreview} onClick={()=>setWidePreview(v=>!v)}>{widePreview?'編集に戻る':'大きく見る'}<span aria-hidden="true">{widePreview?'↙':'↗'}</span></button>
      </div>
      <div className="se-workspace flex-1 flex min-h-0">
        {/* 左: 節の一覧 */}
        <aside className="se-blocks w-60 bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0">
          <div className="se-block-heading"><span>ページの中身</span><span>{blocks.length}節</span></div><p className="se-block-hint">節を選んで編集。右のメニューで並べ替え。</p>
          <BlockList blocks={blocks} selectedId={selectedId} onChange={updateBlocks} onSelect={id=>{setCraftTab('content');setSelectedId(id);setPanel('block');setMobileTool('settings');}} />
          <AddBlock onAdd={type => {
            const id = `b-${Math.random().toString(36).slice(2, 9)}`;
            updateBlocks([...blocks, { id, type: type as Block['type'], data: defaultDataFor(type) }]);
            setSelectedId(id);
            setPanel('block');
            setMobileTool('settings');
          }} />
        </aside>

        {/* 中央: できあがりの見え方 */}
        <main className="se-canvas flex-1 min-w-0 p-4 overflow-hidden"><div className="se-canvas-hint"><span><i/>完成像を見ながら編集</span><span>写真・文字を押すと編集できます</span></div>
          <Preview html={previewHtml} device={device} selectedId={selectedId} selectedField={fieldFocus} onSelect={(id,kind) => {setCraftTab('content');setSheetExpanded(false);setWidePreview(false);const b=blocks.find(x=>x.id===id);if(!b)return;setSelectedId(id);setPanel('block');setMobileTool('settings');const fields=BLOCK_DEFS[b.type]?.fields||[];const f=fields.find(f=>kind==='image'?f.type==='image':kind==='button'?f.key==='ctaText':f.type==='multiline'||f.type==='text');setFieldFocus(f?.key||'');setFocusRequest(n=>n+1);}} />
        </main>

        {/* 右: 設定 */}
        <aside className="se-settings w-[340px] bg-white border-l border-slate-200 flex flex-col flex-shrink-0">
          <div className="sc-sheet-handle"><button type="button" onClick={()=>setSheetExpanded(v=>!v)} aria-label={sheetExpanded?"編集欄を小さくする":"編集欄を広げる"}>{sheetExpanded?<ChevronDown size={17}/>:<ChevronUp size={17}/>}<span>{panel==='block'&&selected?blockLabel(selected):panel==='design'?'サイト全体':'編集'}</span></button><button type="button" onClick={()=>setMobileTool('preview')}><Check size={16}/>完了</button></div>
          <div className="se-settings-tabs flex border-b border-slate-200 flex-shrink-0">
            {([['block', '選んだ場所'], ['design', 'サイト全体'], ['ready', '公開の準備']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setPanel(k)}
                className={`flex-1 py-2.5 text-[12px] font-bold ${panel === k ? 'text-sky-700 border-b-2 border-sky-600' : 'text-slate-400'}`}>
                {label}
              </button>
            ))}
          </div>
          <div ref={settingsPane} className="se-settings-body flex-1 overflow-y-auto p-4">
            {panel === 'block' && (
              selected && def ? (
                <>
                  <div className="mb-4">
                    <div className="text-sm font-bold text-slate-900">{def.label}</div>
                    <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{def.purpose}</div>
                  </div>
                  <div className="sc-tabs" role="group" aria-label="選んだ節の編集方法">{([['content','内容'],['appearance','見せ方'],['assistant','AIに相談']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={craftTab===value} onClick={()=>{setCraftTab(value);setFieldFocus('')}}>{label}</button>)}</div>
                  {craftTab==='appearance'&&<SectionCraft block={selected} globalMotion={site.settings.animLevel} globalLayout={site.settings.heroLayout} ink={site.settings.design?.ink||'#263248'} onChange={(key,value)=>updateBlockData(selected.id,key,value)}/>}
                  {craftTab==='assistant'&&<SectionAssistant key={selected.id} block={selected} siteId={siteId} onApply={adoptProposal}/>}
                  {craftTab==='content'&&def.fields.map(f => (
                    <div key={`${selected.id}:${f.key}`} data-field-key={f.key} className={fieldFocus===f.key?'se-focused-field':''}>{f.key==='heroVideo'&&<div className="se-motion-heading"><Film size={18}/><div><strong>写真に、空気の動きを。</strong><p>背景動画を重ねられます。写真は代替表示として残ります。</p></div></div>}<Field def={f}
                      value={(selected.data as Record<string, unknown>)[f.key]}
                      onChange={v => updateBlockData(selected.id, f.key, v)} /></div>
                  ))}
                </>
              ) : selected ? (
                <p className="text-sm text-slate-500 leading-relaxed">
                  この節（{selected.type}）は、いまの画面からは細かい設定を出していません。
                  <Link href={`/laruHP/builder?siteId=${siteId ?? ''}`} className="text-sky-700 underline ml-1">これまでの編集画面</Link>
                  で直せます。
                </p>
              ) : (
                <p className="text-sm text-slate-500">左の一覧か、真ん中のプレビューを押すと、その場所の設定が出ます。</p>
              )
            )}

            {panel === 'design' && (
              <DesignPanel
                site={site}
                setSite={setSite}
                setDesign={setDesign}
                adoptDesign={adoptDesign}
                seo={page?.seo || EMPTY_SEO}
                onSeo={next => setSite(prev => ({ ...prev, pages: prev.pages.map((p, i) => i === 0 ? { ...p, seo: next } : p) }))}
              />
            )}

            {panel === 'ready' && (
              <Ready
                items={readiness}
                siteId={siteId}
                published={!!publishedAt}
                savedSincePublish={savedSincePublish}
                saveState={saveState}
                publishing={publishing}
                note={publishNote}
                onPublish={publish}
              />
            )}
          </div>
        </aside>
      </div>
      <nav className="se-mobile-tools" aria-label="編集の操作">
        <button type="button" aria-pressed={mobileTool==='preview'} onClick={()=>setMobileTool('preview')}>完成像</button>
        <button type="button" aria-pressed={mobileTool==='blocks'} onClick={()=>setMobileTool('blocks')}>ページの中身</button>
        <button type="button" aria-pressed={mobileTool==='settings'&&panel==='block'} onClick={()=>{setPanel('block');setMobileTool('settings')}}>選んだ場所</button>
        <button type="button" aria-pressed={mobileTool==='settings'&&panel==='design'} onClick={()=>{setPanel('design');setMobileTool('settings')}}>色・書体</button>
      </nav>
      {comparison&&comparisonBase&&<CompareStudio {...comparison} device={device} onClose={()=>setComparison(null)} onRestore={()=>{if(uploads)return;setSite(structuredClone(comparisonBase));setComparison(null);setSelectedId(comparisonBase.pages[0]?.blocks[0]?.id??null);setHistoryNote('残した案に戻しました。取り消しで、直前の編集にも戻れます。');}} onReplace={()=>{keepComparison();setComparison(null);}}/>}
    </div></ImageUploadContext.Provider>
  );
}

/* ── 上の帯の保存表示 ── */
function SaveBadge({ state }: { state: SaveState }) {
  if (state.kind === 'saving') return <span className="text-xs font-bold text-slate-500">保存しています…</span>;
  if (state.kind === 'dirty') return <span className="text-xs font-bold text-amber-600">未保存の変更があります</span>;
  if (state.kind === 'failed') {
    return <span className="text-xs font-bold text-red-600 max-w-[300px] truncate" title={state.message}>保存できませんでした: {state.message}</span>;
  }
  return <span className="text-xs font-bold text-emerald-600">{state.at ? `${state.at.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} に保存` : '保存済み'}</span>;
}

/* ── 節を足す ── */
function AddBlock({ onAdd }: { onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-3">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="se-add-block"><Plus size={17}/>節を足す</button>
      {open && (
        <div className="mt-2 space-y-1">
          {Object.entries(BLOCK_DEFS).map(([type, d]) => (
            <button key={type} onClick={() => { onAdd(type); setOpen(false); }}
              className="se-add-option">
              <span className="se-add-option-title"><BlockIcon type={type}/>{d.label}</span>
              <span className="block text-[10px] text-slate-400 leading-tight">{d.purpose}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function defaultDataFor(type: string): Record<string, unknown> {
  const base: Record<string, Record<string, unknown>> = {
    hero: { heading: '', subheading: '', ctaText: 'お問い合わせ', ctaLink: '#contact', bgColor: '#ffffff', textColor: '#111111' },
    heading: { text: '見出し', subtext: '', align: 'center' },
    paragraph: { text: '', align: 'left' },
    image: { src: '', alt: '', height: 320 },
    gallery: { heading: '写真', images: [], columns: '2' },
    'price-table': { heading: 'メニューと料金', subtext: '', plans: [] },
    team: { heading: '担当する人', items: [] },
    faq: { heading: 'よくある質問', items: [] },
    hours: { heading: '営業時間', schedule: [], note: '' },
    booking: { mode: 'simple', heading: 'ご予約', subtext: '', serviceTypes: [], timeSlots: ['10:00', '11:00', '13:00'], buttonText: 'この内容で予約を申し込む', buttonColor: '#2563eb', bgColor: '#f8fafc', stickyCta: true, stickyCtaText: 'ご予約へ' },
    contact: { heading: 'お問い合わせ', subtext: '', fields: ['name', 'email', 'phone', 'message'], buttonText: '送信する', buttonColor: '#2563eb', bgColor: '#ffffff' },
    'two-col': { col1Title: '', col1Text: '', col2Title: '', col2Text: '' },
    map: { heading: '地図', embedUrl: '', height: 320 },
    cta: { heading: '', subtext: '', buttonText: '', buttonLink: '#contact', bgColor: '#111827' },
    tabs: { heading: '', items: [] },
    services: {heading:'商品・サービス',items:[]},
    testimonials: {heading:'お客様の声',items:[]},
    'three-col': {col1Title:'',col1Text:'',col2Title:'',col2Text:'',col3Title:'',col3Text:''},
  };
  return base[type] ?? {};
}


/** 色・文字・余白・形。「サイト全体の設定」を使っている作品にだけ出す */
function DesignFields({ d, setDesign }: { d: SiteDesign; setDesign: (patch: Partial<SiteDesign>) => void }) {
  const swatch = (key: keyof SiteDesign, label: string, hint?: string) => (
    <Row key={key} label={label} hint={hint}>
      <div className="flex gap-2 items-center">
        <input type="color" value={String(d[key])} onChange={e => setDesign({ [key]: e.target.value } as Partial<SiteDesign>)}
          className="w-9 h-9 rounded border border-slate-300 bg-transparent cursor-pointer" />
        <input className={inputCls} value={String(d[key])}
          onChange={e => setDesign({ [key]: e.target.value } as Partial<SiteDesign>)} />
      </div>
    </Row>
  );
  const slider = (key: keyof SiteDesign, label: string, min: number, max: number, stepv: number, unit = '') => (
    <Row key={key} label={`${label}（${d[key]}${unit}）`}>
      <input type="range" min={min} max={max} step={stepv} value={Number(d[key])}
        onChange={e => setDesign({ [key]: Number(e.target.value) } as Partial<SiteDesign>)}
        className="w-full accent-sky-600" />
    </Row>
  );

  return (
    <>
      <div className="text-[11px] font-bold text-slate-400 mt-5 mb-2">色</div>
      {swatch('ink', '文字の色')}
      {swatch('bg', '地の色')}
      {swatch('accent', '差し色', 'ボタンや強調に使います')}
      {swatch('surface', '薄い面の色', 'カードや帯の地色')}
      {swatch('line', '罫線の色')}

      <div className="text-[11px] font-bold text-slate-400 mt-5 mb-2">文字と余白</div>
      {slider('bodyScale', '本文の大きさ', 0.85, 1.25, 0.01)}
      {slider('bodyLeading', '行の高さ', 1.5, 2.3, 0.05)}
      {slider('bodyTracking', '本文の字間', 0, 0.12, 0.005, 'em')}
      {slider('headingScale', '見出しの大きさ', 0.8, 1.4, 0.05)}
      {slider('headingTracking', '見出しの字間', 0, 0.2, 0.01, 'em')}
      {slider('headingWeight', '見出しの太さ', 200, 900, 100)}
      {slider('readWidth', '一行の長さ', 24, 46, 1, '字')}
      <Row label="節と節のあいだ">
        <select className={inputCls} value={d.space}
          onChange={e => setDesign({ space: e.target.value as SiteDesign['space'] })}>
          <option value="tight">つめる</option>
          <option value="normal">ふつう</option>
          <option value="roomy">ひろめ</option>
          <option value="airy">とてもひろい</option>
        </select>
      </Row>

      <div className="text-[11px] font-bold text-slate-400 mt-5 mb-2">形</div>
      {slider('radius', '角の丸み', 0, 32, 1, 'px')}
      <Row label="ボタンの形">
        <select className={inputCls} value={d.buttonShape}
          onChange={e => setDesign({ buttonShape: e.target.value as SiteDesign['buttonShape'] })}>
          <option value="square">角のまま</option>
          <option value="soft">すこし丸い</option>
          <option value="pill">まるい</option>
        </select>
      </Row>
      <Row label="見出しの飾り線">
        <select className={inputCls} value={d.titleRule}
          onChange={e => setDesign({ titleRule: e.target.value as SiteDesign['titleRule'] })}>
          <option value="none">なし</option>
          <option value="short">短い線</option>
          <option value="underline">下線</option>
        </select>
      </Row>
      <Row label="写真の比率" hint="並べた写真の切り取り方">
        <select className={inputCls} value={d.photoRatio}
          onChange={e => setDesign({ photoRatio: e.target.value as SiteDesign['photoRatio'] })}>
          <option value="1:1">正方形</option>
          <option value="4:5">たて長（4:5）</option>
          <option value="3:4">たて長（3:4）</option>
          <option value="4:3">よこ長（4:3）</option>
          <option value="16:9">よこ長（16:9）</option>
        </select>
      </Row>

    </>
  );
}

/* ── サイト全体の設定 ── */
function DesignPanel({ site, setSite, setDesign, adoptDesign, seo, onSeo }: {
  site: StudioSite;
  setSite: React.Dispatch<React.SetStateAction<StudioSite>>;
  setDesign: (patch: Partial<SiteDesign>) => void;
  adoptDesign: (base: SiteDesign, presetId?: string) => void;
  seo: SEOSettings;
  onSeo: (next: SEOSettings) => void;
}) {
  const d = site.settings.design;
  return (
    <>
      <div className="mb-4">
        <div className="text-sm font-bold text-slate-900">サイト全体</div>
        <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
          ここで決めた色や余白が、すべての節に効きます。CSSを書く必要はありません。
        </div>
      </div>

      {!d && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <div className="text-[12px] font-bold text-amber-900 mb-1">この作品は、まだ「サイト全体」の設定を使っていません</div>
          <div className="text-[11px] text-amber-900/80 leading-relaxed mb-2">
            いまの見え方は、これまでの指定のままです。使いはじめると、色・余白・角の丸み・
            写真の切り取り方が下の設定で置き換わります。見え方が変わるので、
            変えたくなければ、このままで大丈夫です。
          </div>
          <div className="se-design-presets">
            {DESIGN_PRESETS.map(p => (
              <button key={p.id} type="button"
                onClick={() => adoptDesign(p.design, p.id)}
                className="text-left px-2 py-1.5 rounded-lg border border-amber-300 bg-white text-[12px] font-bold text-amber-900 hover:border-amber-500">
                {p.name}ではじめる
              </button>
            ))}
          </div>
        </div>
      )}

      {d && (
        <Row label="雰囲気を選び直す" hint="いまの文章と写真はそのまま、見た目だけ入れ替わります">
          <div className="se-design-presets">
            {DESIGN_PRESETS.map(p => (
              <button key={p.id} type="button"
                onClick={() => setSite(prev => ({
                  ...prev,
                  settings: { ...prev.settings, design: { ...p.design }, designStyle: p.designStyle, fontFamily: p.fontFamily, accentColor: p.design.accent, designPreset: p.id },
                }))}
                aria-pressed={site.settings.designPreset === p.id}
                className="se-design-preset">
                <span className="se-preset-art" aria-hidden="true" style={{background:p.design.bg,color:p.design.ink}}><span style={{fontFamily:p.fontFamily==='mincho'?'serif':'sans-serif'}}>あ</span><i style={{background:p.design.accent,borderRadius:p.design.radius}}/><em style={{background:p.design.ink}}/></span>
                <span>{p.name}<b aria-hidden="true">{site.settings.designPreset===p.id?'✓':'↗'}</b></span>
              </button>
            ))}
          </div>
        </Row>
      )}

      {d && <Row label="色の組み合わせ" hint="写真・文章・書体はそのまま。色だけ試せます。">
        <div className="se-palettes">{STUDIO_PALETTES.map(p=><button type="button" key={p.name} aria-label={p.name} aria-pressed={d.bg===p.bg&&d.ink===p.ink&&d.accent===p.accent&&d.surface===p.surface&&d.line===p.line&&d.onAccent===p.onAccent} onClick={()=>setSite(prev=>({...prev,settings:{...prev.settings,accentColor:p.accent,design:prev.settings.design?{...prev.settings.design,bg:p.bg,ink:p.ink,surface:p.surface,accent:p.accent,line:p.line,onAccent:p.onAccent}:null}}))}>
          <span aria-hidden="true">{[p.bg,p.surface,p.accent,p.ink].map(color=><i key={color} style={{background:color}}/>)}</span><b>{p.name}</b>
        </button>)}</div>
      </Row>}

      <Row label="書体">
        <select className={inputCls} value={site.settings.fontFamily}
          onChange={e => setSite(prev => ({ ...prev, settings: { ...prev.settings, fontFamily: e.target.value } }))}>
          {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </Row>

      {d && <DesignFields d={d} setDesign={setDesign} />}

      <div className="text-[11px] font-bold text-slate-400 mt-5 mb-2">写真の見せ方</div>
      <Row label="最初の画面の組み方">
        <select className={inputCls} value={site.settings.heroLayout}
          onChange={e => setSite(prev => ({ ...prev, settings: { ...prev.settings, heroLayout: e.target.value as StudioSettings['heroLayout'] } }))}>
          <option value="center">中央に文字</option>
          <option value="left">左に文字</option>
          <option value="split">左に文字・右に写真</option>
        </select>
      </Row>
      <Row label="動き" hint="読みづらいと感じたら「なし」にしてください">
        <select className={inputCls} value={site.settings.animLevel}
          onChange={e => setSite(prev => ({ ...prev, settings: { ...prev.settings, animLevel: e.target.value as StudioSettings['animLevel'] } }))}>
          <option value="none">なし</option>
          <option value="subtle">ひかえめ</option>
          <option value="full">しっかり</option>
        </select>
      </Row>

      <div className="text-[11px] font-bold text-slate-400 mt-5 mb-2">検索・連絡</div>
      <Row label="検索結果に出る説明文" hint="110文字くらいまで。何の店で、どこにあるかを書きます">
        <textarea className={`${inputCls} min-h-[72px]`} value={seo.description}
          onChange={e => onSeo({ ...seo, description: cleanIncomingText(e.target.value, 200) })} />
      </Row>
      <Row label="問い合わせの届け先（メール）">
        <input className={inputCls} type="email" value={site.settings.notifyEmail}
          onChange={e => setSite(prev => ({ ...prev, settings: { ...prev.settings, notifyEmail: e.target.value.trim() } }))} />
      </Row>
    </>
  );
}

/* ── 公開の準備 ── */
function Ready({ items, siteId, published, savedSincePublish, saveState, publishing, note, onPublish }: {
  items: ReadyItem[];
  siteId: string | null;
  published: boolean;
  savedSincePublish: boolean;
  saveState: SaveState;
  publishing: boolean;
  note: string;
  onPublish: () => void;
}) {
  /* 「直さないと困ること」と「直したほうが良いこと」を分ける。
     数の割合（4/7）は、重さの違う項目を同じ1として数えてしまうので出さない。 */
  const blocking = blockingItems(items);
  const must = items.filter(i => i.level === 'must');
  const better = items.filter(i => i.level === 'better');
  const row = (i: ReadyItem) => (
    <li key={i.id} className="flex gap-2">
      <span className={`mt-0.5 ${i.ok ? 'text-emerald-600' : i.level === 'must' ? 'text-rose-500' : 'text-amber-500'}`}>
        {i.ok ? '✓' : '!'}
      </span>
      <div>
        <div className="text-[13px] font-bold text-slate-800">{i.label}</div>
        <div className="text-[11px] text-slate-500 leading-relaxed">{i.detail}</div>
      </div>
    </li>
  );
  return (
    <>
      <div className="mb-4">
        <div className="text-sm font-bold text-slate-900">公開の準備</div>
        <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
          {blocking.length === 0
            ? '公開して困ることは見つかりませんでした。'
            : `このまま公開すると困ることが ${blocking.length} 件あります。`}
        </div>
      </div>

      <div className="text-[11px] font-bold text-slate-500 mb-1.5">直さないと、来た人に影響が出ること</div>
      <ul className="space-y-2 mb-4">{must.map(row)}</ul>

      <div className="text-[11px] font-bold text-slate-500 mb-1.5">直したほうが良いこと</div>
      <ul className="space-y-2 mb-5">{better.map(row)}</ul>

      <div className="border-t border-slate-200 pt-4">
        <div className="text-[12px] text-slate-600 mb-2 leading-relaxed">
          {!siteId && '最初に一度「保存」を押すと、公開できるようになります。'}
          {siteId && !published && 'まだ公開していません。'}
          {siteId && published && savedSincePublish && '公開したあとに直した内容があります。もう一度公開すると、その内容が出ます。'}
          {siteId && published && !savedSincePublish && '公開しています。いまの内容が出ています。'}
        </div>
        {saveState.kind === 'dirty' && (
          <div className="text-[12px] font-bold text-amber-700 mb-2">先に「保存」を押してください。公開されるのは、保存された内容です。</div>
        )}
        {saveState.kind === 'saving' && (
          <div className="text-[12px] font-bold text-slate-600 mb-2">保存しています。終わると公開できます。</div>
        )}
        {saveState.kind === 'failed' && (
          <div className="text-[12px] font-bold text-rose-700 mb-2">保存できていません。保存し直してから公開してください。</div>
        )}
        {blocking.length > 0 && (
          <div className="text-[12px] font-bold text-rose-700 mb-2 leading-relaxed">
            公開はできますが、上の赤い印の {blocking.length} 件は先に直すことをおすすめします。
          </div>
        )}
        <button onClick={onPublish} disabled={!siteId || publishing || saveState.kind !== 'clean'}
          className="w-full py-2.5 rounded-lg bg-sky-600 text-white text-sm font-bold disabled:opacity-40">
          {publishing ? '公開しています…' : published ? 'この内容で公開し直す' : '公開する'}
        </button>
        {note && <div className="text-[12px] mt-2 text-slate-700">{note}</div>}
        {siteId && (
          <Link href={`/laruHP/builder?siteId=${siteId}`}
            className="block text-center text-[11px] text-slate-400 hover:text-slate-700 mt-3 underline">
            これまでの編集画面を開く
          </Link>
        )}
      </div>
    </>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-slate-500">開いています…</div>}>
      <StudioInner />
    </Suspense>
  );
}
