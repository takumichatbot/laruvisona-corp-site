import { getStripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { paymentsAvailable } from './payments';
export async function merchantStatus(userId:string) {
  if(!paymentsAvailable())return {ready:false,connected:false,available:false};
  const {data,error}=await createServiceClient().from('hp_payment_accounts').select('account_id,livemode').eq('user_id',userId).maybeSingle();
  if(error)throw Error('payment_database');
  if(!data?.account_id)return {ready:false,connected:false,available:true};
  try {
    const a=await getStripe().accounts.retrieve(data.account_id);
    const live=process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')===true;
    return {available:true,connected:true,ready:a.charges_enabled&&a.payouts_enabled&&data.livemode===live};
  }catch {return {available:true,connected:true,ready:false};}
}
