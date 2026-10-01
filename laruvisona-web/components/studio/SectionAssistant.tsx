'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowRight, LoaderCircle } from 'lucide-react';
import {
  aiData,
  aiFields,
  aiFieldLabel,
  reviewSectionProposal,
  MAX_FACTS,
  type SectionProposal,
} from '@/lib/studio-ai';
import { isPlaceholderText } from '@/lib/placeholder-text';
import type { Block } from '@/types/laruHP';

type Availability = { available: boolean; reason?: 'login' | 'contract' | 'not-ready' } | null;
const UNAVAILABLE: Record<string, string> = {
  login: 'AIの文案は、ログインすると使えます。',
  contract: 'AIの文案は、ご契約中のプランで使えます。いまは「内容」タブで手で書けます。「公開の準備」の案内もそのまま使えます。',
};

export default function SectionAssistant({
  block,
  siteId,
  focusPath = '',
  onApply,
}: {
  block: Block;
  siteId: string | null;
  /** 「公開の準備」から開いた欄。あれば「この欄だけ」を既定にする */
  focusPath?: string;
  onApply: (proposal: SectionProposal, keys: string[]) => boolean;
}) {
  const fields = aiFields(block);
  const focusable = !!focusPath && Object.hasOwn(fields, focusPath);
  const [prompt, setPrompt] = useState(''),
    [facts, setFacts] = useState(''),
    [onlyFocus, setOnlyFocus] = useState(focusable),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [proposal, setProposal] = useState<SectionProposal | null>(null),
    [missing, setMissing] = useState<string[]>([]),
    [dropped, setDropped] = useState<{ key: string; reason: string }[]>([]),
    [keys, setKeys] = useState<string[]>([]),
    [access, setAccess] = useState<Availability>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    let alive = true;
    fetch('/api/ai/section-proposal', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setAccess(d && typeof d.available === 'boolean' ? d : { available: true }); })
      .catch(() => { if (alive) setAccess({ available: true }); });   // 分からなければ、押したときの返事で伝える
    return () => { alive = false; };
  }, []);
  const scopeKeys = onlyFocus && focusable ? [focusPath] : Object.keys(fields);
  const blankInScope = scopeKeys.filter((k) => isPlaceholderText(fields[k]));
  const needFacts = scopeKeys.length > 0 && blankInScope.length === scopeKeys.length && !facts.trim();
  // 押す前に止めるのは、ログイン・契約の条件だけ。AIの準備（鍵）が無いときは、これまでどおり押したときに伝える
  const unavailable = access && !access.available && access.reason !== 'not-ready' ? UNAVAILABLE[access.reason || 'contract'] : '';
  const request = async () => {
    if (busy || unavailable || (!prompt.trim() && !facts.trim()) || needFacts) return;
    setBusy(true);
    setError('');
    setProposal(null);
    setMissing([]);
    setDropped([]);
    const before = structuredClone(block);
    const usedFacts = facts.trim();
    const only = onlyFocus && focusable ? [focusPath] : [];
    controller.current = new AbortController();
    try {
      const res = await fetch('/api/ai/section-proposal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          siteId,
          block: { id: before.id, type: before.type, data: aiData(before) },
          prompt,
          facts: usedFacts,
          only,
        }),
        signal: controller.current.signal,
      });
      const data = await res.json();
      if (res.status === 403 && /契約/.test(data.error || '')) { setAccess({ available: false, reason: 'contract' }); return; }
      if (!res.ok) throw Error(data.error || '提案を取得できませんでした。');
      // 画面でも、いまの節で同じ確かめをする（繰り返し項目は、提案したときの項目全体も覚える）
      const review = data.proposal
        ? reviewSectionProposal(before, data.proposal.changes, { facts: usedFacts, only: Object.keys(data.proposal.before || {}) })
        : { proposal: null, dropped: [], missing: [] };
      const allDropped = [...(Array.isArray(data.dropped) ? data.dropped : []), ...review.dropped];
      setDropped(allDropped);
      setMissing(Array.isArray(data.missing) ? data.missing.filter((m: unknown) => typeof m === 'string') : []);
      if (data.proposal && !review.proposal && !allDropped.length) throw Error('提案の形式を確認できませんでした。');
      if (review.proposal) {
        setProposal(review.proposal);
        setKeys(Object.keys(review.proposal.changes));
      }
    } catch (e) {
      if (!controller.current?.signal.aborted)
        setError(
          e instanceof Error ? e.message : '提案を取得できませんでした。',
        );
    } finally {
      setBusy(false);
    }
  };
  if (!Object.keys(fields).length)
    return (
      <p className="sc-assistant-note">
        この節にはAIで提案できる文章がありません。対象は2,000文字以内の見出し・説明文と、サービス・流れ・質問と答え・メニューの文章です。写真や見せ方は隣のタブから編集できます。
      </p>
    );
  return (
    <div className="sc-assistant" data-ai-assistant>
      <h3>
        <Sparkles size={18} />
        この場所を、一緒に磨く
      </h3>
      <p>
        選んだ節の文章だけを提案します。採用するまで、元の文章は変わりません。
      </p>
      {unavailable && (
        <p className="sc-assistant-note" role="status" data-ai-unavailable>
          {unavailable}
        </p>
      )}
      {focusable && (
        <div className="sc-scope" role="radiogroup" aria-label="提案する範囲">
          <label><input type="radio" checked={onlyFocus} onChange={() => setOnlyFocus(true)} /> この欄だけ（{aiFieldLabel(block, focusPath)}）</label>
          <label><input type="radio" checked={!onlyFocus} onChange={() => setOnlyFocus(false)} /> この節の文章すべて</label>
        </div>
      )}
      <label>
        使う情報（公開してよい事実だけ・任意）
        <textarea
          data-ai-facts
          maxLength={MAX_FACTS}
          value={facts}
          onChange={(e) => setFacts(e.target.value)}
          placeholder="例：対応地域は足立区と葛飾区。水回りの修理とリフォームに対応。費用は現地確認のあと見積り。"
        />
      </label>
      <small>
        実績・年数・料金・許可・資格・保証・口コミ・営業時間・住所・電話・対応範囲は、ここに書いたことだけを使います。書いていないことは足しません。この情報は保存も公開もしません。
      </small>
      {blankInScope.length > 0 && (
        <small className="sc-blank-note">
          見本のままの欄（{blankInScope.length}か所）は、上の情報があるときだけ文章にします。見本の文章はAIに渡しません。
        </small>
      )}
      {!facts.trim() && (
        <div className="sc-prompts">
          {['もっと上品な言葉に', '短く、わかりやすく', '相談しやすい表現に'].map(
            (t) => (
              <button type="button" key={t} onClick={() => setPrompt(t)}>
                {t}
              </button>
            ),
          )}
        </div>
      )}
      <label>
        どう変えたいですか？{facts.trim() ? '（任意）' : ''}
        <textarea
          maxLength={500}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="大切にしている想いは残して、短く伝えたい"
        />
      </label>
      <button
        className="sc-propose"
        type="button"
        onClick={request}
        disabled={busy || !!unavailable || (!prompt.trim() && !facts.trim()) || needFacts}
      >
        {busy ? (
          <LoaderCircle size={17} className="se-spin" />
        ) : (
          <Sparkles size={17} />
        )}{' '}
        {busy ? '変更案を考えています…' : '変更案をつくる'}
      </button>
      {needFacts && <small>見本のままの欄です。上の「使う情報」に事実を書くと、文案を作れます。</small>}
      {!unavailable && (
        <small>
          ログインとご契約が必要です。実績・価格・事実は、採用前にご自身で確認してください。
        </small>
      )}
      {error && (
        <p role="alert" className="sc-error">
          {error}
        </p>
      )}
      {(missing.length > 0 || dropped.length > 0) && (
        <div className="sc-missing" data-ai-missing role="status">
          {missing.length > 0 && (
            <>
              <strong>この情報があれば書けます</strong>
              <ul>{missing.map((m) => <li key={m}>{m}</li>)}</ul>
            </>
          )}
          {dropped.length > 0 && (
            <>
              <strong>提案から外した欄</strong>
              <ul>{dropped.map((d) => <li key={d.key}>{aiFieldLabel(block, d.key)}：{d.reason}</li>)}</ul>
            </>
          )}
          {!proposal && <p>文章は変えていません。見本の文章もそのまま残しています。</p>}
        </div>
      )}
      {proposal && (
        <div className="sc-proposals" data-ai-proposal>
          <h4>採用する文章を選ぶ</h4>
          {proposal.facts && (
            <div className="sc-used-facts" data-ai-used-facts>
              <strong>使った本人の情報</strong>
              <p>{proposal.facts}</p>
              <small>新しい文章が、この情報と合っているか確かめてから採用してください。</small>
            </div>
          )}
          {Object.entries(proposal.changes).map(([key, text]) => (
            <label className="sc-proposal" key={key} data-ai-change={key}>
              <span>
                <input
                  type="checkbox"
                  checked={keys.includes(key)}
                  onChange={(e) =>
                    setKeys(
                      e.target.checked
                        ? [...keys, key]
                        : keys.filter((k) => k !== key),
                    )
                  }
                />
                {aiFieldLabel(block, key)}
              </span>
              <del>{proposal.before[key] || '（空欄）'}</del>
              <ArrowRight size={14} />
              <ins>{text || '（空欄）'}</ins>
            </label>
          ))}
          <button
            className="sc-propose"
            type="button"
            disabled={!keys.length}
            onClick={() => {
              if (onApply(proposal, keys)) {
                setProposal(null);
                setError('');
                setMissing([]);
                setDropped([]);
              } else
                setError(
                  '提案後に文章が変わりました。作り直してから採用してください。',
                );
            }}
          >
            選んだ{keys.length}か所を採用
          </button>
          <button
            type="button"
            className="sc-discard"
            onClick={() => setProposal(null)}
          >
            採用せず閉じる
          </button>
        </div>
      )}
    </div>
  );
}
