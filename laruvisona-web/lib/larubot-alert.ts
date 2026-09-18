import { Resend } from 'resend';

/**
 * LARUbot 連携が失敗したことを、**人に届くところへ出す。**
 *
 * これまでは `console.error` だけだった。ログは誰も見ていないので、
 * 「契約は通ったのにボットもSEOも付いていない」が起きても、
 * **お客様が気づいて連絡してくるまで誰も知らない。**
 *
 * LARUbot 側からも指摘されている:
 *   「失敗しても決済が止まらないので、こちら側の事故がそちらに伝わりません」
 *
 * ⚠️ 決済の流れは変えない。止めるべきかどうかは別の判断で、
 *    ここでやることではない。**気づけるようにするだけ。**
 *
 * 送り先は運営（ADMIN_EMAIL）。お客様には送らない。
 */

export type LarubotFailure =
  | 'register'          // 契約時の登録が失敗した
  | 'autopilot'         // 自動運転を始められなかった
  | 'link'              // public_id を保存できなかった
  | 'held';             // サイトが無いあいだの預かりに失敗した

const LABEL: Record<LarubotFailure, string> = {
  register: 'LARUbotへの登録',
  autopilot: 'SEO自動運転の開始',
  link: 'public_id の保存',
  held: 'public_id の預かり',
};

const esc = (v: string) => v.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/**
 * 運営へ1通。失敗しても投げない（これ自体で契約処理を巻き込まない）。
 * 同じ内容を何度も送らないよう、Resend の idempotencyKey を使う。
 */
export async function alertLarubotFailure(params: {
  kind: LarubotFailure;
  userId: string;
  plan?: string | null;
  siteId?: string | null;
  reason: string;
  status?: number | string | null;
}): Promise<void> {
  const to = (process.env.ADMIN_EMAIL || '').split(',').map(v => v.trim()).filter(Boolean)[0];
  const key = process.env.RESEND_API_KEY;
  // 記録は必ず残す。メールが出せなくても、ここは消さない。
  console.error('[larubot] 連携に失敗:', params.kind, params.userId, params.reason, params.status ?? '');
  if (!to || !key) return;

  const label = LABEL[params.kind];
  const lines: Array<[string, string]> = [
    ['失敗した処理', label],
    ['利用者', params.userId],
    ['プラン', params.plan || '（不明）'],
    ['サイト', params.siteId || '（まだ無い）'],
    ['理由', params.reason],
    ['状態コード', params.status != null ? String(params.status) : '—'],
  ];

  try {
    const resend = new Resend(key);
    const sent = await resend.emails.send({
      from: 'LARU HP <noreply@laruvisona.jp>',
      to,
      subject: `【要対応】${label}に失敗しました`,
      html: `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#fff7ed;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #fed7aa;border-radius:12px;padding:24px">
    <h1 style="font-size:17px;margin:0 0 4px;color:#9a3412">${esc(label)}に失敗しました</h1>
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px">
      契約そのものは通っています。お客様側では、ボットやSEOが付いていない状態です。
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${lines.map(([k, v]) => `<tr>
        <td style="padding:6px 0;color:#6b7280;width:120px">${esc(k)}</td>
        <td style="padding:6px 0;color:#111827;font-weight:600">${esc(v)}</td>
      </tr>`).join('')}
    </table>
    <p style="font-size:12px;color:#9ca3af;margin:16px 0 0">
      直し方: プランを付け直す（管理画面）か、契約を叩き直すと登録からやり直せます。
    </p>
  </div>
</body></html>`,
    }, { idempotencyKey: `larubot-fail-${params.kind}-${params.userId}-${params.reason}`.slice(0, 200) });
    if (sent.error) console.error('[larubot] 失敗の通知を送れませんでした:', sent.error.message);
  } catch (e) {
    console.error('[larubot] 失敗の通知で例外:', (e as Error)?.message);
  }
}
