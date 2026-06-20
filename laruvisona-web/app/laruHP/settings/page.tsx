'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setEmailLoading(true);
    setEmailMsg('');
    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      setEmailMsg(`エラー: ${error.message}`);
    } else {
      setEmailMsg('確認メールを送信しました。新しいメールアドレスで確認してください。');
      setEmail('');
    }
    setEmailLoading(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwMsg('パスワードが一致しません'); return; }
    if (newPw.length < 8) { setPwMsg('パスワードは8文字以上で設定してください'); return; }
    setPwLoading(true);
    setPwMsg('');
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      setPwMsg(`エラー: ${error.message}`);
    } else {
      setPwMsg('パスワードを変更しました。');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    }
    setPwLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== '削除する') return;
    setDeleteLoading(true);
    const res = await fetch('/api/account/delete', { method: 'DELETE' });
    if (res.ok) {
      await supabase.auth.signOut();
      router.push('/laruHP');
    } else {
      setDeleteMsg('削除に失敗しました。サポートにお問い合わせください。');
      setDeleteLoading(false);
    }
  };

  const inputCls = 'w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-sky-500 transition-colors';

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="border-b border-sky-100 bg-white/90 backdrop-blur-xl shadow-sm px-6 py-4 flex items-center gap-4">
        <Link href="/laruHP/dashboard" className="text-gray-500 hover:text-gray-700 text-sm transition-colors">← ダッシュボード</Link>
        <h1 className="text-sm font-bold text-gray-900 ml-auto mr-auto">アカウント設定</h1>
      </header>

      <div className="max-w-xl mx-auto px-6 py-10 space-y-8">

        {/* Email */}
        <section className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <h2 className="font-bold text-sm mb-1 text-gray-900">メールアドレスの変更</h2>
          <p className="text-gray-500 text-xs mb-5">新しいメールアドレスに確認メールが送信されます。</p>
          <form onSubmit={handleEmailChange} className="space-y-3">
            <input type="email" placeholder="新しいメールアドレス" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} required />
            {emailMsg && <p className={`text-xs ${emailMsg.startsWith('エラー') ? 'text-red-600' : 'text-emerald-700'}`}>{emailMsg}</p>}
            <button type="submit" disabled={emailLoading} className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition-colors">
              {emailLoading ? '送信中...' : '確認メールを送信'}
            </button>
          </form>
        </section>

        {/* Password */}
        <section className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <h2 className="font-bold text-sm mb-1 text-gray-900">パスワードの変更</h2>
          <p className="text-gray-500 text-xs mb-5">8文字以上で設定してください。</p>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <input type="password" placeholder="現在のパスワード（確認用）" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className={inputCls} />
            <input type="password" placeholder="新しいパスワード（8文字以上）" value={newPw} onChange={e => setNewPw(e.target.value)} className={inputCls} required />
            <input type="password" placeholder="新しいパスワード（確認）" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={inputCls} required />
            {pwMsg && <p className={`text-xs ${pwMsg.startsWith('エラー') || pwMsg.includes('一致') || pwMsg.includes('文字') ? 'text-red-600' : 'text-emerald-700'}`}>{pwMsg}</p>}
            <button type="submit" disabled={pwLoading} className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition-colors">
              {pwLoading ? '変更中...' : 'パスワードを変更'}
            </button>
          </form>
        </section>

        {/* Delete account */}
        <section className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <h2 className="font-bold text-sm text-red-600 mb-1">アカウントの削除</h2>
          <p className="text-gray-500 text-xs mb-5">アカウントを削除すると、すべてのサイトとデータが完全に削除されます。この操作は取り消せません。</p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="「削除する」と入力してください"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              className={inputCls}
            />
            {deleteMsg && <p className="text-xs text-red-600">{deleteMsg}</p>}
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== '削除する' || deleteLoading}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
            >
              {deleteLoading ? '削除中...' : 'アカウントを完全に削除する'}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
