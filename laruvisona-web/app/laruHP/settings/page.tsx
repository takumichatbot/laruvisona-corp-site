'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

const PLAN_LABELS: Record<string, { name: string; price: string; color: string }> = {
  hp:           { name: 'HP プラン',               price: '¥999/月',    color: 'text-sky-600 bg-sky-50 border-sky-200' },
  lite:         { name: 'HP + LARUbot Lite',        price: '¥2,480/月',  color: 'text-indigo-500 bg-indigo-50 border-indigo-200' },
  'hp-bot':     { name: 'HP + LARUbot',             price: '¥4,980/月',  color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  'hp-bot-seo': { name: 'HP + Bot + SEO',           price: '¥9,800/月',  color: 'text-purple-600 bg-purple-50 border-purple-200' },
  agency:       { name: 'エージェンシー',            price: '¥19,800/月', color: 'text-violet-600 bg-violet-50 border-violet-200' },
};

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [plan, setPlan] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalMsg, setPortalMsg] = useState('');

  // GSC state
  const [gscConnected, setGscConnected] = useState(false);
  const [gscSiteUrl, setGscSiteUrl] = useState<string | null>(null);
  const [gscAvailableSites, setGscAvailableSites] = useState<string[]>([]);
  const [gscLoading, setGscLoading] = useState(true);
  const [gscSaving, setGscSaving] = useState(false);
  const [gscMsg, setGscMsg] = useState('');
  const [gscSelectVal, setGscSelectVal] = useState('');

  useEffect(() => {
    const gscParam = searchParams.get('gsc');
    if (gscParam === 'connected') setGscMsg('Googleアカウントを連携しました。プロパティを選択してください。');
    if (gscParam === 'error') setGscMsg('error:Google連携に失敗しました。もう一度お試しください。');
    router.replace('/laruHP/settings');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/laruHP/auth/login'); return; }
      const { data: profile } = await supabase.from('profiles').select('plan, brand_logo_url').eq('id', user.id).single();
      setPlan(profile?.plan ?? null);
      if ((profile as { brand_logo_url?: string | null } | null)?.brand_logo_url) {
        setBrandLogoUrl((profile as { brand_logo_url: string }).brand_logo_url);
      }
      setPlanLoading(false);

      // Load GSC status
      try {
        const res = await fetch('/api/search-console/data');
        const d = await res.json();
        setGscConnected(!!d.connected);
        setGscSiteUrl(d.siteUrl ?? null);
        setGscAvailableSites(d.availableSites ?? []);
        setGscSelectVal(d.siteUrl ?? (d.availableSites?.[0] ?? ''));
      } catch {/* ignore */} finally {
        setGscLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openBillingPortal = async () => {
    setPortalLoading(true);
    setPortalMsg('');
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.url) {
      window.location.href = data.url;
    } else if (res.status === 403 && data.message) {
      setPortalMsg(data.message);
    } else {
      setPortalMsg('サブスクリプション情報が見つかりません。');
    }
    setPortalLoading(false);
  };

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

  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [brandLogoLoading, setBrandLogoLoading] = useState(false);
  const [brandLogoMsg, setBrandLogoMsg] = useState('');

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

        {/* Plan */}
        {!planLoading && (
          <section className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
            <h2 className="font-bold text-sm mb-1 text-gray-900">現在のプラン</h2>
            <p className="text-gray-500 text-xs mb-4">ご契約中のプランと料金です。</p>
            {plan ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className={`inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-sm font-bold ${PLAN_LABELS[plan]?.color ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                    {PLAN_LABELS[plan]?.name ?? plan}
                    <span className="font-normal text-xs opacity-70">{PLAN_LABELS[plan]?.price}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {plan === 'agency' && (
                      <Link href="/laruHP/agency" className="text-xs text-violet-600 hover:text-violet-500 border border-violet-200 rounded-lg px-3 py-2 transition-colors">
                        代理店管理
                      </Link>
                    )}
                    <Link href="/laruHP/plans" className="text-xs text-sky-600 hover:text-sky-500 border border-sky-200 rounded-lg px-3 py-2 transition-colors">
                      プラン変更
                    </Link>
                    <button
                      onClick={openBillingPortal}
                      disabled={portalLoading}
                      className="text-xs text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
                    >
                      {portalLoading ? '読み込み中...' : 'サブスクリプション管理'}
                    </button>
                  </div>
                </div>
                {portalMsg && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{portalMsg}</p>}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                プランが設定されていません。
                <Link href="/laruHP/plans" className="ml-2 text-sky-600 hover:text-sky-500">プランを選ぶ →</Link>
              </div>
            )}
          </section>
        )}

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

        {/* Agency white-label */}
        {plan === 'agency' && (
          <section className="bg-white border border-violet-200 shadow-sm rounded-2xl p-6">
            <h2 className="font-bold text-sm mb-1 text-gray-900">ホワイトラベル設定</h2>
            <p className="text-gray-500 text-xs mb-5">ビルダーのヘッダーに表示されるロゴを差し替えます。クライアントに見せる画面から LARU HP ブランドを非表示にできます。</p>
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                {brandLogoUrl && (
                  <img src={brandLogoUrl} alt="ロゴプレビュー" className="h-8 w-auto max-w-[120px] object-contain rounded border border-gray-200" />
                )}
                {!brandLogoUrl && (
                  <div className="h-8 w-8 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-400 text-xs font-bold">L</div>
                )}
                <span className="text-xs text-gray-500">現在のロゴ</span>
              </div>
              <input
                type="url"
                placeholder="ロゴ画像のURL（PNG / SVG 推奨）"
                value={brandLogoUrl}
                onChange={e => { setBrandLogoUrl(e.target.value); setBrandLogoMsg(''); }}
                className={inputCls}
              />
              {brandLogoMsg && (
                <p className={`text-xs ${brandLogoMsg.includes('エラー') ? 'text-red-600' : 'text-emerald-700'}`}>{brandLogoMsg}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setBrandLogoLoading(true);
                    setBrandLogoMsg('');
                    const res = await fetch('/api/account/brand', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ brand_logo_url: brandLogoUrl }),
                    });
                    setBrandLogoMsg(res.ok ? '保存しました' : 'エラーが発生しました');
                    setBrandLogoLoading(false);
                  }}
                  disabled={brandLogoLoading}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
                >
                  {brandLogoLoading ? '保存中...' : 'ロゴURLを保存'}
                </button>
                {brandLogoUrl && (
                  <button
                    onClick={async () => {
                      setBrandLogoLoading(true);
                      const res = await fetch('/api/account/brand', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ brand_logo_url: '' }),
                      });
                      if (res.ok) { setBrandLogoUrl(''); setBrandLogoMsg('リセットしました'); }
                      setBrandLogoLoading(false);
                    }}
                    disabled={brandLogoLoading}
                    className="border border-gray-200 text-gray-600 hover:text-gray-900 disabled:opacity-50 py-2.5 px-4 rounded-lg text-sm transition-colors"
                  >
                    リセット
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Google Search Console */}
        <section id="gsc" className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <h2 className="font-bold text-sm mb-1 text-gray-900">Google Search Console 連携</h2>
          <p className="text-gray-500 text-xs mb-5">サイトの検索クリック数・表示回数・平均順位をダッシュボードで確認できます。</p>
          {gscMsg && (
            <p className={`text-xs mb-4 px-3 py-2 rounded-lg border ${gscMsg.startsWith('error:') ? 'text-red-600 bg-red-50 border-red-200' : 'text-green-700 bg-green-50 border-green-200'}`}>
              {gscMsg.replace('error:', '')}
            </p>
          )}
          {gscLoading ? (
            <div className="text-xs text-gray-400">読み込み中...</div>
          ) : !gscConnected ? (
            <a
              href="/api/auth/google"
              className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-orange-300 hover:text-orange-600 text-gray-700 font-semibold text-sm px-4 py-2.5 rounded-lg transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.102 18.08.116 18.1.136 18.116a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Googleアカウントで連携する
            </a>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-600 font-semibold">✓ 連携済み</span>
                {gscSiteUrl && <span className="text-gray-400 text-xs">{gscSiteUrl}</span>}
              </div>

              {gscAvailableSites.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-600 block">プロパティを選択</label>
                  <div className="flex gap-2">
                    <select
                      value={gscSelectVal}
                      onChange={e => setGscSelectVal(e.target.value)}
                      className={inputCls + ' flex-1'}
                    >
                      <option value="">-- プロパティを選択 --</option>
                      {gscAvailableSites.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      onClick={async () => {
                        if (!gscSelectVal) return;
                        setGscSaving(true);
                        setGscMsg('');
                        const res = await fetch('/api/search-console/settings', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ siteUrl: gscSelectVal }),
                        });
                        if (res.ok) { setGscSiteUrl(gscSelectVal); setGscMsg('プロパティを保存しました'); }
                        else setGscMsg('error:保存に失敗しました');
                        setGscSaving(false);
                      }}
                      disabled={gscSaving || !gscSelectVal}
                      className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-colors whitespace-nowrap"
                    >
                      {gscSaving ? '保存中...' : '保存'}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={async () => {
                  setGscSaving(true);
                  await fetch('/api/search-console/settings', { method: 'DELETE' });
                  setGscConnected(false);
                  setGscSiteUrl(null);
                  setGscAvailableSites([]);
                  setGscSelectVal('');
                  setGscMsg('');
                  setGscSaving(false);
                }}
                disabled={gscSaving}
                className="text-xs text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                連携を解除する
              </button>
            </div>
          )}
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
