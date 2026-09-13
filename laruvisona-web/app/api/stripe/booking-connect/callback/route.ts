import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { appOrigin } from '@/lib/public-site-url';
import { privateHeaders } from '@/lib/scheduling/server';
import { merchantOnboarding,merchantStatus } from '@/lib/scheduling/merchant';
import { uuidPattern } from '@/lib/scheduling/config';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const auth=await createClient();
 const {data:{user}}=await auth.auth.getUser();
 const q=new URL(req.url).searchParams,siteId=q.get('siteId')||'';
 const redirect=(result:string)=>NextResponse.redirect(appOrigin()+'/laruHP/booking/schedule?'+new URLSearchParams({paymentConnect:result,...(uuidPattern.test(siteId)?{siteId}:{})}),{status:303,headers:privateHeaders});
 if(!user||!uuidPattern.test(siteId))return redirect('invalid');
 const {data:site}=await auth.from('sites').select('id').eq('id',siteId).eq('user_id',user.id).maybeSingle();
 if(!site)return redirect('invalid');
 try{
  if(q.get('refresh')==='1')return NextResponse.redirect((await merchantOnboarding({id:user.id,email:user.email},siteId)).url,{status:303,headers:privateHeaders});
  const status=await merchantStatus(user.id);
  return redirect(status.ready?'connected':'requirements');
 }catch{return redirect('failed');}
}
