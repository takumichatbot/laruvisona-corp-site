'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, Layers3, Check, MousePointer2 } from 'lucide-react';
import {
  buildComposition,
  initialComposition,
  COMPOSITION_PHOTOS,
  COMPOSITION_INDUSTRIES,
  storeComposition,
  type Composition,
} from '@/lib/studio-composition';
import { INDUSTRY_BLUEPRINTS } from '@/lib/studio-blueprints';
import { exportToHTML } from '@/lib/html-export';
import { withPreviewBridge } from '@/lib/preview-frame';
import './creation-lab.css';
import DirectionChoices from '@/components/studio/DirectionChoices';
import { DIRECTIONS } from '@/lib/studio-direction';
import { INDUSTRY_REFERENCES } from '@/lib/studio-reference';
const labels: Record<string, string> = {
  beauty: '美容',
  restaurant: '飲食',
  construction: '工事',
  retail: '物販',
  clinic: '整体',
};
const moods = [
  ['refined', '上質'],
  ['calm', '落ち着いた'],
  ['warm', 'やわらかい'],
];
export default function CreationLab() {
  const router = useRouter();
  const [choice, setChoice] = useState<Composition>(() => initialComposition());
  const [active, setActive] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const [width, setWidth] = useState(390),
    [html, setHtml] = useState(''),
    [ready, setReady] = useState(false),
    [depth, setDepth] = useState(false),
    [error, setError] = useState('');
  const lastHtml = useRef('');
  const holder = useRef<HTMLDivElement>(null),
    frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const built = useMemo(() => buildComposition(choice), [choice]);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      const site = built.site;
      const output = exportToHTML(
        site.pages,
        site.pages[0].seo,
        {
          ...site.settings,
          accentColor: site.settings.design.accent,
          animLevel: 'none',
        } as never,
        site.name,
        {
          name: site.name,
          industry: choice.industry,
          siteId: 'creation-preview',
          slug: '',
        },
      );
      const safe = withPreviewBridge(output).replace(
        '<head>',
        "<head><meta http-equiv=\"Content-Security-Policy\" content=\"connect-src 'none'; form-action 'none'; frame-src 'none';\">",
      );
      const nextHtml = safe.replace(
        '</head>',
        '<style>[data-lhp-block]:hover{outline:0!important}</style></head>',
      );
      if (nextHtml !== lastHtml.current) {
        lastHtml.current = nextHtml;
        setHtml(nextHtml);
        setReady(false);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [built, choice.industry, active]);
  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (
        e.source !== frame.current?.contentWindow ||
        e.data?.source !== 'lhp-studio-preview'
      )
        return;
      if (e.data.type === 'ready') setReady(true);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);
  const edit = <K extends keyof Composition>(key: K, value: Composition[K]) =>
    setChoice((c) => ({ ...c, [key]: value }));
  const canvasWidth = width < 560 ? 390 : 1100,
    scale = width / canvasWidth;
  const continueMaking = () => {
    const id = storeComposition(choice);
    if (!id) {
      setError(
        'このタブに内容を引き継げませんでした。ブラウザの保存設定をご確認ください。',
      );
      return;
    }
    router.push(`/laruHP/studio?creation=${encodeURIComponent(id)}`);
  };
  return (
    <div ref={root} className="cl-lab" data-ready={ready}>
      <div className="cl-heading">
        <span>
          <MousePointer2 size={16} />
          ここから、あなたの一案に。
        </span>
        <small>保存・公開されない試作です</small>
      </div>
      <div className="cl-industries" role="group" aria-label="試作する業種">
        {COMPOSITION_INDUSTRIES.map((industry) => (
          <button
            type="button"
            aria-pressed={choice.industry === industry}
            key={industry}
            onClick={() => setChoice(initialComposition(industry))}
          >
            {labels[industry]}
          </button>
        ))}
      </div>
      <div className="cl-controls">
        <label className="cl-name">
          店名・会社名
          <input
            value={choice.name}
            maxLength={80}
            onChange={(e) => edit('name', e.target.value)}
          />
        </label>
        <div className="cl-moods" role="group" aria-label="見せ方を選ぶ">
          {moods.map(([preset, label]) => (
            <button
              type="button"
              key={preset}
              aria-pressed={choice.preset === preset}
              onClick={() => edit('preset', preset)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="cl-directions">
        <div className="cl-direction-heading">
          <strong>同じ内容から、構成の違う3案。</strong>
          <span>配置の見取り図を選ぶと、下の実物が変わります</span>
        </div>
        <DirectionChoices
          value={DIRECTIONS.find((d) => d.layout === choice.presentation)!.id}
          photo={COMPOSITION_PHOTOS.find((p) => p.id === choice.photo)!.src}
          onChange={(id) =>
            edit('presentation', DIRECTIONS.find((d) => d.id === id)!.layout)
          }
        />
        <p className="cl-direction-note">
          {DIRECTIONS.find((d) => d.layout === choice.presentation)!.note}
        </p>
      </div>
      <div className="cl-photo-row">
        <div className="cl-photos" role="group" aria-label="写真を選ぶ">
          {COMPOSITION_PHOTOS.map((photo) => (
            <button
              type="button"
              key={photo.id}
              aria-label={photo.label}
              aria-pressed={choice.photo === photo.id}
              onClick={() => edit('photo', photo.id)}
            >
              <Image
                src={photo.src}
                width={72}
                height={54}
                alt=""
                loading="lazy"
              />
              {choice.photo === photo.id && <Check size={13} />}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="cl-depth"
          aria-pressed={depth}
          onClick={() => setDepth((v) => !v)}
        >
          <Layers3 size={17} />
          {depth ? '正面に戻す' : '立体で眺める'}
        </button>
      </div>
      <details className="cl-copy">
        <summary>言葉と写真の配置も変える</summary>
        <label>
          最初の見出し
          <textarea
            aria-label="最初の見出し"
            value={choice.heading}
            maxLength={160}
            onChange={(e) => edit('heading', e.target.value)}
          />
        </label>
        <label>
          紹介文
          <textarea
            aria-label="紹介文"
            value={choice.description}
            maxLength={400}
            onChange={(e) => edit('description', e.target.value)}
          />
        </label>
        <label>
          写真の配置
          <select
            aria-label="写真の配置"
            value={choice.presentation}
            onChange={(e) =>
              edit(
                'presentation',
                e.target.value as Composition['presentation'],
              )
            }
          >
            <option value="split">写真と文字を分ける</option>
            <option value="center">写真を背景いっぱいに</option>
            <option value="left">写真に文字を添える</option>
          </select>
        </label>
      </details>
      <div className="cl-stage" data-depth={depth}>
        <div className="cl-page" ref={holder}>
          <div className="cl-browser">
            <i />
            <i />
            <i />
            <span>{choice.name || 'あなたのサイト'}</span>
          </div>
          <div
            className="cl-viewport"
            style={{
              height: Math.min(
                canvasWidth === 390 ? 560 : 580,
                canvasWidth === 390 ? 760 * scale : 780 * scale,
              ),
            }}
          >
            {html ? (
              <iframe
                key={html}
                ref={frame}
                title="いまつくっているサイトの完成像"
                sandbox="allow-scripts"
                srcDoc={html}
                style={{
                  width: canvasWidth,
                  height: canvasWidth === 390 ? 900 : 900,
                  transform: `scale(${scale})`,
                }}
              />
            ) : (
              <div className="cl-loading">完成像を準備しています…</div>
            )}
          </div>
        </div>
      </div>
      <div className="cl-structure">
        <span>{INDUSTRY_REFERENCES[choice.industry].concept}</span>
        <p>{INDUSTRY_BLUEPRINTS[choice.industry].reason}</p>
      </div>
      <button type="button" className="cl-continue" onClick={continueMaking}>
        このまま制作を続ける
        <ArrowRight size={20} />
      </button>
      <p className="cl-footnote">
        写真・文章・見せ方を引き継ぎます。見本の情報は公開前に差し替えられます。前回の下書きがある場合は、そちらを優先します。
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
