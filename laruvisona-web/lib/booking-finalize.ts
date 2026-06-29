// 予約確定時の通知。既存の /api/contact を内部呼び出しして
// オーナー宛メール・自動返信・LINE・Webhook・ステップ配信・管理画面リアルタイム表示
// （contacts への INSERT）をまとめて再利用する。
//
// /api/contact はレート制限があるため、内部呼び出しは x-internal-secret
// （= RETENTION_SECRET）でバイパスする。

function fmtJst(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}/${p(jst.getUTCMonth() + 1)}/${p(jst.getUTCDate())}(${days[jst.getUTCDay()]}) ${p(jst.getUTCHours())}:${p(jst.getUTCMinutes())}`;
}

export async function finalizeBooking(opts: {
  baseUrl: string;
  siteId: string;
  name: string;
  email: string;
  phone?: string | null;
  service?: string | null;
  slotId: string;
  slotDatetime: string;
  prepaid: boolean;
  amount?: number;
}): Promise<void> {
  const dt = fmtJst(opts.slotDatetime);
  const messageLines = [
    opts.service ? `メニュー: ${opts.service}` : '',
    `ご予約日時: ${dt}`,
    opts.prepaid ? `事前決済: 完了（¥${(opts.amount || 0).toLocaleString()}）` : '',
  ].filter(Boolean);

  try {
    await fetch(`${opts.baseUrl}/api/contact`, {
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
  } catch (e) {
    console.error('[booking-finalize] notify failed:', (e as Error)?.message);
  }
}
