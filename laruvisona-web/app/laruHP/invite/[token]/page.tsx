import { createClient as createServiceClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { CircleX } from 'lucide-react';
import { siteMemberToken } from '@/lib/site-member-contract';

function getService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  try { siteMemberToken(token); }
  catch { return <InvalidInvite />; }
  const service = getService();

  const { data: member } = await service
    .from('site_members')
    .select('id, site_id, invited_email, role, status, invite_expires_at')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .gt('invite_expires_at', new Date().toISOString())
    .maybeSingle();

  if (!member) {
    return <InvalidInvite />;
  }

  const { data: site } = await service.from('sites').select('name').eq('id', member.site_id).single();

  // This is a server component — we need a form action to accept
  // We'll redirect to the accept API which handles auth check
  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full shadow-sm">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mx-auto mb-4">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={40} width={160} className="h-10 w-auto" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-1">LARUbot履歴への招待</h1>
          <p className="text-gray-500 text-sm">
            <strong className="text-gray-900">「{site?.name || 'サイト'}」</strong> のチャット履歴を閲覧するメンバーとして招待されています
          </p>
        </div>

        <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 mb-6">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">招待メール:</span>
            <span className="font-mono text-gray-800">{member.invited_email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs mt-1">
            <span className="text-gray-500">権限:</span>
            <span className="font-semibold text-sky-700">チャット履歴の閲覧</span>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center mb-5">
          ログイン済みアカウントでこの招待を承認します。<br/>
          未ログインの場合は先にログインしてください。
        </p>

        <div className="space-y-2">
          <a
            href={`/api/sites/${member.site_id}/members/accept?token=${token}`}
            className="block w-full text-center bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl text-sm transition-colors"
          >
            招待を承認する
          </a>
          <a
            href={`/laruHP/auth/login?redirectTo=${encodeURIComponent('/laruHP/invite/' + token)}`}
            className="block w-full text-center border border-gray-200 hover:border-gray-300 text-gray-600 py-3 rounded-xl text-sm transition-colors"
          >
            別アカウントでログインする
          </a>
        </div>
      </div>
    </div>
  );
}

function InvalidInvite() {
  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
        <CircleX className="mx-auto mb-4 h-10 w-10 text-red-500" aria-hidden="true" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">招待リンクが無効です</h1>
        <p className="text-gray-500 text-sm mb-6">このリンクは期限切れか、すでに使用されています。</p>
        <Link href="/laruHP/dashboard" className="text-sky-600 hover:text-sky-500 text-sm transition-colors">ダッシュボードへ →</Link>
      </div>
    </div>
  );
}
