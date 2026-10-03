'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { isPlaceholderText } from '@/lib/placeholder-text';
import {
  FACT_KEYS, FACT_LABEL, FACT_HINT, FACT_MAX, normalizeBusinessFacts, publicContactFacts, relevantFactKeys,
  type BusinessFacts, type FactKey,
} from '@/lib/business-facts';
import type { Block } from '@/types/laruHP';

/**
 * 会社の情報（文章づくりに使い回す控え）。
 * 書いたものは保存されるが、公開ページ・検索向けの情報には出ない。
 * 電話・住所・営業時間は「検索・SEO」の事業者情報が出どころ（ここでは見るだけ）。
 */
export function BusinessFactsPanel({ facts, onChange, businessInfo, siteId, name, onLeave }: {
  /** 保存していない変更があるとき、移動を確かめる */
  onLeave?: (e: React.MouseEvent) => void;
  facts: BusinessFacts | undefined;
  onChange: (next: BusinessFacts) => void;
  businessInfo: unknown;
  siteId: string | null;
  name: string;
}) {
  const f = facts ?? {};
  const contact = publicContactFacts(businessInfo);
  return (
    <section className="bf-panel" aria-label="会社の情報" data-business-facts>
      <div className="text-sm font-bold text-slate-900">会社の情報</div>
      <p className="bf-lead">
        ここに書いた事実は、節の文章を書くとき（「AIに相談」や、見本のままの欄）に使い回せます。
        保存されますが、公開ページや検索向けの情報には出しません。推測や見本の文は入れず、本当のことだけを書いてください。
      </p>
      <dl className="bf-source">
        <div><dt>名前</dt><dd>{name.trim() || '（未入力）'}<small>上の帯の名前</small></dd></div>
        {contact.length ? contact.map((c) => (
          <div key={c.label}><dt>{c.label}</dt><dd>{c.value}<small>検索・SEO の事業者情報</small></dd></div>
        )) : (
          <div><dt>電話・住所</dt><dd>未登録<small>検索・SEO の事業者情報で登録します</small></dd></div>
        )}
      </dl>
      {siteId && <Link className="bf-link" href={`/laruHP/seo?siteId=${encodeURIComponent(siteId)}`} onClick={onLeave}>電話・住所・営業時間を直す（検索・SEO）</Link>}
      {FACT_KEYS.map((k) => (
        <label key={k} className="bf-field" data-fact={k}>
          <span>{FACT_LABEL[k]}</span>
          <textarea
            rows={k === 'servicesSummary' || k === 'shortDescription' ? 3 : 1}
            maxLength={FACT_MAX[k]}
            value={f[k] ?? ''}
            placeholder={FACT_HINT[k]}
            onChange={(e) => {
              // 打っている途中の空白は残し、保存時に整える（見本の文は保存時に落とす）
              const next = { ...f, [k]: e.target.value.slice(0, FACT_MAX[k]) };
              if (!next[k]) delete next[k];
              onChange(next);
            }}
          />
          {f[k] && isPlaceholderText(f[k]) && <small className="bf-warn">見本の言い回しが入っています。この欄は保存されません。</small>}
        </label>
      ))}
    </section>
  );
}

/** この欄に、保存済みの会社の情報を使う（押すと変更前・後を見せ、もう一度押すと入れる） */
export function FactSuggest({ block, field, value, facts, onApply }: {
  block: Block;
  field: string;
  value: unknown;
  facts: BusinessFacts | undefined;
  onApply: (text: string) => void;
}) {
  const [picked, setPicked] = useState<FactKey | null>(null);
  const current = typeof value === 'string' ? value : '';
  // 見本のまま・空の文章欄だけに出す（本人が書いた文は書き換えない）
  if (current.trim() && !isPlaceholderText(current)) return null;
  const clean = normalizeBusinessFacts(facts);
  const keys = relevantFactKeys(block).filter((k) => clean[k]);
  if (!keys.length) return null;
  return (
    <div className="bf-suggest" data-fact-suggest={field}>
      <span>この情報をここにも使えます</span>
      <div>
        {keys.map((k) => (
          <button type="button" key={k} aria-pressed={picked === k} onClick={() => setPicked(picked === k ? null : k)} data-fact-pick={k}>
            {FACT_LABEL[k]}
          </button>
        ))}
      </div>
      {picked && (
        <div className="bf-preview" data-fact-preview>
          <del>{current || '（空欄）'}</del>
          <ArrowRight size={13} aria-hidden="true" />
          <ins>{clean[picked]}</ins>
          <div className="bf-actions">
            <button type="button" onClick={() => { onApply(clean[picked]!); setPicked(null); }} data-fact-apply>この欄に入れる</button>
            <button type="button" onClick={() => setPicked(null)}>やめる</button>
          </div>
          <small>入れたあとも「取り消す」で戻せます。文の長さや言い回しは、この欄に合わせて直してください。</small>
        </div>
      )}
    </div>
  );
}
