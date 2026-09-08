// SSRF対策の共通fetch。
//
// 外部から与えられたURL（ユーザーが入力したサイトURL、テナントが設定した
// Webhook URLなど）をサーバーから取りに行くときは、必ずこれを通す。
// 素の fetch() を使うと、社内ネットワーク・クラウドのメタデータサーバ・
// localhost で動いている別のAPIに、こちらのサーバーの権限で到達できてしまう。
//
// 守っていること:
//   1. プロトコルは http / https のみ（file:, gopher:, data: などを弾く）
//   2. ポートは 80 / 443 のみ
//   3. ホスト名の名前解決結果を全部見て、1つでも内部アドレスなら拒否
//   4. リダイレクトは自動追従せず、1ホップごとに 1〜3 を再検査（最大3回）
//   5. レスポンスは上限バイト数で打ち切る（巨大ファイルでメモリを潰されない）
//   6. タイムアウト必須
//
// Node の組み込みモジュールしか使わないので、単体テストから直接importできる。

import { lookup as dnsLookup } from 'node:dns/promises';
import net from 'node:net';

export class BlockedUrlError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'BlockedUrlError';
    this.code = code;
  }
}

/** 名前だけで拒否するホスト（DNSを引くまでもないもの） */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'instance-data.ec2.internal',
]);

/** 内部向けにしか使われないサフィックス */
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.onion', '.test', '.invalid'];

const ALLOWED_PORTS = new Set([80, 443]);

function v4IsPrivate(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0) return true;                       // 0.0.0.0/8
  if (a === 10) return true;                      // 10/8 プライベート
  if (a === 127) return true;                     // ループバック
  if (a === 100 && b >= 64 && b <= 127) return true;  // 100.64/10 CGNAT
  if (a === 169 && b === 254) return true;        // リンクローカル（クラウドのメタデータ）
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16/12
  if (a === 192 && b === 168) return true;        // 192.168/16
  if (a === 192 && b === 0) return true;          // 192.0.0/24, 192.0.2/24
  if (a === 198 && (b === 18 || b === 19)) return true; // ベンチマーク用
  if (a === 198 && b === 51) return true;         // 198.51.100/24 ドキュメント用
  if (a === 203 && b === 0) return true;          // 203.0.113/24 ドキュメント用
  if (a >= 224) return true;                      // マルチキャスト/予約/ブロードキャスト
  return false;
}

function v6IsPrivate(ip: string): boolean {
  const lower = ip.toLowerCase().split('%')[0]; // ゾーンIDを落とす
  if (lower === '::' || lower === '::1') return true;
  // IPv4射影 / IPv4互換（::ffff:127.0.0.1 で回避されないように）
  const mapped = lower.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return v4IsPrivate(mapped[1]);
  // 6to4 (2002:xxyy:zzww::/16) は内側のIPv4を見る
  const sixToFour = lower.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4}):/);
  if (sixToFour) {
    const hi = parseInt(sixToFour[1], 16), lo = parseInt(sixToFour[2], 16);
    return v4IsPrivate([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.'));
  }
  if (/^(fc|fd)/.test(lower)) return true;   // fc00::/7 ユニークローカル
  if (/^fe[89ab]/.test(lower)) return true;  // fe80::/10 リンクローカル
  if (/^ff/.test(lower)) return true;        // ff00::/8 マルチキャスト
  if (/^64:ff9b:/.test(lower)) return true;  // NAT64
  return false;
}

/** そのIPアドレスが「外に出てはいけない」ものかどうか。判定できない文字列は安全側に倒して true。 */
export function isPrivateAddress(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) return v4IsPrivate(ip);
  if (v === 6) return v6IsPrivate(ip);
  return true;
}

export type UrlShape = { url: URL; hostname: string; port: number };

/**
 * DNSを引かずに分かる範囲でURLを検査する。
 * 形が不正・スキームが違う・ポートが違う・名前で分かる内部ホストはここで落ちる。
 */
