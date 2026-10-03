'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Wand2, ImageIcon, ClipboardCheck, LoaderCircle } from 'lucide-react';
import type { Page, SEOSettings, SiteSettings } from '@/types/laruHP';
import type { ReadyItem } from '@/lib/publish-readiness';
import { blockName, type DesignChangePlan, type PlanSettingsLike } from '@/lib/design-change';
import { planFromWords, readIntents, wantsSection, type IntentId } from '@/lib/design-words';
import { planFromReference, referenceStats, statsKey, type ReferenceStats } from '@/lib/reference-style';
import { directorChecks, findingsFromReview, reviewSummary, type Finding } from '@/lib/design-director';
import PlanReview from './PlanReview';
import './design-assistant.css';

type Site = { pages: Page[]; settings: PlanSettingsLike & { businessInfo?: Record<string, unknown> } };
type Tool = 'words' | 'reference' | 'director';
type Availability = { available: boolean; reason?: 'login' | 'contract' | 'not-ready' } | null;

export type DesignAssistantProps = {
  site: Site;
  toExport: (settings: PlanSettingsLike) => SiteSettings;
  name: string;
  seo: SEOSettings;
  selectedId: string | null;
  readiness: ReadyItem[];
  businessPhone?: string;
  disabled: boolean;
  /** 採用（1回の setSite）。当てられなければ false */
  onAdopt: (plan: DesignChangePlan) => boolean;
  onOpen: (blockId: string, field?: string) => void;
  onReady: () => void;
  /** 開いておく道具（公開の準備から「見た目も見直す」で来たとき） */
  initialTool?: Tool;
};

const EXAMPLES = ['もう少し落ち着いた印象に', '余白を増やす', '写真を大きく見せる', '見出しを少し強く', '動きを控えめに', '高級感を出す'];
/* 同じ画像・同じ指示・同じ状態では、計算し直さない・AIを呼び直さない（画面を開いている間） */
const statsCache = new Map<string, ReferenceStats>();
const intentCache = new Map<string, IntentId[]>();
const reviewCache = new Map<string, string[]>();
const MAX_FILE = 15 * 1024 * 1024;

async function readPixels(file: File): Promise<{ px: Uint8ClampedArray; w: number; h: number }> {
  let src: CanvasImageSource & { width: number; height: number };
  let cleanup = () => {};
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file);
    src = bmp;
    cleanup = () => bmp.close();
  } else {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    src = img;
    cleanup = () => URL.revokeObjectURL(url);
  }
  try {
    const scale = Math.min(1, 160 / Math.max(src.width, src.height));
    const w = Math.max(8, Math.round(src.width * scale)), h = Math.max(8, Math.round(src.height * scale));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw Error('no canvas');
    ctx.drawImage(src, 0, 0, w, h);
    return { px: ctx.getImageData(0, 0, w, h).data, w, h };
  } finally {
    cleanup();
  }
}

