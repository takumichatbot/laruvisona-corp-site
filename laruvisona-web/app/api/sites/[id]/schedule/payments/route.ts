import { randomBytes } from 'node:crypto';
import { owner,reply,hash } from '@/lib/scheduling/server';
import { merchantStatus } from '@/lib/scheduling/merchant';
import { appOrigin } from '@/lib/public-site-url';
import { paymentsAvailable } from '@/lib/scheduling/payments';
import { rateLimit } from '@/lib/rate-limit';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(_req:Request,{params}:Context){
 const a=await owner((await params).id);if(a.response)return a.response;
 try{return reply(await merchantStatus(a.user.id));}catch{return reply({error:'入金先の状態を確認できませんでした'},503);}
}
export async function POST(_req:Request,{params}:Context){
 const a=await owner((await params).id);if(a.response)return a.response;
 if(!paymentsAvailable()||!process.env.STRIPE_CONNECT_CLIENT_ID)return reply({error:'Stripeとの接続を準備中です。来店時払いは引き続き利用できます'},503);
 if(!rateLimit('booking-connect:'+a.user.id,5,60000).ok)return reply({error:'少し待ってからお試しください'},429);
 const state=randomBytes(32).toString('hex');
 const {error}=await a.db.from('hp_payment_accounts').upsert({user_id:a.user.id,state_hash:hash(state),state_expires:new Date(Date.now()+10*60000).toISOString(),state_site:a.site.id},{onConflict:'user_id'});
 if(error)return reply({error:'接続の準備に失敗しました'},503);
 const q=new URLSearchParams({response_type:'code',client_id:process.env.STRIPE_CONNECT_CLIENT_ID,scope:'read_write',state,redirect_uri:appOrigin()+'/api/stripe/booking-connect/callback'});
 return reply({url:'https://connect.stripe.com/oauth/authorize?'+q});
}
