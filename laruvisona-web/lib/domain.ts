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
// release_pending   : 利用者が解除を指示したが、Render側の解除がまだ終わっていない。
//                     行を消してしまうと再試行できなくなるので、外部IDごと残す。
export type DomainStatus =
  | 'pending_ownership'
  | 'pending_dns'
  | 'ssl_pending'
  | 'connected'
  | 'failed'
  | 'legacy'
  | 'release_pending';

export const DOMAIN_STATUSES: DomainStatus[] = [
  'pending_ownership', 'pending_dns', 'ssl_pending', 'connected', 'failed', 'legacy', 'release_pending',
];

/**
 * 主な公開URL（sites.custom_domain）に採用してよい状態か。
 * ここに入ったホストだけが proxy.ts の配信先と
 * lib/site-origin.ts の決済戻り先許可リストに載る。
 */
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

export type RenderCheck =
  /** Renderの照会が成功し、verified だった */
  | 'verified'
  /** Renderの照会が成功したが、まだ未検証だった */
  | 'unverified'
  /** 登録・照会に失敗した。結果が分からない（未検証と同じ扱いにはできない） */
  | 'unavailable'
  /** RENDER_API_KEY等が未設定で、この確認自体を行わない運用 */
  | 'not_configured';

export type ProbeResult =
  /** 署名付きの往復が成立し、このサービスに届いていることを確認できた */
  | 'reached'
  /** 応答が無い、署名が合わない、別ホストだった */
  | 'not_reached'
  /** 署名鍵が未設定などで、この確認自体ができない */
  | 'unavailable';

export interface StatusInput {
  /** テナント固有のTXTで所有を確認できたか */
  ownership: boolean;
  /** 公開DNS上で配信先がこちらを向いているか（案内用の補助的な根拠） */
  dnsPointsHere: boolean;
  /**
   * そのホスト名で実際にこのサービスへ到達できたか。
   * 固定の文字列を返すだけの確認は別のサーバーでも真似できるので、
   * 要求ごとの nonce と署名で往復が成立したときだけ 'reached' にする。
   */
  probe: ProbeResult;
  renderCheck: RenderCheck;
}

/**
 * 事実の組み合わせから状態を決める。
 *
 * 「確認していない」「確認して駄目だった」「確認する必要がない」を混ぜない。
 * 接続済みにするには、次のどちらかで配信先の裏が取れている必要がある:
 *   (a) 署名付きの到達確認が成立した（probe = reached）
 *   (b) 到達確認ができない運用で、Renderが verified を返し、
 *       かつ公開DNSの向き先も一致している
 * どちらも無いときは ssl_pending のままにして、切り替えない。
 */
export function deriveStatus(input: StatusInput): DomainStatus {
  if (!input.ownership) return 'pending_ownership';

  const renderOk = input.renderCheck === 'verified' || input.renderCheck === 'not_configured';

  if (input.probe === 'reached') {
    return renderOk ? 'connected' : 'ssl_pending';
  }

  if (input.probe === 'unavailable') {
    // 到達確認ができない運用。信頼できる外部確認が取れているときだけ通す。
    if (input.renderCheck === 'verified' && input.dnsPointsHere) return 'connected';
    return input.dnsPointsHere ? 'ssl_pending' : 'pending_dns';
  }

  // probe === 'not_reached'
  return input.dnsPointsHere ? 'ssl_pending' : 'pending_dns';
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
      // 「接続確認済み」と「主な公開URL」は別。ここでは配信ポインタの話をしない。
      return { label: '接続確認済み', next: 'このドメインでアクセスできます。主な公開URLにするかは下で選べます。' };
    case 'failed':
      return { label: '失敗', next: '設定を確認して、もう一度お試しください。' };
    case 'legacy':
      return { label: '要再確認', next: '以前からの設定で配信中です。新しい確認手順での再確認をお願いします。' };
    case 'release_pending':
      return { label: '解除待ち', next: '配信は停止しました。外部側の解除が残っています。「解除を再試行」を押してください。' };
  }
}

/** 利用者に見せるDNSレコードの一覧 */
export interface DnsInstruction {
  purpose: string;
  type: 'TXT' | 'CNAME' | 'A';
  name: string;
  value: string;
  /** 同じ目的の選択肢が複数あるとき、こちらを勧める */
  recommended?: boolean;
  /** 「どちらか一方でよい」ことを示すグループ名 */
  group?: string;
  note?: string;
}

/**
 * 複数ラベルの公開サフィックス（抜粋）。
 *
 * example.co.jp のようなドメインは、ラベル数が3でもDNSゾーンの頂点(apex)であり、
 * 多くのレジストラでCNAMEを置けない。ラベル数だけで判定すると誤った案内になる。
 * ただしここは網羅リストではないので、判定は「おすすめ」を決めるためだけに使い、
 * A と CNAME の両方を必ず画面に出す。
 */
const MULTI_LABEL_SUFFIXES = [
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp', 'ad.jp', 'ed.jp', 'gr.jp', 'lg.jp',
  'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk',
  'com.au', 'net.au', 'org.au', 'co.nz', 'com.br', 'com.cn', 'com.tw',
  'co.kr', 'or.kr', 'com.sg', 'com.hk', 'com.mx', 'co.in', 'com.tr',
];

/**
 * そのホストがDNSゾーンの頂点である「可能性が高い」か。
 * 断定はしない（顧客が example.com のDNSでサブゾーンを委任している場合もある）。
 */
export function looksLikeApex(host: string): boolean {
  const labels = host.split('.');
  for (const suf of MULTI_LABEL_SUFFIXES) {
    if (host.endsWith(`.${suf}`)) return labels.length === suf.split('.').length + 1;
  }
  return labels.length === 2;
}

export function dnsInstructions(
  host: string,
  token: string,
  opts: { expectedTarget: string; expectedApexIp: string },
): DnsInstruction[] {
  const apex = looksLikeApex(host);
  const rows: DnsInstruction[] = [
    {
      purpose: '所有の確認',
      type: 'TXT',
      name: challengeRecordName(host),
      value: challengeRecordValue(token),
      note: 'このレコードは接続後も残してください。既存のTXT（SPFなど）は消さずに追加します。TXTは同じ名前に複数登録できます。',
    },
  ];

  // 配信先は A か CNAME のどちらか一方。どちらが正しいかは顧客のDNSゾーン次第
  // なので、こちらで決め打ちにせず両方を出し、可能性が高いほうを勧める。
  rows.push({
    purpose: '配信先',
    group: 'delivery',
    type: 'CNAME',
    name: host,
    value: opts.expectedTarget,
    recommended: !apex,
    note: 'このホストがサブドメイン（ゾーンの途中）の場合はこちら。',
  });
  rows.push({
    purpose: '配信先',
    group: 'delivery',
    type: 'A',
    name: host,
    value: opts.expectedApexIp,
    recommended: apex,
    note: 'このホストがDNSゾーンの頂点（@ / ルートドメイン）の場合はこちら。ALIAS/ANAMEが使えるDNSなら、CNAMEと同じ値でも構いません。',
  });

  return rows;
}

/** 画面と説明に出す、現時点の対応範囲 */
export const DNS_SUPPORT_NOTES = [
  'MXレコード（メール）や他サービスの確認用TXTは消さずに残してください。',
  'Cloudflareのプロキシ（オレンジ色の雲）を有効にしたままでも接続できます。公開DNSからはレコードが見えませんが、実際にHTTPSで到達できるかで確認します。',
  'DNSの反映には数分〜最大48時間かかることがあります。',
];
