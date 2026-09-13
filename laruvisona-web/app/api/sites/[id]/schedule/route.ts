import { notifyAppointment } from "@/lib/scheduling/notify";
import { owner, readBody, reply, fail } from "@/lib/scheduling/server";
import {
  parseSchedule,
  defaultSchedule,
  uuidPattern,
  validDay,
  jstDay,
} from "@/lib/scheduling/config";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, { params }: Context) {
  const { id } = await params;
  const auth = await owner(id);
  if (auth.response) return auth.response;
  const day = new URL(req.url).searchParams.get("day") || jstDay();
  if (!validDay(day)) return reply({ error: "日付を確認してください" }, 400);
  const from = new Date(day + "T00:00:00+09:00"),
    to = new Date(from.getTime() + 86400000);
  const [calendar, appointments, events] = await Promise.all([
    auth.db
      .from("hp_booking_calendars")
      .select("config,version")
      .eq("site_id", id)
      .maybeSingle(),
    auth.db
      .from("hp_appointments")
      .select(
        "id,service_id,service_name,staff_id,staff_name,resource_id,resource_name,starts_at,ends_at,price,name,email,phone,status,revision",
      )
      .eq("site_id", id)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at"),
    auth.db
      .from("hp_booking_events")
      .select("id,appointment_id,revision,action,created_at,notified")
      .eq("site_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  for (const result of [calendar, appointments, events])
    if (result.error) return fail(result.error);
  return reply({
    site: auth.site,
    config: calendar.data?.config || defaultSchedule(),
    version: calendar.data?.version || 0,
    appointments: appointments.data,
    events: events.data,
  });
}
export async function PUT(req: Request, { params }: Context) {
  const { id } = await params;
  const auth = await owner(id);
  if (auth.response) return auth.response;
  let config, version;
  try {
    const b = await readBody(req);
    config = parseSchedule(b.config);
    version = b.version;
    if (!Number.isSafeInteger(version) || Number(version) < 0)
      throw Error("設定を読み直してください");
  } catch (e) {
    return reply({ error: (e as Error).message }, 400);
  }
  const result = await auth.db.rpc("hp_schedule_configure", {
    p_site: id,
    p_owner: auth.user.id,
    p_config: config,
    p_version: version,
  });
  if (result.error) return fail(result.error);
  return reply({ config, version: result.data.version });
}
export async function PATCH(req: Request, { params }: Context) {
  const { id } = await params;
  const auth = await owner(id);
  if (auth.response) return auth.response;
  let b;
  try {
    b = await readBody(req);
  } catch {
    return reply({ error: "入力を確認してください" }, 400);
  }
  if (b.action === "retry-notification") {
    if (
      typeof b.id !== "string" ||
      !uuidPattern.test(b.id) ||
      !Number.isInteger(b.revision)
    )
      return reply({ error: "通知を確認してください" }, 400);
    const notified = await notifyAppointment(id, b.id, Number(b.revision));
    return reply({ notified });
  }
  if (
    typeof b.id !== "string" ||
    !uuidPattern.test(b.id) ||
    !["cancel", "reschedule"].includes(String(b.action)) ||
    !Number.isInteger(b.revision)
  )
    return reply({ error: "予約を読み直してください" }, 400);
  if (
    b.action === "reschedule" &&
    (typeof b.startsAt !== "string" ||
      !Number.isFinite(Date.parse(b.startsAt)) ||
      typeof b.staffId !== "string")
  )
    return reply({ error: "日時を確認してください" }, 400);
  const result = await auth.db.rpc("hp_schedule_change", {
    p_site: id,
    p_id: b.id,
    p_token_hash: null,
    p_owner: auth.user.id,
    p_action: b.action,
    p_start: b.action === "reschedule" ? b.startsAt : null,
    p_staff: b.staffId || null,
    p_revision: b.revision,
  });
  if (result.error) return fail(result.error);
  const notified = await notifyAppointment(
    id,
    result.data.id,
    result.data.revision,
  );
  return reply({ appointment: result.data, notified });
}