export default function DesignAssistant(props: DesignAssistantProps) {
  const { site, selectedId, disabled } = props;
  const [tool, setTool] = useState<Tool>(props.initialTool ?? 'words');
  const [plan, setPlan] = useState<DesignChangePlan | null>(null);
  const [access, setAccess] = useState<Availability>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/ai/design-intent', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setAccess(d && typeof d.available === 'boolean' ? d : { available: false, reason: 'not-ready' }); })
      .catch(() => { if (alive) setAccess({ available: false, reason: 'not-ready' }); });
    return () => { alive = false; };
  }, []);
  const top = site.pages[0]?.blocks ?? [];
  const selected = selectedId ? top.find((b) => b.id === selectedId) : undefined;
  const selectedLabel = selected ? blockName(top, selected) : '';
  return (
    <section className="da-box" aria-label="見た目を相談して直す" data-design-assistant>
      <span className="de-eyebrow">文章と写真はそのまま、見た目の設定だけ</span>
      <h3>見た目を、言葉や参考から整える。</h3>
      <div className="sc-tabs da-tabs" role="group" aria-label="直し方">
        {([['words', '言葉で直す', Wand2], ['reference', '参考画像から', ImageIcon], ['director', '公開前の見直し', ClipboardCheck]] as const).map(([k, label, Icon]) => (
          <button type="button" key={k} aria-pressed={tool === k} onClick={() => setTool(k)} data-da-tool={k}>
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      {tool === 'words' && <WordsTool {...props} selectedLabel={selectedLabel} hasSelected={!!selected} access={access} onPlan={setPlan} />}
      {tool === 'reference' && <ReferenceTool {...props} onPlan={setPlan} />}
      {tool === 'director' && <DirectorTool {...props} access={access} onPlan={setPlan} />}
      {plan && (
        <PlanReview
          site={site}
          toExport={props.toExport}
          name={props.name}
          seo={props.seo}
          plan={plan}
          disabled={disabled}
          onAdopt={props.onAdopt}
          onClose={() => setPlan(null)}
        />
      )}
    </section>
  );
}

function WordsTool({ site, selectedId, selectedLabel, hasSelected, access, onPlan }: DesignAssistantProps & {
  selectedLabel: string;
  hasSelected: boolean;
  access: Availability;
  onPlan: (p: DesignChangePlan) => void;
}) {
  const [text, setText] = useState('');
  const [scope, setScope] = useState<'auto' | 'site' | 'section'>('auto');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // 範囲を選んでいなければ、「この節」と書いたときだけ選んでいる節（範囲は案の確認画面にも出す）
  const effective: 'site' | 'section' = !hasSelected ? 'site' : scope === 'auto' ? (wantsSection(text) ? 'section' : 'site') : scope;
  const make = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setNote('');
    let p = planFromWords(site, t, { selectedId, scope: effective });
    // 決まった言い回しで読めないときだけ、AIに「どの意図か」を選んでもらう（1回の操作で1回まで）
    if (!readIntents(t).length && access?.available) {
      let intents = intentCache.get(t);
      if (!intents) {
        setBusy(true);
        try {
          const res = await fetch('/api/ai/design-intent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: t }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) { setNote(data.error || 'AIで読み取れませんでした。例のような言い方で書くと読み取れます。'); return; }
          intents = Array.isArray(data.intents) ? (data.intents as IntentId[]) : [];
          intentCache.set(t, intents);
        } catch {
          setNote('AIで読み取れませんでした。例のような言い方で書くと読み取れます。');
          return;
        } finally {
          setBusy(false);
        }
      }
      if (intents.length) p = planFromWords(site, t, { selectedId, scope: effective, intents });
    }
    if (!p.ops.length) { setNote(p.note || '変えるものが見つかりませんでした。'); return; }
    onPlan(p);
  };
  return (
    <div className="da-tool" data-da-words>
      <p>「もう少し落ち着いた印象に」のように書くと、今の設定から一段だけ動かす案を1つ作ります。文章・料金・連絡先は変えません。</p>
      <label className="da-label">
        どう変えたいですか
        <textarea maxLength={200} value={text} onChange={(e) => { setText(e.target.value); setNote(''); }} placeholder="例：もう少し落ち着いた印象に" data-da-text />
      </label>
      <div className="sc-prompts">
        {EXAMPLES.map((t) => <button type="button" key={t} onClick={() => { setText(t); setNote(''); }}>{t}</button>)}
      </div>
      <fieldset className="da-scope">
        <legend>変える範囲</legend>
        <label><input type="radio" name="da-scope" checked={effective === 'site'} onChange={() => setScope('site')} /> サイト全体</label>
        <label className={hasSelected ? '' : 'da-off'}>
          <input type="radio" name="da-scope" disabled={!hasSelected} checked={effective === 'section'} onChange={() => setScope('section')} data-da-scope-section />
          {hasSelected ? `選んだ節だけ（${selectedLabel}）` : '選んだ節だけ（完成像か「ページの中身」で節を選ぶと使えます）'}
        </label>
      </fieldset>
      <button type="button" className="sc-propose" disabled={!text.trim() || busy} onClick={make} data-da-make>
        {busy ? <LoaderCircle size={16} className="se-spin" /> : <Wand2 size={16} />} {busy ? '読み取っています…' : '変更案を見る'}
      </button>
      {note && <p className="da-note" role="status" data-da-note>{note}</p>}
      <small>決まった言い回しで読めないときだけ{access?.available ? '、AIで読み取ります（1回）' : '、例のように書き直してください（AIはご契約中に使えます）'}。</small>
    </div>
  );
}

function ReferenceTool({ site, onPlan }: DesignAssistantProps & { onPlan: (p: DesignChangePlan) => void }) {
  const [stats, setStats] = useState<ReferenceStats | null>(null);
  const [thumb, setThumb] = useState('');
  const [usePalette, setUsePalette] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (thumb) URL.revokeObjectURL(thumb); }, [thumb]);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setNote('');
    if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type) || file.size > MAX_FILE) {
      setNote('PNG・JPEG・WebP の画像（15MBまで）を選んでください。');
      return;
    }
    setBusy(true);
    try {
      const { px, w, h } = await readPixels(file);
      const key = statsKey(px);
      let s = statsCache.get(key);
      if (!s) { s = referenceStats(px, w, h); statsCache.set(key, s); }
      setStats(s);
      setThumb(URL.createObjectURL(file));
    } catch {
      setNote('この画像は読み取れませんでした。別の画像を選んでください。');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const preview = useMemo(() => (stats ? planFromReference(site, stats, { usePalette }) : null), [site, stats, usePalette]);
  return (
    <div className="da-tool" data-da-reference>
      <p>好きなサイトの画面写真や、雰囲気の近い画像を選ぶと、明るさ・余白・線の多さ・写真の存在感だけを読み取って、今のサイトの設定に置き換えます。</p>
      <p className="da-keep">画像はこの端末の中で数値にするだけで、送信・保存しません。サイトの写真にも使いません。文字・ロゴ・写真・飾りは写しません。</p>
      <label className="da-file">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => pick(e.target.files?.[0])} data-da-file />
        <span>{busy ? '読み取っています…' : stats ? '別の画像を選ぶ' : '参考にする画像を選ぶ'}</span>
      </label>
      {note && <p className="da-note" role="status">{note}</p>}
      {stats && preview && (
        <div className="da-ref" data-da-traits>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {thumb && <img src={thumb} alt="選んだ参考画像（サイトには使いません）" className="da-thumb" />}
          <ul>
            {preview.traits.map((t) => (
              <li key={t.label} className={t.used ? '' : 'da-off'}><b>{t.label}</b>{t.value}</li>
            ))}
          </ul>
          <label className="da-check">
            <input type="checkbox" checked={usePalette} onChange={(e) => setUsePalette(e.target.checked)} data-da-palette />
            配色も近づける（用意した配色から「{preview.palette}」）
          </label>
          <button type="button" className="sc-propose" disabled={!preview.ops.length} onClick={() => onPlan(preview)} data-da-make>
            <ImageIcon size={16} /> 変更案を見る
          </button>
          {!preview.ops.length && <p className="da-note" role="status">{preview.note}</p>}
        </div>
      )}
    </div>
  );
}

