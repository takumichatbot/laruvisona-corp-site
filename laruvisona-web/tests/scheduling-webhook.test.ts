import test from "node:test";
import assert from "node:assert/strict";

test("予約決済Webhookは署名が無い本文をDB処理前に拒否", async () => {
  const previous = {
    key: process.env.STRIPE_SECRET_KEY,
    webhook: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  };
  process.env.STRIPE_SECRET_KEY = "fixture-secret";
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "fixture-webhook";
  try {
    const { POST } = await import(
      "../app/api/stripe/scheduling-webhook/route.ts"
    );
    const response = await POST(
      new Request("https://laruvisona.jp/api/stripe/scheduling-webhook", {
        method: "POST",
        headers: { "stripe-signature": "invalid" },
        body: JSON.stringify({ type: "checkout.session.completed" }),
      }),
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid signature" });
  } finally {
    if (previous.key === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous.key;
    if (previous.webhook === undefined)
      delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    else process.env.STRIPE_CONNECT_WEBHOOK_SECRET = previous.webhook;
  }
});
