import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/adminAuth';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { readContactBody } from '@/lib/contact-contract';
import { startLarubotAutopilot, fetchLarubotStatus, seoDisplayState } from '@/lib/larubot-seo';

/**
 * LARUbot 連携の本番疎通を、**1件だけ**通してみるための口。
 *
 *   register → public_id → seo/autopilot（初回1本つき） → status
 *
 * 運営だけが叩ける。本物のテナントが1つでき、記事が1本出る（枠を1消費する）。
 * 何度叩いても、同じメールなら同じ public_id が返り、初回記事は1本きり
 * （どちらも LARUbot 側で止めている）。
 *
 * ⚠️ 共有鍵はサーバの環境変数だけにある。応答にも記録にも出さない。
 * ⚠️ 識別子は頭8文字だけ返す。全部を画面やログへ流さない。
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const short = (v: unknown) => (typeof v === 'string' && v ? `${v.slice(0, 8)}…` : null);

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const rate = await claimPublicRate(createServiceClient(), 'larubot-smoke', user.id, 3, 60);
  if (rate !== 'allowed') return NextResponse.json({ error: '少し待ってからお試しください' }, { status: 429 });

  // 本文は上限つきで読む。どのAPIも同じ決まり（tests/integration-boundaries）。
  let body: Record<string, unknown>;
  try { body = await readContactBody(req, 4096); }
  catch { return NextResponse.json({ error: '入力を確認してください' }, { status: 400 }); }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const plan = typeof body.plan === 'string' ? body.plan : 'hp-bot-seo';
  if (!EMAIL.test(email)) return NextResponse.json({ error: 'メールアドレスを確認してください' }, { status: 400 });

  const secret = process.env.LARU_HP_API_SECRET;
  if (!secret) return NextResponse.json({ error: 'LARU_HP_API_SECRET が未設定です' }, { status: 500 });
  const base = process.env.LARUBOT_API_URL || 'https://larubot.tokyo';

  // 1. 登録
  let reg: Response;
  try {
    reg = await fetch(`${base}/api/hp/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-laru-secret': secret },
      body: JSON.stringify({ email, plan, site_name: '疎通確認' }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json({ step: 'register', error: 'LARUbot へ届きませんでした' }, { status: 502 });
  }
  const regBody = await reg.json().catch(() => null) as Record<string, unknown> | null;
  if (!reg.ok) {
    return NextResponse.json({ step: 'register', status: reg.status, code: regBody?.code ?? null }, { status: 502 });
  }
  const publicId = [regBody?.laruseo_public_id, regBody?.larubot_public_id, regBody?.public_id]
    .find(v => typeof v === 'string' && v) as string | undefined;
  if (!publicId) {
    return NextResponse.json({ step: 'register', error: '応答に public_id がありません', keys: Object.keys(regBody ?? {}) }, { status: 502 });
  }

  // 2. 自動運転（初回1本つき）
  const started = await startLarubotAutopilot({
    publicId,
    keywords: typeof body.keyword === 'string' && body.keyword ? [body.keyword] : ['疎通確認 テスト'],
    generateFirst: body.generateFirst !== false,
  });

  // 3. いまの状態（記事は1〜2分かかるので、ここでは「受け付けられたか」を見る）
  const statusBody = await fetchLarubotStatus(publicId);
  const seo = (statusBody?.seo ?? null) as Record<string, unknown> | null;

  return NextResponse.json({
    ok: true,
    register: { status: reg.status, registerStatus: regBody?.status ?? null, publicId: short(publicId) },
    autopilot: started,
    status: seo ? {
      state: seoDisplayState(seo),
      autopilot_active: seo.autopilot_active ?? null,
      next_run_at: seo.next_run_at ?? null,
      unused_keywords: seo.unused_keywords ?? null,
      articles: seo.articles ?? null,
      quota: seo.quota ?? null,
      last_result: seo.last_result ?? null,
    } : null,
  });
}
