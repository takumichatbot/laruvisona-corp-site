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
import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { readDesignChoice, saveDesignChoice, clearDesignChoice } from '@/lib/design-handoff';
import Link from 'next/link';
import { exportToHTML } from '@/lib/html-export';
import { getTemplateForIndustry, applyTemplateData } from '@/lib/templates';
import {
  DESIGN_PRESETS, DEFAULT_DESIGN, normalizeDesign, type SiteDesign,
} from '@/lib/site-design';
import {
  BLOCK_DEFS, blockIcon, blockLabel, blockSummary, orderForGoal,
  GOALS, INDUSTRY_CHOICES, type FieldDef, type IntakeAnswers,
} from '@/lib/studio-schema';
import { cleanIncomingText } from '@/lib/safe-markup';
import { checkPublishReadiness, blockingItems, type ReadyItem } from '@/lib/publish-readiness';
import { withPreviewBridge } from '@/lib/preview-frame';
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

function Preview({ html, device, selectedId, onSelect }: {
  html: string;
  device: 'pc' | 'sp';
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const scrollRef = useRef(0);
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
      const d = e.data as { source?: string; type?: string; id?: string; y?: number } | null;
      if (!d || d.source !== 'lhp-studio-preview') return;
      if (d.type === 'ready') { post({ type: 'scrollTo', y: scrollRef.current }); return; }
      if (d.type === 'scroll') { scrollRef.current = Number(d.y) || 0; return; }
      if (d.type === 'select') { onSelectRef.current(String(d.id || '')); return; }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post]);

  useEffect(() => { post({ type: 'select', id: selectedId || '' }); }, [selectedId, html, post]);

  const srcDoc = useMemo(() => withPreviewBridge(html), [html]);

  return (
    <div className={`mx-auto h-full ${device === 'sp' ? 'w-[390px]' : 'w-full max-w-[1440px]'}`}>
      <iframe
        ref={ref}
        title="できあがりの見え方"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className={`w-full h-full bg-white ${device === 'sp' ? 'rounded-[28px] border-[10px] border-slate-800 shadow-2xl' : 'rounded-lg border border-slate-300 shadow-sm'}`}
      />
    </div>
  );
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
        <Row label={def.label} hint={def.hint}>
          <div className="space-y-2">
            {arr.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input className={inputCls} value={String(v ?? '')}
                  onChange={e => onChange(arr.map((x, j) => j === i ? e.target.value : x))} />
                <button type="button" className="px-2 text-slate-400 hover:text-red-600"
                  onClick={() => onChange(arr.filter((_, j) => j !== i))}>削除</button>
              </div>
            ))}
            <button type="button" className="text-[12px] font-bold text-sky-700 hover:underline"
              onClick={() => onChange([...arr, ''])}>＋ 追加する</button>
          </div>
        </Row>
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
                  {i > 0 && <button type="button" className="text-slate-500 hover:text-slate-900"
                    onClick={() => { const a = [...arr]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); }}>上へ</button>}
                  {i < arr.length - 1 && <button type="button" className="text-slate-500 hover:text-slate-900"
                    onClick={() => { const a = [...arr]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; onChange(a); }}>下へ</button>}
                  <button type="button" className="text-red-600 hover:underline"
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
          <button type="button" className="text-[12px] font-bold text-sky-700 hover:underline"
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
  if (def.type === 'image') {
    return (
      <Row label={def.label} hint={def.hint || '写真のURL、または /salon/hero-1600.jpg のような置き場所'}>
        <div className="flex gap-2 items-start">
          {String(value || '') && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={String(value)} alt="" className="w-14 h-14 rounded object-cover border border-slate-200 bg-slate-100" />
          )}
          <input className={inputCls} value={String(value ?? '')} placeholder="https://…"
            onChange={e => onChange(e.target.value.trim())} />
        </div>
      </Row>
    );
  }
  return (
    <Row label={def.label} hint={def.hint}>
      <input className={inputCls} value={String(value ?? '')} placeholder={def.placeholder}
        onChange={e => onChange(cleanIncomingText(e.target.value, 400))} />
    </Row>
  );
}

