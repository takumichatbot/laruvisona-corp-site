import { NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function ghFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers as Record<string, string> || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'GITHUB_TOKEN が未設定です' }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const repo = searchParams.get('repo');

  try {
    if (action === 'list_prs' && repo) {
      const prs = await ghFetch(`/repos/${repo}/pulls?state=open&per_page=20`);
      return NextResponse.json({
        prs: (prs as Array<{
          number: number; title: string; body: string | null;
          user: { login: string }; created_at: string; head: { label: string }; base: { label: string };
          changed_files: number; additions: number; deletions: number;
        }>).map(p => ({
          number: p.number,
          title: p.title,
          body: (p.body || '').slice(0, 300),
          author: p.user.login,
          created_at: p.created_at,
          head: p.head.label,
          base: p.base.label,
        })),
      });
    }

    if (action === 'get_pr' && repo) {
      const prNum = searchParams.get('pr');
      if (!prNum) return NextResponse.json({ error: 'PR番号が必要です' }, { status: 400 });
      const [prData, files] = await Promise.all([
        ghFetch(`/repos/${repo}/pulls/${prNum}`),
        ghFetch(`/repos/${repo}/pulls/${prNum}/files`),
      ]);
      const pr = prData as {
        title: string; body: string | null; additions: number; deletions: number; changed_files: number;
      };
      const fileList = (files as Array<{ filename: string; status: string; additions: number; deletions: number; patch?: string }>)
        .map(f => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          patch: (f.patch || '').slice(0, 1500),
        }));
      return NextResponse.json({
        title: pr.title,
        body: pr.body || '',
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        files: fileList,
      });
    }

    return NextResponse.json({ error: '不明なアクション' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'GitHubエラー' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'GITHUB_TOKEN が未設定です' }, { status: 500 });
  try {
    const { action, repo, pr, body, event } = await req.json();

    if (action === 'post_review' && repo && pr) {
      await ghFetch(`/repos/${repo}/pulls/${pr}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ body: body || '', event: event || 'COMMENT' }),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'merge_pr' && repo && pr) {
      await ghFetch(`/repos/${repo}/pulls/${pr}/merge`, {
        method: 'PUT',
        body: JSON.stringify({ merge_method: 'squash' }),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '不明なアクション' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'GitHubエラー' }, { status: 500 });
  }
}
