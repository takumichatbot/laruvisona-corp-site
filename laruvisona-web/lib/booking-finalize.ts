// 予約確定時の通知。既存の /api/contact を内部呼び出しして
// オーナー宛メール・自動返信・LINE・Webhook・ステップ配信・管理画面リアルタイム表示
// （contacts への INSERT）をまとめて再利用する。
//
// /api/contact はレート制限があるため、内部呼び出しは x-internal-secret
// （= RETENTION_SECRET）でバイパスする。
//
// 宛先は必ず自プロセス（ループバック）に固定する。リクエストの Origin を
// 宛先に使うと、匿名の予約リクエストから任意ドメインへ内部秘密ヘッダーを
// 送らせることができてしまうため、呼び出し側から URL は受け取らない。

/** 内部 API の宛先。外部入力からは決して組み立てない。 */
function internalBaseUrl(): string {
  const explicit = process.env.INTERNAL_API_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  return `http://127.0.0.1:${process.env.PORT || 3000}`;
}

function fmtJst(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}/${p(jst.getUTCMonth() + 1)}/${p(jst.getUTCDate())}(${days[jst.getUTCDay()]}) ${p(jst.getUTCHours())}:${p(jst.getUTCMinutes())}`;
}

export async function finalizeBooking(opts: {
  siteId: string;
  name: string;
  email: string;
  phone?: string | null;
  service?: string | null;
  slotId: string;
  slotDatetime: string;
  prepaid: boolean;
  amount?: number;
}): Promise<boolean> {
  const dt = fmtJst(opts.slotDatetime);
  const messageLines = [
    opts.service ? `メニュー: ${opts.service}` : '',
    `ご予約日時: ${dt}`,
    opts.prepaid ? `事前決済: 完了（¥${(opts.amount || 0).toLocaleString()}）` : '',
  ].filter(Boolean);

  try {
    const res = await fetch(`${internalBaseUrl()}/api/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.RETENTION_SECRET || '',
      },
      body: JSON.stringify({
        siteId: opts.siteId,
        type: 'booking',
        name: opts.name,
        email: opts.email,
        phone: opts.phone || '',
        message: messageLines.join('\n'),
        extraFields: {
          slot_id: opts.slotId,
          date: dt,
          ...(opts.prepaid ? { prepaid: 'yes' } : {}),
        },
      }),
    });
    if (!res.ok) {
      console.error('[booking-finalize] notify failed: status', res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[booking-finalize] notify failed:', (e as Error)?.message);
    return false;
  }
}
