import { Resend } from 'resend';
import { createHash } from 'node:crypto';

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
  | 'held'              // サイトが無いあいだの預かりに失敗した
  | 'entitlement'       // HP バンドルの権利の同期（/api/hp/entitlement）が届かない・拒否された
  | 'entitlement_record' // 権利の同期の控え（再送・照合の手がかり）を保存できない
  | 'publication_recovery'; // 権利は確認できたが、記事の公開先を戻せていない（または SEO を確かめられない）

const LABEL: Record<LarubotFailure, string> = {
  register: 'LARUbotへの登録',
  autopilot: 'SEO自動運転の開始',
  link: 'public_id の保存',
  held: 'public_id の預かり',
  entitlement: 'LARUbotへの権利の同期',
  entitlement_record: '権利の同期の控えの保存',
  publication_recovery: '記事の公開先の復帰',
};

/*
  権利同期まわりの通知（2026-10-18）。
  ・同じ障害（種類・利用者・サイト・状態の時刻・段階＝dedupe）は、同じ冪等キーで送る。Resend は同じキーを 24 時間まとめる。
    キーには日付（日本時間）を入れ、未解決なら翌日に 1 通だけ出し直す（1 日 1 通が上限）。試行回数・時刻・状態コードは入れない。
  ・同じキーでは本文も同じにする（変わる詳細＝状態コード・試行回数はログへ）。
  ・保証の範囲：プロバイダーの冪等が効く 24 時間・同じ日付の範囲だけ。メールの送信自体が失敗した・API の鍵が無い・
    日付の境目をまたいだ場合は、もう 1 通出ることがある。HP 側に「通知済み」を記録しないのは、控えを保存できない障害そのものと
    同じ書き込みに頼ることになるため（保存できない場面では、記録もできない）。
*/
const ENT_KINDS: LarubotFailure[] = ['entitlement', 'entitlement_record', 'publication_recovery'];
const ENT_TEXT: Record<string, { lead: string; guide: string }> = {
  entitlement: {
    lead: 'LARUbot への権利の同期が届いていないか、受け付けられませんでした。LARUbot 側は直前の状態を保っています。',
    guide: '直し方：管理画面の照合（/api/admin/hp-entitlement）で HP 側の契約と LARUbot の状態を見比べ、原因（鍵・紐付け・LARUbot 側の障害）を直してください。5xx・通信の失敗は 5 分ごとの再送が続けます。課金やプランを付け直して直そうとしないでください。',
  },
  entitlement_record: {
    lead: 'HP 側で権利の同期の控えを保存できませんでした。送信の結果に関係なく、再送・照合の手がかりが残っていない可能性があります（契約や権利が付いていないという意味ではありません）。',
    guide: '直し方：管理画面の照合（/api/admin/hp-entitlement）で HP 側の契約・控え・LARUbot の状態を確かめてください。データベースへの書き込みが戻れば、次の契約の変化から通常どおり記録されます。課金やプランを付け直して直そうとしないでください。',
  },
  publication_recovery: {
    lead: '権利の同期は済んでいますが、記事の公開先（LARUbot 側の旧URLからの案内）を戻せていません。公開ページそのものは変わっていません。',
    guide: '直し方：管理画面の照合で、そのサイトが公開中か、記事一覧（/articles）が表示できるか、独自ドメインの状態を確かめてください。一時的な失敗は 5 分ごとに自動で再開します（最大 24 時間）。要対応になったものは、原因を直したあとサイトの公開操作で登録し直されます。課金やプランを付け直して直そうとしないでください。',
  },
};

export interface AlertParams {
  kind: LarubotFailure;
  userId: string;
  plan?: string | null;
  siteId?: string | null;
  reason: string;
  status?: number | string | null;
  /** 同じ障害を見分ける固定の値（状態・状態の時刻・段階など）。試行回数や現在時刻は入れない */
  dedupe?: string;
}
export interface AlertDeps {
  now?: () => Date;
  send?: (payload: { from: string; to: string; subject: string; html: string }, opts: { idempotencyKey: string }) => Promise<{ error: { message: string } | null }>;
}

