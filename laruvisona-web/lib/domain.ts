// 独自ドメインの正規化・所有確認・接続状態の判定。
//
// ここは「外部に一切つながらない純粋な判定」だけを置く。
// DNSを引く・RenderのAPIを叩く・DBを更新するのは呼び出し側の責務にして、
// 判定ロジックだけを単体テストできるようにしている。
//
// 背景（このファイルが必要になった理由）:
//   - 以前の判定は CNAME の部分一致（records.some(r => r.includes('onrender.com'))）
//     だった。別のRenderサービスや、末尾がたまたま一致するだけのホスト名でも
//     「確認済み」になってしまう。
//   - 共有のAレコード（Renderの全顧客共通IP）に一致することは、
//     そのドメインを我々のアカウントに紐づけてよい証明にならない。
//     「そのドメインのDNSを操作できる人物である」ことを、テナント固有の
//     TXTレコードで別に確認する必要がある。
//   - 「所有確認」「配信先の向き先」「TLSの準備完了」は別の事実なので、
//     ひとつの verified フラグに潰さない。

import { randomBytes } from 'node:crypto';

// ── 状態 ──────────────────────────────────────────────
//
// pending_ownership : TXTレコードによる所有確認待ち
// pending_dns       : 所有は確認できたが、まだ配信先がこちらを向いていない
// ssl_pending       : 向き先も揃ったが、証明書の発行／HTTPS応答がまだ
// connected         : HTTPSで実際に配信できている
// failed            : 直近の確認で回復不能な失敗（理由は last_error）
// legacy            : この仕組みを入れる前から接続されていた既存ドメイン。
//                     既存顧客を止めないため配信は続けるが、UIでは再確認を促す。
export type DomainStatus =
  | 'pending_ownership'
  | 'pending_dns'
  | 'ssl_pending'
  | 'connected'
  | 'failed'
  | 'legacy';

export const DOMAIN_STATUSES: DomainStatus[] = [
  'pending_ownership', 'pending_dns', 'ssl_pending', 'connected', 'failed', 'legacy',
];

/** 配信・canonical・決済戻り先に使ってよい状態か */
export function isServable(status: DomainStatus): boolean {
  return status === 'connected' || status === 'legacy';
}

// ── 正規化 ────────────────────────────────────────────

export interface NormalizedDomain {
  /** punycode（ASCII）に変換済みのホスト名。DBにはこれを保存する */
  host: string;
  /** 利用者に見せる表示用。IDNならUnicodeのまま */
  display: string;
  isWww: boolean;
}

export type NormalizeResult =
  | { ok: true; value: NormalizedDomain }
  | { ok: false; error: string };

const LABEL_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * 利用者が入力した文字列を、DNSで引ける1つのホスト名にそろえる。
 * スキーム・パス・ポート・末尾ドット・全角空白・大文字・IDNを吸収する。
 */
export function normalizeDomain(input: unknown): NormalizeResult {
  if (typeof input !== 'string') return { ok: false, error: 'ドメインを入力してください' };

  // 前後の空白（全角含む）だけを落とす。途中に空白があるものは打ち間違いなので
  // 詰めて通してしまわず、はっきり弾く。
  let s = input.replace(/^[\s　]+|[\s　]+$/g, '');
  if (!s) return { ok: false, error: 'ドメインを入力してください' };
  if (/[\s　]/.test(s)) return { ok: false, error: 'ドメインに空白は使えません' };

  s = s.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, ''); // スキーム
  s = s.replace(/^[^@/]*@/, '');                       // user:pass@
  s = s.split('/')[0].split('?')[0].split('#')[0];     // パス以降
  s = s.replace(/:\d+$/, '');                          // ポート
  s = s.replace(/\.+$/, '');                           // 末尾ドット
  s = s.toLowerCase();

  if (!s) return { ok: false, error: 'ドメインを入力してください' };
  if (s.includes('[') || s.includes(']') || s.includes(':')) {
    return { ok: false, error: 'IPアドレスではなくドメイン名を入力してください' };
  }

  const display = s;

  // IDN → punycode。WHATWG URL に任せる（Node組み込みで完結する）
  let host: string;
  try {
    host = new URL(`http://${s}`).hostname;
  } catch {
    return { ok: false, error: 'ドメインの形式が正しくありません（例: example.com）' };
  }
  host = host.replace(/\.+$/, '').toLowerCase();

  if (host.length > 253) return { ok: false, error: 'ドメインが長すぎます' };

  const labels = host.split('.');
  if (labels.length < 2) return { ok: false, error: 'ドメインの形式が正しくありません（例: example.com）' };
  for (const l of labels) {
    if (l.length < 1 || l.length > 63) return { ok: false, error: 'ドメインの形式が正しくありません（例: example.com）' };
    if (!LABEL_RE.test(l)) return { ok: false, error: 'ドメインの形式が正しくありません（例: example.com）' };
  }

  const tld = labels[labels.length - 1];
  // 全部数字のTLDは存在しない。IPv4を弾くのもここ。
  if (/^\d+$/.test(tld)) return { ok: false, error: 'IPアドレスではなくドメイン名を入力してください' };
  if (tld.length < 2) return { ok: false, error: 'ドメインの形式が正しくありません（例: example.com）' };

  return { ok: true, value: { host, display, isWww: labels[0] === 'www' } };
}

