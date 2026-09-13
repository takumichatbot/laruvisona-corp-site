import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { uuidPattern, tokenPattern } from "./config";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const privateHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};
export function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: privateHeaders });
}
export function fail(error: { code?: string; message?: string } | null) {
  const message = error?.message || "";
  const names: Record<string, [number, string]> = {
    quote_changed: [
      409,
      "メニューや料金の設定が変わりました。ページを読み直して内容をご確認ください",
    ],
    not_found: [404, "予約情報が見つかりません"],
    slot_taken: [409, "この時間は埋まりました。別の時間をお選びください"],
    config_conflict: [
      409,
      "別の画面で設定が変わりました。読み直してから保存してください",
    ],
    booking_conflict: [
      409,
      "予約が更新されています。最新の内容を読み直してください",
    ],
    request_conflict: [
      409,
      "送信内容が変更されています。予約状況を確認してください",
    ],
    change_closed: [
      409,
      "オンライン変更の受付期限を過ぎています。お店へお問い合わせください",
    ],
    already_canceled: [409, "この予約はキャンセル済みです"],
    assigned_in_use: [
      409,
      "今後の予約があるメニュー・担当者・設備は削除できません",
    ],
    legacy_active: [
      409,
      "固定枠に今後の予約が残っています。対応を終えてから切り替えてください",
    ],
  };
  const mapped = names[message];
  if (mapped) return reply({ error: mapped[1] }, mapped[0]);
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(error?.code || ""))
    return reply(
      {
        error: "予約機能を準備中です。お店へ直接お問い合わせください",
        migrationPending: true,
      },
      503,
    );
  if (error?.code === "23P01")
    return reply(
      { error: "この時間は埋まりました。別の時間をお選びください" },
      409,
    );
  console.error("[scheduling] database error", error?.code || "unknown");
  return reply(
    { error: "予約情報を確認できませんでした。時間をおいてお試しください" },
    503,
  );
}
export async function owner(siteId: string) {
  if (!uuidPattern.test(siteId))
    return { response: reply({ error: "サイトが見つかりません" }, 404) };
  const userDb = await createClient();
  const {
    data: { user },
  } = await userDb.auth.getUser();
  if (!user) return { response: reply({ error: "ログインしてください" }, 401) };
  const { data: site, error } = await userDb
    .from("sites")
    .select("id,name,slug,custom_domain,published")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .single();
  if (error || !site)
    return { response: reply({ error: "サイトが見つかりません" }, 404) };
  return { db: createServiceClient(), user, site };
}
export function managementToken(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  return tokenPattern.test(token) ? hash(token) : null;
}
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("content-length")) > 100000)
    throw Error("入力が長すぎます");
  const reader = req.body?.getReader();
  if (!reader) throw Error("入力がありません");
  const decoder = new TextDecoder();
  let s = "",
    size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 100000) {
      await reader.cancel();
      throw Error("入力が長すぎます");
    }
    s += decoder.decode(value, { stream: true });
  }
  s += decoder.decode();
  const b = JSON.parse(s);
  if (!b || typeof b !== "object" || Array.isArray(b))
    throw Error("入力の形式が正しくありません");
  return b;
}
export function reserveInput(b: Record<string, unknown>) {
  if (
    typeof b.clientKey !== "string" ||
    !uuidPattern.test(b.clientKey) ||
    typeof b.token !== "string" ||
    !tokenPattern.test(b.token)
  )
    throw Error("予約の確認情報が不足しています");
  if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 100)
    throw Error("お名前を入力してください（100文字以内）");
  if (
    typeof b.email !== "string" ||
    b.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)
  )
    throw Error("メールアドレスを確認してください");
  if (typeof b.phone !== "string" || b.phone.length > 40)
    throw Error("電話番号を確認してください");
  if (typeof b.serviceId !== "string" || !/^[\w-]{1,64}$/.test(b.serviceId))
    throw Error("メニューを選んでください");
  if (
    typeof b.staffId !== "string" ||
    (b.staffId !== "" && !/^[\w-]{1,64}$/.test(b.staffId))
  )
    throw Error("担当者を選び直してください");
  if (
    typeof b.startsAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|\+09:00)$/.test(
      b.startsAt,
    ) ||
    !Number.isFinite(Date.parse(b.startsAt))
  )
    throw Error("日時を選び直してください");
  if (!Number.isSafeInteger(b.configVersion) || Number(b.configVersion) < 1)
    throw Error("メニューを読み直してください");
  return {
    configVersion: Number(b.configVersion),
    clientKey: b.clientKey,
    name: b.name.trim(),
    email: b.email.trim().toLowerCase(),
    phone: b.phone.trim(),
    serviceId: b.serviceId,
    staffId: b.staffId,
    startsAt: new Date(b.startsAt).toISOString(),
  };
}
