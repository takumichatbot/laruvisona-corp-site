import { requireBearer } from '@/lib/scheduled-email';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import { legacyBookingReminderMessage, type LegacyBookingReminder } from '@/lib/scheduling/reminders';

export const dynamic = 'force-dynamic';

// Compatibility worker for reservations created by the old fixed-slot form.
// The current scheduling engine has its own revision-scoped queue.
export async function POST(req: Request) {
  const secret=process.env.ADMIN_SECRET;
  if(!requireBearer(req,secret)){
    return NextResponse.json({error:'Unauthorized'},{status:401});
  }
  if(!process.env.RESEND_API_KEY){
    return NextResponse.json({error:'Mail delivery unavailable'},{status:503});
  }

  const db=createServiceClient();
  const claimed=await db.rpc('hp_legacy_claim_reminders',{p_limit:20});
  if(claimed.error)return NextResponse.json({error:'Reminder storage unavailable'},{status:503});
  const resend=new Resend(process.env.RESEND_API_KEY);
  let sent=0,failed=0;

  for(const row of (claimed.data||[]) as LegacyBookingReminder[]){
    let ok=false;let reason='delivery_failed';
    try{
      const response=await resend.emails.send({
        from:'LARU HP <noreply@laruvisona.jp>',to:row.customer_email,
        ...legacyBookingReminderMessage(row),
      },{idempotencyKey:`hp-legacy-booking-reminder-${row.reservation_id}`});
      ok=!response.error;reason=response.error?.message||reason;
    }catch(error){reason=error instanceof Error?error.message:reason;}

    const finished=await db.rpc('hp_legacy_finish_reminder',{
      p_id:row.reservation_id,p_claim_token:row.claim_token,p_success:ok,p_error:ok?null:reason,
    });
    if(finished.error||finished.data!==true){
      return NextResponse.json({error:'Could not save reminder result',sent,failed},{status:503});
    }
    if(ok)sent++;else failed++;
  }
  return NextResponse.json({claimed:(claimed.data||[]).length,sent,failed},{status:failed?503:200});
}
