import { notifyAppointment } from "@/lib/scheduling/notify";
import { createServiceClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  parseSchedule,
  uuidPattern,
  tokenPattern,
  validDay,
} from "@/lib/scheduling/config";
import {
  fail,
  reply,
  hash,
  readBody,
  reserveInput,
  managementToken,
} from "@/lib/scheduling/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams,
    siteId = q.get("siteId") || "",
    day = q.get("day"),
    service = q.get("serviceId");
  if (!uuidPattern.test(siteId) || (day !== null && !validDay(day)))
    return reply({ error: "日時・サイトを確認してください" }, 400);
  const limit = rateLimit("schedule-read:" + clientIp(req), 120, 60000);
  if (!limit.ok) return reply({ error: "少し待ってからお試しください" }, 429);
  const db = createServiceClient();
  const { data: site, error: se } = await db
    .from("sites")
    .select("name,published")
    .eq("id", siteId)
    .single();
  if (se || !site?.published)
    return reply({ error: "予約ページが見つかりません" }, 404);
  const { data: calendar, error } = await db
    .from("hp_booking_calendars")
    .select("config,version")
    .eq("site_id", siteId)
    .maybeSingle();
  if (error) return fail(error);
  if (!calendar)
    return reply({ error: "オンライン予約はまだ受け付けていません" }, 404);
  let config;
  try {
    config = parseSchedule(calendar.config);
  } catch {
    return reply({ error: "予約設定を確認中です" }, 503);
  }
  if (!config.enabled)
    return reply({ error: "オンライン予約の受付を休止しています" }, 409);
  // Never publish staff working patterns, days off or resource inventory.
  const publicConfig = {
    version: calendar.version,
    services: config.services.map((x) => ({ ...x, resourceIds: [] })),
    staff: config.staff.map(({ id, name }) => ({ id, name })),
    advanceDays: config.advanceDays,
    cancelHours: config.cancelHours,
  };
  if (!day || !service) return reply({ config: publicConfig, name: site.name });
  let ignore = null;
  if (q.get("appointmentId")) {
    const id = q.get("appointmentId")!,
      token = managementToken(req);
    if (!uuidPattern.test(id) || !token)
      return reply({ error: "確認リンクを開き直してください" }, 404);
    const checked = await db.rpc("hp_schedule_change", {
      p_site: siteId,
      p_id: id,
      p_token_hash: token,
      p_owner: null,
      p_action: "lookup",
      p_start: null,
      p_staff: null,
      p_revision: null,
    });
    if (checked.error) return fail(checked.error);
    ignore = id;
  }
  const slots = await db.rpc("hp_schedule_slots", {
    p_site: siteId,
    p_day: day,
    p_service: service,
    p_staff: q.get("staffId") || null,
    p_ignore: ignore,
  });
  if (slots.error) return fail(slots.error);
  const seen = new Set<string>();
  return reply({
    slots: (slots.data || [])
      .filter((s: { starts_at: string }) => {
        if (seen.has(s.starts_at)) return false;
        seen.add(s.starts_at);
        return true;
      })
      .map((s: { starts_at: string; ends_at: string }) => ({
        startsAt: s.starts_at,
        endsAt: s.ends_at,
      })),
  });
}
export async function POST(req: Request) {
  const limit = rateLimit("schedule-write:" + clientIp(req), 30, 3600000);
  if (!limit.ok)
    return reply(
      { error: "送信が続いています。時間をおいてお試しください" },
      429,
    );
  let b;
  try {
    b = await readBody(req);
  } catch {
    return reply({ error: "入力を確認してください" }, 400);
  }
  if (typeof b.siteId !== "string" || !uuidPattern.test(b.siteId))
    return reply({ error: "サイトを確認してください" }, 400);
  const db = createServiceClient();
  if (b.action === "recover") {
    if (
      typeof b.clientKey !== "string" ||
      !uuidPattern.test(b.clientKey) ||
      typeof b.token !== "string" ||
      !tokenPattern.test(b.token)
    )
      return reply({ error: "確認情報が不足しています" }, 400);
    const r = await db
      .from("hp_appointments")
      .select(
        "id,service_id,service_name,staff_id,staff_name,resource_name,starts_at,ends_at,price,name,email,phone,status,revision",
      )
      .eq("site_id", b.siteId)
      .eq("client_key", b.clientKey)
      .eq("token_hash", hash(b.token))
      .maybeSingle();
    if (r.error) return fail(r.error);
    return reply({ appointment: r.data });
  }
  if (b.action === "reserve") {
    let input;
    try {
      input = reserveInput(b);
    } catch (e) {
      return reply({ error: (e as Error).message }, 400);
    }
    const result = await db.rpc("hp_schedule_book", {
      p_site: b.siteId,
      p_input: input,
      p_token_hash: hash(b.token as string),
      p_request_hash: hash(JSON.stringify(input)),
    });
    if (result.error) return fail(result.error);
    const notified = await notifyAppointment(
      b.siteId,
      result.data.id,
      result.data.revision,
    );
    return reply({ appointment: result.data, notified });
  }
  if (
    !["lookup", "cancel", "reschedule"].includes(String(b.action)) ||
    typeof b.id !== "string" ||
    !uuidPattern.test(b.id)
  )
    return reply({ error: "予約を確認してください" }, 400);
  const token = managementToken(req);
  if (!token)
    return reply({ error: "予約確認リンクを開き直してください" }, 404);
  if (
    b.action !== "lookup" &&
    (!Number.isInteger(b.revision) || Number(b.revision) < 1)
  )
    return reply({ error: "予約を読み直してください" }, 400);
  if (
    b.action === "reschedule" &&
    (typeof b.startsAt !== "string" ||
      !Number.isFinite(Date.parse(b.startsAt)) ||
      typeof b.staffId !== "string")
  )
    return reply({ error: "日時を選び直してください" }, 400);
  const result = await db.rpc("hp_schedule_change", {
    p_site: b.siteId,
    p_id: b.id,
    p_token_hash: token,
    p_owner: null,
    p_action: b.action,
    p_start: b.action === "reschedule" ? b.startsAt : null,
    p_staff: b.action === "reschedule" ? b.staffId : null,
    p_revision: b.revision || null,
  });
  if (result.error) return fail(result.error);
  const notified =
    b.action === "lookup"
      ? undefined
      : await notifyAppointment(b.siteId, result.data.id, result.data.revision);
  return reply({ appointment: result.data, notified });
}
