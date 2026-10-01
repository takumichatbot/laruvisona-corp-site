'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Page, SEOSettings, SiteSettings } from '@/types/laruHP';
import {
  compositionAdvice,
  DIRECTIONS,
  type DirectionId,
  isDirection,
} from '@/lib/studio-direction';
import {
  DEFAULT_PLAN_OPTIONS,
  planStyleDirection,
  STYLE_PLANS,
  FONT_LABEL,
  KEY_LABEL,
  type PlanOptions,
  type PlanSettings,
} from '@/lib/style-direction-plan';
import { exportToHTML } from '@/lib/html-export';
import { withPreviewBridge } from '@/lib/preview-frame';
import DirectionChoices from './DirectionChoices';
import './direction-editor.css';

type Site = { pages: Page[]; settings: PlanSettings };
type Props = {
  site: Site;
  /** 制作画面の設定を、公開HTMLの書き出し設定へ */
  toExport: (settings: PlanSettings) => SiteSettings;
  name: string;
  seo: SEOSettings;
  onApply: (id: DirectionId, options: PlanOptions) => void;
  disabled: boolean;
};

/* 比較の枠の中だけで使う。通信・送信・別の枠を止める（実問い合わせ・計測を起こさない） */
const PREVIEW_CSP = `<head><meta http-equiv="Content-Security-Policy" content="connect-src 'none'; form-action 'none'; frame-src 'none';">`;

/** 変更計画（採用と同じ関数）から、比較の枠に流す公開HTMLを作る */
function previewHtml(site: Site, id: DirectionId, options: PlanOptions, toExport: Props['toExport'], seo: SEOSettings, name: string) {
  const plan = planStyleDirection(site, id, options);
  const top = plan.pages[0];
  const page: Page = { id: top?.id || 'direction-preview', name: top?.name || 'トップページ', path: '/', blocks: top?.blocks || [], seo };
  return {
    plan,
    html: withPreviewBridge(exportToHTML([page], seo, { ...toExport(plan.settings), animLevel: 'none' }, name)).replace('<head>', PREVIEW_CSP),
  };
}

export default function DirectionEditor(props: Props) {
  const current = props.site.pages[0]?.blocks.find((b) => b.type === 'hero');
  const [chosen, setChosen] = useState<DirectionId | null>(null);
  const adopted = isDirection(props.site.settings.styleDirection) ? props.site.settings.styleDirection : '';
  return (
    <section className="de-editor" aria-label="見た目の案を比較">
      <span className="de-eyebrow">あなたの写真と文章のままで</span>
      <h3>構成から、選び直す。</h3>
      <p>
        配置と節の順番に加えて、書体・余白・見出しの強弱も変わる3案です。配色は今のままにできます。大きな完成像で見比べてから採用できます。
      </p>
      <DirectionChoices
        value={adopted || (isDirection(current?.data.compositionStyle) ? current.data.compositionStyle : '')}
        photo={String(current?.data.bgImage || '')}
        onChange={setChosen}
      />
      {chosen && (
        <DirectionReview
          {...props}
          chosen={chosen}
          onChoose={setChosen}
          onClose={() => setChosen(null)}
        />
      )}
    </section>
  );
}

/** 選択肢のカード：最初の画面と次の節の一部が見える縮小表示 */
function OptionThumb({ html }: { html: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const [w, setW] = useState(240);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width || 240));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // パソコン幅で、最初の画面と次の節の頭まで（高さ 1000px 分）を縮小して見せる
  const canvas = 1440, view = 1000, scale = w / canvas;
  return (
    <span ref={box} className="dr-thumb" aria-hidden="true" style={{ height: Math.round(view * scale) }}>
      <iframe title="" tabIndex={-1} srcDoc={html} sandbox="allow-scripts" loading="lazy"
        style={{ width: canvas, height: view, transform: `scale(${scale})` }} />
    </span>
  );
}

