import type { SupabaseClient } from "@supabase/supabase-js";
/** Existing installations without the new migration keep the fixed-slot flow. Other DB errors fail closed. */
export async function scheduledBookingLink(
  db: SupabaseClient,
  siteId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from("hp_booking_calendars")
    .select("config")
    .eq("site_id", siteId)
    .maybeSingle();
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return null;
    throw Error("schedule_lookup_failed");
  }
  let active = !!data?.config?.enabled;
  if (data && !active) {
    const r = await db
      .from("hp_appointments")
      .select("id")
      .eq("site_id", siteId)
      .eq("status", "confirmed")
      .gt("occupied_until", new Date().toISOString())
      .limit(1);
    if (r.error) throw Error("schedule_lookup_failed");
    active = !!r.data?.length;
  }
  return active
    ? "/api/hp/scheduling/link?siteId=" + encodeURIComponent(siteId)
    : null;
}
