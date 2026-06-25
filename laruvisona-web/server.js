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

  let macWs = null;
  const clients = [];

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname !== '/relay') { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token') || '';
    const role = url.searchParams.get('role') || '';

    if (!verify(token)) {
      safeSend(ws, { type: 'auth_error' });
      ws.close(4001);
      return;
    }

    if (role === 'mac') {
      macWs = ws;
      safeSend(ws, { type: 'relay_ready' });
      clients.forEach(c => safeSend(c, { type: 'mac_online' }));

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          clients.forEach(c => safeSend(c, msg));

          // Push notification when Claude Code finishes
          if (msg.type === 'done') {
            const activeClients = clients.filter(c => c.readyState === 1);
            // Send push when no clients are connected (phone closed the app)
            if (activeClients.length === 0) {
              const ok = msg.exit_code === 0;
              sendPushNotification({
                title: ok ? 'Claude Code 完了' : 'Claude Code エラー',
                body: ok ? '実行が正常に完了しました' : `終了コード: ${msg.exit_code}`,
                url: '/laruHP/bridge',
              });
            }
          }
        } catch {}
      });
      ws.on('close', () => {
        macWs = null;
        clients.forEach(c => safeSend(c, { type: 'mac_offline' }));
      });

    } else if (role === 'client') {
      clients.push(ws);
      safeSend(ws, { type: 'mac_status', online: macWs !== null });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (macWs) macWs.send(JSON.stringify(msg));
          else safeSend(ws, { type: 'error', message: 'Macがオフラインです' });
        } catch {}
      });
      ws.on('close', () => {
        const i = clients.indexOf(ws);
        if (i > -1) clients.splice(i, 1);
      });
    }
  });

  server.listen(port, () => console.log(`> Ready on port ${port}`));
});
