// 独自ドメインまわりの「構造として保証したいこと」だけを見るテスト。
//
// APIの振る舞い（失敗・競合・所有者違い・解除の再試行）は
// tests/domain-service.test.ts で実処理を呼んで検証している。
// こちらに残すのは、コードを実行しても分からない事実だけ:
//   - 迂回経路が復活していないこと
//   - 移行SQLと権限設計が要件を満たしていること
//   - 画面に必要な情報が出ていること
// DBの実効権限はここでは保証できない。supabase/site_domains_permission_check.sql
// を隔離環境で実行して確認する。

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

function code(p: string): string {
  return read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

// ── 迂回経路 ──────────────────────────────────────────

test('PATCH /api/sites/[id] からドメインを書き換えられない', () => {
  const s = code('app/api/sites/[id]/route.ts');
  const patch = s.slice(s.indexOf('export async function PATCH'), s.indexOf('export async function DELETE'));
  assert.equal(/update\(\{\s*custom_domain/.test(patch), false,
    'PATCHにドメイン更新経路が残っている');
  assert.match(patch, /custom_domain' in body[\s\S]{0,400}status: 400/);
});

test('配信側は sites.custom_domain だけを見る（確認済みしか入らない）', () => {
  const byDomain = read('app/hp/by-domain/[domain]/page.tsx');
  assert.match(byDomain, /\.eq\('custom_domain', domain\)/);
  assert.match(byDomain, /\.eq\('published', true\)/);
  assert.match(read('lib/site-origin.ts'), /site\.custom_domain/);
});

test('副作用のあるverifyとprimaryはPOSTのみ', () => {
  assert.match(code('app/api/sites/[id]/domain/verify/route.ts'), /export async function GET[\s\S]*?405/);
  const primary = code('app/api/sites/[id]/domain/primary/route.ts');
  assert.match(primary, /export async function POST/);
  assert.equal(/export async function GET/.test(primary), false);
});

test('顧客が入力したドメインへの接続は safeFetch を通し、リダイレクトを追わない', () => {
  const s = code('lib/domain-ports.ts');
  assert.match(s, /safeFetch\(\s*`https:\/\/\$\{host\}\/api\/domain-probe`/);
  assert.match(s, /maxRedirects: 0/);
  assert.equal(/\bawait fetch\(/.test(s), false, '素のfetchが混ざっている');
});

test('外部解除は保存済みIDを信用せず、ホスト名で引き直す', () => {
  const s = code('lib/domain-ports.ts');
  const fn = s.slice(s.indexOf('async unregisterByHost'));
  const find = fn.indexOf('findDomain(cfg, host)');
  const del = fn.indexOf('unregisterDomain(cfg');
  assert.ok(find > -1 && del > -1 && find < del, '引き直さずに削除している');
  assert.match(fn, /found\.domain\.name\.toLowerCase\(\) !== host\.toLowerCase\(\)/,
    '対象ホスト名の一致を確認していない');
});

// ── 移行SQLと権限 ────────────────────────────────────

test('一般ユーザーは site_domains を読むことしかできない', () => {
  const sql = read('supabase/site_domains.sql');
  assert.match(sql, /create policy "Users read own site_domains"[\s\S]{0,120}for select/);
  assert.equal(/for all/.test(sql), false, 'FOR ALL のポリシーが残っている');
  assert.match(sql, /revoke insert, update, delete on public\.site_domains from authenticated, anon/);
});

test('sites.custom_domain の直接変更をDB側で拒否する', () => {
  const sql = read('supabase/site_domains.sql');
  assert.match(sql, /create trigger guard_sites_custom_domain_trg/);
  assert.match(sql, /tg_op = 'UPDATE' and new\.custom_domain is distinct from old\.custom_domain/);
  assert.match(sql, /tg_op = 'INSERT' and new\.custom_domain is not null/);
});

test('状態遷移の関数は service_role からしか実行できない', () => {
  const sql = read('supabase/site_domains.sql');
  for (const fn of ['apply_check', 'set_primary', 'begin_release', 'finish_release', 'mark_release_failed']) {
    assert.ok(sql.includes(`laruhp_domain_${fn}`), `関数が無い: ${fn}`);
  }
  assert.match(sql, /revoke all on function public\.%s from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.%s to service_role/);
});

test('確定処理は行をロックし、fencing tokenが一致するときだけ適用する', () => {
  const sql = read('supabase/site_domains.sql');
  const fn = sql.slice(sql.indexOf('function public.laruhp_domain_apply_check'), sql.indexOf('function public.laruhp_domain_set_primary'));
  assert.match(fn, /for update/);
  assert.match(fn, /verification_token is distinct from p_fencing_token/);
  assert.match(fn, /'reason', 'gone'/);
  // 状態更新と配信ポインタの更新が同じ関数（＝同じトランザクション）にある
  assert.match(fn, /update public\.sites set custom_domain = p_host/);
});

test('サイトごと消えても外部解除の記録が残る', () => {
  const sql = read('supabase/site_domains.sql');
  assert.match(sql, /create table if not exists public\.domain_release_queue/);
  assert.match(sql, /create trigger site_domains_enqueue_release_trg before delete/);
});

test('移行SQLは既存ドメインを止めない', () => {
  const sql = read('supabase/site_domains.sql');
  assert.match(sql, /'legacy'/);
  assert.match(sql, /from public\.sites s\s+where s\.custom_domain is not null/);
  assert.equal(/update public\.sites[\s\S]{0,200}custom_domain\s*=\s*null\s*;?\s*--\s*移行/.test(sql), false);
  assert.match(sql, /create unique index if not exists site_domains_host_key/);
});

test('移行SQL適用前でも既存の接続済みドメインが画面から消えない', () => {
  const s = code('app/api/sites/[id]/domain/route.ts');
  assert.match(s, /migrationPending/);
  const idx = s.indexOf('if (rows.length === 0 && site.custom_domain)');
  assert.ok(idx > -1, 'SQL未適用時の分岐が無い');
  assert.match(s.slice(idx, idx + 500), /liveDomain: site\.custom_domain/);
});

// ── 画面 ──────────────────────────────────────────────

test('設定画面はステップ・次の操作・DNSレコードを出す', () => {
  const ui = read('app/laruHP/settings/DomainSettings.tsx');
  for (const w of ['所有確認', 'DNS接続', 'SSL', '公開']) {
    assert.ok(ui.includes(w), `進捗表示に「${w}」が無い`);
  }
  assert.match(ui, /種類: \{r\.type\}/);
  assert.match(ui, /\['名前', r\.name\], \['値', r\.value\]/);
  assert.equal(/<table/.test(ui), false, '狭い画面で潰れる表に戻っている');
  assert.match(ui, /navigator\.clipboard\.writeText/);
});

test('設定画面が「接続確認済み」と「主な公開URL」を分けている', () => {
  const ui = read('app/laruHP/settings/DomainSettings.tsx');
  assert.match(ui, /主な公開URL/);
  assert.match(ui, /canBePrimary/);
  assert.match(ui, /domain\/primary/, '主ドメイン切替の呼び出しが無い');
  assert.match(ui, /解除を再試行|release_pending/, '解除待ちの再試行導線が無い');
});

test('ダッシュボードは旧APIの形を参照しない', () => {
  const dash = read('app/laruHP/dashboard/DashboardClient.tsx');
  assert.equal(/data\.customDomain/.test(dash), false, '旧レスポンスのcustomDomainを見ている');
  assert.equal(/data\.verified/.test(dash), false, '旧レスポンスのverifiedを見ている');
  assert.equal(/method: 'PUT'[\s\S]{0,200}customDomain/.test(dash), false,
    '所有確認を飛ばす旧操作が残っている');
  assert.match(dash, /settings\?tab=domain/, '新しい設定画面への導線が無い');
});

test('操作ボタンのタップ領域は44px以上', () => {
  const ui = read('app/laruHP/settings/DomainSettings.tsx');
  const parts = ui.split('<button').slice(1);
  assert.ok(parts.length >= 3);
  for (const part of parts) {
    const body = part.slice(0, part.indexOf('</button'));
    assert.ok(/min-h-\[44px\]/.test(body), `44px未満のボタンがある: ${body.slice(0, 80)}`);
  }
});
