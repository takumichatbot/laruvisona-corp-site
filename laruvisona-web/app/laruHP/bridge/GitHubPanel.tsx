'use client';
import { useState } from 'react';
import { GitPullRequest, ChevronRight, ChevronLeft, RefreshCw, MessageSquare, GitMerge } from 'lucide-react';

interface PR {
  number: number; title: string; body: string;
  author: string; created_at: string; head: string; base: string;
}

interface PRFile {
  filename: string; status: string; additions: number; deletions: number; patch: string;
}

interface PRDetail {
  title: string; body: string; additions: number; deletions: number; changed_files: number;
  files: PRFile[];
}

interface Props {
  githubRepo: string | null;
}

export default function GitHubPanel({ githubRepo }: Props) {
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPR, setSelectedPR] = useState<PR | null>(null);
  const [detail, setDetail] = useState<PRDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [review, setReview] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const repo = githubRepo;

  const fetchPRs = async () => {
    if (!repo) return setError('config.py に github_repo を設定してください');
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/bridge/github?action=list_prs&repo=${encodeURIComponent(repo)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPrs(data.prs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    }
    setLoading(false);
  };

  const openPR = async (pr: PR) => {
    setSelectedPR(pr); setDetail(null); setReview(''); setDetailLoading(true);
    try {
      const res = await fetch(`/api/bridge/github?action=get_pr&repo=${encodeURIComponent(repo!)}&pr=${pr.number}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    }
    setDetailLoading(false);
  };

  const generateReview = async () => {
    if (!detail || !selectedPR) return;
    setReviewLoading(true); setReview('');
    const diffSummary = detail.files
      .map(f => `### ${f.filename} (${f.status} +${f.additions} -${f.deletions})\n\`\`\`diff\n${f.patch}\n\`\`\``)
      .join('\n\n');
    try {
      const res = await fetch('/api/bridge/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          messages: [{
            role: 'user',
            content: `PR #${selectedPR.number}: ${selectedPR.title}\n\n${detail.body}\n\n変更ファイル:\n${diffSummary}\n\nこのPRをコードレビューしてください。バグ、セキュリティ問題、改善点を指摘してください。日本語で。`,
          }],
          projectName: repo || '',
        }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) { full += parsed.text; setReview(full); }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'レビューエラー');
    }
    setReviewLoading(false);
  };

  const postReview = async () => {
    if (!review || !selectedPR || !repo) return;
    setPosting(true);
    try {
      const res = await fetch('/api/bridge/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post_review', repo, pr: selectedPR.number, body: review, event: 'COMMENT' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      alert('レビューをGitHubに投稿しました');
    } catch (e) {
      setError(e instanceof Error ? e.message : '投稿エラー');
    }
    setPosting(false);
  };

  if (selectedPR) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <button onClick={() => { setSelectedPR(null); setDetail(null); setReview(''); }}
          className="flex items-center gap-1 text-xs text-gray-500 active:opacity-70">
          <ChevronLeft size={14} /> 一覧に戻る
        </button>

        <div className="rounded-xl p-4 space-y-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <GitPullRequest size={14} className="text-violet-400" />
            <span className="text-gray-500 text-xs">#{selectedPR.number}</span>
          </div>
          <p className="text-white text-sm font-semibold">{selectedPR.title}</p>
          <p className="text-gray-600 text-xs">{selectedPR.author} · {selectedPR.head} → {selectedPR.base}</p>
          {selectedPR.body && <p className="text-gray-500 text-xs mt-2">{selectedPR.body}</p>}
        </div>

        {detailLoading && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border border-violet-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {detail && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '変更ファイル', val: detail.changed_files, color: '#a78bfa' },
                { label: '追加', val: `+${detail.additions}`, color: '#34d399' },
                { label: '削除', val: `-${detail.deletions}`, color: '#f87171' },
              ].map(s => (
                <div key={s.label} className="rounded-xl py-2 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ color: s.color }} className="text-sm font-semibold">{s.val}</p>
                  <p className="text-gray-600 text-xs">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              {detail.files.map(f => (
                <div key={f.filename} className="rounded-lg px-3 py-2 flex items-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span className={`text-xs w-12 flex-shrink-0 ${f.status === 'added' ? 'text-green-400' : f.status === 'removed' ? 'text-red-400' : 'text-amber-400'}`}>
                    {f.status.slice(0, 4)}
                  </span>
                  <span className="text-gray-400 text-xs font-mono flex-1 truncate">{f.filename}</span>
                  <span className="text-gray-600 text-xs flex-shrink-0">+{f.additions} -{f.deletions}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={generateReview} disabled={reviewLoading}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white active:scale-98 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
                {reviewLoading
                  ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> 生成中...</>
                  : <><MessageSquare size={14} /> Claude でレビュー</>}
              </button>
            </div>

            {review && (
              <div className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <p className="text-violet-400 text-xs font-semibold">Claude Review</p>
                <div className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">{review}</div>
                <button onClick={postReview} disabled={posting}
                  className="w-full py-2 rounded-xl text-xs font-semibold active:scale-98 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#e5e7eb' }}>
                  {posting
                    ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> 投稿中...</>
                    : <><GitMerge size={12} /> GitHubにコメントとして投稿</>}
                </button>
              </div>
            )}
          </>
        )}

        {error && <p className="text-red-400 text-xs px-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-semibold">Pull Requests</p>
          {repo && <p className="text-gray-600 text-xs">{repo}</p>}
        </div>
        <button onClick={fetchPRs} disabled={loading}
          className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <RefreshCw size={13} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!repo && (
        <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className="text-gray-600 text-sm">config.py の github_repo にリポジトリを設定してください</p>
          <p className="text-gray-700 text-xs mt-1">例: "owner/repo-name"</p>
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {prs.length === 0 && repo && !loading && (
        <div className="rounded-xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <GitPullRequest size={24} className="text-gray-700 mx-auto mb-2" />
          <p className="text-gray-600 text-sm">「更新」でPR一覧を取得</p>
        </div>
      )}

      {prs.map(pr => (
        <button key={pr.number} onClick={() => openPR(pr)}
          className="w-full rounded-xl p-4 text-left active:scale-99 transition-all"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-start gap-3">
            <GitPullRequest size={14} className="text-violet-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs">#{pr.number}</span>
                <span className="text-gray-600 text-xs">{pr.author}</span>
              </div>
              <p className="text-white text-sm mt-0.5 truncate">{pr.title}</p>
              <p className="text-gray-600 text-xs mt-1">{pr.head} → {pr.base}</p>
            </div>
            <ChevronRight size={14} className="text-gray-700 flex-shrink-0 mt-1" />
          </div>
        </button>
      ))}
    </div>
  );
}
