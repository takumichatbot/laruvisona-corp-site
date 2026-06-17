'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

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
  const [form, setForm] = useState({ title: '', content: '', category: 'お知らせ', image_url: '', published: true, published_at: new Date().toISOString().split('T')[0] });

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
    const res = await fetch(`/api/sites/${siteId}/posts`);
    const data = await res.json();
    setPosts(data.posts || []);
    setPostsLoading(false);
  }, []);

  useEffect(() => {
    if (selectedSiteId) loadPosts(selectedSiteId);
  }, [selectedSiteId, loadPosts]);

  const openCreate = () => {
    setEditingPost(null);
    setForm({ title: '', content: '', category: 'お知らせ', image_url: '', published: true, published_at: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  };

  const openEdit = async (post: Post) => {
    const res = await fetch(`/api/posts/${post.id}`);
    const data = await res.json();
    const p = data.post as Post;
    setEditingPost(p);
    setForm({ title: p.title, content: p.content || '', category: p.category || 'お知らせ', image_url: p.image_url || '', published: p.published, published_at: p.published_at?.split('T')[0] || new Date().toISOString().split('T')[0] });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!selectedSiteId || !form.title.trim()) return;
    setSaving(true);
    const body = { ...form, published_at: new Date(form.published_at).toISOString() };
    if (editingPost) {
      await fetch(`/api/posts/${editingPost.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetch(`/api/sites/${selectedSiteId}/posts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    setSaving(false);
    setShowModal(false);
    loadPosts(selectedSiteId);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('この投稿を削除しますか？')) return;
    await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleTogglePublish = async (post: Post) => {
    await fetch(`/api/posts/${post.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ published: !post.published }) });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, published: !p.published } : p));
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <header className="border-b border-white/[0.07] bg-[#0a0f1e]/90 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/laruHP/dashboard" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← ダッシュボード</Link>
          <span className="text-white/20">/</span>
          <h1 className="text-sm font-bold">ブログ・お知らせ管理</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="text-slate-500 text-sm">読み込み中...</div>
        ) : sites.length === 0 ? (
          <div className="text-slate-500 text-sm">サイトがありません</div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <select
                  value={selectedSiteId || ''}
                  onChange={e => setSelectedSiteId(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                >
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <span className="text-slate-500 text-sm">{posts.length} 件</span>
              </div>
              <button
                onClick={openCreate}
                className="text-xs bg-white text-black font-bold px-4 py-2 rounded-lg hover:bg-blue-50 transition-all"
              >
                + 新規投稿
              </button>
            </div>

            {postsLoading ? (
              <div className="text-slate-500 text-sm py-8 text-center">読み込み中...</div>
            ) : posts.length === 0 ? (
              <div className="py-16 text-center border border-white/[0.07] border-dashed rounded-xl">
                <p className="text-slate-500 text-sm">投稿がありません</p>
                <p className="text-slate-600 text-xs mt-1">「新規投稿」から記事を作成してください</p>
                <p className="text-slate-600 text-xs mt-1">サイトのお知らせブロックに自動表示されます</p>
              </div>
            ) : (
              <div className="border border-white/[0.07] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                      {['タイトル', 'カテゴリ', '公開日', 'ステータス', '操作'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] text-slate-500 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map(post => (
                      <tr key={post.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-white text-xs font-medium truncate max-w-[220px]">{post.title}</div>
                        </td>
                        <td className="px-4 py-3">
                          {post.category && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">{post.category}</span>}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-500">{timeAgo(post.published_at)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleTogglePublish(post)} className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${post.published ? 'text-green-400 bg-green-400/10 hover:bg-green-400/20' : 'text-slate-500 bg-white/5 hover:bg-white/10'}`}>
                            {post.published ? '公開中' : '下書き'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(post)} className="text-[10px] text-slate-400 hover:text-white transition-colors">編集</button>
                            <button onClick={() => handleDelete(post.id)} className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors">削除</button>
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-bold mb-4">{editingPost ? '投稿を編集' : '新規投稿'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">タイトル <span className="text-red-400">*</span></label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="記事のタイトル"
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-white/20" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1.5 block">カテゴリ</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/20">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1.5 block">公開日</label>
                  <input type="date" value={form.published_at} onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">本文</label>
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="記事の本文（省略可）"
                  rows={5}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-white/20 resize-none" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">画像URL（省略可）</label>
                <input type="url" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-white/20 font-mono text-xs" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-slate-300 text-sm">公開する</span>
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 text-sm text-slate-400 hover:text-slate-200 border border-white/10 py-2.5 rounded-lg transition-colors">キャンセル</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()} className="flex-1 text-sm bg-white text-black font-bold py-2.5 rounded-lg hover:bg-blue-50 transition-all disabled:opacity-50">
                {saving ? '保存中...' : editingPost ? '更新する' : '投稿する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