function sha(text: string): string {
  // 固定長の要約。秘密ではなく、長い理由の文を切り詰めずに、同じ障害を同じキーにするためだけ
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

/** 通知の冪等キー。権利同期まわりは「同じ障害・同じ日（日本時間）」で同じキー。それ以外は従来のまま */
export function alertIdempotencyKey(params: AlertParams, now: Date = new Date()): string {
  if (!ENT_KINDS.includes(params.kind)) return `larubot-fail-${params.kind}-${params.userId}-${params.reason}`.slice(0, 200);
  const day = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  const identity = [params.kind, params.userId, params.siteId ?? '-', params.dedupe ?? params.reason].join('|');
  return `laruhp-alert-${params.kind}-${sha(identity)}-${day}`;
}

const esc = (v: string) => v.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** 通知の本文。同じキーなら同じ本文になるよう、権利同期まわりでは変わる値（状態コード）を入れない */
export function alertMessage(params: AlertParams): { subject: string; html: string } {
  const label = LABEL[params.kind];
  const ent = ENT_KINDS.includes(params.kind);
  const text = ent ? ENT_TEXT[params.kind] : {
    lead: '契約そのものは通っています。お客様側では、ボットやSEOが付いていない状態です。',
    guide: '直し方: プランを付け直す（管理画面）か、契約を叩き直すと登録からやり直せます。',
  };
  const lines: Array<[string, string]> = [
    ['失敗した処理', label],
    ['利用者', params.userId],
    ['プラン', params.plan || '（不明）'],
    ['サイト', params.siteId || '（まだ無い）'],
    ['理由', params.reason],
    ...(ent ? [] : [['状態コード', params.status != null ? String(params.status) : '—'] as [string, string]]),
  ];
  return {
    subject: `【要対応】${label}に失敗しました`,
    html: `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#fff7ed;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #fed7aa;border-radius:12px;padding:24px">
    <h1 style="font-size:17px;margin:0 0 4px;color:#9a3412">${esc(label)}に失敗しました</h1>
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px">
      ${esc(text.lead)}
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${lines.map(([k, v]) => `<tr>
        <td style="padding:6px 0;color:#6b7280;width:120px">${esc(k)}</td>
        <td style="padding:6px 0;color:#111827;font-weight:600">${esc(v)}</td>
      </tr>`).join('')}
    </table>
    <p style="font-size:12px;color:#9ca3af;margin:16px 0 0">
      ${esc(text.guide)}
    </p>
  </div>
</body></html>`,
  };
}


/**
 * 運営へ1通。失敗しても投げない（これ自体で契約処理を巻き込まない）。
 * 同じ内容を何度も送らないよう、Resend の idempotencyKey を使う。
 */
export async function alertLarubotFailure(params: AlertParams, deps: AlertDeps = {}): Promise<void> {
  const to = (process.env.ADMIN_EMAIL || '').split(',').map(v => v.trim()).filter(Boolean)[0];
  const key = process.env.RESEND_API_KEY;
  // 記録は必ず残す。メールが出せなくても、ここは消さない（変わる詳細＝状態コードもここに残す）
  console.error('[larubot] 連携に失敗:', params.kind, params.userId, params.siteId ?? '', params.reason, params.status ?? '');
  if (!to || !key) return;
  const idempotencyKey = alertIdempotencyKey(params, (deps.now ?? (() => new Date()))());
  const { subject, html } = alertMessage(params);
  try {
    const send = deps.send ?? ((payload, opts) => new Resend(key).emails.send(payload, opts) as unknown as Promise<{ error: { message: string } | null }>);
    const sent = await send({ from: 'LARU HP <noreply@laruvisona.jp>', to, subject, html }, { idempotencyKey });
    if (sent.error) console.error('[larubot] 失敗の通知を送れませんでした:', sent.error.message);
  } catch (e) {
    console.error('[larubot] 失敗の通知で例外:', (e as Error)?.message);
  }
}