function DirectionReview({
  site,
  toExport,
  name,
  seo,
  onApply,
  disabled,
  chosen,
  onChoose,
  onClose,
}: Props & {
  chosen: DirectionId;
  onChoose: (id: DirectionId) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    holder = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<'sp' | 'pc'>('sp');
  const [size, setSize] = useState({ width: 320, height: 440 });
  const [options, setOptions] = useState<PlanOptions>(DEFAULT_PLAN_OPTIONS);
  // 詳細の開閉は、案・配色を選び替えても保つ
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    const el = dialog.current!,
      focus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    el.showModal();
    return () => {
      el.close();
      document.body.style.overflow = overflow;
      focus?.focus();
    };
  }, []);
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ width: e.contentRect.width, height: e.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 3案とも、同じ元の状態から作る（選び替えても積み重ならない）
  const previews = useMemo(
    () => Object.fromEntries(DIRECTIONS.map((d) => [d.id, previewHtml(site, d.id, options, toExport, seo, name)])) as Record<DirectionId, ReturnType<typeof previewHtml>>,
    [site, options, toExport, seo, name],
  );
  const { plan, html } = previews[chosen];
  const hero = plan.pages[0]?.blocks.find((b) => b.type === 'hero');
  const canvas = device === 'sp' ? 390 : 1440,
    scale = Math.max(0.01, size.width / canvas);
  const palette = STYLE_PLANS[chosen].palette;
  const direction = DIRECTIONS.find((d) => d.id === chosen)!;
  const mainChanges = plan.changes.filter((c) => !c.group);
  const fineChanges = plan.changes.filter((c) => c.group === 'detail');
  const scope = plan.changes.find((c) => c.group === 'scope');
  return (
    <dialog
      ref={dialog}
      className="dr-dialog"
      aria-labelledby="dr-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="dr-shell">
        <header className="dr-header">
          <div>
            <span>いまの写真・文章で比較</span>
            <h2 id="dr-title">見せ方で、伝わり方が変わる。</h2>
          </div>
          <button
            type="button"
            aria-label="比較を閉じる（何も変わりません）"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        <div className="dr-workspace">
          <aside className="dr-options">
            <div role="radiogroup" aria-label="比較する案" className="dr-options-list">
              {DIRECTIONS.map((d, i) => (
                <button
                  type="button"
                  role="radio"
                  key={d.id}
                  aria-checked={chosen === d.id}
                  tabIndex={chosen === d.id ? 0 : -1}
                  onClick={() => onChoose(d.id)}
                  onKeyDown={(e) => {
                    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
                    if (!step) return;
                    e.preventDefault();
                    const next = DIRECTIONS[(i + step + DIRECTIONS.length) % DIRECTIONS.length];
                    onChoose(next.id);
                    (e.currentTarget.parentElement?.children[DIRECTIONS.indexOf(next)] as HTMLElement | undefined)?.focus();
                  }}
                >
                  <OptionThumb html={previews[d.id].html} />
                  <span>0{i + 1}{chosen === d.id ? '・確認中' : ''}</span>
                  <strong>{d.name}</strong>
                  <small>{d.note} 書体：{FONT_LABEL[STYLE_PLANS[d.id].fontFamily]}</small>
                </button>
              ))}
            </div>
            <div className="de-devices" role="group" aria-label="案の画面幅">
              <button type="button" aria-pressed={device === 'sp'} onClick={() => setDevice('sp')}>スマホ</button>
              <button type="button" aria-pressed={device === 'pc'} onClick={() => setDevice('pc')}>パソコン</button>
            </div>
            <fieldset className="dr-palette">
              <legend>配色</legend>
              <label>
                <input type="radio" name="dr-palette" checked={!options.usePalette}
                  onChange={() => setOptions((o) => ({ ...o, usePalette: false }))} />
                今の配色のまま
              </label>
              <label>
                <input type="radio" name="dr-palette" checked={options.usePalette}
                  onChange={() => setOptions((o) => ({ ...o, usePalette: true }))} />
                この案の配色にする（{palette}）
              </label>
            </fieldset>
            {plan.individualColors.length > 0 && (
              <div className="dr-colors">
                <p>次の部品は色が個別に入っています。そのままにすると、配色を変えても追従しません。</p>
                <ul>
                  {plan.individualColors.map((c) => (
                    <li key={`${c.blockId}:${c.key}`}>
                      <i style={{ background: c.value }} aria-hidden="true" />
                      {c.part}の{KEY_LABEL[c.key]}（{c.value}）
                    </li>
                  ))}
                </ul>
                <label>
                  <input type="checkbox" checked={options.themeColors}
                    onChange={(e) => setOptions((o) => ({ ...o, themeColors: e.target.checked }))} />
                  これらもテーマの色に合わせる（入っている色の値は消さずに残します）
                </label>
              </div>
            )}
            <section className="dr-changes" aria-label="採用すると変わること">
              <h3>採用すると変わること</h3>
              {/* 要約：同じ変更計画（plan.changes）の項目名を並べるだけ。判定を別に持たない */}
              <p className="dr-summary">
                <strong>{direction.name}</strong>：{direction.note}
              </p>
              <p className="dr-summary">
                変わる主な項目：{mainChanges.map((c) => c.label).join('・')}
                {fineChanges.length > 0 && `。ほかに${fineChanges.slice(0, 2).map((c) => c.label).join('・')}など、細かな調整が${fineChanges.length}項目`}
              </p>
              {scope && (
                <p className="dr-scope">
                  <strong>{scope.label}</strong>
                  {scope.detail}
                </p>
              )}
              <p className="dr-keep">文章・写真・リンク・問い合わせ先は、そのまま残ります。</p>
              <details className="dr-more" open={detailsOpen} onToggle={(e) => setDetailsOpen(e.currentTarget.open)}>
                <summary>変更の詳細を見る（{mainChanges.length + fineChanges.length}項目）</summary>
                <dl>
                  {[...mainChanges, ...fineChanges].map((c) => (
                    <div key={c.label}>
                      <dt>{c.label}</dt>
                      <dd>{c.detail}</dd>
                    </div>
                  ))}
                </dl>
                <ul className="de-quality">
                  {hero && compositionAdvice(hero).map((t) => <li key={t}>{t}</li>)}
                </ul>
              </details>
            </section>
          </aside>
          <main className="dr-preview" data-device={device}>
            <div ref={holder} className="de-frame">
              <iframe
                key={html}
                title="採用前の案"
                srcDoc={html}
                sandbox="allow-scripts"
                style={{
                  width: canvas,
                  height: Math.max(100, size.height / scale),
                  transform: `scale(${scale})`,
                }}
              />
            </div>
          </main>
        </div>
        <footer className="dr-footer">
          <p>
            文章・写真・リンク・問い合わせ先は残します。採用するまで、今のサイトは変わりません。
            <span>採用後も「取り消す」1回で、採用前に戻せます。保存・公開は従来のボタンから行います。</span>
          </p>
          <div className="de-actions">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onApply(chosen, options);
                onClose();
              }}
            >
              この案を採用する
            </button>
            <button type="button" onClick={onClose}>
              やめる
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
