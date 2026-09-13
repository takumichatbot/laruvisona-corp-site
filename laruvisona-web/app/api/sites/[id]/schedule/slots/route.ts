import { owner, reply, fail } from "@/lib/scheduling/server";
import { validDay, uuidPattern } from "@/lib/scheduling/config";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await owner(id);
  if (auth.response) return auth.response;
  const q = new URL(req.url).searchParams,
    day = q.get("day"),
    appointment = q.get("appointmentId");
  if (!validDay(day) || !appointment || !uuidPattern.test(appointment))
    return reply({ error: "日付・予約を確認してください" }, 400);
  const { data: a, error } = await auth.db
    .from("hp_appointments")
    .select("service_id")
    .eq("site_id", id)
    .eq("id", appointment)
    .single();
  if (error || !a) return reply({ error: "予約が見つかりません" }, 404);
  const result = await auth.db.rpc("hp_schedule_slots", {
    p_site: id,
    p_day: day,
    p_service: a.service_id,
    p_staff: q.get("staffId") || null,
    p_ignore: appointment,
  });
  if (result.error) return fail(result.error);
  const seen = new Set<string>();
  return reply({
    slots: (result.data || [])
      .filter((x: { starts_at: string }) => {
        if (seen.has(x.starts_at)) return false;
        seen.add(x.starts_at);
        return true;
      })
      .map((x: { starts_at: string }) => ({ startsAt: x.starts_at })),
  });
}
