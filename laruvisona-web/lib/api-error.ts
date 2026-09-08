// 例外をそのままクライアントに返さないための小さなヘルパー。
//
// String(e) や e.message をレスポンスに載せると、内部URL・クエリ文字列に
// 載ったキー・DBのテーブル名やスキーマなどが外に出る。ここを通してから返す。
//
// Nodeの組み込みすら使わない純関数なので、単体テストから直接importできる。

/** 値っぽい長い文字列を潰すパターン（順番に適用する） */
const REDACTIONS: Array<[RegExp, string]> = [
  // URLのクエリに乗った鍵類（?key=..., &token=..., access_token=... など）
  [/([?&](?:key|api_?key|token|access_?token|secret|password|signature|sig)=)[^&\s"']+/gi, '$1<redacted>'],
  // Authorization: Bearer xxxxx
  [/(bearer\s+)[A-Za-z0-9._~+/-]{8,}=*/gi, '$1<redacted>'],
  // JWT（3つのbase64urlをドットで繋いだもの）
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g, '<redacted-jwt>'],
  // よくある鍵のプレフィックス
  [/\b(sk_live_|sk_test_|rk_live_|whsec_|SG\.|ghp_|xox[baprs]-|AIza)[A-Za-z0-9_.-]{6,}/g, '$1<redacted>'],
  // 20文字以上の16進（ハッシュ・トークン）
  [/\b[0-9a-f]{32,}\b/gi, '<redacted-hex>'],
  // URL自体（内部ホスト名やパス構成を隠す）
  [/\bhttps?:\/\/[^\s"'<>)]+/gi, '<url>'],
];

/** 文字列から秘密になりうる部分を落とす */
export function redact(input: string): string {
  let out = input;
  for (const [re, to] of REDACTIONS) out = out.replace(re, to);
  return out;
}

/**
 * 例外をクライアントに返してよい文字列に変換する。
 * 本番では常に fallback（日本語の定型文）を返し、詳細はサーバーログにだけ残す。
 * 開発中は redact したうえで中身を返す（デバッグのため）。
 */
export function safeErrorMessage(e: unknown, fallback = '処理に失敗しました'): string {
  if (process.env.NODE_ENV === 'production') return fallback;
  const raw = e instanceof Error ? e.message : String(e);
  const cleaned = redact(raw).trim();
  return cleaned ? `${fallback}: ${cleaned.slice(0, 300)}` : fallback;
}

/**
 * サーバーログ用。ログにも生の鍵を残さない（ログ基盤は外部SaaSのことが多い）。
 * 呼び出し元を示すタグを先頭に付ける。
 */
export function logError(tag: string, e: unknown): void {
  const raw = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  console.error(`[${tag}] ${redact(raw).slice(0, 1000)}`);
}
