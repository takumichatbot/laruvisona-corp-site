import { requireBearer } from '@/lib/scheduled-email';
import { createServiceClient } from '@/lib/supabase/server';
import { paymentService } from '@/lib/scheduling/payments';
import { reply } from '@/lib/scheduling/server';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const secret=process.env.ADMIN_SECRET;
 if(!requireBearer(req,secret))return reply({error:'Unauthorized'},401);
 const db=createServiceClient();
 // Terminal rows are dormant. Cancellation reactivates a paid row for refund polling.
 const {data,error}=await db.from('hp_booking_payments').select('appointment_id,site_id,last_checked_at').eq('active',true).order('last_checked_at',{ascending:true,nullsFirst:true}).limit(20);
 if(error)return reply({error:'Payment storage unavailable'},503);
 let checked=0,failed=0;
 for(const p of data||[]){
  try{await paymentService(db).reconcile(p.site_id,p.appointment_id);checked++;}catch{failed++;}
  // Rotate failures as well so one disconnected merchant never starves other tenants.
  const saved=await db.from('hp_booking_payments').update({last_checked_at:new Date().toISOString()}).eq('appointment_id',p.appointment_id);
  if(saved.error)return reply({error:'Could not save progress'},503);
 }
 return reply({checked,failed},failed?503:200);
}
