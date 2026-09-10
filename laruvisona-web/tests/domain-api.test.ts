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

/** safeFetch を使っている本番のファイル。ここに guard: が現れてはいけない */
const PRODUCTION_FILES_USING_SAFE_FETCH = [
  'lib/domain-ports.ts',
  'app/api/contact/route.ts',
  'app/api/ai/scan-url/route.ts',
];

test('顧客が入力したドメインへの接続は safeFetch を通し、リダイレクトを追わない', () => {
  const s = code('lib/domain-ports.ts');
  // 本番の既定値: 宛先は https、取得は safeFetch
  assert.match(s, /deps\.fetchUrl \?\? safeFetch/);
  assert.match(s, /deps\.originOf \?\? \(\(host: string\) => `https:\/\/\$\{host\}`\)/);
  assert.match(s, /\$\{origin\}\/api\/domain-probe\?/);
  // 追わない指定。maxRedirects:0 は例外になり Location が読めなかったので使わない
  assert.match(s, /redirect: 'manual'/);
  assert.equal(/maxRedirects: 0/.test(s), false, 'maxRedirects:0 は308を例外にする');
  assert.equal(/\bawait fetch\(/.test(s), false, '素のfetchが混ざっている');
});

test('SSRF検査の差し替えは、本番のコードには入っていない', () => {
  // safeFetch の guard はループバックの検証用サーバへ繋ぐテスト専用の口。
  // 本番のコードから渡していないことを固定する。
  for (const f of PRODUCTION_FILES_USING_SAFE_FETCH) {
    assert.equal(/guard\s*:/.test(code(f)), false, `本番コードで guard を渡している: ${f}`);
  }
});

test('到達確認は固定文字列ではなく署名付きの往復で行う', () => {
  const ports = code('lib/domain-ports.ts');
  assert.match(ports, /createChallenge\(secret, host\)/);
  assert.match(ports, /verifyProof\(secret, c, json\.proof\)/);
  assert.match(ports, /if \(!secret\) return \{ result: 'unavailable' \}/);
  // 3xx は追わず、検査を通った転送先ホストだけを持ち帰る
  assert.match(ports, /return \{ result: 'redirected', redirectHost: redirectTargetHost\(loc, origin\) \}/);
  // 転送先URLは https・既定443・資格情報なしだけを通す
  assert.match(ports, /url\.protocol !== 'https:'/);
  assert.match(ports, /url\.username \|\| url\.password/);
  assert.match(ports, /url\.port && url\.port !== '443'/);
  // 使わない本文は上限なく読み込まない
  assert.equal(/await res\.arrayBuffer\(\)/.test(ports), false, '応答本文を全部メモリに読んでいる');
  assert.match(ports, /res\.body\.cancel\(\)/);

  const route = code('app/api/domain-probe/route.ts');
  assert.match(route, /verifyChallenge\(/);
  assert.equal(/marker/.test(route), false, '固定の目印を返す実装が残っている');

  const proof = code('lib/domain-probe-proof.ts');
  assert.match(proof, /createHmac\('sha256'/);
  assert.match(proof, /timingSafeEqual/);
  // 要求と応答で別の署名を使う（応答を要求から作れないように）
  assert.match(proof, /`req\|/);
  assert.match(proof, /`res\|/);
  assert.match(proof, /exp < now/);
});

test('DBの状態遷移は処理世代を見る', () => {
  const sql = read('supabase/site_domains.sql');
  assert.match(sql, /operation_epoch bigint not null default 1/);
  // 解除の開始で世代が進む
  assert.match(sql, /operation_epoch = operation_epoch \+ 1/);
  for (const fn of ['apply_check', 'finish_release', 'mark_release_failed', 'mark_register_started']) {
    const i = sql.indexOf(`function public.laruhp_domain_${fn}`);
    assert.ok(i > -1, `関数が無い: ${fn}`);
    const body = sql.slice(i, sql.indexOf('$$;', i));
    assert.match(body, /operation_epoch is distinct from p_epoch/, `世代を見ていない: ${fn}`);
  }
  // 自動採用は「いまも未設定」のときだけ
  assert.match(sql, /update public\.sites set custom_domain = p_host\s*\n\s*where id = p_site_id and custom_domain is null/);
});

test('外部解除の帰属を解除開始時に固定する', () => {
  const sql = read('supabase/site_domains.sql');
  assert.match(sql, /external_registration_owned boolean/);
  assert.match(sql, /external_registration_owned = coalesce\(/);
  const svc = code('lib/domain-service.ts');
  assert.match(svc, /export function ownsExternalRegistration/);
  assert.match(svc, /const external = ownsExternalRegistration\(row\)/);
});

test('外部削除は解除処理に固定したIDだけを消す', () => {
  const s = code('lib/domain-ports.ts');
  // 削除の直前にホスト名から引き直さない。引き直すと、遅れて再開した
  // 古い解除が、作り直された新しい登録を消してしまう。
  const del = s.slice(s.indexOf('async unregisterById'));
  assert.equal(/findDomain\(/.test(del), false, '削除側でホストから引き直している');
  assert.match(del, /unregisterDomain\(cfg, domainId\)/);

  const find = s.slice(s.indexOf('async findByHost'), s.indexOf('async unregisterById'));
  assert.match(find, /name\.toLowerCase\(\) !== host\.toLowerCase\(\)/, '照会でホスト名の一致を見ていない');

  const svc = code('lib/domain-service.ts');
  // 固定 → 直前の占有確認 → 削除 の順であること
  const pin = svc.indexOf('pinReleaseTarget(');
  const claim = svc.indexOf('claimRelease(args.siteId');
  const unreg = svc.indexOf('unregisterById(targetId)');
  assert.ok(pin > -1 && claim > -1 && unreg > -1, '固定・占有確認・削除がそろっていない');
  assert.ok(pin < claim && claim < unreg, '順序が違う');
});

test('重複した解除は1本に集約する', () => {
  const sql = read('supabase/site_domains.sql');
  assert.match(sql, /release_lease_until > now\(\)[\s\S]{0,200}'in_progress'/);
  const svc = code('lib/domain-service.ts');
  assert.match(svc, /begun\.reason === 'in_progress'/);
});

test('登録開始を記録できなければ外部登録を呼ばない', () => {
  const svc = code('lib/domain-service.ts');
  const i = svc.indexOf('const started = await deps.store.markRegisterStarted');
  assert.ok(i > -1, '記録の結果を受け取っていない');
  const after = svc.slice(i, i + 900);
  assert.match(after, /if \(!started\.ok\)/);
  // register は else 側にしかない
  const reg = after.indexOf('deps.render.register(host)');
  const els = after.indexOf('} else {');
  assert.ok(els > -1 && reg > els, '記録に失敗しても外部登録へ進んでいる');

  const store = code('lib/domain-store-supabase.ts');
  const fn = store.slice(store.indexOf('async markRegisterStarted'));
  assert.match(fn, /if \(error\) return \{ ok: false/, 'RPCのエラーを捨てている');
});

test('登録できたのに記録できなかった分は帰属付きで積む', () => {
  const svc = code('lib/domain-service.ts');
  assert.match(svc, /enqueueOrphanRegistration\(\s*args\.siteId, host, registeredNow, row\.verification_token, row\.operation_epoch,/);
  const sql = read('supabase/site_domains.sql');
  assert.match(sql, /'orphan_registration'/);
});

test('サイトごと削除されても登録途中の記録を失わない', () => {
  const sql = read('supabase/site_domains.sql');
  const trg = sql.slice(sql.indexOf('function public.site_domains_enqueue_release'), sql.indexOf('$$;', sql.indexOf('function public.site_domains_enqueue_release')));
  assert.match(trg, /old\.render_register_started_at is not null/, '登録開始の記録を見ていない');
  assert.match(trg, /verification_token/, 'キューに行の同一性を残していない');
});

test('到達確認は必須。できない場合は接続済みにしない', () => {
  const d = code('lib/domain.ts');
  const fn = d.slice(d.indexOf('export function deriveStatus'), d.indexOf('export function statusLabel'));
  assert.match(fn, /if \(input\.probe !== 'reached'\)/);
  // 「鍵が無くてもRenderのverifiedで通す」抜け道が無いこと
  assert.equal(/probe === 'unavailable'[\s\S]{0,200}'connected'/.test(fn), false);
});

test('回帰テストのランナーが正しいファイルを参照する', () => {
  const sh = read('supabase/run-sql-regression.sh');
  assert.match(sh, /test-bootstrap\.sql/);
  assert.equal(/[^-]bootstrap\.sql/.test(sh.replace(/test-bootstrap\.sql/g, '')), false,
    '存在しない bootstrap.sql を参照している');
  // 自前で一時クラスタを作り、既存DBを消さない
  assert.match(sh, /initdb/);
  assert.match(sh, /mktemp -d/);
  assert.equal(/drop database/i.test(sh), false, '既存のDBを削除している');
  assert.match(sh, /laruhp_regression_\$\$/, '固定名のDBを使っている');
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

// ── 画面（apex/www の主従表示） ──

test('設定画面は「主な公開URL」「転送」「準備中・失敗」を書き分ける', () => {
  const ui = code('app/laruHP/settings/DomainSettings.tsx');
  // 3つの状態がそれぞれ別の文言で出ること
  assert.match(ui, /主な公開URL/);
  assert.match(ui, /へ転送/);
  assert.match(ui, /準備中です。まだこのドメインでは公開されていません。/);
  // 転送先はホスト名を明示する（「どこへ行くのか」が分かるように）
  assert.match(ui, /\{d\.forwardsTo\}/);
  // 転送されるホストにDNS手順を出さない（もう設定は終わっている）
  assert.match(ui, /d\.status !== 'connected' && d\.status !== 'alias'/);
});

test('ドメイン一覧APIは、各ホストの転送先を返す', () => {
  const route = code('app/api/sites/[id]/domain/route.ts');
  assert.match(route, /forwardsTo: forwardTargetFor\(r, site\.custom_domain\)/);
});

test('別名ホストの配信は、そのホストが属するサイトの正規URLからしか作らない', () => {
  const p = code('proxy.ts');
  // 観測値（redirects_to）を配信の宛先に使わない
  assert.equal(/redirects_to/.test(p), false, '観測した転送先を配信に使っている');
  // 転送はパスとクエリを保つ
  assert.match(p, /to\.search = request\.nextUrl\.search/);
  // 恒久転送（308）でメソッドを変えない
  assert.match(p, /NextResponse\.redirect\(to, 308\)/);
  // 公開中のサイトに限る
  assert.match(p, /sites\.published=is\.true/);
});

// ── フォント配布（案B） ──────────────────────────────
//
// 監督レビュー(e836ed3) 3:
//   共通レイアウトの日本語Webフォントと、顧客本文への強制指定だけを外す。
//   会社のブランド書体と、顧客が選んだ書体は維持する。

/** 会社のブランド書体を読み込む画面。ここ以外には配らない */
const BRAND_FONT_ROUTES = [
  'app/page.tsx',                 // 会社トップ
  'app/laruHP/page.tsx',          // LARU HP のLP
  'app/services/layout.tsx',
  'app/works/layout.tsx',
  'app/contact/layout.tsx',
  'app/blog/layout.tsx',
  'app/privacy/layout.tsx',
  'app/terms/layout.tsx',
];

/** ブランド書体を配ってはいけない画面 */
const NO_BRAND_FONT_ROUTES = [
  'app/layout.tsx',               // 全ページ共通
  'app/laruHP/layout.tsx',        // 管理画面ぜんぶ
  'app/hp/[slug]/page.tsx',       // 顧客の公開ページ
  'app/hp/[slug]/shop/page.tsx',
  'app/lp-next/page.tsx',         // 端末フォントで組んである
];

test('共通レイアウトは日本語Webフォントを配らない', () => {
  const layout = code('app/layout.tsx');
  assert.equal(/next\/font\/google/.test(layout), false,
    '共通レイアウトでWebフォントを読み込んでいる（全ページに配られる）');
  assert.equal(/Noto_Sans_JP/.test(layout), false);
});

test('ブランド書体は、ブランドを見せる画面だけが読み込む', () => {
  for (const f of BRAND_FONT_ROUTES) {
    assert.match(code(f), /BrandFonts/, `ブランド書体が抜けている: ${f}`);
  }
  for (const f of NO_BRAND_FONT_ROUTES) {
    assert.equal(/BrandFonts/.test(code(f)), false, `ブランド書体を配っている: ${f}`);
  }
});

test('ブランド書体の部品は、会社の2書体を維持している', () => {
  const bf = code('components/BrandFonts.tsx');
  assert.match(bf, /Space_Grotesk/, '欧文のブランド書体が消えている');
  assert.match(bf, /Noto_Sans_JP/, '和文のブランド書体が消えている');
  assert.match(bf, /--font-space-grotesk:/);
  assert.match(bf, /--font-noto-sans-jp:/);
});

test('ブランド書体を置かない画面の既定は端末フォント', () => {
  const css = code('app/globals.css');
  assert.match(css, /--font-jp-system:/);
  assert.match(css, /--font-noto-sans-jp: var\(--font-jp-system\)/,
    '既定が端末フォントになっていない');
});

test('顧客の公開ページの見出しに、アプリ側から書体を指定しない', () => {
  // 端末フォントを強制するのではなく、指定をやめて顧客の設定を継承させる。
  const css = code('app/globals.css');
  assert.match(css, /\.laru-published :is\(h1, h2, h3, h4, h5, h6\) \{\s*font-family: inherit;/,
    '顧客の見出しがアプリ側の書体で上書きされたままになっている');
  assert.equal(/\.laru-published[^{]*\{[^}]*system-ui/.test(css), false,
    '顧客の見出しに端末フォントを強制している');
  assert.match(code('components/PublishedSite.tsx'), /className="laru-published"/);
});

test('顧客が選んだ書体は、これまでどおり読み込む', () => {
  const ex = code('lib/html-export.ts');
  assert.match(ex, /fonts\.googleapis\.com\/css2\?family=\$\{font\.url\}/,
    '顧客が選んだ書体の読み込みを消している');
  for (const key of ['noto', 'zen', 'mincho', 'rounded', 'biz', 'kaisei']) {
    assert.match(ex, new RegExp(`'${key}':`), `書体の選択肢が減っている: ${key}`);
  }
});
