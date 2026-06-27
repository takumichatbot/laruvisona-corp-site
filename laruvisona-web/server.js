const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const SECRET_KEY = process.env.JWT_SECRET || 'change-me';
const SUB_FILE = path.join('/tmp', 'bridge_push_sub.json');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL || 'admin@laruvisona.jp'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

function verify(token) {
  try { jwt.verify(token, SECRET_KEY); return true; } catch { return false; }
}

function safeSend(ws, data) {
  try { if (ws.readyState === 1) ws.send(JSON.stringify(data)); } catch {}
}

async function sendPushNotification(payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  try {
    const sub = JSON.parse(fs.readFileSync(SUB_FILE, 'utf-8'));
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch { /* no subscription or send failed */ }
}

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      await handle(req, res, parse(req.url, true));
    } catch (err) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // macs: Map<macId, { ws, name }>
  const macs = new Map();
  // Expose to Next.js API routes so quick-task POST can forward directly to mac_agent
  global.relayMacs = macs;
  const clients = [];

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname !== '/relay') { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  function broadcastMacList() {
    const list = [...macs.entries()].map(([id, m]) => ({ id, name: m.name }));
    clients.forEach(c => safeSend(c, { type: 'mac_list', macs: list }));
  }

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token') || '';
    const role = url.searchParams.get('role') || '';
    const macId = url.searchParams.get('mac_id') || 'default';
    const macName = url.searchParams.get('mac_name') || macId;

    if (!verify(token)) {
      safeSend(ws, { type: 'auth_error' });
      ws.close(4001);
      return;
    }

    if (role === 'mac') {
      macs.set(macId, { ws, name: macName });
      console.log(`[relay] mac connected: ${macId} (${macName}) — total macs: ${macs.size}`);
      safeSend(ws, { type: 'relay_ready' });
      broadcastMacList();
      // backward compat: also send mac_online
      clients.forEach(c => safeSend(c, { type: 'mac_online', mac_id: macId, mac_name: macName }));

      // Mac 接続時: キューに溜まったショートカットタスクを処理
      setTimeout(() => {
        const queue = global.bridgeQuickQueue;
        if (!queue || queue.length === 0) return;
        const pending = queue.filter(t => !t.mac_id || t.mac_id === macId);
        global.bridgeQuickQueue = queue.filter(t => t.mac_id && t.mac_id !== macId);
        for (const task of pending) {
          if (task.project) safeSend(ws, { type: 'select_project', project: task.project });
          safeSend(ws, { type: 'message', content: task.input });
          console.log(`[relay] queued task forwarded to ${macId}: ${task.input.slice(0, 40)}`);
        }
      }, 1500); // Mac の初期化を待つ

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          // keepalive ping は吸収（クライアントへ流さない）
          if (msg.type === 'ping') return;
          // Tag message with source mac
          const tagged = { ...msg, mac_id: macId };
          clients.forEach(c => safeSend(c, tagged));

          if (msg.type === 'done') {
            const activeClients = clients.filter(c => c.readyState === 1);
            if (activeClients.length === 0) {
              const ok = msg.exit_code === 0;
              sendPushNotification({
                title: ok ? 'Claude Code 完了' : 'Claude Code エラー',
                body: ok ? `${macName}: 実行が正常に完了しました` : `${macName}: 終了コード ${msg.exit_code}`,
                url: '/laruHP/bridge',
              });
            }
          }
        } catch {}
      });
      ws.on('close', () => {
        macs.delete(macId);
        console.log(`[relay] mac disconnected: ${macId} — total macs: ${macs.size}`);
        broadcastMacList();
        clients.forEach(c => safeSend(c, { type: 'mac_offline', mac_id: macId }));
      });

    } else if (role === 'client') {
      clients.push(ws);
      const online = macs.size > 0;
      safeSend(ws, { type: 'mac_status', online });
      broadcastMacList();
      // iPhone が繋いだとき: Mac にバッファを送るよう通知
      macs.forEach(({ ws: macWs }) => safeSend(macWs, { type: 'client_connected' }));

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          const targetId = msg.mac_id || (macs.size > 0 ? [...macs.keys()][0] : null);
          const target = targetId ? macs.get(targetId) : null;
          if (target) target.ws.send(JSON.stringify(msg));
          else safeSend(ws, { type: 'error', message: 'Macがオフラインです' });
        } catch {}
      });
      const removeClient = () => {
        const i = clients.indexOf(ws);
        if (i > -1) clients.splice(i, 1);
      };
      ws.on('close', removeClient);
      ws.on('error', removeClient);
    }
  });

  server.listen(port, () => console.log(`> Ready on port ${port}`));

  // ── 定期実行スケジューラ（常時起動のこのプロセスが内部APIを叩く）──────────────
  // Render は単一インスタンスのため、外部cron無しでステップ配信・週次レポートを動かす。
  const SELF = `http://127.0.0.1:${port}`;

  async function triggerSequences() {
    if (!process.env.RETENTION_SECRET) return;
    try {
      const r = await fetch(`${SELF}/api/sequences/execute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RETENTION_SECRET}` },
      });
      if (!r.ok) console.warn('[cron] sequences/execute:', r.status);
    } catch (e) { console.warn('[cron] sequences error:', e?.message); }
  }
  // ステップ配信: 15分ごと（起動30秒後に初回）
  setTimeout(triggerSequences, 30 * 1000);
  setInterval(triggerSequences, 15 * 60 * 1000);

  // 週次レポート: JST 月曜 8時台に1回だけ（同一週の二重送信を防ぐ）
  let _lastWeeklyKey = '';
  async function maybeWeeklyReport() {
    if (!process.env.CRON_SECRET) return;
    const jst = new Date(Date.now() + 9 * 3600 * 1000);
    const day = jst.getUTCDay();   // 1 = Monday
    const hour = jst.getUTCHours();
    const weekKey = `${jst.getUTCFullYear()}-${jst.getUTCMonth()}-${jst.getUTCDate()}`;
    if (day === 1 && hour === 8 && _lastWeeklyKey !== weekKey) {
      _lastWeeklyKey = weekKey;
      try {
        const r = await fetch(`${SELF}/api/cron/weekly-report`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        });
        if (!r.ok) console.warn('[cron] weekly-report:', r.status);
      } catch (e) { console.warn('[cron] weekly error:', e?.message); }
    }
  }
  setInterval(maybeWeeklyReport, 30 * 60 * 1000); // 30分ごとに判定

  // 日次バッチ: JST 9時台に1回（リテンション・日次ダイジェスト・予約リマインダー）
  let _lastDailyKey = '';
  async function postCron(pathname) {
    try {
      const r = await fetch(`${SELF}${pathname}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RETENTION_SECRET}` },
      });
      if (!r.ok) console.warn(`[cron] ${pathname}:`, r.status);
    } catch (e) { console.warn(`[cron] ${pathname} error:`, e?.message); }
  }
  async function maybeDaily() {
    if (!process.env.RETENTION_SECRET) return;
    const jst = new Date(Date.now() + 9 * 3600 * 1000);
    const hour = jst.getUTCHours();
    const dayKey = `${jst.getUTCFullYear()}-${jst.getUTCMonth()}-${jst.getUTCDate()}`;
    if (hour === 9 && _lastDailyKey !== dayKey) {
      _lastDailyKey = dayKey;
      await postCron('/api/retention/send');
      await postCron('/api/digest/send');
      await postCron('/api/sms/reminders');
    }
  }
  setInterval(maybeDaily, 30 * 60 * 1000); // 30分ごとに判定
});
