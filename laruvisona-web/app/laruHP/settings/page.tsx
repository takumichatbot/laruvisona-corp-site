'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

const PLAN_LABELS: Record<string, { name: string; price: string; color: string }> = {
  hp:           { name: 'HP プラン',               price: '¥999/月',    color: 'text-sky-600 bg-sky-50 border-sky-200' },
  lite:         { name: 'HP + LARUbot Lite',        price: '¥2,980/月',  color: 'text-indigo-500 bg-indigo-50 border-indigo-200' },
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

      // Load sites for custom domain settings
      const sitesRes = await fetch('/api/sites');
      const sitesData = await sitesRes.json();
      const ds = (sitesData.sites || []) as { id: string; name: string; slug: string | null; custom_domain: string | null }[];
      setDomainSites(ds);
      const vals: Record<string, string> = {};
      for (const s of ds) vals[s.id] = s.custom_domain || '';
      setDomainValues(vals);

      // Load saved GMB place ID + Instagram from profile
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        const { data: prof } = await supabase.from('profiles').select('gmb_place_id, instagram_username, instagram_access_token').eq('id', u.id).single();
        const gmbSavedVal = (prof as { gmb_place_id?: string } | null)?.gmb_place_id ?? '';
        if (gmbSavedVal) { setGmbPlaceId(gmbSavedVal); setGmbSaved(gmbSavedVal); }
        const igUser = (prof as { instagram_username?: string } | null)?.instagram_username;
        if (igUser) {
          setIgConnected(true);
          setIgUsername(igUser);
          // Load media preview
          const igRes = await fetch('/api/instagram');
          const igData = await igRes.json();
          if (igData.media) setIgMedia(igData.media.slice(0, 6));
        }
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

  // GMB (Google My Business) state
  const [gmbPlaceId, setGmbPlaceId] = useState('');
  const [gmbSaved, setGmbSaved] = useState('');
  const [gmbSaving, setGmbSaving] = useState(false);
  const [gmbPreview, setGmbPreview] = useState<{ name: string; rating: number; totalRatings: number } | null>(null);
  const [gmbPreviewLoading, setGmbPreviewLoading] = useState(false);
  const [gmbMsg, setGmbMsg] = useState('');

  // Instagram state
  const [igToken, setIgToken] = useState('');
  const [igConnected, setIgConnected] = useState(false);
  const [igUsername, setIgUsername] = useState('');
  const [igSaving, setIgSaving] = useState(false);
  const [igMsg, setIgMsg] = useState('');
  const [igMedia, setIgMedia] = useState<{ id: string; media_url: string; permalink: string; caption?: string }[]>([]);

  // Custom domain state
  const [domainSites, setDomainSites] = useState<{ id: string; name: string; slug: string | null; custom_domain: string | null }[]>([]);
  const [domainValues, setDomainValues] = useState<Record<string, string>>({});
  const [domainSaving, setDomainSaving] = useState<string | null>(null);
  const [domainChecking, setDomainChecking] = useState<string | null>(null);
  const [domainMsg, setDomainMsg] = useState<Record<string, { text: string; type: 'success' | 'error' | 'info' }>>({});
  const [domainVerified, setDomainVerified] = useState<Record<string, { verified: boolean; cname: string | null; expectedTarget: string }>>({});

  // GMB reviews + AI reply
  const [gmbReviews, setGmbReviews] = useState<{ author_name: string; rating: number; text: string; relative_time_description: string }[]>([]);
  const [reviewReplies, setReviewReplies] = useState<Record<number, string[]>>({});
  const [reviewReplyLoading, setReviewReplyLoading] = useState<number | null>(null);
  const [reviewReplySelected, setReviewReplySelected] = useState<Record<number, string>>({});

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

  const handleIgConnect = async () => {
    if (!igToken.trim()) return;
    setIgSaving(true);
    setIgMsg('');
    const res = await fetch('/api/instagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: igToken.trim() }),
    });
    const d = await res.json();
    if (!res.ok) { setIgMsg(`エラー: ${d.error ?? '接続に失敗しました'}`); setIgSaving(false); return; }
    setIgConnected(true);
    setIgUsername(d.username);
    setIgMsg('接続しました');
    setIgToken('');
    const igRes = await fetch('/api/instagram');
    const igData = await igRes.json();
    if (igData.media) setIgMedia(igData.media.slice(0, 6));
    setIgSaving(false);
  };

  const handleIgDisconnect = async () => {
    if (!confirm('Instagramの連携を解除しますか？')) return;
    await fetch('/api/instagram', { method: 'DELETE' });
    setIgConnected(false);
    setIgUsername('');
    setIgMedia([]);
    setIgMsg('連携を解除しました');
  };

  const handleGmbPreview = async () => {
    if (!gmbPlaceId.trim()) return;
    setGmbPreviewLoading(true);
    setGmbMsg('');
    try {
      const res = await fetch(`/api/google/reviews?placeId=${encodeURIComponent(gmbPlaceId.trim())}`);
      if (!res.ok) { const e = await res.json(); setGmbMsg(`エラー: ${e.error ?? '確認できませんでした'}`); return; }
      const d = await res.json();
      setGmbPreview({ name: d.name, rating: d.rating, totalRatings: d.totalRatings });
      setGmbReviews(d.reviews || []);
    } catch { setGmbMsg('確認に失敗しました。Place IDを確認してください。'); }
    finally { setGmbPreviewLoading(false); }
  };

  const handleReviewReply = async (idx: number, review: { author_name: string; rating: number; text: string }) => {
    if (!gmbPreview) return;
    setReviewReplyLoading(idx);
    const res = await fetch('/api/ai/review-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewText: review.text,
        reviewerName: review.author_name,
        rating: review.rating,
        businessName: gmbPreview.name,
      }),
    });
    const d = await res.json();
    if (res.ok && d.replies) {
      setReviewReplies(prev => ({ ...prev, [idx]: d.replies }));
    }
    setReviewReplyLoading(null);
  };

  const handleGmbSave = async () => {
    if (!gmbPlaceId.trim()) return;
    setGmbSaving(true);
    setGmbMsg('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setGmbMsg('ログインが必要です'); setGmbSaving(false); return; }
    const { error } = await supabase.from('profiles').update({ gmb_place_id: gmbPlaceId.trim() }).eq('id', user.id);
    if (error) { setGmbMsg(`保存に失敗しました: ${error.message}`); }
    else { setGmbSaved(gmbPlaceId.trim()); setGmbMsg('保存しました'); }
    setGmbSaving(false);
  };

  const handleDomainSave = async (siteId: string) => {
    const domain = (domainValues[siteId] || '').trim().toLowerCase().replace(/^https?:\/\//, '');
    setDomainSaving(siteId);
    setDomainMsg(prev => ({ ...prev, [siteId]: { text: '', type: 'info' } }));
    const res = await fetch(`/api/sites/${siteId}/domain`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customDomain: domain || null }),
    });
    const d = await res.json() as { ok?: boolean; error?: string; renderStatus?: string };
    if (res.ok) {
      setDomainSites(prev => prev.map(s => s.id === siteId ? { ...s, custom_domain: domain || null } : s));
      const renderNote = d.renderStatus && d.renderStatus !== 'registered' ? `（Render: ${d.renderStatus}）` : '';
      setDomainMsg(prev => ({ ...prev, [siteId]: { text: domain ? `保存しました${renderNote}。次にDNSを設定してください。` : 'ドメインを削除しました', type: 'success' } }));
    } else {
      setDomainMsg(prev => ({ ...prev, [siteId]: { text: `エラー: ${d.error || '保存に失敗しました'}`, type: 'error' } }));
    }
    setDomainSaving(null);
  };

  const handleDomainCheck = async (siteId: string) => {
    setDomainChecking(siteId);
    setDomainMsg(prev => ({ ...prev, [siteId]: { text: 'DNS確認中...', type: 'info' } }));
    try {
      const res = await fetch(`/api/sites/${siteId}/domain`);
      const d = await res.json() as { verified?: boolean; dnsVerified?: boolean; cname?: string | null; aRecord?: string | null; expectedTarget?: string; expectedApexIp?: string; reason?: string };
      if (d.reason === 'no_domain') {
        setDomainMsg(prev => ({ ...prev, [siteId]: { text: 'ドメインが設定されていません', type: 'error' } }));
      } else if (d.verified) {
        setDomainMsg(prev => ({ ...prev, [siteId]: { text: '✓ DNS確認済み！サイトが独自ドメインで表示されています。', type: 'success' } }));
        setDomainVerified(prev => ({ ...prev, [siteId]: { verified: true, cname: d.cname ?? null, expectedTarget: d.expectedTarget ?? '' } }));
      } else {
        setDomainMsg(prev => ({ ...prev, [siteId]: { text: `DNS未反映。現在: CNAME ${d.cname || 'なし'} / A ${d.aRecord || 'なし'} → 期待値: CNAME ${d.expectedTarget || '---'} または A ${d.expectedApexIp || '---'}`, type: 'error' } }));
        setDomainVerified(prev => ({ ...prev, [siteId]: { verified: false, cname: d.cname ?? null, expectedTarget: d.expectedTarget ?? '' } }));
      }
    } catch {
      setDomainMsg(prev => ({ ...prev, [siteId]: { text: 'DNS確認に失敗しました', type: 'error' } }));
    }
    setDomainChecking(null);
  };

  const inputCls = 'w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-sky-500 transition-colors';

  const [igDisconnectConfirm, setIgDisconnectConfirm] = useState(false);

  const handleIgDisconnectClick = () => setIgDisconnectConfirm(true);
  const handleIgDisconnectCancel = () => setIgDisconnectConfirm(false);
  const handleIgDisconnectConfirm = async () => {
    setIgDisconnectConfirm(false);
    await fetch('/api/instagram', { method: 'DELETE' });
    setIgConnected(false);
    setIgUsername('');
    setIgMedia([]);
    setIgMsg('連携を解除しました');
  };

  const pwStrength = (() => {
    if (!newPw) return 0;
    if (newPw.length < 8) return 1;
    if (newPw.length < 12) return 2;
    return 3;
  })();

  type Tab = 'account' | 'domain' | 'integrations' | 'danger';
  const [activeTab, setActiveTab] = useState<Tab>('account');

  const TABS: { id: Tab; label: string }[] = [
    { id: 'account', label: 'アカウント' },
    { id: 'domain', label: '独自ドメイン' },
    { id: 'integrations', label: '外部連携' },
    { id: 'danger', label: '退会・削除' },
  ];

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="border-b border-sky-100 bg-white/90 backdrop-blur-xl shadow-sm px-6 py-4 flex items-center gap-4">
        <Link href="/laruHP/dashboard" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          ダッシュボード
        </Link>
        <h1 className="text-sm font-bold text-gray-900 ml-auto mr-auto">アカウント設定</h1>
      </header>

      {/* Tabs */}
      <div className="border-b border-sky-100 bg-white/70 backdrop-blur-md">
        <div className="max-w-xl mx-auto px-6 flex gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === tab.id ? (tab.id === 'danger' ? 'border-red-500 text-red-600' : 'border-sky-600 text-sky-700') : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab.id === 'danger' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5 mb-0.5" />}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-10 space-y-8">

        {/* ── Account tab ── */}
        {activeTab === 'account' && <>

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
                      className="text-xs text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            <button type="submit" disabled={emailLoading} className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg text-sm transition-colors">
              {emailLoading ? '送信中...' : '確認メールを送信'}
            </button>
          </form>
        </section>

        {/* Password */}
        <section className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <h2 className="font-bold text-sm mb-1 text-gray-900">パスワードの変更</h2>
          <p className="text-gray-500 text-xs mb-5">8文字以上で設定してください。</p>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <input type="password" autoComplete="current-password" placeholder="現在のパスワード（確認用）" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className={inputCls} />
            <div>
              <input type="password" autoComplete="new-password" placeholder="新しいパスワード（8文字以上）" value={newPw} onChange={e => setNewPw(e.target.value)} className={inputCls} required />
              {newPw && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden flex gap-0.5">
                    {[1, 2, 3].map(level => (
                      <div key={level} className={`flex-1 rounded-full transition-all ${pwStrength >= level ? (level === 1 ? 'bg-red-400' : level === 2 ? 'bg-amber-400' : 'bg-green-500') : 'bg-gray-100'}`} />
                    ))}
                  </div>
                  <span className={`text-[10px] font-bold ${pwStrength === 1 ? 'text-red-500' : pwStrength === 2 ? 'text-amber-500' : 'text-green-600'}`}>
                    {pwStrength === 1 ? '弱い' : pwStrength === 2 ? '普通' : '強い'}
                  </span>
                </div>
              )}
            </div>
            <input type="password" autoComplete="new-password" placeholder="新しいパスワード（確認）" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={inputCls} required />
            {pwMsg && <p className={`text-xs ${pwMsg.startsWith('エラー') || pwMsg.includes('一致') || pwMsg.includes('文字') ? 'text-red-600' : 'text-emerald-700'}`}>{pwMsg}</p>}
            <button type="submit" disabled={pwLoading} className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg text-sm transition-colors">
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
                  <Image src="/laruhp_logo.png" alt="LARU HP" height={32} width={160} className="h-8 w-auto rounded" />
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
                  className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
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
                    className="border border-gray-200 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 px-4 rounded-lg text-sm transition-colors"
                  >
                    リセット
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        </> /* end account tab */}

        {/* ── Domain tab ── */}
        {activeTab === 'domain' && <>

        {/* Custom Domain (moved to its own tab) */}
        {domainSites.length > 0 && (
          <section className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-700"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <h2 className="font-bold text-sm text-gray-900">独自ドメイン設定</h2>
            </div>
            <p className="text-xs text-gray-500 mb-5">取得済みドメインをサイトに紐付けます。設定後、ドメインのDNSにレコードを追加してください（下の手順参照）。</p>
            <div className="space-y-5">
              {domainSites.map(site => (
                <div key={site.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">{site.name}</span>
                    {domainVerified[site.id]?.verified && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">✓ 確認済み</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={domainValues[site.id] ?? ''}
                      onChange={e => setDomainValues(prev => ({ ...prev, [site.id]: e.target.value }))}
                      placeholder="example.com"
                      className={inputCls}
                    />
                    <button onClick={() => handleDomainSave(site.id)} disabled={domainSaving === site.id}
                      className="flex-shrink-0 text-sm bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-4 py-2.5 rounded-lg transition-all">
                      {domainSaving === site.id ? '...' : '保存'}
                    </button>
                    {site.custom_domain && (
                      <button onClick={() => handleDomainCheck(site.id)} disabled={domainChecking === site.id}
                        className="flex-shrink-0 text-xs border border-gray-200 hover:border-sky-300 text-gray-600 px-3 py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {domainChecking === site.id ? '確認中...' : 'DNS確認'}
                      </button>
                    )}
                  </div>
                  {domainMsg[site.id]?.text && (
                    <p className={`text-[11px] font-semibold ${domainMsg[site.id].type === 'error' ? 'text-red-600' : domainMsg[site.id].type === 'success' ? 'text-green-600' : 'text-sky-600'}`}>
                      {domainMsg[site.id].text}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
              <p className="text-[11px] font-bold text-gray-700">DNS設定手順</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-gray-600">
                  <thead><tr className="border-b border-gray-200"><th className="text-left pb-1.5 font-semibold">設定するドメイン</th><th className="text-left pb-1.5 font-semibold">タイプ</th><th className="text-left pb-1.5 font-semibold">ホスト</th><th className="text-left pb-1.5 font-semibold">値</th></tr></thead>
                  <tbody className="font-mono">
                    <tr><td className="py-1 pr-3">www.example.com</td><td className="py-1 pr-3">CNAME</td><td className="py-1 pr-3">www</td><td className="py-1 text-sky-600">laruvisona-corp-site.onrender.com</td></tr>
                    <tr><td className="py-1 pr-3">example.com</td><td className="py-1 pr-3">A</td><td className="py-1 pr-3">@（空欄）</td><td className="py-1 text-sky-600">216.24.57.1</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400">ルートドメイン（@）にはCNAMEを設定できないレジストラが多いため、Aレコードをご利用ください（ALIAS/ANAME対応のDNSならCNAMEと同じ値でも可）。設定後「DNS確認」ボタンで反映状況を確認できます。反映には最大48時間かかる場合があります。</p>
            </div>
          </section>
        )}

        </> /* end domain tab */}

        {/* ── Integrations tab ── */}
        {activeTab === 'integrations' && <>

        {/* Integration status summary */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">連携ステータス</p>
          <div className="flex flex-wrap gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${gscConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${gscConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
              Search Console {gscConnected ? (gscSiteUrl ? `(${gscSiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')})` : '接続済') : '未連携'}
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${gmbSaved ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${gmbSaved ? 'bg-green-500' : 'bg-gray-300'}`} />
              Google マップ {gmbSaved ? '設定済' : '未設定'}
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${igConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${igConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
              Instagram {igConnected ? `@${igUsername}` : '未連携'}
            </div>
          </div>
        </div>

        {/* Google Search Console */}
        <section id="gsc" className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <h2 className="font-bold text-sm mb-1 text-gray-900">Google Search Console 連携</h2>
          <p className="text-gray-500 text-xs mb-3">サイトの検索クリック数・表示回数・平均順位をダッシュボードで確認できます。</p>
          <details className="mb-4">
            <summary className="text-xs text-sky-600 hover:text-sky-500 cursor-pointer font-semibold select-none">設定方法を見る ›</summary>
            <ol className="mt-2 ml-4 space-y-1.5 list-decimal text-xs text-gray-600">
              <li><a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">Google Search Console</a> を開き、サイトを追加してください</li>
              <li>「URLプレフィックス」を選択し、公開中のサイトURLを入力</li>
              <li>所有権を確認（HTMLファイルのアップロード or メタタグ推奨）</li>
              <li>確認完了後、下の「Googleアカウントで連携する」をクリック</li>
            </ol>
          </details>
          {gscMsg && (
            <p className={`text-xs mb-4 px-3 py-2 rounded-lg border ${gscMsg.startsWith('error:') ? 'text-red-600 bg-red-50 border-red-200' : 'text-green-700 bg-green-50 border-green-200'}`}>
              {gscMsg.replace('error:', '')}
            </p>
          )}
          {gscLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <svg className="animate-spin w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
              連携状態を確認中...
            </div>
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
                      className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-colors whitespace-nowrap"
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
                className="text-xs text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                連携を解除する
              </button>
            </div>
          )}
        </section>

        {/* Instagram */}
        <section id="instagram" className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </div>
            <div>
              <h2 className="font-bold text-sm text-gray-900">Instagram連携</h2>
              <p className="text-gray-500 text-xs mt-0.5">最新投稿をサイトに自動表示。アクセストークンを入力して連携します。</p>
            </div>
          </div>

          {igConnected ? (
            <>
              <div className="flex items-center gap-3 bg-pink-50 border border-pink-200 rounded-xl px-4 py-3 mb-4">
                <div className="w-4 h-4 rounded-full" style={{ background: 'linear-gradient(135deg,#f09433,#bc1888)' }} />
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-900">@{igUsername}</div>
                  <div className="text-xs text-gray-500">連携済み</div>
                </div>
                {igDisconnectConfirm ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={handleIgDisconnectConfirm} className="text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition-colors">解除する</button>
                    <button onClick={handleIgDisconnectCancel} className="text-[10px] text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg border border-gray-200 transition-colors">戻る</button>
                  </div>
                ) : (
                  <button onClick={handleIgDisconnectClick} className="text-xs text-gray-400 hover:text-red-500 transition-colors">解除</button>
                )}
              </div>

              {igMedia.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 mb-4 rounded-xl overflow-hidden">
                  {igMedia.map(m => (
                    <a key={m.id} href={m.permalink} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-gray-100 overflow-hidden group">
                      <img src={m.media_url} alt={m.caption?.slice(0, 30) ?? ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-400">最新投稿はビルダーの「Instagram」ブロックをページに追加すると表示されます。</p>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">アクセストークン</label>
                <input
                  type="password"
                  autoComplete="off"
                  value={igToken}
                  onChange={e => setIgToken(e.target.value)}
                  placeholder="Instagram Graph API アクセストークン"
                  className={inputCls}
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Meta Developer Console で取得したアクセストークンを入力してください（長期トークン推奨）。
                </p>
                <details className="mt-2">
                  <summary className="text-[10px] text-sky-600 hover:text-sky-500 cursor-pointer font-semibold select-none">トークン取得方法 ›</summary>
                  <ol className="mt-2 ml-3 space-y-1 list-decimal text-[10px] text-gray-500">
                    <li><a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">Meta for Developers</a> でアプリを作成</li>
                    <li>「Instagram Basic Display」を追加してアプリに紐付け</li>
                    <li>テストユーザーに自分のアカウントを追加</li>
                    <li>「ユーザートークンを生成」でトークンを取得 → 上のフォームに貼り付け</li>
                    <li>長期トークン（60日）への交換は API で自動延長可能</li>
                  </ol>
                </details>
              </div>

              {igMsg && (
                <p className={`text-xs font-semibold ${igMsg.startsWith('エラー') ? 'text-red-600' : 'text-green-600'}`}>{igMsg}</p>
              )}

              <button
                onClick={handleIgConnect}
                disabled={!igToken.trim() || igSaving}
                className="w-full text-sm bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {igSaving ? '接続中...' : 'Instagramと連携する'}
              </button>
            </div>
          )}
        </section>

        {/* GMB (Google My Business) */}
        <section id="gmb" className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-700" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <div>
              <h2 className="font-bold text-sm text-gray-900">Googleビジネスプロフィール（GMB）連携</h2>
              <p className="text-gray-500 text-xs mt-0.5">Google Place IDを入力すると、ダッシュボードで口コミ・評価を確認できます。</p>
            </div>
          </div>

          {gmbSaved && gmbPreview && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
              <div className="text-green-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{gmbPreview.name}</div>
                <div className="text-xs text-gray-500">
                  ★ {gmbPreview.rating?.toFixed(1)} · {gmbPreview.totalRatings?.toLocaleString()}件の口コミ
                </div>
              </div>
              <span className="text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-bold">連携済み</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Google Place ID</label>
              <input
                type="text"
                value={gmbPlaceId}
                onChange={e => setGmbPlaceId(e.target.value)}
                placeholder="例: ChIJN1t_tDeuEmsRUsoyG83frY4"
                className={inputCls}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                <a href="https://developers.google.com/maps/documentation/javascript/place-id" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">Place ID Finder</a>
                でPlace IDを確認できます
              </p>
              <details className="mt-2">
                <summary className="text-[10px] text-sky-600 hover:text-sky-500 cursor-pointer font-semibold select-none">Place IDの調べ方 ›</summary>
                <ol className="mt-2 ml-3 space-y-1 list-decimal text-[10px] text-gray-500">
                  <li>上のリンク「Place ID Finder」を開く</li>
                  <li>検索ボックスに店舗名または住所を入力して選択</li>
                  <li>地図上のピンをクリックすると「Place ID: ChIJ...」が表示される</li>
                  <li>その文字列（ChIJ〜）をコピーして上のフォームに貼り付け</li>
                </ol>
              </details>
            </div>

            {gmbMsg && (
              <p className={`text-xs font-semibold ${gmbMsg.startsWith('エラー') || gmbMsg.startsWith('保存に失敗') ? 'text-red-600' : 'text-green-600'}`}>
                {gmbMsg}
              </p>
            )}

            {gmbPreview && !gmbMsg.startsWith('エラー') && gmbPlaceId !== gmbSaved && (
              <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
                <div className="font-semibold text-sm text-gray-900">{gmbPreview.name}</div>
                <div className="text-xs text-gray-500">★ {gmbPreview.rating?.toFixed(1)} · {gmbPreview.totalRatings?.toLocaleString()}件の口コミ</div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleGmbPreview}
                disabled={!gmbPlaceId.trim() || gmbPreviewLoading}
                className="flex-1 text-sm border border-gray-200 hover:border-sky-300 text-gray-700 py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {gmbPreviewLoading ? '確認中...' : '確認する'}
              </button>
              <button
                onClick={handleGmbSave}
                disabled={!gmbPlaceId.trim() || gmbSaving || gmbPlaceId === gmbSaved}
                className="flex-1 text-sm bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {gmbSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </section>

        {/* GMB Reviews with AI Reply */}
        {gmbReviews.length > 0 && (
          <section className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-700"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/></svg>
              </div>
              <h2 className="font-bold text-sm text-gray-900">AI口コミ返信文生成</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">口コミに対してAIが返信案を3パターン提案します。コピーして活用してください。</p>

            <div className="space-y-4">
              {gmbReviews.map((review, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">
                      {review.author_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900">{review.author_name}</span>
                        <span className="text-amber-500 text-xs">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                        <span className="text-[10px] text-gray-400">{review.relative_time_description}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-3">{review.text}</p>
                    </div>
                  </div>

                  {reviewReplies[idx] ? (
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">返信案（3パターン）</div>
                      {reviewReplies[idx].map((reply, ri) => (
                        <div
                          key={ri}
                          className={`border rounded-lg p-3 cursor-pointer transition-all ${reviewReplySelected[idx] === reply ? 'border-sky-400 bg-sky-50' : 'border-gray-200 hover:border-sky-200'}`}
                          onClick={() => setReviewReplySelected(prev => ({ ...prev, [idx]: reply }))}
                        >
                          <div className="text-xs text-gray-700 leading-relaxed">{reply}</div>
                          <div className="flex items-center gap-2 mt-2">
                            {reviewReplySelected[idx] === reply && <span className="text-[9px] text-sky-600 font-bold">✓ 選択中</span>}
                            <button
                              onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(reply); }}
                              className="ml-auto text-[10px] bg-gray-100 hover:bg-sky-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded transition-all"
                            >
                              コピー
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleReviewReply(idx, review)}
                      disabled={reviewReplyLoading === idx}
                      className="w-full text-xs bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-bold py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reviewReplyLoading === idx ? 'AIが生成中...' : '✨ AI返信案を生成する'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        </> /* end integrations tab */}

        {/* ── Danger tab ── */}
        {activeTab === 'danger' && <>

        {/* Export data */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
          <h2 className="font-bold text-sm text-gray-900 mb-1">データのエクスポート</h2>
          <p className="text-gray-500 text-xs mb-5">サイト設定・問い合わせ履歴をJSONファイルとしてダウンロードします。削除前にバックアップとして保存できます。</p>
          <button
            onClick={async () => {
              const [sitesRes, contactsRes] = await Promise.all([
                fetch('/api/sites').then(r => r.json()),
                fetch('/api/contacts').then(r => r.json()),
              ]);
              const payload = {
                exported_at: new Date().toISOString(),
                sites: sitesRes.sites || [],
                contacts: contactsRes.contacts || [],
              };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `laruHP_export_${new Date().toISOString().split('T')[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            データをダウンロード (JSON)
          </button>
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
              className={`${inputCls} ${deleteConfirm === '削除する' ? 'border-red-500 bg-red-50 text-red-900 focus:border-red-500' : ''}`}
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

        </> /* end danger tab */}

      </div>
    </div>
  );
}
