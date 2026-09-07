// サイトの blocks_json（v1配列 / v2 {pages}）を横断して探索するヘルパー。
// 会員ゲートの本文取得と、購読価格の照合で共有する。

type Block = { id?: string; type?: string; data?: Record<string, unknown> };

function walk(node: unknown, visit: (b: Block) => void): void {
  if (node == null) return;
  if (Array.isArray(node)) { node.forEach(n => walk(n, visit)); return; }
  if (typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  if (typeof o.type === 'string') visit(o as Block);
  Object.values(o).forEach(v => walk(v, visit));
}

/** 指定 id・指定 type のブロックを探す。 */
export function findBlock(blocksJson: unknown, blockId: string, type: string): Block | null {
  let found: Block | null = null;
  walk(blocksJson, b => {
    if (!found && b.id === blockId && b.type === type) found = b;
  });
  return found;
}

/**
 * 指定 type のブロックに設定されている Stripe Price ID を集める。
 * クライアントから渡された priceId を「このサイトのオーナーが設定した値か」で
 * 照合するために使う（任意の価格で購読されるのを防ぐ）。
 */
export function collectPriceIds(blocksJson: unknown, type: string): Set<string> {
  const ids = new Set<string>();
  walk(blocksJson, b => {
    if (b.type !== type) return;
    const pid = String((b.data as Record<string, unknown> | undefined)?.priceId ?? '').trim();
    if (pid) ids.add(pid);
  });
  return ids;
}
