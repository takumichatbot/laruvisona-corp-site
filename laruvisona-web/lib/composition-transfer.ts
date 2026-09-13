import { parseComposition, type Composition } from './studio-composition';
import { LARUHP_APP_ORIGIN } from './laruhp-host';

// デモの文章だけをURLフラグメントで渡す。HTTP・Refererには載せず、受け取り後に消す。
// 認証情報・siteId・任意URLは扱わず、既存のたたき台検査を必ず通す。
export function compositionTransferUrl(choice: Composition, now = Date.now()): string {
  return `${LARUHP_APP_ORIGIN}/laruHP/continue#creation=${encodeURIComponent(JSON.stringify({ at: now, choice }))}`;
}
export function parseCompositionTransfer(hash: string, now = Date.now()): Composition | null {
  if (hash.length > 12000 || !hash.startsWith('#creation=')) return null;
  try {
    const value = JSON.parse(decodeURIComponent(hash.slice('#creation='.length)));
    if (!Number.isFinite(value?.at) || value.at > now + 60000 || now - value.at > 7200000) return null;
    return parseComposition(value.choice);
  } catch { return null; }
}
