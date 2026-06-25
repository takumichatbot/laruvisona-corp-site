import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(req: Request) {
  const { secret } = await req.json();
  const adminSecret = process.env.ADMIN_SECRET || '';
  if (!adminSecret || secret !== adminSecret) {
    return NextResponse.json({ error: '認証失敗' }, { status: 401 });
  }
  const token = jwt.sign({ sub: 'bridge' }, process.env.JWT_SECRET || 'change-me');
  return NextResponse.json({ token });
}
