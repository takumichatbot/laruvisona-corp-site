// 実モデル試験だけに使う、手元の中継（本番には出さない・製品コードではない）。
//   ・本体の提案API（app/api/ai/section-proposal）が呼ぶ Anthropic Messages API を、ここ経由で実際の API へ送る
//     （サーバーを ANTHROPIC_BASE_URL=http://127.0.0.1:54998 で起動する）
//   ・送る前に、呼び出し回数と費用の上限を確かめる。超えるなら送らない（503 を返す）
//   ・送った呼び出しは、失敗・時間切れでも「使った」と数える。usage が分からなければ見積もりの上限額で計上する
//   ・依頼の本文と、モデルの元の回答・usage を記録する。鍵（x-api-key など）は記録も表示もしない
//   実行: NODE_USE_ENV_PROXY=1 LEDGER=<記録のJSON> node tests/ai-live/anthropic-record-proxy.mjs
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PORT = Number(process.env.PORT || 54998);
const LEDGER = process.env.LEDGER;
const MAX_CALLS = 6;
const BUDGET_USD = 0.10;
// 料金の根拠：https://platform.claude.com/docs/en/about-claude/pricing（Claude Haiku 4.5：入力 $1 / MTok、出力 $5 / MTok）
const PRICE = { 'claude-haiku-4-5-20251001': { input: 1 / 1e6, output: 5 / 1e6 } };
if (!LEDGER) { console.error('LEDGER を指定してください'); process.exit(2); }
const load = () => (existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : { calls: [] });
const save = (l) => writeFileSync(LEDGER, JSON.stringify(l, null, 2));
const spent = (l) => l.calls.reduce((n, c) => n + (c.costUsd ?? c.boundUsd), 0);

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    const ledger = load();
    const reply = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.method !== 'POST' || !req.url.startsWith('/v1/messages')) return reply(404, { error: 'not found' });
    let parsed;
    try { parsed = JSON.parse(body); } catch { return reply(400, { error: 'bad json' }); }
    const price = PRICE[parsed.model];
    if (!price) return reply(503, { type: 'error', error: { type: 'budget', message: `料金の根拠が無いモデル: ${parsed.model}` } });
    // 入力トークンの上限見積もり：送る文字数（system＋messages の JSON）の2倍をトークン数とみなす（日本語の1文字が2トークンになっても足りる側）
    const inputBound = 2 * JSON.stringify({ system: parsed.system, messages: parsed.messages }).length;
    const boundUsd = inputBound * price.input + (parsed.max_tokens || 0) * price.output;
    if (ledger.calls.length >= MAX_CALLS) return reply(503, { type: 'error', error: { type: 'budget', message: `呼び出しは ${MAX_CALLS} 回まで` } });
    if (spent(ledger) + boundUsd > BUDGET_USD) return reply(503, { type: 'error', error: { type: 'budget', message: `費用の上限 $${BUDGET_USD} を超えるため送らない（見積もり上限 $${boundUsd.toFixed(5)}）` } });
    const entry = { n: ledger.calls.length + 1, at: new Date().toISOString(), model: parsed.model, maxTokens: parsed.max_tokens, inputCharsBound: inputBound, boundUsd, request: { system: parsed.system, messages: parsed.messages } };
    ledger.calls.push(entry); save(ledger);   // 送る前に「使った」と記録する
    const headers = {};
    for (const k of ['x-api-key', 'anthropic-version', 'content-type', 'anthropic-beta']) if (req.headers[k]) headers[k] = req.headers[k];
    try {
      const r = await fetch('https://api.anthropic.com' + req.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(30000) });
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch { /* そのまま */ }
      entry.status = r.status;
      entry.requestId = r.headers.get('request-id') || null;
      entry.response = json ?? text.slice(0, 4000);
      entry.rawText = json?.content?.filter((c) => c.type === 'text').map((c) => c.text).join('') ?? null;
      entry.usage = json?.usage ?? null;
      entry.costUsd = entry.usage ? entry.usage.input_tokens * price.input + entry.usage.output_tokens * price.output : undefined;
      save(ledger);
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' });
      res.end(text);
    } catch (e) {
      entry.status = 'network-error'; entry.error = String(e && e.name);   // 課金されたか分からない：見積もりの上限額のまま計上
      save(ledger);
      reply(502, { type: 'error', error: { type: 'network', message: 'upstream failed' } });
    }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`record proxy on ${PORT}`));
