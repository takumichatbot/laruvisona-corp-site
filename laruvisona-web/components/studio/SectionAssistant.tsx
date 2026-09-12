'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowRight, LoaderCircle } from 'lucide-react';
import {
  aiFields,
  parseSectionProposal,
  type SectionProposal,
} from '@/lib/studio-ai';
import { BLOCK_DEFS } from '@/lib/studio-schema';
import type { Block } from '@/types/laruHP';
export default function SectionAssistant({
  block,
  siteId,
  onApply,
}: {
  block: Block;
  siteId: string | null;
  onApply: (proposal: SectionProposal, keys: string[]) => boolean;
}) {
  const [prompt, setPrompt] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [proposal, setProposal] = useState<SectionProposal | null>(null),
    [keys, setKeys] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const request = async () => {
    if (busy || !prompt.trim()) return;
    setBusy(true);
    setError('');
    setProposal(null);
    const before = structuredClone(block);
    controller.current = new AbortController();
    try {
      const res = await fetch('/api/ai/section-proposal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          siteId,
          block: { id: before.id, type: before.type, data: aiFields(before) },
          prompt,
        }),
        signal: controller.current.signal,
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || '提案を取得できませんでした。');
      const parsed = parseSectionProposal(before, data.proposal?.changes);
      if (!parsed) throw Error('提案の形式を確認できませんでした。');
      setProposal(parsed);
      setKeys(Object.keys(parsed.changes));
    } catch (e) {
      if (!controller.current?.signal.aborted)
        setError(
          e instanceof Error ? e.message : '提案を取得できませんでした。',
        );
    } finally {
      setBusy(false);
    }
  };
  if (!Object.keys(aiFields(block)).length)
    return (
      <p className="sc-assistant-note">
        この節にはAIで提案できる文章がありません。対象は2,000文字以内の見出し・説明文です。写真や見せ方は隣のタブから編集できます。
      </p>
    );
  return (
    <div className="sc-assistant">
      <h3>
        <Sparkles size={18} />
        この場所を、一緒に磨く
      </h3>
      <p>
        選んだ節の文章だけを提案します。採用するまで、元の文章は変わりません。
      </p>
      <div className="sc-prompts">
        {['もっと上品な言葉に', '短く、わかりやすく', '相談しやすい表現に'].map(
          (t) => (
            <button type="button" key={t} onClick={() => setPrompt(t)}>
              {t}
            </button>
          ),
        )}
      </div>
      <label>
        どう変えたいですか？
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
        disabled={busy || !prompt.trim()}
      >
        {busy ? (
          <LoaderCircle size={17} className="se-spin" />
        ) : (
          <Sparkles size={17} />
        )}{' '}
        {busy ? '変更案を考えています…' : '変更案をつくる'}
      </button>
      <small>
        ログインとご契約が必要です。実績・価格・事実は、採用前にご自身で確認してください。
      </small>
      {error && (
        <p role="alert" className="sc-error">
          {error}
        </p>
      )}
      {proposal && (
        <div className="sc-proposals">
          <h4>採用する文章を選ぶ</h4>
          {Object.entries(proposal.changes).map(([key, text]) => (
            <label className="sc-proposal" key={key}>
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
                {BLOCK_DEFS[block.type]?.fields.find((f) => f.key === key)
                  ?.label || key}
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
