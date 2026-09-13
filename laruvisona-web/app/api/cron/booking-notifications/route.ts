import { createServiceClient } from '@/lib/supabase/server';
import { notifyAppointment } from '@/lib/scheduling/notify';
import { reply } from '@/lib/scheduling/server';
export const dynamic='force-dynamic';
type Claimed={site_id:string;appointment_id:string;revision:number;claim_token:string};
export async function POST(req:Request){
 const secret=process.env.ADMIN_SECRET;if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return reply({error:'Unauthorized'},401);
 if(!process.env.RESEND_API_KEY)return reply({error:'Mail delivery unavailable'},503);
 const db=createServiceClient(),claim=await db.rpc('hp_schedule_claim_notifications',{p_limit:20});if(claim.error)return reply({error:'Notification storage unavailable'},503);
 let sent=0,failed=0;
 for(const row of (claim.data||[]) as Claimed[]){
  const ok=await notifyAppointment(row.site_id,row.appointment_id,row.revision);
  const finish=await db.rpc('hp_schedule_finish_notification',{p_site:row.site_id,p_appointment:row.appointment_id,p_revision:row.revision,p_claim_token:row.claim_token,p_success:ok,p_error:ok?null:'delivery_failed'});
  if(finish.error||finish.data!==true)return reply({error:'Could not save notification result',sent,failed},503);
  if(ok)sent++;else failed++;
 }
 return reply({claimed:(claim.data||[]).length,sent,failed},failed?503:200);
}
