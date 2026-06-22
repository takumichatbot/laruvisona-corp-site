'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface SequenceStep {
  delay: number;
  subject: string;
  body: string;
}

interface Sequence {
  id: string;
  name: string;
  trigger: 'contact_form' | 'manual' | 'booking';
  steps: SequenceStep[];
  active: boolean;
  enrolledCount: number;
  createdAt: string;
}

interface Site {
  id: string;
  name: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  contact_form: '問い合わせフォーム送信時',
  booking: '予約完了時',
  manual: '手動で登録',
};

const DEFAULT_STEPS: SequenceStep[] = [
  { delay: 0, subject: 'お問い合わせありがとうございます', body: '{{name}}様\n\nこの度はお問い合わせいただき、ありがとうございます。\n内容を確認の上、担当者よりご連絡いたします。\n\n引き続きよろしくお願いいたします。' },
  { delay: 24, subject: '確認のご連絡', body: '{{name}}様\n\n昨日はお問い合わせいただき、ありがとうございました。\nその後いかがでしょうか？\n\nご不明な点がございましたら、お気軽にご連絡ください。' },
  { delay: 72, subject: '特別なご案内', body: '{{name}}様\n\n先日はお問い合わせいただき、ありがとうございました。\nこの機会に、特別なご案内をお送りします...' },
];

