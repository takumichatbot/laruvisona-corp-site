import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// tsconfig の paths と同じ意味。"@/lib/x" → <プロジェクト直下>/lib/x
const ROOT = new URL('../', import.meta.url);

function resolveAlias(specifier) {
  const rest = specifier.slice(2);                 // "@/" を外す
  const base = new URL(rest, ROOT);
  for (const ext of ['', '.ts', '.tsx', '.js', '/index.ts']) {
    const candidate = new URL(base.href + ext);
    const path = fileURLToPath(candidate);
    if (existsSync(path) && !path.endsWith('/')) {
      return { url: pathToFileURL(path).href, shortCircuit: true };
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // アプリのコードは "@/lib/..." で書かれている。Nextのエイリアスをここで再現する。
  if (specifier.startsWith('@/')) {
    const hit = resolveAlias(specifier);
    if (hit) return hit;
  }
  try {
    return await nextResolve(specifier, context);
  } catch (e) {
    // 相対指定: 拡張子なし → .ts / .tsx / /index.ts を補う
    if (specifier.startsWith('.') && context.parentURL) {
      const base = new URL(specifier, context.parentURL);
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        const candidate = new URL(base.href + ext);
        if (existsSync(fileURLToPath(candidate))) {
          return { url: pathToFileURL(fileURLToPath(candidate)).href, shortCircuit: true };
        }
      }
      throw e;
    }
    // パッケージ内のサブパス（next/server など）は .js を補って再試行する。
    // アプリのコードは Next.js の解決に合わせて拡張子なしで書くため。
    if (!specifier.startsWith('.') && !specifier.startsWith('/') && specifier.includes('/')) {
      try {
        return await nextResolve(`${specifier}.js`, context);
      } catch { /* 元のエラーを投げる */ }
    }
    throw e;
  }
}
