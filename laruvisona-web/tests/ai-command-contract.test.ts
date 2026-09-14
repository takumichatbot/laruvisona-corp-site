import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNewCommand, parseSession, validSessionId } from '../lib/ai-command-contract.ts';

test('AI司令室は命令を有限化し、権限省略を既定で無効にする', () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  const parsed = parseNewCommand({ session_id: 'site-main', message: '確認して' });
  assert.equal(parsed?.auto_approve, false);
  assert.equal(parsed?.auto_retry, false);
  assert.equal(parseNewCommand({ session_id: 'site-main', message: 'x'.repeat(12001) }), null);
  assert.equal(parseNewCommand({ session_id: 'site-main', message: '確認', image_urls: ['https://evil.example/a.png'] }), null);
  assert.ok(parseNewCommand({ session_id: 'site-main', message: '確認', image_urls: ['https://project.supabase.co/storage/v1/object/public/ai-command-images/a.webp'] }));
});

test('AI司令室のセッションIDと作業場所を検査する', () => {
  assert.equal(validSessionId('../escape'), false);
  assert.equal(parseSession({ id: 'main', name: '本体', cwd: 'relative/path' }), null);
  assert.deepEqual(parseSession({ id: 'main', name: '本体', cwd: '/Users/example/repo' }), {
    id: 'main', name: '本体', cwd: '/Users/example/repo', description: null, system_context: null, color: 'sky',
  });
});

test('AI司令室APIは管理者確認後も更新列と添付画像を限定する', () => {
  const patch = readFileSync(new URL('../app/api/ai-command/commands/[id]/route.ts', import.meta.url), 'utf8');
  const upload = readFileSync(new URL('../app/api/ai-command/upload/route.ts', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../app/laruHP/ai-command/page.tsx', import.meta.url), 'utf8');
  assert.match(patch, /body\.status !== 'cancelled'/);
  assert.match(patch, /\.in\('status', \['pending', 'running'\]\)/);
  assert.match(upload, /file\.size > 10 \* 1024 \* 1024/);
  assert.match(upload, /limitInputPixels: 40_000_000/);
  assert.match(page, /useState\(false\)[\s\S]*autoApprove|autoApprove[\s\S]*useState\(false\)/);
});

test('AI司令室はDB障害を空一覧や削除成功として扱わない', () => {
  const commands = readFileSync(new URL('../app/api/ai-command/commands/route.ts', import.meta.url), 'utf8');
  const status = readFileSync(new URL('../app/api/ai-command/status/route.ts', import.meta.url), 'utf8');
  assert.match(commands, /if \(error\) return NextResponse\.json\(\{ error: '命令の一覧を取得できませんでした' \}/);
  assert.match(commands, /if \(error\) return NextResponse\.json\(\{ error: '命令を削除できませんでした' \}/);
  assert.match(status, /if \(health\.error \|\| heartbeat\.error\)/);
});
