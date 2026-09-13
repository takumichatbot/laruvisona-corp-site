import test from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { commitShopCheckout } from '../lib/shop-webhook.ts';
import { cartMetadata } from '../lib/shop-order.ts';

const session = {
  id: 'cs_shop_1', mode: 'payment', payment_status: 'paid', amount_total: 2400,
  currency: 'jpy', livemode: false, payment_intent: 'pi_shop_1', customer_details: { name: '購入者', email: 'buyer@example.invalid' },
  metadata: { kind: 'shop', laru_site_id: 'site-1', ...cartMetadata([{ id: 'p-1', q: 2 }]) },
} as unknown as Stripe.Checkout.Session;

function fixture(account = 'acct_owner') {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const db = {
    from(table: string) {
      if (table === 'sites') return {
        select() { return { eq() { return { single: async () => ({ data: { name: '店', user_id: 'owner-1', settings_json: {} }, error: null }) }; } }; },
      };
      if (table === 'hp_payment_accounts') return {
        select() {
          const chain = {
            eq(_column: string, value: string) {
              if (_column === 'account_id') return { maybeSingle: async () => ({
                data: value === account ? { account_id: account, livemode: false, charges_enabled: true, payouts_enabled: true } : null,
                error: null,
              }) };
              return chain;
            },
          };
          return chain;
        },
      };
      if (table === 'hp_orders') return {
        update() { return { eq() { return this; }, select: async () => ({ data: [{ id: 'order-1' }], error: null }) }; },
      };
      throw new Error(`unexpected table: ${table}`);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      return { data: { created: true, status: 'paid', id: 'order-1' }, error: null };
    },
    auth: { admin: { getUserById: async () => ({ data: { user: { email: '' } } }) } },
  } as unknown as SupabaseClient;
  const lineCalls: unknown[][] = [];
  const stripe = {
    checkout: { sessions: { listLineItems: async (...args: unknown[]) => {
      lineCalls.push(args);
      return { has_more: false, data: [{ description: '焼き菓子', quantity: 2, amount_total: 2400 }] };
    } } },
  } as unknown as Stripe;
  return { db, stripe, rpcCalls, lineCalls };
}

test('接続口座の支払済みSessionだけを注文確定し、同じ接続口座から明細を読む', async () => {
  const f = fixture();
  const result = await commitShopCheckout(session, 'acct_owner', f.db, f.stripe);
  assert.equal(result.created, true);
  assert.equal(f.rpcCalls.length, 1);
  assert.equal(f.rpcCalls[0].name, 'laruhp_shop_commit_order');
  assert.deepEqual(f.lineCalls[0][2], { stripeAccount: 'acct_owner' });
});

test('別の所有者の接続口座と未払いSessionはDB更新前に拒否する', async () => {
  const wrong = fixture('acct_owner');
  await assert.rejects(commitShopCheckout(session, 'acct_other', wrong.db, wrong.stripe), /shop_account/);
  assert.equal(wrong.rpcCalls.length, 0);
  assert.equal(wrong.lineCalls.length, 0);

  const unpaid = fixture();
  await assert.rejects(commitShopCheckout({ ...session, payment_status: 'unpaid' } as Stripe.Checkout.Session, 'acct_owner', unpaid.db, unpaid.stripe), /shop_mismatch/);
  assert.equal(unpaid.rpcCalls.length, 0);
  assert.equal(unpaid.lineCalls.length, 0);
});
