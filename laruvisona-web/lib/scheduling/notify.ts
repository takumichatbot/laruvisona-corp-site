import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import { dateLabel } from "./config";
/** Saved events retain the exact booking revision. Separate receipts avoid resending to a successful recipient. */
export async function notifyAppointment(
  siteId: string,
  id: string,
  revision: number,
): Promise<boolean> {
  const db = createServiceClient();
  const { data: event, error } = await db
    .from("hp_booking_events")
    .select("*")
    .eq("site_id", siteId)
    .eq("appointment_id", id)
    .eq("revision", revision)
    .single();
  if (error || !event) return false;
  if (event.notified) return true;
  if (!process.env.RESEND_API_KEY) return false;
  // Resend idempotency keys expire after 24h. Never blindly retry an old, uncertain delivery.
  if (Date.now() - Date.parse(event.created_at) > 23 * 3600000) return false;
  try {
    const { data: site } = await db
      .from("sites")
      .select("name,user_id,settings_json")
      .eq("id", siteId)
      .single();
    if (!site) return false;
    const { data: user } = await db.auth.admin.getUserById(site.user_id);
    const owner = site.settings_json?.notifyEmail || user?.user?.email;
    const a = event.snapshot;
    const label =
      event.action === "created"
        ? "予約確定"
        : event.action === "cancel"
          ? "予約キャンセル"
          : "予約日時変更";
    const text = [
      `${site.name} — ${label}`,
      `${a.name} 様`,
      dateLabel(a.starts_at),
      `${a.service_name} ／ ${a.staff_name}`,
      `料金 ${Number(a.price).toLocaleString()}円（来店時のお支払い）`,
      `予約番号 ${a.id}`,
      event.action === "cancel"
        ? "この予約はキャンセルされました。"
        : "ご予約が確定しています。変更・キャンセルは予約完了画面の確認リンクから行えます。リンクをお持ちでない場合はお店へ直接お問い合わせください。",
    ].join("\n");
    const resend = new Resend(process.env.RESEND_API_KEY);
    for (const recipient of [
      { kind: "owner", to: owner, sent: event.owner_notified },
      { kind: "customer", to: a.email, sent: event.customer_notified },
    ]) {
      if (recipient.sent) continue;
      if (!recipient.to) return false;
      const response = await resend.emails.send(
        {
          from: "LARU HP <noreply@laruvisona.jp>",
          to: recipient.to,
          subject: `【${label}】${site.name}`,
          text,
        },
        { idempotencyKey: `hp-schedule-${event.id}-${recipient.kind}` },
      );
      if (response.error) return false;
      const saved = await db
        .from("hp_booking_events")
        .update({ [recipient.kind + "_notified"]: true })
        .eq("id", event.id)
        .eq("site_id", siteId);
      if (saved.error) return false;
    }
    const marked = await db
      .from("hp_booking_events")
      .update({ notified: true })
      .eq("id", event.id)
      .eq("site_id", siteId);
    return !marked.error;
  } catch {
    return false;
  }
}
