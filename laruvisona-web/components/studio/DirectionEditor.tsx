'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';
import {
  arrangeDirection,
  compositionAdvice,
  directionSequence,
  DIRECTIONS,
  type DirectionId,
  isDirection,
} from '@/lib/studio-direction';
import { exportToHTML } from '@/lib/html-export';
import { withPreviewBridge } from '@/lib/preview-frame';
import DirectionChoices from './DirectionChoices';
import './direction-editor.css';
type Props = {
  blocks: Block[];
  settings: SiteSettings;
  name: string;
  seo: SEOSettings;
  onApply: (id: DirectionId) => void;
  disabled: boolean;
};
export default function DirectionEditor(props: Props) {
  const current = props.blocks.find((b) => b.type === 'hero');
  const [chosen, setChosen] = useState<DirectionId | null>(null);
  return (
    <section className="de-editor" aria-label="ページの構成を比較">
      <span className="de-eyebrow">あなたの写真と文章のままで</span>
      <h3>構成から、選び直す。</h3>
      <p>
        配置と節の順番が違う3案です。大きな完成像で見比べてから採用できます。
      </p>
      <DirectionChoices
        value={
          isDirection(current?.data.compositionStyle)
            ? current.data.compositionStyle
            : ''
        }
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
function DirectionReview({
  blocks,
  settings,
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
  const candidate = useMemo(
    () =>
      arrangeDirection(
        blocks,
        chosen,
        String(settings.design?.ink || '#263248'),
      ),
    [blocks, chosen, settings.design],
  );
  const hero = candidate.find((b) => b.type === 'hero');
  const html = useMemo(() => {
    const page: Page = {
      id: 'direction-preview',
      name: 'トップページ',
      path: '/',
      blocks: candidate,
      seo,
    };
    return withPreviewBridge(
      exportToHTML([page], seo, { ...settings, animLevel: 'none' }, name),
    ).replace(
      '<head>',
      `<head><meta http-equiv="Content-Security-Policy" content="connect-src 'none'; form-action 'none'; frame-src 'none';">`,
    );
  }, [candidate, seo, settings, name]);
  const canvas = device === 'sp' ? 390 : 1100,
    scale = Math.max(0.01, size.width / canvas);
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
            <h2 id="dr-title">構成で、伝わり方が変わる。</h2>
          </div>
          <button
            type="button"
            aria-label="構成の比較を閉じる"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        <div className="dr-workspace">
          <aside className="dr-options">
            <div
              role="group"
              aria-label="比較する構成"
              className="dr-options-list"
            >
              {DIRECTIONS.map((d, i) => (
                <button
                  type="button"
                  key={d.id}
                  aria-pressed={chosen === d.id}
                  onClick={() => onChoose(d.id)}
                >
                  <span>0{i + 1}</span>
                  <strong>{d.name}</strong>
                  <small>{d.note}</small>
                </button>
              ))}
            </div>
            <div
              className="de-devices"
              role="group"
              aria-label="構成案の画面幅"
            >
              <button
                type="button"
                aria-pressed={device === 'sp'}
                onClick={() => setDevice('sp')}
              >
                スマホ
              </button>
              <button
                type="button"
                aria-pressed={device === 'pc'}
                onClick={() => setDevice('pc')}
              >
                パソコン
              </button>
            </div>
            <details className="dr-details">
              <summary>節の順番と、整えるところ</summary>
              <ol className="de-sequence" aria-label="構成案の節の順番">
                {directionSequence(candidate).map((b) => (
                  <li key={b.id}>{b.label}</li>
                ))}
              </ol>
              <ul className="de-quality">
                {hero &&
                  compositionAdvice(hero).map((t) => <li key={t}>{t}</li>)}
              </ul>
            </details>
          </aside>
          <main className="dr-preview" data-device={device}>
            <div ref={holder} className="de-frame">
              <iframe
                key={html}
                title="採用前の構成案"
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
            文章・写真・リンクは残します。採用後も取り消せます。
            <span>自由配置などがあるページは順番を保ちます。</span>
          </p>
          <div className="de-actions">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onApply(chosen);
                onClose();
              }}
            >
              この構成を採用する
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
