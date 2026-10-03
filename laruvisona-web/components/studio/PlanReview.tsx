'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Page, SEOSettings, SiteSettings } from '@/types/laruHP';
import { applyDesignPlan, scopeText, type DesignChangePlan, type PlanSettingsLike } from '@/lib/design-change';
import { exportToHTML } from '@/lib/html-export';
import { withPreviewBridge } from '@/lib/preview-frame';
import './direction-editor.css';

type Site = { pages: Page[]; settings: PlanSettingsLike };
export type PlanReviewProps = {
  site: Site;
  toExport: (settings: PlanSettingsLike) => SiteSettings;
  name: string;
  seo: SEOSettings;
  plan: DesignChangePlan;
  disabled: boolean;
  /** 採用（1回の取り消しで戻る形で反映）。古い計画などで当てられなければ false */
  onAdopt: (plan: DesignChangePlan) => boolean;
  onClose: () => void;
};

/* 比較の枠の中だけで使う。通信・送信・別の枠を止める（実問い合わせ・計測を起こさない） */
const PREVIEW_CSP = `<head><meta http-equiv="Content-Security-Policy" content="connect-src 'none'; form-action 'none'; frame-src 'none';">`;
const SOURCE_LABEL: Record<DesignChangePlan['source'], string> = { words: '言葉で直す', reference: '参考画像から', director: '公開前の見直し' };

function render(site: Site, toExport: PlanReviewProps['toExport'], seo: SEOSettings, name: string) {
  const top = site.pages[0];
  const page: Page = { id: top?.id || 'plan-preview', name: top?.name || 'トップページ', path: '/', blocks: top?.blocks || [], seo };
  // 比較の枠では動きを止める（見比べるのは形。動きの設定そのものは計画のとおり保存される）
  return withPreviewBridge(exportToHTML([page], seo, { ...toExport(site.settings), animLevel: 'none' }, name)).replace('<head>', PREVIEW_CSP);
}

/**
 * 見た目の変更計画を、採用前に見比べる（言葉で直す・参考画像から・公開前の見直しで共通）。
 * 表示と採用は同じ関数（applyDesignPlan）から作る。閉じても何も変わらない。
 */
export default function PlanReview({ site, toExport, name, seo, plan, disabled, onAdopt, onClose }: PlanReviewProps) {
  const dialog = useRef<HTMLDialogElement>(null),
    holder = useRef<HTMLDivElement>(null),
    frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<'sp' | 'pc'>('sp');
  const [view, setView] = useState<'after' | 'before'>('after');
  const [size, setSize] = useState({ width: 320, height: 440 });
  const [refused, setRefused] = useState('');
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
    const ro = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 採用と同じ関数で、変更後を作る（元のデータは変えない）
  const result = useMemo(() => applyDesignPlan(site, plan), [site, plan]);
  const html = useMemo(() => ({
    before: render(site, toExport, seo, name),
    after: result ? render({ pages: result.pages, settings: result.settings }, toExport, seo, name) : '',
  }), [site, result, toExport, seo, name]);
  // 選んだ節だけの計画は、その節が見える位置まで送る
  const firstOp = plan.ops[0];
  const focusId = plan.scope.kind === 'section' ? plan.scope.blockId
    : firstOp?.t === 'block' && plan.ops.every((op) => op.t === 'block') ? firstOp.blockId : '';
  useEffect(() => {
    if (!focusId) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.type !== 'ready') return;
      frame.current?.contentWindow?.postMessage({ source: 'lhp-studio', type: 'select', id: focusId, align: 'start' }, '*');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [focusId]);
  const canvas = device === 'sp' ? 390 : 1440,
    scale = Math.max(0.01, size.width / canvas);
  const changes = result?.changes ?? [];
  const shown = view === 'after' && result ? html.after : html.before;
  return (
    <dialog ref={dialog} className="dr-dialog" aria-labelledby="pr-title" onCancel={onClose} onClose={onClose} data-plan-review={plan.source}>
      <div className="dr-shell">
        <header className="dr-header">
          <div>
            <span>{SOURCE_LABEL[plan.source]}・採用するまで、今のサイトは変わりません</span>
            <h2 id="pr-title">{plan.title}</h2>
          </div>
          <button type="button" aria-label="閉じる（何も変わりません）" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="dr-workspace">
          <aside className="dr-options">
            <div className="de-devices" role="group" aria-label="変更の前と後">
              <button type="button" aria-pressed={view === 'before'} onClick={() => setView('before')} data-plan-view="before">変更前</button>
              <button type="button" aria-pressed={view === 'after'} onClick={() => setView('after')} data-plan-view="after">変更後</button>
            </div>
            <div className="de-devices" role="group" aria-label="画面幅">
              <button type="button" aria-pressed={device === 'sp'} onClick={() => setDevice('sp')}>スマホ</button>
              <button type="button" aria-pressed={device === 'pc'} onClick={() => setDevice('pc')}>パソコン</button>
            </div>
            <section className="dr-changes" aria-label="採用すると変わること">
              <h3>採用すると変わること</h3>
              {!result ? (
                <p className="dr-summary" role="alert">この案を作ったあとに、同じ設定が変わりました。今の状態から作り直してください。</p>
              ) : (
                <>
                  <p className="dr-summary" data-plan-summary>
                    変わる項目：{[...new Set(changes.map((c) => c.label.replace(/^.*：/, '')))].join('・')}（{changes.length}項目）
                  </p>
                  {plan.reason && <p className="dr-summary">{plan.reason}</p>}
                  <p className="dr-scope" data-plan-scope>
                    <strong>変える範囲</strong>
                    {scopeText(plan)}
                  </p>
                  <p className="dr-keep">文章・写真・リンク・電話・料金・問い合わせ先は、そのまま残ります。</p>
                  <details className="dr-more" open>
                    <summary>変更の詳細（{changes.length}項目）</summary>
                    <dl data-plan-details>
                      {changes.map((c, i) => (
                        <div key={`${c.label}:${i}`}>
                          <dt>{c.label}</dt>
                          <dd>{c.detail}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </>
              )}
              {refused && <p className="dr-summary" role="alert">{refused}</p>}
            </section>
          </aside>
          <main className="dr-preview" data-device={device}>
            <div ref={holder} className="de-frame">
              <iframe
                ref={frame}
                key={`${view}:${shown.length}:${device}`}
                title={view === 'after' ? '採用したあとの見え方' : '今の見え方'}
                srcDoc={shown}
                sandbox="allow-scripts"
                style={{ width: canvas, height: Math.max(100, size.height / scale), transform: `scale(${scale})` }}
              />
            </div>
          </main>
        </div>
        <footer className="dr-footer">
          <p>
            採用するまで、今のサイトは変わりません。
            <span>採用後も「取り消す」1回で、採用前に戻せます。保存・公開は従来のボタンから行います。</span>
          </p>
          <div className="de-actions">
            <button
              type="button"
              data-plan-adopt
              disabled={disabled || !result || !plan.ops.length}
              onClick={() => {
                if (onAdopt(plan)) onClose();
                else setRefused('この案を作ったあとに、同じ設定が変わりました。何も変えていません。今の状態から作り直してください。');
              }}
            >
              この変更を採用する
            </button>
            <button type="button" onClick={onClose} data-plan-cancel>
              やめる
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
