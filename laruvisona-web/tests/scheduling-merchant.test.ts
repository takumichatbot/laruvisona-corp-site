import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { merchantAccountEvent, merchantOnboarding, merchantStatus } from "../lib/scheduling/merchant.ts";

test("Stripe-hosted onboardingは同じ利用者に口座を重複作成しない", async () => {
  const previous = {
    enabled: process.env.HP_BOOKING_PREPAY_ENABLED,
    secret: process.env.STRIPE_SECRET_KEY,
    webhook: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    origin: process.env.NEXT_PUBLIC_APP_URL,
  };
  process.env.HP_BOOKING_PREPAY_ENABLED = "1";
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_fixture";
  process.env.NEXT_PUBLIC_APP_URL = "https://laruvisona.jp";
  const row: { account_id: string | null; livemode: boolean | null; charges_enabled:boolean; payouts_enabled:boolean } = {
    account_id: null,
    livemode: null,
    charges_enabled:false,
    payouts_enabled:false,
  };
  const db = {
    from() {
      return {
        upsert: async () => ({ data: null, error: null }),
        select() {
          return {
            eq() {
              return {
                single: async () => ({ data: { ...row }, error: null }),
                maybeSingle: async () => ({ data: { ...row }, error: null }),
              };
            },
          };
        },
        update(values: { account_id?: string; livemode?: boolean }) {
          return {
            eq() {
              const chain = {
                is() {
                  return {
                    select() {
                      return {
                        maybeSingle: async () => {
                          if (row.account_id) return { data: null, error: null };
                          row.account_id = values.account_id || null;
                          row.livemode = values.livemode ?? null;
                          return { data: { account_id: row.account_id }, error: null };
                        },
                      };
                    },
                  };
                },
                then(resolve: (value:{data:null;error:null})=>unknown) {
                  if(values.account_id===undefined)Object.assign(row,values);
                  return Promise.resolve({data:null,error:null}).then(resolve);
                },
              };
              return chain;
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  const accountKeys: string[] = [];
  const links: Stripe.AccountLinkCreateParams[] = [];
  const stripe = {
    accounts: {
      create: async (_body: Stripe.AccountCreateParams, options: { idempotencyKey: string }) => {
        accountKeys.push(options.idempotencyKey);
        return { id: "acct_shop" };
      },
      retrieve: async () => ({ charges_enabled: true, payouts_enabled: true }),
    },
    accountLinks: {
      create: async (body: Stripe.AccountLinkCreateParams) => {
        links.push(body);
        return { url: "https://connect.stripe.test/onboard" };
      },
    },
  } as unknown as Stripe;
  try {
    const user = { id: "user-1", email: "owner@example.invalid" };
    assert.deepEqual(await merchantOnboarding(user, "site-1", db, stripe), {
      url: "https://connect.stripe.test/onboard",
    });
    await merchantOnboarding(user, "site-1", db, stripe);
    assert.deepEqual(accountKeys, ["hp-booking-account-user-1"]);
    assert.equal(links.length, 2, "期限切れ時はAccount Linkだけを作り直す");
    assert.equal(links[0].account, "acct_shop");
    assert.equal(links[0].type, "account_onboarding");
    assert.deepEqual(links[0].collection_options, {
      fields: "eventually_due",
      future_requirements: "include",
    });
    assert.match(String(links[0].refresh_url), /siteId=site-1&refresh=1$/);
    assert.match(String(links[0].return_url), /siteId=site-1$/);
    assert.deepEqual(await merchantStatus(user.id, db, stripe), {
      available: true,
      connected: true,
      ready: true,
    });
    assert.equal(row.charges_enabled,true);
    assert.equal(row.payouts_enabled,true);
  } finally {
    const restore = (key: string, value: string | undefined) =>
      value === undefined ? delete process.env[key] : (process.env[key] = value);
    restore("HP_BOOKING_PREPAY_ENABLED", previous.enabled);
    restore("STRIPE_SECRET_KEY", previous.secret);
    restore("STRIPE_CONNECT_WEBHOOK_SECRET", previous.webhook);
    restore("NEXT_PUBLIC_APP_URL", previous.origin);
  }
});

test("口座更新と接続解除をWebhook用の安全な状態へ変換する", () => {
  const updated={type:"account.updated",account:"acct_shop",data:{object:{id:"acct_shop",charges_enabled:true,payouts_enabled:false}}} as unknown as Stripe.Event;
  assert.deepEqual(merchantAccountEvent(updated),{accountId:"acct_shop",charges_enabled:true,payouts_enabled:false});
  const revoked={type:"account.application.deauthorized",account:"acct_shop",data:{object:{}}} as unknown as Stripe.Event;
  assert.deepEqual(merchantAccountEvent(revoked),{accountId:"acct_shop",charges_enabled:false,payouts_enabled:false});
});
