'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/laruhp/AppShell';

interface Post {
  id: string;
  title: string;
  content: string | null;
  category: string | null;
  image_url: string | null;
  published: boolean;
  published_at: string;
  created_at: string;
}

interface Site { id: string; name: string }

const CATEGORIES = ['お知らせ', 'イベント', 'キャンペーン', 'ブログ', '重要', '更新'];

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '今日';
  if (days < 30) return `${days}日前`;
  return new Date(d).toLocaleDateString('ja-JP');
}

export default function BlogPage() {
  const router = useRouter();
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'お知らせ', image_url: '', published: true, published_at: new Date().toISOString().split('T')[0] });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const [aiMsg, setAiMsg] = useState('');
  const [aiLimitReached, setAiLimitReached] = useState(false);
  const [firstPostToast, setFirstPostToast] = useState(false);
  /* 失敗を握りつぶすと、書いた本文が黙って消える。必ず画面に出す。 */
  const [opError, setOpError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/laruHP/auth/login'); return; }
      const res = await fetch('/api/sites');
      const data = await res.json();
      const s: Site[] = (data.sites || []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name }));
      setSites(s);
      if (s.length > 0) setSelectedSiteId(s[0].id);
      setLoading(false);
    })();
  }, []);

  const loadPosts = useCallback(async (siteId: string) => {
    setPostsLoading(true);
    setOpError('');
    try {
      // 管理画面は下書き含む全件・全カラムが必要（?all=true）
      const res = await fetch(`/api/sites/${siteId}/posts?all=true`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '記事を読み込めませんでした');
      setPosts(data.posts || []);
    } catch (e) {
      setPosts([]);
      setOpError(e instanceof Error ? e.message : '記事を読み込めませんでした');
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedSiteId) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      void loadPosts(selectedSiteId);
      setCategoryFilter(null);
    });
    return () => { active = false; };
  }, [selectedSiteId, loadPosts]);

  const openCreate = () => {
    setEditingPost(null);
    setForm({ title: '', content: '', category: 'お知らせ', image_url: '', published: true, published_at: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  };

  const openEdit = async (post: Post) => {
    setOpError('');
    const res = await fetch(`/api/posts/${post.id}`);
    const data = await res.json().catch(() => ({}));
    const p = data.post as Post | undefined;
    if (!res.ok || !p) {
      setOpError(data.error || '記事を開けませんでした');
      return;
    }
    setEditingPost(p);
    setForm({ title: p.title, content: p.content || '', category: p.category || 'お知らせ', image_url: p.image_url || '', published: p.published, published_at: p.published_at?.split('T')[0] || new Date().toISOString().split('T')[0] });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!selectedSiteId || !form.title.trim()) return;
    setSaving(true);
    const isFirstPost = !editingPost && posts.length === 0;
    const body = { ...form, published_at: new Date(form.published_at).toISOString() };
    setOpError('');
    try {
      const res = editingPost
        ? await fetch(`/api/posts/${editingPost.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch(`/api/sites/${selectedSiteId}/posts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '記事を保存できませんでした');
    } catch (e) {
      // ここで閉じると、書いた本文がそのまま消える
      setSaving(false);
      setOpError(e instanceof Error ? e.message : '記事を保存できませんでした');
      return;
    }
    setSaving(false);
    setShowModal(false);
    loadPosts(selectedSiteId);
    if (isFirstPost) {
      setFirstPostToast(true);
      setTimeout(() => setFirstPostToast(false), 8000);
    }
  };

  const handleDelete = (postId: string) => {
    setDeleteConfirmId(postId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setOpError('');
    const res = await fetch(`/api/posts/${deleteConfirmId}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setOpError(d.error || '記事を削除できませんでした');
      setDeleteConfirmId(null);
      return;
    }
    setPosts(prev => prev.filter(p => p.id !== deleteConfirmId));
    setDeleteConfirmId(null);
  };

  const handleRenameCategory = async (from: string, to: string) => {
    if (!to.trim() || to === from) { setRenamingCategory(null); return; }
    const trimmed = to.trim();
    const existingCategories = [...new Set(posts.map(p => p.category).filter(Boolean))];
    if (existingCategories.includes(trimmed) && trimmed !== from) {
      alert(`カテゴリ「${trimmed}」はすでに存在します。別の名前を入力してください。`);
      return;
    }
    const targets = posts.filter(p => p.category === from);
    await Promise.all(targets.map(p => fetch(`/api/posts/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: trimmed }) })));
    setPosts(prev => prev.map(p => p.category === from ? { ...p, category: trimmed } : p));
    if (categoryFilter === from) setCategoryFilter(trimmed);
    setRenamingCategory(null);
  };

  const handleAiGenerate = async () => {
    if (!selectedSiteId) return;
    setAiGenerating(true);
    setAiStep(1);
    setAiMsg('');
    const stepTimer1 = setTimeout(() => setAiStep(2), 3000);
    const stepTimer2 = setTimeout(() => setAiStep(3), 7000);
    const res = await fetch('/api/ai/blog-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: selectedSiteId, save: true }),
    });
    clearTimeout(stepTimer1);
    clearTimeout(stepTimer2);
    const d = await res.json();
    if (!res.ok) {
      setAiMsg(d.error || 'AI記事の生成に失敗しました');
      if (d.upgradeRequired) setAiLimitReached(true);
      setAiGenerating(false);
      setAiStep(0);
      return;
    }
    setAiStep(4);
    setAiMsg(`✓ 「${d.title}」を下書き保存しました`);
    // Reload posts
    const postsRes = await fetch(`/api/sites/${selectedSiteId}/posts?all=true`);
    const postsData = await postsRes.json();
    const updatedPosts: Post[] = postsData.posts || [];
    setPosts(updatedPosts);
    setAiGenerating(false);
    setAiStep(0);
    // 生成した記事のモーダルを自動で開く
    const newPost = updatedPosts.find(p => p.title === d.title);
    if (newPost) {
      setEditingPost(newPost);
      setForm({ title: newPost.title, content: newPost.content || d.content || '', category: newPost.category || 'ブログ', image_url: newPost.image_url || '', published: newPost.published, published_at: (newPost.published_at || new Date().toISOString()).split('T')[0] });
      setShowModal(true);
    } else {
      setTimeout(() => setAiMsg(''), 5000);
    }
  };

  const handleTogglePublish = async (post: Post) => {
    const newPublished = !post.published;
    const patchBody: Record<string, unknown> = { published: newPublished };
    if (newPublished) patchBody.published_at = new Date().toISOString().split('T')[0];
    setOpError('');
    const res = await fetch(`/api/posts/${post.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patchBody) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      // 公開できていないのに「公開中」にしない
      setOpError(d.error || '公開状態を変更できませんでした');
      return;
    }
    setPosts(prev => prev.map(p => p.id === post.id ? {
      ...p, published: newPublished,
      ...(newPublished ? { published_at: patchBody.published_at as string } : {}),
    } : p));
  };

  return (
    <AppShell title="ブログ・お知らせ管理" lead="サイトに載せる記事を、ここで書いて公開します。">
      

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {opError && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {opError}
          </div>
        )}
        {loading ? (
          <div className="text-gray-500 text-sm">読み込み中...</div>
        ) : sites.length === 0 ? (
          <div className="text-gray-500 text-sm">サイトがありません</div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <select
                  value={selectedSiteId || ''}
                  onChange={e => setSelectedSiteId(e.target.value)}
                  className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-sky-500"
                >
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <span className="text-gray-500 text-sm">{posts.length} 件</span>
                {posts.filter(p => !p.published).length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-200">
                    下書き {posts.filter(p => !p.published).length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || !selectedSiteId}
                  className={`text-xs bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${aiGenerating ? 'opacity-70' : ''}`}
                  title="AIがSEO最適化された記事を自動生成して下書き保存します"
                >
                  {aiGenerating ? (
                    <span className="flex flex-col items-start gap-0.5 w-full">
                      <span className="flex items-center gap-1.5 text-xs">
                        <svg className="animate-spin flex-shrink-0" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        {aiStep === 1 ? 'サイト情報を取得中...' : aiStep === 2 ? 'SEOキーワードを分析中...' : aiStep === 3 ? '本文を執筆中...' : aiStep >= 4 ? '下書きを保存中...' : 'AIを起動中...'}
                        <span className="text-purple-700 text-[10px]">({aiStep}/4)</span>
                      </span>
                      <div className="w-full h-0.5 bg-purple-800 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${(aiStep / 4) * 100}%` }} />
                      </div>
                    </span>
                  ) : 'AI記事生成'}
                </button>
                <button
                  onClick={openCreate}
                  className="text-xs bg-sky-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-sky-50 transition-all"
                >
                  + 新規投稿
                </button>
              </div>
            </div>
            {aiMsg && (
              <div className={`text-xs px-3 py-2 rounded-lg mb-3 ${aiMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-600 border border-green-500/20' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {aiMsg}
              </div>
            )}
            {aiLimitReached && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3 text-xs">
                <p className="font-bold text-amber-600 mb-1">今月の生成上限に達しました</p>
                <p className="text-amber-300/80 mb-2">上位プランにアップグレードすると毎月100件まで生成できます。</p>
                <Link href="/laruHP/plans" className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-3 py-1.5 rounded-lg transition-all">
                  プランを確認する →
                </Link>
              </div>
            )}
            {firstPostToast && (
              <div className="bg-emerald-50 border border-emerald-500/20 rounded-xl px-4 py-3 mb-3 text-xs text-emerald-600">
                <p className="font-bold mb-1">最初の記事を作成しました</p>
                <p>次のステップ: <Link href="/laruHP/seo" className="underline hover:text-emerald-700">SEO設定</Link>でビジネス情報を登録すると検索結果に強くなります。</p>
              </div>
            )}

            {/* Category filter badges */}
            {posts.length > 0 && (() => {
              const cats = Array.from(new Set(posts.map(p => p.category).filter(Boolean))) as string[];
              if (cats.length === 0) return null;
              return (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className={`text-[11px] px-3 py-1 rounded-full font-semibold transition-all ${!categoryFilter ? 'bg-sky-600 text-white' : 'bg-white/[0.06] text-gray-500 hover:bg-gray-100'}`}
                  >
                    すべて ({posts.length})
                  </button>
                  {cats.map(cat => {
                    const count = posts.filter(p => p.category === cat).length;
                    const isRenaming = renamingCategory === cat;
                    return (
                      <div key={cat} className="flex items-center gap-1 group/cat">
                        {isRenaming ? (
                          <input
                            autoFocus
                            defaultValue={cat}
                            onBlur={e => handleRenameCategory(cat, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(cat, e.currentTarget.value); if (e.key === 'Escape') setRenamingCategory(null); }}
                            className="text-[11px] px-3 py-1 rounded-full border border-sky-500 bg-white shadow-lg text-gray-900 outline-none w-28"
                          />
                        ) : (
                          <button
                            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                            className={`text-[11px] px-3 py-1 rounded-full font-semibold transition-all ${categoryFilter === cat ? 'bg-sky-500 text-white' : 'bg-sky-50 text-sky-600 hover:bg-sky-500/20'}`}
                          >
                            {cat} ({count})
                          </button>
                        )}
                        {!isRenaming && (
                          <button
                            onClick={() => { setRenamingCategory(cat); setRenameTarget(cat); }}
                            title="カテゴリ名を変更"
                            className="opacity-30 group-hover/cat:opacity-100 text-gray-500 hover:text-gray-700 transition-all text-[10px]"
                          >
                            ✏
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {postsLoading ? (
              <div className="text-gray-500 text-sm py-8 text-center">読み込み中...</div>
            ) : posts.length === 0 ? (
              <div className="py-16 text-center border border-gray-200 border-dashed rounded-xl">
                <p className="text-gray-500 text-sm">投稿がありません</p>
                <p className="text-gray-400 text-xs mt-1">「新規投稿」から記事を作成してください</p>
                <p className="text-gray-400 text-xs mt-1">サイトのお知らせブロックに自動表示されます</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {['タイトル', 'カテゴリ', '公開日', 'ステータス', '操作'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] text-gray-500 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {posts.filter(p => !categoryFilter || p.category === categoryFilter).map(post => (
                      <tr key={post.id} className={`border-b border-gray-100 hover:bg-white/[0.04] transition-colors ${posts.filter(p => !categoryFilter || p.category === categoryFilter).indexOf(post) % 2 === 1 ? 'bg-gray-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 text-xs font-medium truncate max-w-[220px]">{post.title}</div>
                          {post.content && (() => {
                            const len = post.content.replace(/\s/g, '').length;
                            const min = Math.max(1, Math.ceil(len / 300));
                            return (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-gray-400">{len.toLocaleString()}文字 · 約{min}分</span>
                                {len < 300 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full cursor-help" title="記事は300文字以上が推奨されます">⚠ 短い記事</span>}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          {post.category && <span className="text-[10px] bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full">{post.category}</span>}
                        </td>
                        <td className="px-4 py-3 text-[11px]">
                          {post.published
                            ? <span className="text-gray-500">{timeAgo(post.published_at)}</span>
                            : <span className="text-amber-500 font-semibold">未公開</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleTogglePublish(post)} className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${post.published ? 'text-emerald-600 bg-green-400/10 hover:bg-green-400/20' : 'text-gray-500 bg-gray-50 hover:bg-gray-100'}`}>
                            {post.published ? '公開中' : '下書き'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(post)} className="text-[10px] text-gray-500 hover:text-gray-900 transition-colors">編集</button>
                            <button onClick={() => handleDelete(post.id)} className="text-[10px] text-red-500 hover:text-red-600 transition-colors">削除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4 text-2xl">🗑️</div>
            <h2 className="text-gray-900 font-bold mb-2">この投稿を削除しますか？</h2>
            <p className="text-gray-500 text-sm mb-5">削除した投稿は元に戻せません。</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 py-2.5 rounded-lg transition-colors">
                キャンセル
              </button>
              <button onClick={confirmDelete} className="flex-1 text-sm bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-lg transition-all">
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-gray-900 font-bold mb-4">{editingPost ? '投稿を編集' : '新規投稿'}</h2>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-gray-500">タイトル <span className="text-red-600">*</span></label>
                  {form.title.trim().length > 0 && form.title.trim().length < 20 && (
                    <span className="text-[10px] text-amber-600 font-semibold">短いタイトル — 「地域名＋サービス名＋ベネフィット」形式が効果的です</span>
                  )}
                </div>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="記事のタイトル"
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-sky-500" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1.5 block">カテゴリ</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-sky-500">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1.5 block">公開日</label>
                  <input type="date" value={form.published_at} onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))}
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-sky-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">本文</label>
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="記事の本文（省略可）"
                  rows={5}
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-sky-500 resize-none" />
                {form.content.trim().length >= 10 && (() => {
                  const plain = form.content.replace(/#+\s*/g, '').replace(/\*\*/g, '').replace(/\n+/g, ' ').trim();
                  const suggestion = plain.slice(0, 150);
                  return (
                    <div className="mt-1.5 bg-sky-500/5 border border-sky-500/15 rounded-lg px-3 py-2 flex items-start gap-2">
                      <span className="text-[10px] text-sky-600 font-bold flex-shrink-0 mt-0.5">💡 メタ説明候補</span>
                      <p className="text-[10px] text-gray-500 flex-1 leading-relaxed">{suggestion}{plain.length > 150 ? '…' : ''}</p>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(suggestion + (plain.length > 150 ? '…' : '')); }}
                        className="text-[9px] flex-shrink-0 bg-sky-100 hover:bg-sky-500/30 text-sky-600 px-1.5 py-0.5 rounded font-bold transition-all"
                        title="クリップボードにコピー"
                      >コピー</button>
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">画像URL（省略可）</label>
                <input type="url" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-sky-500 font-mono text-xs" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-gray-600 text-sm">公開する</span>
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 py-2.5 rounded-lg transition-colors">キャンセル</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()} className="flex-1 text-sm bg-sky-600 text-white font-bold py-2.5 rounded-lg hover:bg-sky-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? '保存中...' : editingPost ? '更新する' : '投稿する'}
              </button>
            </div>
          </div>
        </div>
      )}
    
    </AppShell>
  );
}
