'use client';
import { useState, useEffect } from 'react';

export default function InquiryForm({ dark = false, prefillMessage = '' }: { dark?: boolean; prefillMessage?: string }) {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '', _hp: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  // 見積もりシミュレーター等からの引き継ぎ（「この内容で相談する」を押すたびに最新の内容で上書き）
  useEffect(() => {
    if (prefillMessage) setForm(f => ({ ...f, message: prefillMessage }));
  }, [prefillMessage]);

  const inputCls = dark
    ? 'w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors'
    : 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-sky-500 transition-colors';
  const labelCls = dark ? 'block text-left text-xs font-bold text-slate-300 mb-1.5' : 'block text-left text-xs font-bold text-gray-600 mb-1.5';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form._hp) return;
    if (!form.name || !form.email || !form.message) { setError('お名前・メール・お問い合わせ内容は必須です'); return; }
    setStatus('sending'); setError('');
    try {
      const res = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) setStatus('success');
      else { setError(d.error || '送信に失敗しました'); setStatus('error'); }
    } catch { setError('ネットワークエラーが発生しました'); setStatus('error'); }
  };

  if (status === 'success') {
    return (
      <div className={`rounded-2xl p-10 text-center ${dark ? 'bg-white/5 border border-white/10' : 'bg-green-50 border border-green-200'}`}>
        <div className="text-4xl mb-3">✅</div>
        <p className={`font-bold text-lg ${dark ? 'text-white' : 'text-green-800'}`}>お問い合わせを送信しました</p>
        <p className={`text-sm mt-2 ${dark ? 'text-slate-400' : 'text-green-700'}`}>内容を確認のうえ、通常2営業日以内にご返信いたします。</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>お名前 <span className="text-red-400">*</span></label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="山田 太郎" required />
        </div>
        <div>
          <label className={labelCls}>メールアドレス <span className="text-red-400">*</span></label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="you@example.com" required />
        </div>
      </div>
      <div>
        <label className={labelCls}>会社名・屋号（任意）</label>
        <input type="text" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className={inputCls} placeholder="株式会社〇〇" />
      </div>
      <div>
        <label className={labelCls}>お問い合わせ内容 <span className="text-red-400">*</span></label>
        <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className={inputCls + ' h-32 resize-none'} placeholder="ご相談・ご質問の内容をご記入ください" required />
      </div>
      {/* ハニーポット */}
      <input type="text" tabIndex={-1} autoComplete="off" value={form._hp} onChange={e => setForm(f => ({ ...f, _hp: e.target.value }))} style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
      {error && <p className="text-red-400 text-sm font-semibold">{error}</p>}
      <button type="submit" disabled={status === 'sending'}
        className={`w-full font-bold py-3.5 rounded-xl text-sm transition-all disabled:opacity-50 ${dark ? 'bg-white text-black hover:bg-blue-50' : 'bg-sky-600 text-white hover:bg-sky-500'}`}>
        {status === 'sending' ? '送信中...' : '送信する'}
      </button>
      <p className={`text-xs text-center ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
        または <a href="mailto:info@laruvisona.jp" className={dark ? 'text-blue-400 underline' : 'text-sky-600 underline'}>info@laruvisona.jp</a> まで直接ご連絡ください
      </p>
    </form>
  );
}
