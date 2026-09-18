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
/** 長い英数字の連なりは伏せる。鍵やトークンが混ざっていても外に出さない。 */
const scrub = (text: string) => text.replace(/[A-Za-z0-9_-]{24,}/g, '…');

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

  /*
    切り分け用。3つの口を individually 叩いて、何が通って何が止まるかを見る。

    register が 403 を返し、本文が
    「お手数ですが、もう一度お試しください。時間が経って、操作の有効…」
    だった。これは CSRF／セッション期限切れの文面で、
    **機械からの呼び出しが、画面用の守りに引っかかっている**見込み。

    POST だけが止まって GET は通るなら、その裏付けになる。
    存在しない public_id を渡すので、通れば 404 が返るはず（副作用なし）。
  */
  if (body.probe === true) {
    const probe = async (label: string, url: string, init: RequestInit) => {
      try {
        const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
        const text = await res.text().catch(() => '');
        let parsed: Record<string, unknown> | null = null;
        try { parsed = JSON.parse(text) as Record<string, unknown>; } catch { parsed = null; }
        return {
          label, status: res.status, server: res.headers.get('server'),
          contentType: res.headers.get('content-type'), looksJson: parsed !== null,
          error: parsed?.error ?? null,
          preview: scrub(text).slice(0, 160),
        };
      } catch (e) {
        return { label, status: 0, error: (e as Error)?.name || 'failed' };
      }
    };
    const json = { 'Content-Type': 'application/json', 'x-laru-secret': secret };
    return NextResponse.json({
      probe: [
        await probe('register(POST)', `${base}/api/hp/register`, {
          method: 'POST', headers: json,
          body: JSON.stringify({ email: 'probe-does-not-exist@example.invalid', plan: 'hp', site_name: 'probe' }),
        }),
        await probe('seo/autopilot(POST)', `${base}/api/hp/seo/autopilot`, {
          method: 'POST', headers: json,
          body: JSON.stringify({ public_id: 'probe-unknown-id', active: true }),
        }),
        await probe('status(GET)', `${base}/api/hp/status?public_id=probe-unknown-id`, {
          headers: { 'x-laru-secret': secret },
        }),
        await probe('status(GET・鍵なし)', `${base}/api/hp/status?public_id=probe-unknown-id`, {}),
      ],
    });
  }

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
  /*
    失敗したときに「何が返ってきたか」まで残す。

    最初に通したとき 403 が返り、`code` が空だった。あちらの仕様では
    401 unauthorized のはずで、**アプリの応答なのか、手前の何か（WAF等）が
    返したのかが分からなかった。** 状態コードだけでは、次の一手が決まらない。

    ⚠️ 鍵は絶対に出さない。中身は頭200文字だけ、それらしい文字列は伏せる。
  */
  const regText = await reg.text().catch(() => '');
  let regBody: Record<string, unknown> | null = null;
  try { regBody = JSON.parse(regText) as Record<string, unknown>; } catch { regBody = null; }
  if (!reg.ok) {
    return NextResponse.json({
      step: 'register',
      status: reg.status,
      code: regBody?.code ?? null,
      contentType: reg.headers.get('content-type'),
      server: reg.headers.get('server'),
      looksJson: regBody !== null,
      // JSONでない＝アプリではなく手前が返している見込み。頭だけ見る。
      preview: scrub(regText).slice(0, 200),
    }, { status: 502 });
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