const LEVEL_LABEL = { now: '今直す', better: '直すと良い' } as const;

function DirectorTool({ site, readiness, businessPhone, access, onPlan, onOpen, onReady }: DesignAssistantProps & {
  access: Availability;
  onPlan: (p: DesignChangePlan) => void;
}) {
  const result = useMemo(() => directorChecks({ pages: site.pages, settings: site.settings, readiness, businessPhone }), [site, readiness, businessPhone]);
  const summaryKey = useMemo(() => JSON.stringify(reviewSummary(site)), [site]);
  const [aiCodes, setAiCodes] = useState<{ key: string; codes: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const cached = reviewCache.get(summaryKey);
  const codes = aiCodes?.key === summaryKey ? aiCodes.codes : cached;
  const aiFindings = useMemo(() => (codes ? findingsFromReview(site, codes) : []), [site, codes]);
  const askAi = async () => {
    if (busy || reviewCache.has(summaryKey)) return;
    setBusy(true);
    setNote('');
    try {
      const res = await fetch('/api/ai/design-review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ summary: JSON.parse(summaryKey) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNote(data.error || 'AIの見立てを取得できませんでした。'); return; }
      const c = Array.isArray(data.codes) ? (data.codes as string[]) : [];
      reviewCache.set(summaryKey, c);
      setAiCodes({ key: summaryKey, codes: c });
    } catch {
      setNote('AIの見立てを取得できませんでした。');
    } finally {
      setBusy(false);
    }
  };
  const groups = (['now', 'better'] as const).map((level) => ({ level, items: result.findings.filter((f) => f.level === level) }));
  const item = (f: Finding) => (
    <li key={f.id} className="da-finding" data-finding={f.id}>
      <strong>{f.title}</strong>
      <p>{f.what}</p>
      <small>{f.why}{f.where ? `（場所：${f.where}）` : ''}</small>
      {f.action?.kind === 'plan' && f.action.plan.ops.length > 0 && (
        <button type="button" onClick={() => onPlan((f.action as { plan: DesignChangePlan }).plan)} data-finding-plan>改善案を見る</button>
      )}
      {f.action?.kind === 'open' && <button type="button" onClick={() => onOpen((f.action as { blockId: string }).blockId, (f.action as { field?: string }).field)} data-finding-open>その場所を直す</button>}
      {f.action?.kind === 'ready' && <button type="button" onClick={onReady} data-finding-ready>「公開の準備」を開く</button>}
    </li>
  );
  return (
    <div className="da-tool" data-da-director>
      <p>公開の前に、来た人が困りそうなところをコードで確かめます（点数は出しません）。直すかどうかは、案を見てから決められます。</p>
      {groups.map(({ level, items }) => (
        <section key={level} className={`da-group da-${level}`} aria-label={LEVEL_LABEL[level]}>
          <h4>{LEVEL_LABEL[level]}（{items.length}）</h4>
          {items.length ? <ul>{items.map(item)}</ul> : <p className="da-none">ありません</p>}
        </section>
      ))}
      <details className="da-group da-ok">
        <summary>問題なし（{result.passed.length}）</summary>
        <ul>{result.passed.map((p) => <li key={p}>{p}</li>)}</ul>
      </details>
      <section className="da-group da-ai" aria-label="AIの見立て">
        <h4>AIの見立て（任意）</h4>
        {codes ? (
          aiFindings.length ? <ul>{aiFindings.map(item)}</ul> : <p className="da-none">AIからの指摘はありませんでした。</p>
        ) : access?.available ? (
          <button type="button" className="da-ai-ask" disabled={busy} onClick={askAi} data-da-ai-review>
            {busy ? '見ています…' : 'AIにも見てもらう（1回）'}
          </button>
        ) : (
          <p className="da-none">ご契約中は、見出しの強弱・密度・写真の存在感などの見立ても出せます。上の確認はそのまま使えます。</p>
        )}
        {note && <p className="da-note" role="status">{note}</p>}
        <small>AIには、節の種類・文字数・写真の枚数・見た目の設定だけを渡します（文章・連絡先・写真は渡しません）。</small>
      </section>
    </div>
  );
}
