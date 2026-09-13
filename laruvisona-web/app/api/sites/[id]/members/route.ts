import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import crypto from 'crypto';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { escapeInviteHtml, readSiteMemberBody, siteMemberEmail, siteMemberSiteId } from '@/lib/site-member-contract';

type Params = { params: Promise<{ id: string }> };

async function ownerSite(rawSiteId: string) {
  const siteId = siteMemberSiteId(rawSiteId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'ログインが必要です' }, { status: 401 }) };
  const { data: site, error } = await supabase.from('sites').select('id, name').eq('id', siteId).eq('user_id', user.id).maybeSingle();
  if (error) return { error: NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 500 }) };
  if (!site) return { error: NextResponse.json({ error: 'このサイトを操作できません' }, { status: 403 }) };
  return { siteId, site, user };
}

export async function GET(_req: Request, { params }: Params) {
  let access;
  try { access = await ownerSite((await params).id); }
  catch { return NextResponse.json({ error: 'サイトを確認してください' }, { status: 400 }); }
  if ('error' in access) return access.error;
  const service = await createServiceClient();
  const { data: members, error } = await service.from('site_members')
    .select('id, invited_email, role, status, created_at, invite_expires_at')
    .eq('site_id', access.siteId).order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'メンバーを読み込めませんでした' }, { status: 500 });
  return NextResponse.json({ members: members || [] });
}

export async function POST(req: Request, { params }: Params) {
  let access;
  try { access = await ownerSite((await params).id); }
  catch { return NextResponse.json({ error: 'サイトを確認してください' }, { status: 400 }); }
  if ('error' in access) return access.error;
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: '招待メールが設定されていません' }, { status: 503 });
  const service = await createServiceClient();
  const rate = await claimPublicRate(service, 'site-member-invite', access.user.id, 20);
  if (rate === 'limited') {
    return NextResponse.json({ error: '招待回数が多すぎます。しばらくしてからお試しください。' }, { status: 429 });
  }
  if (rate === 'unavailable') return NextResponse.json({ error: '招待受付を確認できません' }, { status: 503 });

  let email: string;
  try {
    const body = await readSiteMemberBody(req);
    if (Object.keys(body).some(key => key !== 'email')) throw Error('入力を確認してください');
    email = siteMemberEmail(body.email);
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  if (email === access.user.email?.trim().toLowerCase()) return NextResponse.json({ error: '所有者自身は招待できません' }, { status: 409 });

  const { data: existing, error: existingError } = await service.from('site_members')
    .select('id, status').eq('site_id', access.siteId).eq('invited_email', email).maybeSingle();
  if (existingError) return NextResponse.json({ error: '招待状態を確認できませんでした' }, { status: 500 });
  if (existing?.status === 'active') return NextResponse.json({ error: 'このメールは参加済みです' }, { status: 409 });

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
  const inviteUrl = `${appUrl}/laruHP/invite/${token}`;
  const { data: saved, error: saveError } = await service.from('site_members').upsert({
    site_id: access.siteId, invited_email: email, role: 'conversation_viewer', status: 'pending',
    user_id: null, invite_token: token, invite_expires_at: expiresAt, created_at: new Date().toISOString(),
  }, { onConflict: 'site_id,invited_email', ignoreDuplicates: false }).select('id').single();
  if (saveError || !saved) return NextResponse.json({ error: '招待を保存できませんでした' }, { status: 500 });

  const safeName = escapeInviteHtml(access.site.name || 'サイト');
  const subjectName = String(access.site.name || 'サイト').replace(/[\r\n]+/g, ' ').slice(0, 100);
  try {
    const { error: mailError } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'LARU HP <noreply@laruvisona.jp>', to: email,
      subject: `「${subjectName}」のLARUbot履歴へ招待されました`,
      html: `<!DOCTYPE html><html lang="ja"><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif"><div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden"><div style="background:#0369a1;padding:28px 36px;color:#fff;font-size:18px;font-weight:800">LARU HP</div><div style="padding:32px 36px"><h2 style="color:#111827;font-size:18px">LARUbot履歴への招待</h2><p style="color:#6b7280;font-size:14px;line-height:1.7"><strong style="color:#111827">「${safeName}」</strong> のチャット履歴を閲覧するメンバーに招待されました。</p><p><a href="${inviteUrl}" style="display:inline-block;background:#0369a1;color:#fff;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none">招待を承認する</a></p><p style="color:#9ca3af;font-size:11px">このリンクは72時間有効です。心当たりがない場合は無視してください。</p></div></div></body></html>`,
    });
    if (mailError) throw Error(mailError.message);
  } catch (error) {
    console.error('[site-members] invitation email failed:', (error as Error).message);
    return NextResponse.json({ error: '招待は保存しましたが、メールを送信できませんでした。再送してください。' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  let access;
  try { access = await ownerSite((await params).id); }
  catch { return NextResponse.json({ error: 'サイトを確認してください' }, { status: 400 }); }
  if ('error' in access) return access.error;
  let email: string;
  try {
    const body = await readSiteMemberBody(req);
    if (Object.keys(body).some(key => key !== 'email')) throw Error('入力を確認してください');
    email = siteMemberEmail(body.email);
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const service = await createServiceClient();
  const { data: deleted, error } = await service.from('site_members').delete()
    .eq('site_id', access.siteId).eq('invited_email', email).select('id');
  if (error) return NextResponse.json({ error: 'メンバーを削除できませんでした' }, { status: 500 });
  if (deleted?.length !== 1) return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
