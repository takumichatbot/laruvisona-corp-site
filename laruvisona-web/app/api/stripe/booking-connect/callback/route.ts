import { NextResponse } from 'next/server';
import { createClient,createServiceClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { appOrigin } from '@/lib/public-site-url';
import { hash,privateHeaders } from '@/lib/scheduling/server';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const {data:{user}}=await (await createClient()).auth.getUser();
 const q=new URL(req.url).searchParams,state=q.get('state')||'',code=q.get('code');
 const redirect=(result:string,site?:string)=>NextResponse.redirect(appOrigin()+'/laruHP/booking/schedule?'+new URLSearchParams({paymentConnect:result,...(site?{siteId:site}:{})}),{status:303,headers:privateHeaders});
 if(!user||!/^[a-f0-9]{64}$/.test(state))return redirect('invalid');
 const db=createServiceClient();
 // Consume once before exchanging the code. Retrying OAuth can revoke the connection.
 const {data,error}=await db.from('hp_payment_accounts').update({state_hash:null,state_expires:null}).eq('user_id',user.id).eq('state_hash',hash(state)).gt('state_expires',new Date().toISOString()).select('state_site,account_id').maybeSingle();
 if(error||!data)return redirect('invalid');
 if(!code||q.get('error'))return redirect('canceled',data.state_site);
 try{
  const r=await getStripe().oauth.token({grant_type:'authorization_code',code},{maxNetworkRetries:0});
  if(!r.stripe_user_id||r.scope!=='read_write'||r.livemode!==(process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')===true))return redirect('failed',data.state_site);
  // Never switch the receiving merchant while historic payments can still need refunds.
  if(data.account_id&&data.account_id!==r.stripe_user_id)return redirect('different_account',data.state_site);
  const saved=await db.from('hp_payment_accounts').update({account_id:r.stripe_user_id,livemode:r.livemode,updated_at:new Date().toISOString()}).eq('user_id',user.id);
  if(saved.error)return redirect('failed',data.state_site);
  return redirect('connected',data.state_site);
 }catch{return redirect('failed',data.state_site);}
}
