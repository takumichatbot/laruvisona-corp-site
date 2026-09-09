// 独自ドメインAPIの構造的な回帰テスト。
//
// 実際のSupabase/Renderには接続できないので、ここではソースを読んで
// 「壊れやすい順番・迂回経路」が戻っていないことを固定する。
// 判定ロジックそのものは tests/domain.test.ts で値として検証している。

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const DOMAIN_ROUTE = 'app/api/sites/[id]/domain/route.ts';
const VERIFY_ROUTE = 'app/api/sites/[id]/domain/verify/route.ts';
const SITE_ROUTE = 'app/api/sites/[id]/route.ts';

/** コメントを外したソース（説明文がテストに引っかからないように） */
function code(p: string): string {
  return read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

test('副作用の前にサイトの所有者を確認する', () => {
  const s = code(DOMAIN_ROUTE);
  const put = s.slice(s.indexOf('export async function PUT'));
  const owner = put.indexOf('ownedSite');
  const insert = put.indexOf('.insert(');
  assert.ok(owner > -1, 'PUTに所有者確認が無い');
  assert.ok(insert > -1, 'PUTにinsertが無い');
  assert.ok(owner < insert, '所有者確認より先に書き込んでいる');
});

test('ドメインを保存しただけでは配信先にならない', () => {
  const s = code(DOMAIN_ROUTE);
  const put = s.slice(s.indexOf('export async function PUT'), s.indexOf('export async function DELETE'));
  assert.equal(/custom_domain\s*:/.test(put), false,
    'PUTで sites.custom_domain を書いている（未確認のドメインが配信先・決済戻り先に載る）');
  assert.equal(/registerDomain/.test(put), false,
    'PUTでRenderに登録している（所有確認の前に外部登録してはいけない）');
});

test('Renderへの登録は所有確認のあとに行う', () => {
  const s = code(VERIFY_ROUTE);
  const ownership = s.indexOf('const ownership = checkOwnership');
  const register = s.indexOf('registerDomain(cfg');
  assert.ok(ownership > -1 && register > -1);
  assert.ok(ownership < register, '所有確認より先にRenderへ登録している');
  assert.match(s, /if \(ownership && cfg\)/, '所有確認を通らなくてもRender登録に進める');
});

test('配信の切り替えは接続済みになったときだけ', () => {
  const s = code(VERIFY_ROUTE);
  const idx = s.indexOf("status === 'connected' && site.custom_domain !== host");
  assert.ok(idx > -1, '接続済み以外でも custom_domain を書き換えうる');
  const after = s.slice(idx, idx + 400);
  assert.match(after, /custom_domain: host/);
  // 失敗時に既存ドメインを消していないこと
  assert.equal(/custom_domain: null/.test(s), false,
    'verifyが custom_domain を消している（切替失敗で旧ドメインが落ちる）');
});

test('顧客が入力したドメインへの接続は safeFetch を通す', () => {
  const s = code(VERIFY_ROUTE);
  assert.match(s, /safeFetch\(`https:\/\/\$\{host\}\//, 'HTTPS確認が素のfetchになっている（SSRF）');
});

test('副作用のあるverifyはPOSTのみで、GETは塞ぐ', () => {
  const s = code(VERIFY_ROUTE);
  assert.match(s, /export async function POST/);
  assert.match(s, /export async function GET[\s\S]*?405/);
});

test('PATCH /api/sites/[id] からドメインを書き換えられない', () => {
  const s = code(SITE_ROUTE);
  const patch = s.slice(s.indexOf('export async function PATCH'), s.indexOf('export async function DELETE'));
  assert.equal(/update\(\{\s*custom_domain/.test(patch), false,
    'PATCHにドメイン更新経路が残っている（所有確認とRender登録を迂回できる）');
  assert.match(patch, /custom_domain' in body[\s\S]{0,400}status: 400/,
    'custom_domainを送られたときに拒否していない');
});

test('配信側は sites.custom_domain だけを見る（＝確認済みのみ配信される）', () => {
  // by-domain と site-origin は変更していない。custom_domain に確認済みしか
  // 入らなくなったので、この2つを触らずに要件を満たしている。
  const byDomain = read('app/hp/by-domain/[domain]/page.tsx');
  assert.match(byDomain, /\.eq\('custom_domain', domain\)/);
  assert.match(byDomain, /\.eq\('published', true\)/);
  const origin = read('lib/site-origin.ts');
  assert.match(origin, /site\.custom_domain/);
});

test('移行SQLがあり、既存ドメインを止めずに取り込む', () => {
  const sql = read('supabase/site_domains.sql');
  assert.match(sql, /create table if not exists public\.site_domains/);
  // 同じホストを2サイトが同時に主張できない
  assert.match(sql, /create unique index if not exists site_domains_host_key/);
  assert.match(sql, /enable row level security/);
  // 既存顧客を止めない
  assert.match(sql, /'legacy'/);
  assert.match(sql, /from public\.sites s\s+where s\.custom_domain is not null/);
  // 既存の配信ポインタを消していない
  assert.equal(/update public\.sites[\s\S]*custom_domain\s*=\s*null/.test(sql), false,
    '移行SQLが既存の custom_domain を消している');
});

test('移行SQL適用前でも既存の接続済みドメインが画面から消えない', () => {
  // デプロイとSQL適用のどちらが先でも、既存顧客の設定画面が壊れないこと。
  const s = code(DOMAIN_ROUTE);
  assert.match(s, /rowsErr/, 'site_domains が無いときの分岐が無い');
  assert.match(s, /migrationPending: true/);
  const idx = s.indexOf('if (rowsErr)');
  assert.ok(idx > -1);
  assert.match(s.slice(idx, idx + 700), /liveDomain: site\.custom_domain/);
});

test('設定画面はステップと次の操作を出す', () => {
  const ui = read('app/laruHP/settings/DomainSettings.tsx');
  for (const w of ['所有確認', 'DNS接続', 'SSL', '公開']) {
    assert.ok(ui.includes(w), `進捗表示に「${w}」が無い`);
  }
  // 「何を・どこに・どんな値で」設定するかが1件ずつ分かること。
  // 390pxだと表は列が潰れて読めなかったので、項目ごとのカードにしている。
  assert.match(ui, /種類: \{r\.type\}/, 'レコードの種類を出していない');
  assert.match(ui, /\['名前', r\.name\], \['値', r\.value\]/, '名前と値を出していない');
  assert.equal(/<table/.test(ui), false, '狭い画面で潰れる表に戻っている');
  // 手で書き写させない
  assert.match(ui, /navigator\.clipboard\.writeText/);
  assert.match(ui, /をコピー/);
  // 既存のメール設定を壊さない案内
  assert.match(ui, /MX[\s\S]{0,80}消さずに残して/);
  // 操作ボタンはタップ領域44px以上。
  // JSXの onClick={() => ...} に > が入るので、開始タグを正規表現で切らずに
  // 「<button から </button まで」を見る。
  const parts = ui.split('<button').slice(1);
  for (const part of parts) {
    const body = part.slice(0, part.indexOf('</button'));
    assert.ok(/min-h-\[44px\]/.test(body), `44px未満のボタンがある: ${body.slice(0, 80)}`);
  }
  assert.ok(parts.length >= 3, 'ボタンが見つからない');
});
