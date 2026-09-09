import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (e) {
    if (!specifier.startsWith('.') || !context.parentURL) throw e;
    const base = new URL(specifier, context.parentURL);
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      const candidate = new URL(base.href + ext);
      if (existsSync(fileURLToPath(candidate))) {
        return { url: pathToFileURL(fileURLToPath(candidate)).href, shortCircuit: true };
      }
    }
    throw e;
  }
}
