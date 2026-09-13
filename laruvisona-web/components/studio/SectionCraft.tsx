'use client';
import { Image as ImageIcon, Layers3, Play, AlignCenter } from 'lucide-react';
import type { Block } from '@/types/laruHP';
import {
  isDirection,
  compositionAdvice,
  DIRECTIONS,
} from '@/lib/studio-direction';
export default function SectionCraft({
  block,
  onChange,
  globalMotion,
  globalLayout,
  ink,
}: {
  block: Block;
  onChange: (key: string, value: unknown) => void;
  globalMotion: string;
  globalLayout: string;
  ink: string;
}) {
  const d = block.data;
  const layouts = [
    ['split', '写真と文字を分ける'],
    ['center', '写真を背景いっぱいに'],
    ['left', '写真に文字を添える'],
  ];
  const hero = block.type === 'hero';
  const position = String(
    d.bgImagePositionSp || d.bgImagePosition || '50% 50%',
  ).match(/([\d.]+)%\s+([\d.]+)%/);
  return (
    <div className="sc-craft">
      {hero && (
        <>
          <h3>
            <ImageIcon size={17} />
            写真の見せ方
          </h3>
          <div className="sc-layouts">
            {layouts.map(([v, label]) => (
              <button
                type="button"
                key={v}
                aria-pressed={(d.heroLayout || globalLayout) === v}
                onClick={() => {
                  onChange('heroLayout', v);
                  if (isDirection(d.compositionStyle))
                    onChange(
                      'compositionStyle',
                      DIRECTIONS.find((x) => x.layout === v)!.id,
                    );
                  onChange('textColor', v === 'split' ? ink : '#ffffff');
                }}
              >
                <span className={'sc-layout-art sc-layout-' + v}>
                  <i />
                  <b />
                </span>
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="sc-inherit"
            onClick={() => {
              onChange('heroLayout', '');
              if (isDirection(d.compositionStyle))
                onChange(
                  'compositionStyle',
                  DIRECTIONS.find((x) => x.layout === globalLayout)?.id ||
                    'editorial',
                );
              onChange('textColor', globalLayout === 'split' ? ink : '#ffffff');
            }}
          >
            サイト全体の配置に戻す
          </button>
          <h3>スマホでも、整えて見せる</h3>
          {isDirection(d.compositionStyle) ? (
            <>
              <p>文章を省略せずに折り返し、内容に合わせて高さを確保します。</p>
              <label>
                スマホの写真の収め方
                <select
                  aria-label="スマホの写真の収め方"
                  value={d.mobilePhotoFit === 'contain' ? 'contain' : 'cover'}
                  onChange={(e) => onChange('mobilePhotoFit', e.target.value)}
                >
                  <option value="cover">選んだ焦点を大きく見せる</option>
                  <option value="contain">写真の全体を残す</option>
                </select>
              </label>
              <ul className="de-quality">
                {compositionAdvice(block).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          ) : (
            <button
              type="button"
              className="sc-inherit"
              onClick={() => {
                onChange(
                  'compositionStyle',
                  DIRECTIONS.find(
                    (x) => x.layout === (d.heroLayout || globalLayout),
                  )?.id || 'editorial',
                );
                onChange('adaptiveLayout', true);
              }}
            >
              この節に読みやすさの調整を使う
            </button>
          )}
          <fieldset>
            <legend>スマホの写真の焦点</legend>
            {['横', '縦'].map((label, i) => (
              <label key={label}>
                {label}
                <input
                  aria-label={`写真の焦点・${label}`}
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Number(position?.[i + 1] || 50)}
                  onChange={(e) => {
                    const v = [
                      Number(position?.[1] || 50),
                      Number(position?.[2] || 50),
                    ];
                    v[i] = Number(e.target.value);
                    onChange('bgImagePositionSp', `${v[0]}% ${v[1]}%`);
                  }}
                />
              </label>
            ))}
          </fieldset>
          <h3>
            <Play size={17} />
            背景に動画を重ねる
          </h3>
          <p>
            静止画を先に表示し、無音で再生します。端末の「動きを減らす」設定では写真を表示します。
          </p>
          <label>
            動画のURL（MP4）
            <input
              type="url"
              value={String(d.heroVideo || '')}
              placeholder="https://…/movie.mp4"
              onChange={(e) => onChange('heroVideo', e.target.value)}
            />
          </label>
          <label>
            動画のURL（WebM・任意）
            <input
              type="url"
              value={String(d.heroVideoWebm || '')}
              onChange={(e) => onChange('heroVideoWebm', e.target.value)}
            />
          </label>
        </>
      )}
      {block.type === 'gallery' && (
        <>
          <h3>
            <Layers3 size={17} />
            写真の並び
          </h3>
          <div className="sc-layouts">
            {[
              ['grid', '整列して見せる'],
              ['stack', 'スクロールで重ねる'],
            ].map(([v, label]) => (
              <button
                type="button"
                key={v}
                aria-pressed={(d.galleryLayout || 'grid') === v}
                onClick={() => onChange('galleryLayout', v)}
              >
                {label}
              </button>
            ))}
          </div>
          <p>
            「重ねる」は写真が2枚以上のときに使えます。スクロールを止めず、写真を順に重ねます。
          </p>
        </>
      )}
      <h3>
        <AlignCenter size={17} />
        この節の余白
      </h3>
      <p>上下の外側に加える余白です。ほかの節は変わりません。</p>
      {[
        ['paddingTop', '上に足す余白'],
        ['paddingBottom', '下に足す余白'],
      ].map(([key, label]) => (
        <label key={key}>
          {label}
          <select
            aria-label={label}
            value={String(d[key] || '')}
            onChange={(e) => onChange(key, e.target.value)}
          >
            <option value="">追加なし</option>
            <option value="sm">少し（24px）</option>
            <option value="lg">広く（72px）</option>
            <option value="xl">ゆったり（96px）</option>
          </select>
        </label>
      ))}
      <h3>
        <Layers3 size={17} />
        現れるときの動き
      </h3>
      <div className="sc-motion-options">
        {[
          ['none', '動かさない'],
          ['fade', '静かに現れる'],
          ['slide-up', '下から現れる'],
          ['zoom', '奥から近づく'],
        ].map(([v, label]) => (
          <button
            type="button"
            key={v}
            aria-pressed={(d.animation || 'fade') === v}
            onClick={() => onChange('animation', v)}
          >
            <span
              className={'sc-motion-art sc-motion-' + v}
              aria-hidden="true"
            />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {globalMotion === 'none' && (
        <p role="status">
          サイト全体の動きが「なし」のため、今は静止しています。「色・書体」の動き設定で再開できます。
        </p>
      )}
    </div>
  );
}
