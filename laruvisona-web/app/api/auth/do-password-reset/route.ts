import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createHmac, timingSafeEqual } from 'crypto';

function verifyToken(token: string): { valid: boolean; email?: string } {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const [email, ts, sig] = decoded.split(':');
    if (!email || !ts || !sig) return { valid: false };

    // 期限チェック（1時間）
    const age = Date.now() - parseInt(ts, 10);
    if (age > 60 * 60 * 1000) return { valid: false };

    // HMAC 検証
    const expected = createHmac('sha256', process.env.ADMIN_SECRET ?? 'fallback')
      .update(`${email}:${ts}:reset`)
      .digest('hex');

    const sigBuf = Buffer.from(sig, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return { valid: false };
    if (!timingSafeEqual(sigBuf, expBuf)) return { valid: false };

    return { valid: true, email };
  } catch {
    return { valid: false };
  }
}

export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}));
  if (!token || !password) return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'パスワードは8文字以上にしてください' }, { status: 400 });

  const { valid, email } = verifyToken(token);
  if (!valid || !email) {
    return NextResponse.json({ error: 'リンクが無効か期限切れです。再度パスワードリセットをお試しください。' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // メールからユーザーを取得
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) return NextResponse.json({ error: 'server error' }, { status: 500 });
  const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });

  // Admin API でパスワードを直接更新（リダイレクト不要）
  const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (updateErr) return NextResponse.json({ error: 'パスワードの更新に失敗しました' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
