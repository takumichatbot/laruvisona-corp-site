import { createServiceClient } from '@/lib/supabase/server';

// LARUbot（AIチャットボット）が付くプラン。ここに含まれるプランへ切り替わったときに
// LARUbot 側のアカウントを自動登録する。
const BOT_PLANS = new Set(['lite', 'hp-bot', 'hp-bot-seo', 'agency']);

export function isBotPlan(plan: string | null | undefined): boolean {
  return !!plan && BOT_PLANS.has(plan);
}

/** public_id の形。LARUbot は uuid4（36文字・0-9a-f と -）で発行すると回答済み。 */
const PUBLIC_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface LarubotRegistration {
  /** チャットの public_id。LARUSEO も同じ値（LARUbot 側の回答 2026-09-17 ③⑪）。 */
  publicId: string | null;
  /** SEOが付くプランのときだけ入る。値そのものは publicId と同じ。 */
  seoPublicId: string | null;
  /** 'created' / 'existing' など。読めなければ null。 */
  status: string | null;
}

export class LarubotRegisterError extends Error {
  /** LARUbot が返す機械判定用の印（unauthorized / email_required / invalid_plan）。 */
  readonly code: string;
  readonly httpStatus: number;
  constructor(message: string, code: string, httpStatus: number) {
    super(message);
    this.name = 'LarubotRegisterError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/**
 * プランが「LARUbotなし → LARUbotあり」へ切り替わったときだけ LARUbot 登録を叩く。
 * - newPlan が bot プランでなければ何もしない（null を返す）
 * - prevPlan が既に bot プランなら（bot→bot の変更）再登録しない＝冪等
 * - 新規契約時は prevPlan を渡さない（undefined）＝必ず登録
 *
 * 例外は握りつぶさず throw する（呼び出し側で try/catch し、決済処理自体は止めない）。
 *
 * 2026-09-17、LARUbot 側からの回答で分かったこと（docs/larubot-reply-2026-09-17.md）:
 *
 *   1. **応答本文に public_id が最初から入っていた。**
 *      こちらは本文を捨ててステータスだけ見ていたので、LARUbot からの
 *      コールバックが来るまで紐付けを終えられなかった。
 *      コールバックが落ちると「課金は通ったのにボットが付かない」が残る。
 *      本文を読めば、その場で終わる。
 *   2. **agency を hp-bot に変換して送っていた。** 向こうでは hp-bot に
 *      LARUSEO が付かない。全機能込みとして売っているのに付いていなかった。
 *      agency のまま送る。
 *   3. **site_id に空文字を送っていた。** 向こうはそれをそのまま
 *      こちらの webhook へ転送し、こちらは 400 で弾いていた。
 *      値が無いときはキーごと省く。
 */
export async function provisionLarubotOnPlan(params: {
  userId: string;
  email: string | null | undefined;
  plan: string;
  siteId?: string;
  prevPlan?: string | null;
}): Promise<LarubotRegistration | null> {
  const { userId, email, plan, siteId, prevPlan } = params;

  if (!isBotPlan(plan)) return null;
  if (isBotPlan(prevPlan)) return null; // 既に LARUbot 利用中 → 再登録不要

  // 鍵が無いときに黙って戻っていた。課金は通っているのにボットだけ用意されず、
  // 本人にも運用にも何も出ない状態が成立していた。決済は止めないが、
  // 「気づけない失敗」にはしない（呼び出し側が必ずログに出す）。
  if (!process.env.LARU_HP_API_SECRET) {
    throw new LarubotRegisterError(
      `LARUbotの用意を飛ばしました: LARU_HP_API_SECRET が未設定です（plan=${plan} user=${userId}）`,
      'secret_missing', 0,
    );
  }

  const supabase = createServiceClient();

  let siteName = '';
  if (siteId) {
    const { data: site } = await supabase.from('sites').select('name').eq('id', siteId).single();
    siteName = site?.name || '';
  }

  const base = process.env.LARUBOT_API_URL || 'https://larubot.tokyo';

  const res = await fetch(`${base}/api/hp/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-laru-secret': process.env.LARU_HP_API_SECRET,
    },
    body: JSON.stringify({
      email,
      // agency はそのまま送る。hp-bot に変換すると LARUSEO が付かない。
      plan,
      site_name: siteName,
      user_id: userId,
      // 値が無いときはキーごと省く。空文字を送ると、向こうがそれを
      // こちらの webhook へ転送し、こちらが 400 で弾いてしまう。
      ...(siteId ? { site_id: siteId } : {}),
    }),
    signal: AbortSignal.timeout(12_000),
  });

  const payload = await res.json().catch(() => null) as Record<string, unknown> | null;

  if (!res.ok) {
    // 失敗の理由を機械で判定できるようにする。画面に一律「登録に失敗しました」
    // としか出せないのが、これまでの状態だった。
    const code = typeof payload?.code === 'string' ? payload.code : 'unknown';
    throw new LarubotRegisterError(
      `LARUbot register failed: ${res.status} (${code})`, code, res.status,
    );
  }

  const pick = (key: string): string | null => {
    const value = payload?.[key];
    return typeof value === 'string' && PUBLIC_ID.test(value) ? value : null;
  };
  // larubot_public_id は今回足してもらったキー。public_id は前からある。
  const publicId = pick('larubot_public_id') || pick('public_id');
  const seoPublicId = pick('laruseo_public_id');

  const registration: LarubotRegistration = {
    publicId,
    seoPublicId,
    status: typeof payload?.status === 'string' ? payload.status : null,
  };

  // 応答で分かった時点で書き込む。コールバックを待たない。
  // コールバックが来れば同じ値で上書きされるだけなので、二重にはならない。
  if (publicId || seoPublicId) {
    await linkLarubotIds({ userId, siteId, publicId, seoPublicId });
  }

  return registration;
}

/**
 * 受け取った public_id を、サイトの設定へ書き込む。
 *
 * site_id があればそのサイトだけ。無ければ、その人の全サイト。
 * （LARUbot 側もコールバックで同じことをする。どちらが先でも同じ結果になる。）
 */
export async function linkLarubotIds(params: {
  userId: string;
  siteId?: string;
  publicId: string | null;
  seoPublicId: string | null;
}): Promise<void> {
  const { userId, siteId, publicId, seoPublicId } = params;
  if (!publicId && !seoPublicId) return;

  const supabase = createServiceClient();
  const patch = {
    ...(publicId ? { larubotPublicId: publicId, larubot: true } : {}),
    ...(seoPublicId ? { laruseoPublicId: seoPublicId, laruseo: true } : {}),
  };

  const query = supabase.from('sites').select('id, settings_json').eq('user_id', userId);
  const { data: sites } = siteId ? await query.eq('id', siteId) : await query;

  /*
    サイトがまだ無いときは、**預かる。**

    以前はここで黙って return していた。そのとき public_id はどこにも
    残らず、例外にもならず、ログも1行も出ない。画面は「契約済み」のまま。

    そして料金ページから契約した人は、必ずここを通る。
    Stripe の metadata の site_id は空文字（まだサイトが無いので当然）で、
    webhook はそれを渡すから「その人の全サイト」＝0件になる。

    識別子が失われると、あとから再登録する経路も無い。
    埋め込みタグが出ないので、**ブログは1記事も出ない。**
    「毎週AIがSEO記事を自動公開」と売っている機能が、契約した日から動かない。

    預けた分は、最初のサイトを作るときに移す（app/api/sites/route.ts）。
  */
  if (!sites?.length) {
    const held = await supabase.from('profiles').update({
      ...(publicId ? { pending_larubot_public_id: publicId } : {}),
      ...(seoPublicId ? { pending_laruseo_public_id: seoPublicId } : {}),
    }).eq('id', userId).select('id');
    if (held.error || held.data?.length !== 1) {
      // 列がまだ無い場合もここに来る（supabase/profiles_pending_larubot.sql を実行する）
      console.error('[larubot] public ids not held for later:', userId, held.error?.message || 'no profile row');
    }
    return;
  }

  for (const site of sites) {
    await supabase
      .from('sites')
      .update({ settings_json: { ...(site.settings_json as Record<string, unknown>), ...patch } })
      .eq('id', site.id)
      .eq('user_id', userId);
  }
}
