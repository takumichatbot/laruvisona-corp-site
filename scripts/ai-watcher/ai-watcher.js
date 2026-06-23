#!/usr/bin/env node
/**
 * AI司令室 ローカル Watcher v3
 * - 並列実行（プロジェクトごとに独立して動く）
 * - git diff 自動キャプチャ
 * - エラー時自動リトライ
 * - プロジェクトヘルス定期更新
 * - 会話チェーン（context_output）
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { spawn, execSync } = require('child_process');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const procs = new Map();           // commandId -> ChildProcess
const busyBySession = new Map();   // sessionId -> boolean (並列対応)

// ── Heartbeat ─────────────────────────────────────────────────────

async function heartbeat() {
  await db.from('watcher_heartbeat').upsert({ id: 'main', last_seen: new Date().toISOString() });
}
heartbeat();
setInterval(heartbeat, 10_000);

// ── Project health ────────────────────────────────────────────────

async function updateHealth(session) {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: session.cwd }).toString().trim();
    const uncommitted = execSync('git status --porcelain', { cwd: session.cwd }).toString().trim().split('\n').filter(Boolean).length;
    const lastMsg = execSync('git log -1 --pretty=format:"%s"', { cwd: session.cwd }).toString().trim();
    await db.from('watcher_health').upsert({
      session_id: session.id,
      git_branch: branch,
      uncommitted_count: uncommitted,
      last_commit_msg: lastMsg.slice(0, 100),
      updated_at: new Date().toISOString(),
    });
  } catch {
    // not a git repo
  }
}

// ── Git diff capture ──────────────────────────────────────────────

async function captureGitDiff(commandId, cwd, beforeSha) {
  try {
    const { stdout: afterSha } = await execAsync('git rev-parse HEAD', { cwd });
    const after = afterSha.trim();
    const range = beforeSha && beforeSha !== after ? `${beforeSha} ${after}` : '';
    const baseCmd = range ? `git diff ${range}` : 'git diff HEAD';

    const { stdout: stat } = await execAsync(`${baseCmd} --stat`, { cwd });
    const { stdout: diff } = await execAsync(baseCmd, { cwd, maxBuffer: 1024 * 1024 });

    if (stat.trim()) {
      await db.from('ai_commands').update({
        git_diff_stat: stat.trim(),
        git_diff: diff.length > 50_000 ? diff.slice(0, 50_000) + '\n…(truncated)' : diff.trim(),
      }).eq('id', commandId);
    }
  } catch {
    // not a git repo or no diff
  }
}

// ── Supabase helpers ──────────────────────────────────────────────

async function getPending() {
  const { data: sessions } = await db.from('ai_sessions').select('*');
  if (!sessions?.length) return null;
  // only consider sessions that are idle
  const idleSessions = sessions.filter(s => !busyBySession.get(s.id));
  if (!idleSessions.length) return null;

  const { data } = await db
    .from('ai_commands')
    .select('*, ai_sessions(*)')
    .eq('status', 'pending')
    .in('session_id', idleSessions.map(s => s.id))
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

async function setStatus(id, status, extra = {}) {
  await db.from('ai_commands').update({ status, ...extra }).eq('id', id);
}

// ── Runner ────────────────────────────────────────────────────────

async function run(cmd) {
  const session = cmd.ai_sessions;
  const short = cmd.id.slice(0, 8);

  busyBySession.set(session.id, true);

  console.log(`\n▶ [${short}] ${session.name}`);
  console.log(`  > ${cmd.message.slice(0, 100)}`);

  // Capture git state before
  let beforeSha = '';
  try { beforeSha = execSync('git rev-parse HEAD', { cwd: session.cwd }).toString().trim(); } catch {}

  await setStatus(cmd.id, 'running', { started_at: new Date().toISOString() });

  // Build full message
  let msg = '';
  if (session.system_context?.trim()) msg += `[プロジェクトコンテキスト]\n${session.system_context.trim()}\n\n---\n`;
  if (cmd.context_output?.trim()) msg += `[前の実行結果（引き継ぎ）]\n${cmd.context_output.slice(0, 8000)}\n\n---\n`;
  msg += cmd.message;
  if (cmd.image_urls?.length) msg += '\n\n---\n添付画像:\n' + cmd.image_urls.join('\n');

  const args = [];
  if (cmd.auto_approve) args.push('--dangerously-skip-permissions');
  args.push('-p', msg);

  const proc = spawn('claude', args, {
    cwd: session.cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  procs.set(cmd.id, proc);

  let currentOutput = '';
  let buf = '';
  let lastFlush = Date.now();

  const flush = async (final = false) => {
    if (!buf && !final) return;
    currentOutput += buf; buf = '';
    await db.from('ai_commands').update({ output: currentOutput }).eq('id', cmd.id);
  };

  proc.stdout.on('data', chunk => {
    const t = chunk.toString(); process.stdout.write(t); buf += t;
    if (Date.now() - lastFlush > 1200) { lastFlush = Date.now(); flush(); }
  });
  proc.stderr.on('data', chunk => {
    const t = chunk.toString(); process.stderr.write(t); buf += '[err] ' + t;
    if (Date.now() - lastFlush > 1200) { lastFlush = Date.now(); flush(); }
  });

  await new Promise(resolve => {
    proc.on('close', async (code, signal) => {
      await flush(true);
      procs.delete(cmd.id);

      const { data: current } = await db.from('ai_commands').select('status, auto_retry, parent_id').eq('id', cmd.id).single();

      if (current?.status === 'cancelled') {
        console.log(`  ⛔ [${short}] キャンセル`);
      } else if (code === 0) {
        await setStatus(cmd.id, 'done', { completed_at: new Date().toISOString() });
        await captureGitDiff(cmd.id, session.cwd, beforeSha);
        await updateHealth(session);
        console.log(`  ✅ [${short}] 完了`);
      } else {
        await setStatus(cmd.id, 'error', {
          completed_at: new Date().toISOString(),
          error_message: `終了コード ${code}${signal ? ` (${signal})` : ''}`,
        });
        console.log(`  ❌ [${short}] エラー (code: ${code})`);

        // 自動リトライ（parent_id がなければ = 最初の試行のみ）
        if (current?.auto_retry && !current?.parent_id) {
          const errCtx = currentOutput.slice(-3000);
          console.log(`  🔄 [${short}] 自動リトライを作成`);
          await db.from('ai_commands').insert({
            session_id: cmd.session_id,
            message: `前のコマンドでエラーが発生しました。エラーを分析して修正してください。\n\nエラー出力（最後の部分）:\n${errCtx}\n\n元の指示:\n${cmd.message}`,
            auto_approve: cmd.auto_approve,
            auto_retry: false,
            parent_id: cmd.id,
            status: 'pending',
          });
        }
      }
      busyBySession.set(session.id, false);
      resolve(undefined);
      // immediately check for more work in this session
      tick();
    });
  });
}

// ── Cancellation ──────────────────────────────────────────────────

async function checkCancels() {
  for (const [id, proc] of procs.entries()) {
    const { data } = await db.from('ai_commands').select('status').eq('id', id).single();
    if (data?.status === 'cancelled') {
      console.log(`\n⛔ 停止: ${id.slice(0, 8)}`);
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 2000);
    }
  }
}

// ── Main loop ─────────────────────────────────────────────────────

async function tick() {
  const cmd = await getPending();
  if (cmd) run(cmd); // no await = 並列実行
}

// Realtime: instant pickup
db.channel('watcher')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_commands', filter: 'status=eq.pending' }, () => {
    console.log('\n📨 新コマンド');
    tick();
  })
  .subscribe(s => console.log(`Realtime: ${s}`));

// Polling fallback
setInterval(() => { tick(); checkCancels(); }, 3000);

// Initial health check for all sessions
(async () => {
  const { data: sessions } = await db.from('ai_sessions').select('*');
  for (const s of sessions ?? []) updateHealth(s);
})();

tick();

console.log('\n🤖 AI司令室 Watcher v3 起動');
console.log(`   Supabase: ${SUPABASE_URL}`);
console.log('   並列実行対応 / git diff / 自動リトライ');
console.log('   Ctrl+C で停止\n');

process.on('SIGINT', async () => {
  console.log('\n停止中...');
  for (const p of procs.values()) { try { p.kill('SIGTERM'); } catch {} }
  process.exit(0);
});
