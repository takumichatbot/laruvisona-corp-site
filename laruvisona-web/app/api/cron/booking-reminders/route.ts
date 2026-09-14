import { requireBearer } from '@/lib/scheduled-email';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import { bookingReminderMessage, type BookingReminder } from '@/lib/scheduling/reminders';
import { reply } from '@/lib/scheduling/server';

export const dynamic='force-dynamic';

export async function POST(req:Request){
  const secret=process.env.ADMIN_SECRET;
  if(!requireBearer(req,secret))return reply({error:'Unauthorized'},401);
  if(!process.env.RESEND_API_KEY)return reply({error:'Mail delivery unavailable'},503);
  const db=createServiceClient();
  const claimed=await db.rpc('hp_schedule_claim_reminders',{p_limit:20});
  if(claimed.error)return reply({error:'Reminder storage unavailable'},503);
  const resend=new Resend(process.env.RESEND_API_KEY);
  let sent=0,failed=0;
  for(const row of (claimed.data||[]) as BookingReminder[]){
    let ok=false;let reason='delivery_failed';
    try{
      const message=bookingReminderMessage(row);
      const response=await resend.emails.send({
        from:'LARU HP <noreply@laruvisona.jp>',to:row.customer_email,...message,
      },{idempotencyKey:`hp-booking-reminder-${row.reminder_id}`});
      ok=!response.error;reason=response.error?.message||reason;
    }catch(error){reason=error instanceof Error?error.message:reason;}
    const finished=await db.rpc('hp_schedule_finish_reminder',{
      p_id:row.reminder_id,p_claim_token:row.claim_token,p_success:ok,p_error:ok?null:reason,
    });
    if(finished.error||finished.data!==true)return reply({error:'Could not save reminder result',sent,failed},503);
    if(ok)sent++;else failed++;
  }
  return reply({claimed:(claimed.data||[]).length,sent,failed},failed?503:200);
}
