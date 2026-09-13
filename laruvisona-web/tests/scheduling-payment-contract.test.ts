import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import {
  bookingReturnUrl,
  validatePaymentSession,
  type BookingPayment,
  type PaidAppointment,
} from "../lib/scheduling/payment-contract.ts";

const payment: BookingPayment = {
  appointment_id: "appointment-1",
  site_id: "site-1",
  account_id: "acct_1",
  livemode: false,
  session_id: "cs_1",
  intent_id: null,
  return_url: null,
  attempted_at: null,
  refund_started_at: null,
  refund_id: null,
};
const appointment: PaidAppointment = {
  id: "appointment-1",
  site_id: "site-1",
  status: "pending_payment",
  payment_status: "pending",
  hold_until: "2026-09-14T10:00:00Z",
  service_name: "初回相談",
  price: 5000,
  email: "guest@example.invalid",
  revision: 1,
};
const session = {
  id: "cs_1",
  mode: "payment",
  livemode: false,
  currency: "jpy",
  amount_total: 5000,
  metadata: {
    kind: "hp_scheduling",
    appointment_id: "appointment-1",
    site_id: "site-1",
  },
} as unknown as Stripe.Checkout.Session;

test("決済の戻り先は会社・サブドメイン・主独自ドメインだけに限定", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://laruvisona.jp";
  try {
    assert.equal(
      bookingReturnUrl("https://laruvisona.jp", { slug: "日本語 店" }),
      "https://laruvisona.jp/hp/%E6%97%A5%E6%9C%AC%E8%AA%9E%20%E5%BA%97/reserve",
    );
    assert.equal(
      bookingReturnUrl("https://salon.laruvisona.jp", { slug: "salon" }),
      "https://salon.laruvisona.jp/reserve",
    );
    assert.equal(
      bookingReturnUrl("https://salon.example", {
        slug: "salon",
        custom_domain: "salon.example",
      }),
      "https://salon.example/reserve",
    );
    for (const origin of [
      "http://salon.example",
      "https://user@salon.example",
      "https://salon.example:444",
      "https://other.example",
      "not a url",
    ])
      assert.throws(() =>
        bookingReturnUrl(origin, {
          slug: "salon",
          custom_domain: "salon.example",
        }),
      );
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});

test("Stripeの金額・環境・接続先・予約メタデータを全部照合", () => {
  assert.doesNotThrow(() => validatePaymentSession(session, payment, appointment));
  for (const changed of [
    { mode: "subscription" },
    { livemode: true },
    { currency: "usd" },
    { amount_total: 4999 },
    { id: "cs_other" },
    { metadata: { ...session.metadata, kind: "shop" } },
    { metadata: { ...session.metadata, appointment_id: "other" } },
    { metadata: { ...session.metadata, site_id: "other" } },
  ])
    assert.throws(() =>
      validatePaymentSession(
        { ...session, ...changed } as Stripe.Checkout.Session,
        payment,
        appointment,
      ),
    );
});
