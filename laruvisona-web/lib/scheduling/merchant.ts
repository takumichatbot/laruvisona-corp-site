import { getStripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { paymentsAvailable, stripeConnectAvailable } from './payments';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { appOrigin } from '@/lib/public-site-url';

const checked=<T>(r:{data:T;error:unknown})=>{if(r.error)throw Error('payment_database');return r.data;};

export function merchantAccountEvent(event:Stripe.Event) {
  if(event.type==='account.updated'){
    const account=event.data.object as Stripe.Account;
    return {accountId:event.account||account.id,charges_enabled:!!account.charges_enabled,payouts_enabled:!!account.payouts_enabled};
  }
  if(event.type==='account.application.deauthorized')return {accountId:event.account||'',charges_enabled:false,payouts_enabled:false};
  return null;
}

type PaymentSurface = 'booking'|'shop';
const surfaceAvailable = (surface:PaymentSurface) => surface === 'booking'
  ? paymentsAvailable()
  : process.env.HP_SHOP_PAYMENTS_ENABLED === '1' && stripeConnectAvailable();

export async function merchantStatus(userId:string,db:SupabaseClient=createServiceClient(),stripe:Stripe=getStripe(),surface:PaymentSurface='booking') {
  if(!surfaceAvailable(surface))return {ready:false,connected:false,available:false};
  const {data,error}=await db.from('hp_payment_accounts').select('account_id,livemode,charges_enabled,payouts_enabled').eq('user_id',userId).maybeSingle();
  if(error)throw Error('payment_database');
  if(!data?.account_id)return {ready:false,connected:false,available:true};
  try {
    const a=await stripe.accounts.retrieve(data.account_id);
    const live=process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')===true;
    const ready=!!a.charges_enabled&&!!a.payouts_enabled&&data.livemode===live;
    checked(await db.from('hp_payment_accounts').update({charges_enabled:!!a.charges_enabled,payouts_enabled:!!a.payouts_enabled,updated_at:new Date().toISOString()}).eq('user_id',userId));
    return {available:true,connected:true,ready};
  }catch {return {available:true,connected:true,ready:false};}
}

export async function merchantOnboarding(user:{id:string},siteId:string,db:SupabaseClient=createServiceClient(),stripe:Stripe=getStripe(),surface:PaymentSurface='booking') {
  if(!surfaceAvailable(surface))throw Error('payment_unavailable');
  checked(await db.from('hp_payment_accounts').upsert({user_id:user.id},{onConflict:'user_id',ignoreDuplicates:true}));
  const current=checked(await db.from('hp_payment_accounts').select('account_id,livemode').eq('user_id',user.id).single()) as {account_id:string|null;livemode:boolean|null};
  let accountId=current.account_id;
  if(!accountId){
    // Keep every parameter stable for this idempotency key. Stripe-hosted onboarding collects current contact details.
    // This key predates shop payments. Keep it stable so existing booking merchants reuse the same account.
    const account=await stripe.accounts.create({type:'standard',country:'JP'},{idempotencyKey:'hp-booking-account-'+user.id});
    const live=process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')===true;
    const saved=checked(await db.from('hp_payment_accounts').update({account_id:account.id,livemode:live,updated_at:new Date().toISOString()}).eq('user_id',user.id).is('account_id',null).select('account_id').maybeSingle()) as {account_id:string}|null;
    if(!saved?.account_id){
      const won=checked(await db.from('hp_payment_accounts').select('account_id').eq('user_id',user.id).single()) as {account_id:string|null};
      if(won.account_id!==account.id)throw Error('payment_account_conflict');
    }
    accountId=account.id;
  }
  const callback = surface === 'shop' ? '/api/stripe/shop-connect/callback' : '/api/stripe/booking-connect/callback';
  const back=appOrigin()+callback+'?'+new URLSearchParams({siteId});
  const link=await stripe.accountLinks.create({
    account:accountId,
    type:'account_onboarding',
    refresh_url:back+'&refresh=1',
    return_url:back,
    collection_options:{fields:'eventually_due',future_requirements:'include'},
  });
  return {url:link.url};
}