/** www あり／なしの相方を返す（www.example.com ⇄ example.com） */
export function wwwSibling(host: string): string | null {
  const labels = host.split('.');
  if (labels[0] === 'www') {
    const rest = labels.slice(1);
    return rest.length >= 2 ? rest.join('.') : null;
  }
  if (labels.length < 2) return null;
  return `www.${host}`;
}

// ── 予約ホスト ────────────────────────────────────────

/**
 * 顧客の独自ドメインとして受け付けてはいけないホスト。
 * 自社の配信基盤・管理画面・サブドメイン空間を顧客に取られないようにする。
 */
export function isReservedHost(host: string, mainHost?: string | null): boolean {
  const h = host.toLowerCase();
  const fixed = ['onrender.com', 'localhost', 'larubot.tokyo', 'laruvisona.jp', 'vercel.app', 'render.com'];
  for (const f of fixed) {
    if (h === f || h.endsWith(`.${f}`)) return true;
  }
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.test') || h.endsWith('.invalid')) return true;
  const m = (mainHost || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').split(':')[0];
  if (m && (h === m || h.endsWith(`.${m}`))) return true;
  return false;
}

// ── 所有確認（TXTチャレンジ）──────────────────────────

export const CHALLENGE_LABEL = '_laruhp-challenge';
export const CHALLENGE_PREFIX = 'laruhp-site-verification=';

/** 利用者が追加するTXTレコードの名前 */
export function challengeRecordName(host: string): string {
  return `${CHALLENGE_LABEL}.${host}`;
}

/** そのレコードに入れる値 */
export function challengeRecordValue(token: string): string {
  return `${CHALLENGE_PREFIX}${token}`;
}

export function generateVerificationToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * TXTレコード群に、このサイト固有のトークンが含まれるか。
 *
 * dns.resolveTxt は文字列の配列の配列を返す（1レコードが255文字ごとに
 * 分割されることがあるため）。呼び出し側で join した文字列の配列を渡す。
 */
export function checkOwnership(txtRecords: string[], token: string): boolean {
  if (!token) return false;
  const expected = challengeRecordValue(token);
  return txtRecords.some(r => r.replace(/^"|"$/g, '').trim() === expected);
}

// ── 向き先の確認 ──────────────────────────────────────

/** DNS名の比較用の正規化（末尾ドットと大文字を落とす） */
export function normalizeDnsName(name: string): string {
  return name.trim().replace(/\.+$/, '').toLowerCase();
}

/**
 * CNAMEが期待する宛先「そのもの」か。
 * 以前は includes() だったので、別のRenderサービスでも通ってしまった。
 */
export function cnameMatchesTarget(records: string[], expectedTarget: string): boolean {
  const want = normalizeDnsName(expectedTarget);
  if (!want) return false;
  return records.some(r => normalizeDnsName(r) === want);
}

export interface DnsEvidence {
  txt: string[];
  cname: string[];
  a: string[];
}

export interface PointsHereResult {
  pointsHere: boolean;
  /** どの根拠で判断したか。UIと調査ログのために残す */
  how: 'cname' | 'a' | null;
}

/**
 * 配信先がこちらを向いているか。
 *
 * CNAMEが見えないケースは正常にありうる（Cloudflareのプロキシ、apexの
 * ALIAS/ANAME展開など）。そのため「CNAMEが無い＝失敗」とはせず、
 * Aレコードが期待IPと一致するかでも判断する。
 * ただしAレコードはRender全体の共有IPなので、これ単独では所有の証明にしない。
 */
export function checkPointsHere(
  ev: DnsEvidence,
  opts: { expectedTarget: string; expectedApexIps: string[] },
): PointsHereResult {
  if (cnameMatchesTarget(ev.cname, opts.expectedTarget)) return { pointsHere: true, how: 'cname' };
  const ips = new Set(opts.expectedApexIps.map(s => s.trim()).filter(Boolean));
  if (ev.a.some(ip => ips.has(ip.trim()))) return { pointsHere: true, how: 'a' };
  return { pointsHere: false, how: null };
}

// ── 状態の決定 ────────────────────────────────────────

export interface StatusInput {
  ownership: boolean;
  pointsHere: boolean;
  /** RenderのcustomDomain.verificationStatus === 'verified'。未設定なら null */
  renderVerified: boolean | null;
  /** 実際にHTTPSで応答したか。確認していないなら null */
  tlsReady: boolean | null;
}

/**
 * 事実の組み合わせから状態を決める。
 * 「所有確認」「向き先」「TLS」を潰さないので、UIは次に何をすべきかを出せる。
 */
export function deriveStatus(input: StatusInput): DomainStatus {
  if (!input.ownership) return 'pending_ownership';
  if (!input.pointsHere) return 'pending_dns';
  if (input.renderVerified === false) return 'ssl_pending';
  if (input.tlsReady !== true) return 'ssl_pending';
  return 'connected';
}

/** 利用者向けの状態ラベルと、次にやること */
export function statusLabel(status: DomainStatus): { label: string; next: string } {
  switch (status) {
    case 'pending_ownership':
      return { label: '所有確認待ち', next: 'TXTレコードを追加してから「確認する」を押してください。' };
    case 'pending_dns':
      return { label: 'DNS設定待ち', next: 'CNAME（またはAレコード）を追加してから「確認する」を押してください。' };
    case 'ssl_pending':
      return { label: 'SSL準備中', next: '証明書の発行を待っています。数分〜数十分かかります。' };
    case 'connected':
      return { label: '接続済み', next: '独自ドメインで公開されています。' };
    case 'failed':
      return { label: '失敗', next: '設定を確認して、もう一度お試しください。' };
    case 'legacy':
      return { label: '要再確認', next: '現在も公開中です。新しい確認手順での再確認をお願いします。' };
  }
}

/** 利用者に見せるDNSレコードの一覧 */
export interface DnsInstruction {
  purpose: string;
  type: 'TXT' | 'CNAME' | 'A';
  name: string;
  value: string;
  note?: string;
}

export function dnsInstructions(
  host: string,
  token: string,
  opts: { expectedTarget: string; expectedApexIp: string },
): DnsInstruction[] {
  const labels = host.split('.');
  const rows: DnsInstruction[] = [
    {
      purpose: '所有の確認',
      type: 'TXT',
      name: challengeRecordName(host),
      value: challengeRecordValue(token),
      note: 'このレコードは接続後も残してください。既存のTXT（SPFなど）は消さずに追加します。',
    },
  ];
  if (labels.length > 2) {
    rows.push({
      purpose: '配信先',
      type: 'CNAME',
      name: host,
      value: opts.expectedTarget,
    });
  } else {
    rows.push({
      purpose: '配信先',
      type: 'A',
      name: host,
      value: opts.expectedApexIp,
      note: 'ルートドメインにCNAMEを置けないDNSが多いためAレコードです。ALIAS/ANAMEが使えるなら CNAME でも構いません。',
    });
  }
  return rows;
}
