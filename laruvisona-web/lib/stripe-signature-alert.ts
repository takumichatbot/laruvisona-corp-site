/*
  Stripe の webhook が署名検証で弾かれたことを、**人に届くところへ出す。**

  2026-09-19 の時点で、本番の STRIPE_WEBHOOK_SECRET が本番の送信先と
  一致しているかを確かめる手段が無い（Stripe は本番モードにテストイベントを
  送れず、本番の決済はまだ1件も起きていない）。

  もし一致していなければ、**最初のお客様の決済が署名で弾かれ、
  アカウントが有効にならないのに、誰にも知らされない。**
  400 を返して終わりだからである。ここはそれを「気づける」ようにする。

  ⚠️ 400 を返す既存の動きは変えない。ここは知らせるだけ。
  ⚠️ 通知に入れるのは原因の特定に要る最小限だけ。
     署名ヘッダ・本文・Cookie・Authorization・鍵は**絶対に入れない。**
  ⚠️ 外から不正な POST を大量に投げられて通知が爆発しないよう、
     送信先ごとに1時間に1通に抑える（既存の claimPublicRate を使う）。
     Stripe の送信元IPを自前で管理するようなことはしない。
*/
import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import { claimPublicRate } from '@/lib/public-rate-limit';

/** 同じ送信先について、この時間に1通まで */
export const SIGNATURE_ALERT_WINDOW_SEC = 3600;

const esc = (v: string) => v.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export interface SignatureFailure {
  /** どの受け口か（例: /api/stripe/webhook） */
  endpoint: string;
  /** 署名ヘッダが付いていたか。付いていなければ Stripe 以外からの可能性が高い */
  hadSignatureHeader: boolean;
  /** Stripe の SDK が投げた例外の種類（本文は含めない） */
  errorName: string;
  /** 発生時刻 */
  at?: Date;
}

/**
 * 運営へ1通。失敗しても投げない。
 *
 * 返り値は「送ったか／抑えたか／送れなかったか」。検査で見るためのもので、
 * 呼ぶ側はこれで動きを変えない。
 */
export async function alertStripeSignatureFailure(
  db: SupabaseClient,
  failure: SignatureFailure,
): Promise<'sent' | 'suppressed' | 'unavailable'> {
  const at = failure.at ?? new Date();
  // 記録は必ず残す。メールが出せなくても、ここは消さない。
  console.error('[Stripe webhook] 署名検証に失敗', {
    endpoint: failure.endpoint, hadSignatureHeader: failure.hadSignatureHeader,
    errorName: failure.errorName, at: at.toISOString(),
  });

  const to = (process.env.ADMIN_EMAIL || '').split(',').map(v => v.trim()).filter(Boolean)[0];
  const key = process.env.RESEND_API_KEY;
  if (!to || !key) return 'unavailable';

  /*
    送信先ごとに1時間1通。identity に送信元IPなどは入れない。
    入れると、IPを変えながら投げられたときに通知が爆発する。
  */
  const rate = await claimPublicRate(db, 'stripe-sig-alert', failure.endpoint, 1, SIGNATURE_ALERT_WINDOW_SEC);
  if (rate === 'limited') return 'suppressed';
  if (rate === 'unavailable') {
    // 抑制の仕組みが使えないときは、送らない側に倒す。
    // 爆発する方が、1通届かないより痛い。
    console.error('[Stripe webhook] 通知の抑制ができないので送りません');
    return 'unavailable';
  }

  const jst = new Date(at.getTime() + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 19) + ' JST';
  const lines: Array<[string, string]> = [
    ['受け口', failure.endpoint],
    ['発生時刻', jst],
    ['署名ヘッダ', failure.hadSignatureHeader ? 'あり（Stripe からの可能性が高い）' : 'なし（Stripe 以外の可能性が高い）'],
    ['エラーの種類', failure.errorName],
    ['この通知', `同じ受け口では ${SIGNATURE_ALERT_WINDOW_SEC / 60} 分に1通までに抑えています`],
  ];

  try {
    const resend = new Resend(key);
    const sent = await resend.emails.send({
      from: 'LARU HP <noreply@laruvisona.jp>',
      to,
      subject: '【要確認】Stripe webhook の署名検証に失敗しました',
      html: `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#fef2f2;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #fecaca;border-radius:12px;padding:24px">
    <h1 style="font-size:17px;margin:0 0 4px;color:#991b1b">Stripe webhook の署名検証に失敗しました</h1>
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px">
      Stripe からのイベントであれば、<strong>本番の STRIPE_WEBHOOK_SECRET が送信先と一致していません。</strong>
      その間、お客様の決済が通っても契約が有効になりません。
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${lines.map(([k, v]) => `<tr>
        <td style="padding:6px 0;color:#6b7280;width:120px">${esc(k)}</td>
        <td style="padding:6px 0;color:#111827;font-weight:600">${esc(v)}</td>
      </tr>`).join('')}
    </table>
    <p style="font-size:12px;color:#9ca3af;margin:16px 0 0">
      確かめ方: Stripe → 本番モード → Webhook → 該当の送信先 → 署名シークレットを表示し、
      Render の STRIPE_WEBHOOK_SECRET と同じかを見る。違っていれば Render 側を入れ替えて再デプロイ。
    </p>
  </div>
</body></html>`,
    }, { idempotencyKey: `stripe-sig-fail-${failure.endpoint}-${Math.floor(at.getTime() / (SIGNATURE_ALERT_WINDOW_SEC * 1000))}`.slice(0, 200) });
    if (sent.error) { console.error('[Stripe webhook] 署名失敗の通知を送れませんでした:', sent.error.message); return 'unavailable'; }
    return 'sent';
  } catch (e) {
    console.error('[Stripe webhook] 署名失敗の通知で例外:', (e as Error)?.message);
    return 'unavailable';
  }
}
