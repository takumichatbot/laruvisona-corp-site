import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { bridgeText, readBridgeJson } from '@/lib/bridge-input';

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
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`GitHub API ${res.status}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'GITHUB_TOKEN が未設定です' }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const repo = searchParams.get('repo');
  if (repo && !/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(repo)) {
    return NextResponse.json({ error: 'リポジトリを確認してください' }, { status: 400 });
  }

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
      if (!prNum || !/^[1-9][0-9]{0,9}$/.test(prNum)) return NextResponse.json({ error: 'PR番号が必要です' }, { status: 400 });
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
  } catch {
    return NextResponse.json({ error: 'GitHub操作に失敗しました' }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'GITHUB_TOKEN が未設定です' }, { status: 500 });
  try {
    const input = await readBridgeJson(req, 32_000);
    const action = bridgeText(input.action, 30, true);
    const repo = bridgeText(input.repo, 201, true);
    const body = bridgeText(input.body, 20_000);
    const event = bridgeText(input.event, 30) || 'COMMENT';
    const pr = Number(input.pr);
    if (!/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(repo)
      || !Number.isSafeInteger(pr) || pr < 1 || pr > 9_999_999_999
      || !['COMMENT', 'APPROVE', 'REQUEST_CHANGES'].includes(event)) {
      return NextResponse.json({ error: '入力を確認してください' }, { status: 400 });
    }

    if (action === 'post_review' && repo && pr) {
      await ghFetch(`/repos/${repo}/pulls/${pr}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ body, event }),
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
  } catch {
    return NextResponse.json({ error: 'GitHub操作に失敗しました' }, { status: 502 });
  }
}
