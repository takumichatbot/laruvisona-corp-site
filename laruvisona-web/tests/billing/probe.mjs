// 立っているサーバーが、この試験の鍵で署名したものを受け取れるかだけを見る。
//
// 前回の実行が残したサーバーは、同じビルドのまま別の鍵で立っていることがある。
// そのまま本編を流すと署名が通らず、10件が一斉に落ちる。
// 落ちた理由はコードではなく居残りなのに、並んだ NG からはそう見えない。
import crypto from 'node:crypto';

const [, , port, secret] = process.argv;
const payload = JSON.stringify({
  id: 'evt_probe', object: 'event', created: Math.floor(Date.now() / 1000),
  // こちらが扱わない種類を選ぶ。届いても何も起きない。
  type: 'ping.probe', data: { object: {} },
});
const t = Math.floor(Date.now() / 1000);
const v1 = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');

try {
  const res = await fetch(`http://127.0.0.1:${port}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` },
    body: payload,
  });
  // 署名が通れば、扱わない種類でも 200 が返る。400 は鍵違い。
  process.stdout.write(res.status === 200 ? 'ok' : `署名が通りませんでした（HTTP ${res.status}）`);
} catch (e) {
  process.stdout.write(`つながりませんでした（${e.message}）`);
}
