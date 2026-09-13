import { owner,reply } from '@/lib/scheduling/server';
import { merchantOnboarding,merchantStatus } from '@/lib/scheduling/merchant';
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
 if(!paymentsAvailable())return reply({error:'Stripeとの接続を準備中です。来店時払いは引き続き利用できます'},503);
 if(!rateLimit('booking-connect:'+a.user.id,5,60000).ok)return reply({error:'少し待ってからお試しください'},429);
 try{return reply(await merchantOnboarding({id:a.user.id},a.site.id,a.db));}
 catch{return reply({error:'接続の準備に失敗しました'},503);}
}
