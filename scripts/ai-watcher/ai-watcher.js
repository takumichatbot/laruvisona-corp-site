#!/usr/bin/env node
/**
 * AI司令室 ローカル Watcher
 * スマホから送ったコマンドをピックアップして claude CLI で実行する
 *
 * 起動:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJh... \
 *   node ai-watcher.js
 */

const { createClient } = require('@supabase/supabase-js');
const { spawn } = require('child_process');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// commandId -> ChildProcess
const procs = new Map();
let busy = false;

// ── Supabase helpers ──────────────────────────────────────────────

async function getPending() {
  const { data: sessions } = await db.from('ai_sessions').select('id');
  if (!sessions?.length) return null;
  const ids = sessions.map(s => s.id);
  const { data } = await db
    .from('ai_commands')
    .select('*, ai_sessions(*)')
    .eq('status', 'pending')
    .in('session_id', ids)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

async function setStatus(id, status, extra = {}) {
  await db.from('ai_commands').update({ status, ...extra }).eq('id', id);
}

async function appendOutput(id, text) {
  // Fetch current output and append (Supabase doesn't have native append)
  const { data } = await db.from('ai_commands').select('output').eq('id', id).single();
  const next = (data?.output ?? '') + text;
  await db.from('ai_commands').update({ output: next }).eq('id', id);
}

// ── Runner ────────────────────────────────────────────────────────

async function run(cmd) {
  const session = cmd.ai_sessions;
  const short = cmd.id.slice(0, 8);

  console.log(`\n▶ [${short}] ${session.name}`);
  console.log(`  > ${cmd.message.slice(0, 120)}`);
  if (cmd.image_urls?.length) console.log(`  📎 画像: ${cmd.image_urls.length}枚`);

  await setStatus(cmd.id, 'running', { started_at: new Date().toISOString() });

  // Build message (append image URLs as context)
  let msg = cmd.message;
  if (cmd.image_urls?.length) {
    msg += '\n\n---\n添付画像（参照してください）:\n' + cmd.image_urls.join('\n');
  }

  const args = [];
  if (cmd.auto_approve) args.push('--dangerously-skip-permissions');
  args.push('-p', msg);

  const proc = spawn('claude', args, {
    cwd: session.cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  procs.set(cmd.id, proc);

  let buf = '';
  let lastFlush = Date.now();

  const flush = async (final = false) => {
    if (!buf && !final) return;
    const chunk = buf;
    buf = '';
    if (!chunk) return;
    const { data } = await db.from('ai_commands').select('output').eq('id', cmd.id).single();
    await db.from('ai_commands').update({ output: (data?.output ?? '') + chunk }).eq('id', cmd.id);
  };

  proc.stdout.on('data', chunk => {
    const text = chunk.toString();
    process.stdout.write(text);
    buf += text;
    if (Date.now() - lastFlush > 1200) {
      lastFlush = Date.now();
      flush();
    }
  });

  proc.stderr.on('data', chunk => {
    const text = chunk.toString();
    process.stderr.write(text);
    buf += '[err] ' + text;
    if (Date.now() - lastFlush > 1200) {
      lastFlush = Date.now();
      flush();
    }
  });

  await new Promise(resolve => {
    proc.on('close', async (code, signal) => {
      await flush(true);
      procs.delete(cmd.id);

      // Re-check status in case user hit stop
      const { data: current } = await db.from('ai_commands').select('status').eq('id', cmd.id).single();
      if (current?.status === 'cancelled') {
        console.log(`  ⛔ [${short}] キャンセル済み`);
        resolve(undefined);
        return;
      }

      if (code === 0) {
        await setStatus(cmd.id, 'done', { completed_at: new Date().toISOString() });
        console.log(`  ✅ [${short}] 完了 (${code})`);
      } else {
        await setStatus(cmd.id, 'error', {
          completed_at: new Date().toISOString(),
          error_message: `終了コード ${code}${signal ? ` (${signal})` : ''}`,
        });
        console.log(`  ❌ [${short}] エラー (code: ${code})`);
      }
      resolve(undefined);
    });
  });
}

// ── Cancellation watcher ──────────────────────────────────────────

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
  if (busy) return;
  busy = true;
  try {
    const cmd = await getPending();
    if (cmd) await run(cmd);
  } catch (err) {
    console.error('エラー:', err);
  } finally {
    busy = false;
  }
}

// Realtime: instant pickup on INSERT
db.channel('watcher')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_commands', filter: 'status=eq.pending' }, () => {
    console.log('\n📨 新コマンドを受信');
    tick();
  })
  .subscribe(status => console.log(`Realtime: ${status}`));

// Polling fallback
setInterval(() => { tick(); checkCancels(); }, 3000);

tick(); // initial check

console.log('\n🤖 AI司令室 Watcher 起動');
console.log(`   Supabase: ${SUPABASE_URL}`);
console.log('   Ctrl+C で停止\n');

process.on('SIGINT', async () => {
  console.log('\n\n停止中...');
  for (const proc of procs.values()) { try { proc.kill('SIGTERM'); } catch {} }
  process.exit(0);
});