/* ── 本体 ─────────────────────────────────────────────────────────────── */

/* 案内ページのデモで選んだ見せ方を、そのまま持ち越すための置き場。
   ログインを挟んでも消えないように sessionStorage に置く。
   個人情報は入らない（入るのは DESIGN_PRESETS の id だけ）。 */
const MOOD_KEY = 'laruhp.studio.mood';
/* 保存前の下書き。ログインが切れて入り直したときに、
   答えた4問と選んだ見せ方からやり直さずに済むようにする。 */
const DRAFT_KEY = 'laruhp.studio.draft';

interface StudioDraft { intake: IntakeAnswers; site: StudioSite; step: 'intake' | 'mood' | 'edit'; at: number }

function readDraft(): StudioDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as StudioDraft;
    // 1日以上前のものは、別の作業のなごりとみなして使わない
    if (!d?.site || !d?.intake || Date.now() - (d.at ?? 0) > 86400_000) return null;
    return d;
  } catch { return null; }
}

function StudioInner() {
  const params = useSearchParams();
  const siteIdParam = params.get('siteId');
  /* 案内ページのデモで選んだ見せ方（DESIGN_PRESETS の id）。
     URL から来たときは、それを控えておく。 */
  const moodParam = params.get('mood');
  const [moodFromLp] = useState<string | null>(() => {
    if (typeof window === 'undefined') return moodParam;
    if (moodParam) { try { window.sessionStorage.setItem(MOOD_KEY, moodParam); } catch { /* 使えなくても困らない */ } return moodParam; }
    try { return window.sessionStorage.getItem(MOOD_KEY); } catch { return null; }
  });

  /* 保存前の下書き（あれば）。siteId 付きで開いたときは、保存済みの内容が正。 */
  const [draft] = useState<StudioDraft | null>(() => (siteIdParam ? null : readDraft()));

  /* 会社トップで見せ方を選んでから来た場合、その選択を引き継ぐ。
     引き継ぐのは見せ方の名前だけ。既にあるサイトを開いたときは読まない
     （別のサイト・別のアカウントの設定が混ざらないようにするため）。 */
  const designParam = params.get('design') || '';
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
  const [step, setStep] = useState<'intake' | 'mood' | 'edit'>(
    siteIdParam ? 'edit' : (draft?.step ?? 'intake'),
  );
  const [loading, setLoading] = useState(!!siteIdParam);
  const [loadError, setLoadError] = useState('');

  const [intake, setIntake] = useState<IntakeAnswers>(() => draft?.intake ?? {
    industry: 'beauty', name: '', area: '', audience: '', goal: 'booking', description: '',
  });

  const [site, setSite] = useState<StudioSite>(() => draft?.site ?? ({
    name: '', pages: [], settings: {
      colorScheme: 'professional-blue', designStyle: 'modern', fontFamily: 'noto',
      accentColor: '#2563eb', heroLayout: 'center', headerStyle: 'solid', animLevel: 'subtle',
      larubot: false, laruseo: false, notifyEmail: '', customCss: '',
      design: { ...DEFAULT_DESIGN }, designPreset: '',
    },
  }));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<'pc' | 'sp'>('pc');
  const [panel, setPanel] = useState<'block' | 'design' | 'ready'>('block');
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'clean', at: null });
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [savedSincePublish, setSavedSincePublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishNote, setPublishNote] = useState('');
  /* 保存できない理由のうち、利用者の側で手当てが要るもの。
     いずれも下書きは端末に残してあるので、済ませて戻れば続きから直せる。
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
  // 読み込みで入れ替えた分は「編集」ではない。
  // ここを時間差（setTimeout）で打ち消すと、順番によって未保存のまま残る。
  const hydrating = useRef(true);

  useEffect(() => {
    if (hydrating.current) { hydrating.current = false; return; }
    editSeq.current += 1;
    setSaveState(prev => (prev.kind === 'saving' ? prev : { kind: 'dirty' }));
  }, [site]);

  /* まだ一度も保存していないあいだ、下書きをこの端末に控える。
     ログインが切れて入り直したときに、答えた4問と組み上がった中身が消えないようにする。
     一度保存できたら（siteId が付いたら）サーバ側が正なので、控えは捨てる。 */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (siteId) { window.sessionStorage.removeItem(DRAFT_KEY); return; }
      if (step === 'intake' && site.pages.length === 0 && !intake.name.trim()) return;
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ intake, site, step, at: Date.now() }));
    } catch { /* 使えなくても、保存そのものは動く */ }
  }, [siteId, site, intake, step]);

  /* 未保存のまま閉じようとしたら、ブラウザに確認させる。
     「保存した」と誤解したまま閉じて消える、を防ぐ。 */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStateRef.current.kind !== 'dirty') return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  /* ── 読み込み ── */
  useEffect(() => {
    if (!siteIdParam) return;
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
        setSite({
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
        /* 中身がまだ何も無いサイト（一覧から「新しいサイト」で作った直後）は、
           空の編集画面ではなく4つの質問から始める。答えたあとは、この
           サイトにそのまま書き込む（新しいサイトは作らない）。 */
        if (!pages.some(pg => (pg.blocks ?? []).length > 0)) {
          setIntake(prev => ({ ...prev, name: s.name && s.name !== '新しいサイト' ? s.name : prev.name }));
          setStep('intake');
        }
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : '読み込みに失敗しました');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [siteIdParam]);

  const page = site.pages[0];
  const blocks = useMemo(() => page?.blocks ?? [], [page]);

  const updateBlocks = useCallback((next: Block[]) => {
    setSite(prev => ({ ...prev, pages: prev.pages.map((p, i) => i === 0 ? { ...p, blocks: next } : p) }));
  }, []);

  const updateBlockData = useCallback((id: string, key: string, value: unknown) => {
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map((p, i) => i === 0
        ? { ...p, blocks: p.blocks.map(b => b.id === id ? { ...b, data: { ...b.data, [key]: value } } : b) }
        : p),
    }));
  }, []);

  const setDesign = useCallback((patch: Partial<SiteDesign>) => {
    setSite(prev => prev.settings.design
      ? { ...prev, settings: { ...prev.settings, design: { ...prev.settings.design, ...patch } } }
      : prev);   // 使いはじめる前は、触っても何も入れない
  }, []);

  /** 「サイト全体の設定」を使いはじめる。ここで初めて design が入る */
  const adoptDesign = useCallback((base: SiteDesign, presetId = '') => {
    setSite(prev => ({
      ...prev,
      settings: { ...prev.settings, design: { ...base }, accentColor: base.accent, designPreset: presetId },
    }));
  }, []);

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

  /* ── 保存 ── */
  const save = useCallback(async () => {
    const s = siteRef.current;
    const seq = editSeq.current;
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
            ? 'ログインが切れています。作った中身は残してあります。入り直すと、続きから直せます'
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
            ? 'ログインするとサイトを保存できます。いま作った中身は残してあります'
            : (b.error as string) || `保存できませんでした (${res.status})`);
        }
        const { site: created } = await res.json();
        id = created?.id ?? null;
        setSiteId(id);
      }
      setBlocked(null);
      setSavedSincePublish(true);
      // 送っているあいだに続きを編集していたら、保存済みにはしない
      setSaveState(editSeq.current === seq ? { kind: 'clean', at: new Date() } : { kind: 'dirty' });
    } catch (e) {
      setSaveState({ kind: 'failed', message: e instanceof Error ? e.message : '保存できませんでした' });
    }
  }, [siteId, intake.industry]);

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
    // 使ったら持ち越さない
    clearDesignChoice();
    const preset = DESIGN_PRESETS.find(p => p.id === presetId) || DESIGN_PRESETS[0];
    const template = getTemplateForIndustry(intake.industry);
    let made: Block[] = template
      ? applyTemplateData(template, {
        name: intake.name || '店名', address: intake.area,
        description: intake.description, catchphrase: '', phone: '',
        services: [], hours: [],
      })
      : [];
    if (!made.length) {
      made = [
        { id: 'b-hero', type: 'hero', data: { heading: intake.name || '店名', subheading: intake.area, ctaText: 'お問い合わせ', ctaLink: '#contact' } },
        { id: 'b-text', type: 'paragraph', data: { text: intake.description, align: 'left' } },
        { id: 'b-contact', type: 'contact', data: { heading: 'お問い合わせ', subtext: '', fields: ['name', 'email', 'phone', 'message'], buttonText: '送信する' } },
      ];
    }
    made = orderForGoal(made, intake.goal);
    const seo: SEOSettings = {
      ...EMPTY_SEO,
      title: `${intake.name || '店名'}${intake.area ? ` | ${intake.area}` : ''}`,
      description: intake.description.slice(0, 110),
    };
    setSite({
      name: intake.name || '無題のサイト',
      pages: [{ id: 'page-main', name: 'トップページ', path: '/', blocks: made, seo }],
      settings: {
        colorScheme: 'professional-blue',
        designStyle: preset.designStyle,
        fontFamily: preset.fontFamily,
        accentColor: preset.design.accent,
        heroLayout: 'split', headerStyle: 'solid', animLevel: 'subtle',
        larubot: false, laruseo: false, notifyEmail: '', customCss: '',
        design: { ...preset.design }, designPreset: preset.id,
      },
    });
    setSelectedId(made[0]?.id ?? null);
    setStep('edit');
  }, [intake]);

  /* ── 公開準備の確認 ──
     判定は lib/publish-readiness.ts に寄せてある。編集画面（ビルダー）と
     同じ関数を呼ぶので、どちらで開いても「準備できている」の意味が変わらない。 */
  const readiness = useMemo<ReadyItem[]>(() => checkPublishReadiness({
    name: site.name,
    pages: site.pages,
    notifyEmail: site.settings.notifyEmail,
  }), [site.name, site.pages, site.settings.notifyEmail]);

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

  if (step === 'intake') return <Intake intake={intake} setIntake={setIntake} onNext={() => setStep('mood')} />;
  if (step === 'mood') return <Mood intake={intake} onBack={() => setStep('intake')} onPick={buildFromIntake} fromLp={moodFromLp || handoff} />;

  const selected = blocks.find(b => b.id === selectedId) || null;
  const def = selected ? BLOCK_DEFS[selected.type] : null;

  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* 上の帯 */}
      <header className="flex items-center gap-3 px-4 h-14 bg-white border-b border-slate-200 flex-shrink-0">
        <Link href="/laruHP/dashboard" className="text-sm font-bold text-slate-500 hover:text-slate-900">← 一覧</Link>
        <input
          className="font-bold text-slate-900 border border-transparent hover:border-slate-300 focus:border-sky-400 rounded px-2 py-1 text-sm w-56 focus:outline-none"
          value={site.name} placeholder="店名"
          onChange={e => setSite(prev => ({ ...prev, name: cleanIncomingText(e.target.value, 120) }))}
        />
        <div className="flex bg-slate-100 rounded-lg p-0.5 ml-2">
          {(['pc', 'sp'] as const).map(k => (
            <button key={k} onClick={() => setDevice(k)}
              className={`px-3 py-1 rounded-md text-xs font-bold ${device === k ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
              {k === 'pc' ? 'パソコン' : 'スマホ'}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <SaveBadge state={saveState} />
          <button onClick={reload} disabled={!siteId || saveState.kind === 'saving'}
            className="text-xs font-bold text-slate-500 hover:text-slate-900 disabled:opacity-30">読み直す</button>
          <button onClick={save} disabled={saveState.kind === 'saving'}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-50">
            {saveState.kind === 'saving' ? '保存中…' : '保存'}
          </button>
          <button onClick={() => setPanel('ready')}
            className="px-4 py-1.5 rounded-lg bg-sky-600 text-white text-sm font-bold">公開の準備</button>
        </div>
      </header>

      {blocked && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[13px] font-bold text-amber-900">
            {blocked.kind === 'login'
              ? '保存するにはログインが必要です。いま作った中身は、この端末に残してあります。'
              : (blocked.message || '保存するには契約が必要です。') + ' いま作った中身は、この端末に残してあります。'}
          </span>
          <a
            href={blocked.kind === 'login'
              ? `/laruHP/auth/login?redirectTo=${encodeURIComponent('/laruHP/studio')}`
              : '/laruHP/plans'}
            className="text-[13px] font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-md px-3 py-1">
            {blocked.kind === 'login' ? 'ログインして戻る' : '料金を見る'}
          </a>
          <span className="text-[11px] text-amber-800">
            戻ってきたら、もう一度「保存」を押してください。続きから直せます。
          </span>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* 左: 節の一覧 */}
        <aside className="w-60 bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0">
          <div className="px-3 py-2 text-[11px] font-bold text-slate-400">ページの中身</div>
          {blocks.map((b, i) => (
            <div key={b.id}
              className={`group px-3 py-2 border-l-4 cursor-pointer ${selectedId === b.id ? 'border-sky-500 bg-sky-50' : 'border-transparent hover:bg-slate-50'}`}
              onClick={() => { setSelectedId(b.id); setPanel('block'); }}>
              <div className="flex items-center gap-2">
                <span>{blockIcon(b)}</span>
                <span className="text-[13px] font-bold text-slate-800 flex-1 truncate">{blockLabel(b)}</span>
                <span className="opacity-0 group-hover:opacity-100 flex gap-1 text-[10px] text-slate-400">
                  {i > 0 && <button onClick={e => { e.stopPropagation(); const a = [...blocks]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; updateBlocks(a); }}>▲</button>}
                  {i < blocks.length - 1 && <button onClick={e => { e.stopPropagation(); const a = [...blocks]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; updateBlocks(a); }}>▼</button>}
                  <button onClick={e => { e.stopPropagation(); if (confirm(`「${blockLabel(b)}」を消しますか`)) updateBlocks(blocks.filter(x => x.id !== b.id)); }}>✕</button>
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate pl-6">{blockSummary(b)}</div>
            </div>
          ))}
          <AddBlock onAdd={type => {
            const id = `b-${Math.random().toString(36).slice(2, 9)}`;
            updateBlocks([...blocks, { id, type: type as Block['type'], data: defaultDataFor(type) }]);
            setSelectedId(id);
            setPanel('block');
          }} />
        </aside>

        {/* 中央: できあがりの見え方 */}
        <main className="flex-1 min-w-0 p-4 overflow-hidden">
          <Preview html={previewHtml} device={device} selectedId={selectedId} onSelect={id => { setSelectedId(id); setPanel('block'); }} />
        </main>

        {/* 右: 設定 */}
        <aside className="w-[340px] bg-white border-l border-slate-200 flex flex-col flex-shrink-0">
          <div className="flex border-b border-slate-200 flex-shrink-0">
            {([['block', '選んだ場所'], ['design', 'サイト全体'], ['ready', '公開の準備']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setPanel(k)}
                className={`flex-1 py-2.5 text-[12px] font-bold ${panel === k ? 'text-sky-700 border-b-2 border-sky-600' : 'text-slate-400'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {panel === 'block' && (
              selected && def ? (
                <>
                  <div className="mb-4">
                    <div className="text-sm font-bold text-slate-900">{def.label}</div>
                    <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{def.purpose}</div>
                  </div>
                  {def.fields.map(f => (
                    <Field key={f.key} def={f}
                      value={(selected.data as Record<string, unknown>)[f.key]}
                      onChange={v => updateBlockData(selected.id, f.key, v)} />
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
    </div>
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
      <button onClick={() => setOpen(v => !v)}
        className="w-full py-2 rounded-lg border border-dashed border-slate-300 text-[12px] font-bold text-slate-500 hover:border-sky-400 hover:text-sky-700">
        ＋ 節を足す
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {Object.entries(BLOCK_DEFS).map(([type, d]) => (
            <button key={type} onClick={() => { onAdd(type); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100">
              <span className="text-[13px] font-bold text-slate-700">{d.icon} {d.label}</span>
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
          <div className="grid grid-cols-2 gap-1.5">
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
          <div className="grid grid-cols-2 gap-1.5">
            {DESIGN_PRESETS.map(p => (
              <button key={p.id} type="button"
                onClick={() => setSite(prev => ({
                  ...prev,
                  settings: { ...prev.settings, design: { ...p.design }, designStyle: p.designStyle, fontFamily: p.fontFamily, accentColor: p.design.accent, designPreset: p.id },
                }))}
                className={`text-left px-2 py-1.5 rounded-lg border text-[12px] font-bold ${site.settings.designPreset === p.id ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                {p.name}
              </button>
            ))}
          </div>
        </Row>
      )}

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

/* ── ステップ1: きく ── */
function Intake({ intake, setIntake, onNext }: {
  intake: IntakeAnswers;
  setIntake: React.Dispatch<React.SetStateAction<IntakeAnswers>>;
  onNext: () => void;
}) {
  const ready = intake.name.trim().length > 0;
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-5">
      <div className="max-w-xl mx-auto">
        <div className="text-[11px] font-bold text-sky-700 mb-2">1 / 3　きく</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">お店のことを、少しだけ教えてください</h1>
        <p className="text-sm text-slate-500 mb-8 leading-relaxed">
          この4つだけで、たたき台を作ります。あとから全部直せます。
        </p>

        <Row label="何のお店ですか">
          <select className={inputCls} value={intake.industry}
            onChange={e => setIntake(v => ({ ...v, industry: e.target.value }))}>
            {INDUSTRY_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Row>
        <Row label="店名・屋号">
          <input className={inputCls} value={intake.name} placeholder="結い庵"
            onChange={e => setIntake(v => ({ ...v, name: cleanIncomingText(e.target.value, 120) }))} />
        </Row>
        <Row label="どこにありますか" hint="市区町村や、最寄り駅まででかまいません">
          <input className={inputCls} value={intake.area} placeholder="東京都国立市"
            onChange={e => setIntake(v => ({ ...v, area: cleanIncomingText(e.target.value, 120) }))} />
        </Row>
        <Row label="どんな人に来てほしいですか" hint="サイトの言葉づかいを決めるのに使います">
          <input className={inputCls} value={intake.audience} placeholder="髪のくせで朝に困っている人"
            onChange={e => setIntake(v => ({ ...v, audience: cleanIncomingText(e.target.value, 200) }))} />
        </Row>

        <div className="mb-5">
          <div className="text-[13px] font-bold text-slate-700 mb-2">来た人に、まずしてほしいことは</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {GOALS.map(g => (
              <button key={g.value} type="button" onClick={() => setIntake(v => ({ ...v, goal: g.value }))}
                className={`text-left px-3 py-2.5 rounded-xl border-2 ${intake.goal === g.value ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <div className="text-[13px] font-bold text-slate-800">{g.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{g.note}</div>
              </button>
            ))}
          </div>
        </div>

        <Row label="お店のことを、ひとことで" hint="うまく書けなくて大丈夫です。あとで直せます">
          <textarea className={`${inputCls} min-h-[90px]`} value={intake.description}
            placeholder="朝、自分で乾かしてまとまる髪を目指す、予約制の美容室です。"
            onChange={e => setIntake(v => ({ ...v, description: cleanIncomingText(e.target.value, 600) }))} />
        </Row>

        <button onClick={onNext} disabled={!ready}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-30">
          雰囲気を選ぶ →
        </button>
        {!ready && <p className="text-[11px] text-slate-400 mt-2 text-center">店名だけ入れてください</p>}
      </div>
    </div>
  );
}

/* ── ステップ2: えらぶ ──
   見本は静止画ではなく、実際の公開用HTMLをその場で作って表示している。
   選んだあとに「思っていたのと違う」が起きないようにするため。 */
/** 入れ物の幅に合わせて縮める枠。見本ごとに幅が違っても切れない */
function ScaledFrame({ html, width, height, title }: { html: string; width: number; height: number; title: string }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const apply = () => setW(el.clientWidth);
    apply();
    if (typeof ResizeObserver !== 'function') {
      window.addEventListener('resize', apply);
      return () => window.removeEventListener('resize', apply);
    }
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = w > 0 ? w / width : 0.35;
  return (
    <div ref={boxRef} className="relative w-full overflow-hidden bg-white" style={{ height: Math.round(height * scale) }}>
      <iframe title={title} sandbox="allow-scripts" srcDoc={withPreviewBridge(html)}
        className="absolute top-0 left-0 border-0"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }} />
    </div>
  );
}

/* 見本に使う写真。
   雰囲気の違いは「色と余白と形」で出る。写真が無いと、どれも白い紙に
   文字が載っただけの絵になり、見分けがつかない。実際に配信している
   写真を入れて、切り取り方（写真の比率）の違いまで見えるようにする。
   写真は見本で、その店のものではない。画面にもそう書く。 */
const SAMPLE_PHOTOS = {
  hero: '/salon/hero-1200.jpg',
  heroW: 1200, heroH: 896,
};

function Mood({ intake, onBack, onPick, fromLp }: {
  intake: IntakeAnswers;
  onBack: () => void;
  onPick: (presetId: string) => void;
  /** 案内ページのデモで選んだ見せ方（DESIGN_PRESETS の id）。無ければ null */
  fromLp?: string | null;
}) {
  const samples = useMemo(() => DESIGN_PRESETS.map(p => {
    const name = intake.name || '店名';
    const seo = { ...EMPTY_SEO, title: name };
    const blocks: Block[] = [
      {
        id: 's-hero', type: 'hero',
        data: {
          heading: name,
          subheading: intake.area ? `${intake.area}の${INDUSTRY_WORD[intake.industry] || 'お店'}` : 'まちの名前',
          ctaText: 'ご予約へ', ctaLink: '#',
          bgColor: p.design.bg, textColor: p.design.ink,
          bgImage: SAMPLE_PHOTOS.hero, bgImageWidth: SAMPLE_PHOTOS.heroW, bgImageHeight: SAMPLE_PHOTOS.heroH,
          bgImageAlt: '',
        },
      },
      { id: 's-lead', type: 'heading', data: { text: '当店について', subtext: '', align: 'center' } },
      {
        id: 's-price', type: 'price-table',
        data: {
          heading: 'メニューと料金', subtext: '表示は税込です',
          plans: [
            { name: '基本のメニュー', price: '6,600', period: '円', description: 'ご相談を含みます', features: ['ていねいに伺います'], highlighted: false, buttonText: '予約する', buttonLink: '#' },
            { name: 'おすすめ', price: '13,200', period: '円〜', description: '状態に合わせて調整します', features: ['ご相談だけでも大丈夫です'], highlighted: true, buttonText: '予約する', buttonLink: '#' },
          ],
        },
      },
    ];
    const html = exportToHTML(
      [{ id: 'p', name: 'p', path: '/', blocks, seo }],
      seo,
      {
        colorScheme: 'professional-blue', style: 'clean', designStyle: p.designStyle, fontFamily: p.fontFamily,
        accentColor: p.design.accent, heroLayout: 'split', headerStyle: 'solid', animLevel: 'none',
        larubot: false, laruseo: false, design: p.design as unknown as Record<string, unknown>,
      } as never,
      name,
    );
    return { preset: p, html };
  }), [intake]);

  /* 案内ページで選んだものがあれば、先頭に出す。
     選び直しは妨げない（並び順を変えるだけで、5つとも出したまま）。 */
  const ordered = useMemo(() => {
    if (!fromLp) return samples;
    const hit = samples.find(s => s.preset.id === fromLp);
    if (!hit) return samples;
    return [hit, ...samples.filter(s => s !== hit)];
  }, [samples, fromLp]);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-5">
      <div className="max-w-6xl mx-auto">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 mb-4">← 戻る</button>
        <div className="text-[11px] font-bold text-sky-700 mb-2">2 / 3　えらぶ</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">どの雰囲気が近いですか</h1>
        <p className="text-sm text-slate-500 mb-1">
          出来上がる見た目そのものです。文章と写真はあとから入れ替えます。あとから何度でも変えられます。
        </p>
        <p className="text-[11px] text-slate-400 mb-6">写真は見本です。お店の写真は、このあと入れ替えられます。</p>
        {fromLp && samples.some(s => s.preset.id === fromLp) && (
          <p className="text-[12px] text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 mb-5 leading-relaxed">
            案内の画面で選んだ「{samples.find(s => s.preset.id === fromLp)!.preset.name}」を、いちばん上に出しています。
            ここで選び直しても構いません。
          </p>
        )}

        {chosen && (
          <p className="mb-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900">
            会社トップで選んだ「{DESIGN_PRESETS.find(p => p.id === chosen)?.name}」を先頭に出しています。ここで選び直せます。
          </p>
        )}
        <div className="grid md:grid-cols-2 gap-5">
          {ordered.map(({ preset, html }) => (
            <button key={preset.id} onClick={() => onPick(preset.id)}
              className={`text-left bg-white rounded-2xl border-2 overflow-hidden transition-colors ${
                preset.id === fromLp ? 'border-sky-500' : 'border-slate-200 hover:border-sky-500'}`}>
              <div className="pointer-events-none">
                <ScaledFrame html={html} width={1280} height={1330} title={`${preset.name}の見本`} />
              </div>
              <div className="p-4 border-t border-slate-100">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[15px] font-bold text-slate-900">{preset.name}</span>
                  {preset.id === fromLp && (
                    <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5">案内で選んだもの</span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    {[preset.design.bg, preset.design.accent, preset.design.ink].map((c, k) => (
                      <span key={k} className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ background: c }} />
                    ))}
                  </span>
                </div>
                <div className="text-[12px] text-slate-500 leading-relaxed">{preset.note}</div>
                <div className="text-[11px] text-slate-400 mt-1.5">
                  {DESCRIBE.space[preset.design.space]}・{DESCRIBE.shape[preset.design.buttonShape]}・{DESCRIBE.photo[preset.design.photoRatio]}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 見本の下に出す、違いの言葉。数字ではなく、選ぶ理由になる言い方にする */
const DESCRIBE = {
  space: { tight: '余白はつめ', normal: '余白はふつう', roomy: '余白はひろめ', airy: '余白はとてもひろい' } as Record<string, string>,
  shape: { square: '角のままのボタン', soft: 'すこし丸いボタン', pill: 'まるいボタン' } as Record<string, string>,
  photo: { '1:1': '写真は正方形', '4:5': '写真はたて長', '3:4': '写真はたて長', '4:3': '写真はよこ長', '16:9': '写真はよこ長' } as Record<string, string>,
};

/** 業種を、見本の説明に出す言葉にする */
const INDUSTRY_WORD: Record<string, string> = {
  beauty: '美容室', restaurant: '飲食店', clinic: 'クリニック', school: '教室',
  retail: 'お店', service: 'サービス', other: 'お店',
};

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-slate-500">開いています…</div>}>
      <StudioInner />
    </Suspense>
  );
}