export function validateUrlShape(raw: string | URL): UrlShape {
  let url: URL;
  try {
    url = raw instanceof URL ? raw : new URL(raw);
  } catch {
    throw new BlockedUrlError('invalid_url', 'URLの形式が正しくありません');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError('bad_protocol', 'http/https以外は取得できません');
  }
  if (url.username || url.password) {
    throw new BlockedUrlError('credentials_in_url', 'URLに認証情報を含めることはできません');
  }
  const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
  if (!ALLOWED_PORTS.has(port)) {
    throw new BlockedUrlError('bad_port', '80/443以外のポートは取得できません');
  }
  // 末尾ドット（"example.com." は同じ場所を指すが、文字列一致を抜けられる）を正規化
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname) throw new BlockedUrlError('no_host', 'ホスト名がありません');
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new BlockedUrlError('blocked_host', 'そのホストは取得できません');
  }
  if (BLOCKED_SUFFIXES.some(s => hostname.endsWith(s))) {
    throw new BlockedUrlError('blocked_host', 'そのホストは取得できません');
  }
  return { url, hostname, port };
}

/** 形の検査 + 名前解決した全アドレスの検査。1つでも内部アドレスなら拒否。 */
export async function assertUrlAllowed(raw: string | URL): Promise<UrlShape> {
  const shape = validateUrlShape(raw);
  const { hostname } = shape;

  // IPリテラルならDNSは不要
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new BlockedUrlError('private_address', '内部アドレスへは接続できません');
    }
    return shape;
  }
  // 角括弧付きIPv6 ([::1] など) は URL.hostname で括弧が残る
  const bare = hostname.replace(/^\[|\]$/g, '');
  if (bare !== hostname && net.isIP(bare)) {
    if (isPrivateAddress(bare)) {
      throw new BlockedUrlError('private_address', '内部アドレスへは接続できません');
    }
    return shape;
  }

  let addrs: Array<{ address: string }>;
  try {
    addrs = await dnsLookup(hostname, { all: true });
  } catch {
    throw new BlockedUrlError('dns_failed', 'ホスト名を解決できませんでした');
  }
  if (!addrs.length) throw new BlockedUrlError('dns_failed', 'ホスト名を解決できませんでした');
  for (const a of addrs) {
    if (isPrivateAddress(a.address)) {
      throw new BlockedUrlError('private_address', '内部アドレスへは接続できません');
    }
  }
  return shape;
}

export type SafeFetchOptions = {
  /** ミリ秒。既定10秒 */
  timeoutMs?: number;
  /** 追従するリダイレクトの最大数。既定3 */
  maxRedirects?: number;
};

/**
 * SSRF検査つきのfetch。リダイレクトは自分で1ホップずつ検査しながら追う。
 * 返ってくるResponseのbodyはまだ読んでいないので、readCapped() で上限つきで読む。
 */
export async function safeFetch(
  raw: string | URL,
  init: RequestInit = {},
  opts: SafeFetchOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxRedirects = opts.maxRedirects ?? 3;

  let current: string = (raw instanceof URL ? raw : new URL(String(raw))).toString();
  let currentInit: RequestInit = { ...init };

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const { url } = await assertUrlAllowed(current);
    const res = await fetch(url, {
      ...currentInit,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status < 300 || res.status > 399) return res;

    const loc = res.headers.get('location');
    if (!loc) return res;
    // bodyを捨てておく（ソケットを解放するため）
    try { await res.arrayBuffer(); } catch { /* noop */ }

    let next: URL;
    try { next = new URL(loc, url); } catch {
      throw new BlockedUrlError('bad_redirect', 'リダイレクト先のURLが不正です');
    }
    // 303、および 301/302 のPOSTは仕様どおりGETに落とす
    if (res.status === 303 || ((res.status === 301 || res.status === 302) && (currentInit.method || 'GET').toUpperCase() === 'POST')) {
      currentInit = { ...currentInit, method: 'GET', body: undefined };
    }
    current = next.toString();
  }
  throw new BlockedUrlError('too_many_redirects', 'リダイレクトが多すぎます');
}

/** レスポンス本文を上限バイト数まで読む。超えたぶんは捨てる。 */
export async function readCapped(res: Response, maxBytes = 1_000_000): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        chunks.push(value.subarray(0, value.byteLength - (total - maxBytes)));
        break;
      }
      chunks.push(value);
    }
  } finally {
    try { await reader.cancel(); } catch { /* noop */ }
  }
  return Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8');
}