export default function SequencesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState<{ name: string; trigger: Sequence['trigger']; steps: SequenceStep[] }>({
    name: '',
    trigger: 'contact_form',
    steps: [...DEFAULT_STEPS],
  });

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsgType(type);
    setMsg(text);
    setTimeout(() => setMsg(''), 4000);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/laruHP/auth/login'); return; }
        const res = await fetch('/api/sites');
        if (!res.ok) throw new Error('sites fetch failed');
        const d = await res.json();
        const s: Site[] = d.sites || [];
        setSites(s);
        if (s.length > 0) {
          setSelectedSite(s[0]);
          await loadSequences(s[0].id);
        }
      } catch {
        setError('データの読み込みに失敗しました。ページを再読み込みしてください。');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSequences = async (siteId: string) => {
    try {
      const res = await fetch(`/api/sequences?siteId=${siteId}`);
      if (!res.ok) throw new Error('sequences fetch failed');
      const d = await res.json();
      setSequences(d.sequences || []);
    } catch {
      showMsg('シーケンスの読み込みに失敗しました', 'error');
    }
  };

  const handleCreate = async () => {
    if (!selectedSite || !form.name || !form.steps.length) return;
    setSaving(true);
    try {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: selectedSite.id, ...form }),
      });
      if (res.ok) {
        const d = await res.json();
        setSequences(prev => [...prev, d.sequence]);
        setForm({ name: '', trigger: 'contact_form', steps: [...DEFAULT_STEPS] });
        setShowForm(false);
        showMsg('シーケンスを作成しました');
      } else {
        const d = await res.json().catch(() => ({}));
        showMsg((d as { error?: string }).error || 'シーケンスの作成に失敗しました', 'error');
      }
    } catch {
      showMsg('ネットワークエラーが発生しました', 'error');
    }
    setSaving(false);
  };

  const handleToggle = async (seq: Sequence) => {
    if (!selectedSite) return;
    try {
      const res = await fetch(`/api/sequences?sequenceId=${seq.id}&siteId=${selectedSite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !seq.active }),
      });
      if (res.ok) {
        setSequences(prev => prev.map(s => s.id === seq.id ? { ...s, active: !s.active } : s));
      } else {
        showMsg('更新に失敗しました', 'error');
      }
    } catch {
      showMsg('ネットワークエラーが発生しました', 'error');
    }
  };

  const handleDelete = async (seqId: string) => {
    if (!selectedSite || !confirm('このシーケンスを削除しますか？')) return;
    try {
      const res = await fetch(`/api/sequences?sequenceId=${seqId}&siteId=${selectedSite.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSequences(prev => prev.filter(s => s.id !== seqId));
      } else {
        showMsg('削除に失敗しました', 'error');
      }
    } catch {
      showMsg('ネットワークエラーが発生しました', 'error');
    }
  };

  const updateStep = (i: number, key: keyof SequenceStep, value: string | number) => {
    setForm(f => {
      const steps = [...f.steps];
      steps[i] = { ...steps[i], [key]: value };
      return { ...f, steps };
    });
  };

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 transition-colors';

  if (loading) return <div className="min-h-screen bg-sky-50 flex items-center justify-center"><div className="text-gray-500 text-sm">読み込み中...</div></div>;
  if (error) return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center p-6">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-sm w-full text-center">
        <p className="text-red-700 font-semibold text-sm mb-3">{error}</p>
        <button onClick={() => window.location.reload()} className="text-xs bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-500 transition-colors">再読み込み</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="border-b border-sky-100 bg-white/90 backdrop-blur-xl shadow-sm px-6 py-4 flex items-center gap-4">
        <Link href="/laruHP/dashboard" className="text-gray-500 hover:text-gray-700 text-sm transition-colors">← ダッシュボード</Link>
        <h1 className="text-sm font-bold text-gray-900 mx-auto">メールシーケンス</h1>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Site picker */}
        {sites.length > 1 && (
          <select
            value={selectedSite?.id || ''}
            onChange={async e => {
              const s = sites.find(x => x.id === e.target.value) ?? null;
              setSelectedSite(s);
              if (s) await loadSequences(s.id);
            }}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-500"
          >
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {msg && (
          <div className={`text-xs font-semibold px-4 py-3 rounded-xl ${msgType === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>
        )}

        {/* Create button */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-2xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新しいシーケンスを作成
          </button>
        ) : (
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-gray-900">メールシーケンスを作成</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">シーケンス名</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="問い合わせフォロー" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">開始トリガー</label>
                <select value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value as Sequence['trigger'] }))} className={inputCls}>
                  {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Steps */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-3 block">メールステップ（{form.steps.length}通）</label>
              <div className="space-y-4">
                {form.steps.map((step, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0">{i + 1}</div>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
                            {i === 0 ? '即時送信' : `前のメールから（時間）`}
                          </label>
                          <input
                            type="number"
                            value={step.delay}
                            onChange={e => updateStep(i, 'delay', parseInt(e.target.value) || 0)}
                            disabled={i === 0}
                            min="0"
                            className={inputCls + ' disabled:opacity-40 text-xs py-1.5'}
                            placeholder="0 = 即時"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 mb-1 block">件名</label>
                          <input
                            type="text"
                            value={step.subject}
                            onChange={e => updateStep(i, 'subject', e.target.value)}
                            className={inputCls + ' text-xs py-1.5'}
                          />
                        </div>
                      </div>
                      {form.steps.length > 1 && (
                        <button
                          onClick={() => setForm(f => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }))}
                          className="text-gray-300 hover:text-red-400 transition-colors text-xs flex-shrink-0"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <textarea
                      value={step.body}
                      onChange={e => updateStep(i, 'body', e.target.value)}
                      className={inputCls + ' h-24 resize-none text-xs'}
                      placeholder="メール本文。{{name}}で顧客名が入ります"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={() => setForm(f => ({ ...f, steps: [...f.steps, { delay: 48, subject: 'フォローアップ', body: '' }] }))}
                className="mt-3 w-full border border-dashed border-gray-300 text-gray-500 hover:border-sky-300 hover:text-sky-600 text-xs font-semibold py-2.5 rounded-xl transition-colors"
              >
                + ステップを追加
              </button>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-600 font-bold py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.name || !form.steps.length}
                className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                {saving ? '保存中...' : 'シーケンスを作成'}
              </button>
            </div>
          </section>
        )}

        {/* Sequences list */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-sm text-gray-900 mb-4">シーケンス一覧（{sequences.length}件）</h2>

          {sequences.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">✉️</div>
              <p className="text-sm text-gray-500">まだシーケンスがありません</p>
              <p className="text-xs text-gray-400 mt-1">問い合わせやメール登録後の自動フォローアップを設定しましょう</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sequences.map(seq => (
                <div key={seq.id} className={`border rounded-2xl overflow-hidden transition-colors ${seq.active ? 'border-gray-200' : 'border-gray-100 opacity-70'}`}>
                  <button
                    onClick={() => setExpandedId(expandedId === seq.id ? null : seq.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-sm text-gray-900">{seq.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${seq.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {seq.active ? '有効' : '停止中'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-2">
                        <span>{TRIGGER_LABELS[seq.trigger]}</span>
                        <span>·</span>
                        <span>{seq.steps.length}通のメール</span>
                      </div>
                    </div>
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`text-gray-400 flex-shrink-0 transition-transform ${expandedId === seq.id ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {expandedId === seq.id && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                      <div className="space-y-2 mb-4">
                        {seq.steps.map((step, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <div className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">{i + 1}</div>
                            <div>
                              <span className="font-semibold text-gray-700">{step.subject}</span>
                              <span className="text-gray-400 ml-2">{i === 0 ? '即時' : `${step.delay}時間後`}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggle(seq)}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all ${seq.active ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                        >
                          {seq.active ? '停止する' : '有効にする'}
                        </button>
                        <button
                          onClick={() => handleDelete(seq.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-bold transition-all"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Info */}
        <section className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
          <h3 className="font-bold text-sm text-indigo-900 mb-2">シーケンスの動作</h3>
          <ul className="space-y-1.5 text-xs text-indigo-700">
            <li>• 問い合わせフォームが送信されると自動的にシーケンスが開始されます</li>
            <li>• <code className="bg-indigo-100 px-1 rounded">{'{{name}}'}</code> は顧客名に自動置換されます</li>
            <li>• シーケンスを複数作成した場合、トリガーが一致する最初のアクティブなものが実行されます</li>
            <li>• 送信にはResend（送信数が無料枠内）を使用します</li>
          </ul>
        </section>

      </div>
    </div>
  );
}
