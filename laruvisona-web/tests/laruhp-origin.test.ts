import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LARUHP_PUBLIC_PATHS } from '../lib/laruhp-public.ts';
import { LARUHP_APP_ORIGIN } from '../lib/laruhp-host.ts';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('案内サイトから決済を始めるときは、アプリ側の origin へ渡す', () => {
  // laruhp.com では proxy が /api/* を通さないので、相対パスへのPOSTは405で返る。
  // 405は401でも402でもないため、そのまま「エラーが発生しました」になっていた。
  const plans = src('app/laruHP/plans/page.tsx');
  assert.match(plans, /function checkoutOnAppOrigin/);
  assert.match(plans, /window\.location\.origin === LARUHP_APP_ORIGIN/);
  // 決済の入口で、必ずこの判定を通ってから fetch する
  const guard = plans.indexOf('if (checkoutOnAppOrigin(plan, billing)) return null;');
  const call = plans.indexOf("fetch('/api/stripe/checkout'");
  assert.ok(guard > 0 && call > guard, '判定より前に fetch している');
});

test('proxy が通す laruhp.com のパスに、APIは入っていない', () => {
  // ここに /api を足すと、上の迂回が不要になる代わりに、
  // 案内サイトから認証つきの経路が生える。意図せず開けていないことを見る。
  const proxy = src('proxy.ts');
  const allowed = proxy.match(/\['\/favicon\.ico'[^\]]*\]/)![0];
  const apis = [...allowed.matchAll(/'(\/api\/[a-z-]+)'/g)].map(m => m[1]);
  assert.deepEqual(apis, ['/api/domain-probe'], '案内サイトに開いているAPIが増えている');
});

test('公開ページのどこからも、相対パスでアプリのAPIを叩いていない', () => {
  // 公開ページは laruhp.com でも配信される。相対 /api は必ず失敗する。
  const dir = fileURLToPath(new URL('../app/laruHP/', import.meta.url));
  const publicDirs = LARUHP_PUBLIC_PATHS
    .filter(p => p !== '/' && !p.startsWith('/articles/'))
    .map(p => p.slice(1));
  for (const d of publicDirs) {
    let files: string[];
    try { files = readdirSync(`${dir}${d}`, { recursive: true, encoding: 'utf8' }); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.tsx')) continue;
      const body = readFileSync(`${dir}${d}/${f}`, 'utf8');
      const calls = [...body.matchAll(/fetch\(\s*'(\/api\/[^']+)'/g)].map(m => m[1]);
      for (const c of calls) {
        assert.match(body, /checkoutOnAppOrigin|LARUHP_APP_ORIGIN/, `${d}/${f}: ${c} を相対で叩いている`);
      }
    }
  }
});

test('「料金ページに戻る」で料金ページから出ていかない', () => {
  const plans = src('app/laruHP/plans/page.tsx');
  // 注記のコメントは残してよい。表示文言とリンク先を見る。
  const code = plans.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.doesNotMatch(code, /料金ページに戻る/);
  assert.doesNotMatch(code, /laruHP#pricing/);
  assert.ok(LARUHP_APP_ORIGIN === 'https://laruvisona.jp');
});
