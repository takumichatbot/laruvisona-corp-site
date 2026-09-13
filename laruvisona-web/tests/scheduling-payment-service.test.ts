import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { paymentService } from "../lib/scheduling/payments.ts";

test("Checkout作成の応答を失っても同じ冪等キーで回収し、二重決済を作らない", async () => {
  const previous = {
    enabled: process.env.HP_BOOKING_PREPAY_ENABLED,
    secret: process.env.STRIPE_SECRET_KEY,
    webhook: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  };
  process.env.HP_BOOKING_PREPAY_ENABLED = "1";
  process.env.STRIPE_SECRET_KEY = "fixture-secret";
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "fixture-webhook";
  const appointment = {
    id: "appointment-1",
    site_id: "site-1",
    status: "pending_payment",
    payment_status: "pending",
    hold_until: new Date(Date.now() + 40 * 60_000).toISOString(),
    service_name: "初回相談",
    price: 5000,
    email: "guest@example.invalid",
    revision: 1,
  };
  const payment = {
    appointment_id: appointment.id,
    site_id: appointment.site_id,
    account_id: "acct_shop",
    livemode: false,
    session_id: null as string | null,
    intent_id: null,
    return_url: "https://salon.example/reserve",
    attempted_at: new Date().toISOString(),
    refund_started_at: null,
    refund_id: null,
  };
  const session = {
    id: "cs_same",
    mode: "payment",
    livemode: false,
    currency: "jpy",
    amount_total: 5000,
    metadata: {
      kind: "hp_scheduling",
      appointment_id: appointment.id,
      site_id: appointment.site_id,
    },
    status: "open",
    url: "https://checkout.stripe.test/cs_same",
  } as unknown as Stripe.Checkout.Session;

  const query = (value: unknown) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "update"])
      chain[method] = () => chain;
    chain.maybeSingle = async () => ({ data: value, error: null });
    chain.single = async () => ({ data: value, error: null });
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: value, error: null }).then(resolve);
    return chain;
  };
  const db = {
    from(table: string) {
      return query(table === "hp_booking_payments" ? payment : appointment);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "hp_payment_prepare")
        return { data: { ...payment, appointment }, error: null };
      if (name === "hp_payment_attach") {
        payment.session_id = String(args.p_session);
        return { data: null, error: null };
      }
      throw Error(`unexpected rpc ${name}`);
    },
  } as unknown as SupabaseClient;

  const createKeys: string[] = [];
  let createCalls = 0;
  const stripe = {
    accounts: { retrieve: async () => ({ charges_enabled: true, payouts_enabled: true }) },
    checkout: {
      sessions: {
        create: async (_body: unknown, options: { idempotencyKey: string }) => {
          createCalls += 1;
          createKeys.push(options.idempotencyKey);
          if (createCalls === 1) throw Error("response_lost");
          return session;
        },
        retrieve: async () => session,
      },
    },
    paymentIntents: {},
    refunds: {},
  } as unknown as Stripe;

  try {
    const service = paymentService(db, stripe, async () => true);
    await assert.rejects(() =>
      service.checkout(
        appointment.site_id,
        appointment.id,
        "a".repeat(64),
        payment.return_url,
      ),
    );
    assert.deepEqual(
      await service.checkout(
        appointment.site_id,
        appointment.id,
        "a".repeat(64),
        payment.return_url,
      ),
      { url: session.url },
    );
    assert.deepEqual(createKeys, [
      "hp-booking-checkout-appointment-1",
      "hp-booking-checkout-appointment-1",
    ]);
    await service.checkout(
      appointment.site_id,
      appointment.id,
      "a".repeat(64),
      payment.return_url,
    );
    assert.equal(createCalls, 2, "保存後は既存Sessionを取得する");
  } finally {
    for (const [key, value] of Object.entries({
      HP_BOOKING_PREPAY_ENABLED: previous.enabled,
      STRIPE_SECRET_KEY: previous.secret,
      STRIPE_CONNECT_WEBHOOK_SECRET: previous.webhook,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("返金照合を繰り返しても返金要求は一度だけ", async () => {
  const appointment = {
    id: "appointment-2",
    site_id: "site-1",
    status: "confirmed",
    payment_status: "refund_pending",
    hold_until: new Date(Date.now() + 40 * 60_000).toISOString(),
    service_name: "初回相談",
    price: 5000,
    email: "guest@example.invalid",
    revision: 3,
  };
  const payment = {
    appointment_id: appointment.id,
    site_id: appointment.site_id,
    account_id: "acct_shop",
    livemode: false,
    session_id: "cs_paid",
    intent_id: "pi_paid",
    return_url: "https://salon.example/reserve",
    attempted_at: new Date().toISOString(),
    refund_started_at: null as string | null,
    refund_id: null as string | null,
    active: true,
  };
  let update: Record<string, unknown> | null = null;
  const query = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is"])
      chain[method] = () => chain;
    chain.update = (value: Record<string, unknown>) => {
      update = value;
      return chain;
    };
    chain.maybeSingle = async () => ({
      data: table === "hp_booking_payments" ? payment : appointment,
      error: null,
    });
    chain.single = chain.maybeSingle;
    chain.then = (resolve: (v: unknown) => unknown) => {
      if (update && table === "hp_booking_payments") Object.assign(payment, update);
      update = null;
      return Promise.resolve({ data: null, error: null }).then(resolve);
    };
    return chain;
  };
  const db = {
    from: query,
    async rpc(name: string, args: Record<string, unknown>) {
      if (name !== "hp_payment_settle") throw Error(`unexpected rpc ${name}`);
      if (args.p_state === "refunded") {
        appointment.status = "canceled";
        appointment.payment_status = "refunded";
        appointment.revision += 1;
        payment.active = false;
      }
      return { data: { ...appointment }, error: null };
    },
  } as unknown as SupabaseClient;
  let refundCreated = false;
  let refundCalls = 0;
  const checkoutSession = {
    id: payment.session_id,
    mode: "payment",
    livemode: false,
    currency: "jpy",
    amount_total: 5000,
    metadata: {
      kind: "hp_scheduling",
      appointment_id: appointment.id,
      site_id: appointment.site_id,
    },
    status: "complete",
    payment_status: "paid",
    payment_intent: payment.intent_id,
  } as unknown as Stripe.Checkout.Session;
  const stripe = {
    checkout: { sessions: { retrieve: async () => checkoutSession } },
    paymentIntents: {
      retrieve: async () => ({
        amount: 5000,
        currency: "jpy",
        livemode: false,
        latest_charge: {
          refunded: refundCreated,
          amount_refunded: refundCreated ? 5000 : 0,
        },
      }),
    },
    refunds: {
      list: async () => ({ data: [], has_more: false }),
      create: async () => {
        refundCalls += 1;
        refundCreated = true;
        return { id: "re_same", status: "succeeded" };
      },
    },
  } as unknown as Stripe;
  const service = paymentService(db, stripe, async () => true);
  assert.equal((await service.reconcile("site-1", "appointment-2"))?.payment_status, "refunded");
  assert.equal((await service.reconcile("site-1", "appointment-2"))?.payment_status, "refunded");
  assert.equal(refundCalls, 1);
});

test("Checkout作成結果を安全に回収できない期限では、新しい請求を作らず確認待ちにする", async () => {
  const appointment = {
    id: "appointment-review",
    site_id: "site-1",
    status: "pending_payment",
    payment_status: "pending",
    hold_until: new Date(Date.now() + 60_000).toISOString(),
    service_name: "初回相談",
    price: 5000,
    email: "guest@example.invalid",
    revision: 1,
  };
  const payment = {
    appointment_id: appointment.id,
    site_id: appointment.site_id,
    account_id: "acct_shop",
    livemode: false,
    session_id: null,
    intent_id: null,
    return_url: "https://salon.example/reserve",
    attempted_at: new Date(Date.now() - 24 * 3600_000).toISOString(),
    refund_started_at: null,
    refund_id: null,
  };
  const query = (value: unknown) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "update"])
      chain[method] = () => chain;
    chain.maybeSingle = async () => ({ data: value, error: null });
    chain.single = chain.maybeSingle;
    return chain;
  };
  let settled = "";
  const db = {
    from(table: string) {
      return query(table === "hp_booking_payments" ? payment : appointment);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "hp_payment_settle");
      settled = String(args.p_state);
      return {
        data: { ...appointment, payment_status: "review" },
        error: null,
      };
    },
  } as unknown as SupabaseClient;
  let created = 0;
  const stripe = {
    checkout: { sessions: { create: async () => { created += 1; } } },
  } as unknown as Stripe;
  const result = await paymentService(db, stripe, async () => true).reconcile(
    appointment.site_id,
    appointment.id,
  );
  assert.equal(result?.payment_status, "review");
  assert.equal(settled, "review");
  assert.equal(created, 0);
});
