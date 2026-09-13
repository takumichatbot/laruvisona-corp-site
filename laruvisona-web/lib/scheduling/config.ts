/** All business times are explicit Japan Standard Time; browser time zone never changes a booking. */
export type Hours = { start: number; end: number }[];
export type Weekly = Hours[]; // Sunday = 0. Multiple intervals allow a lunch break.
export interface Person {
  id: string;
  name: string;
  weekly: Weekly;
  daysOff: string[];
}
export interface Resource {
  id: string;
  name: string;
}
export interface Service {
  id: string;
  name: string;
  duration: number;
  buffer: number;
  price: number;
  staffIds: string[];
  resourceIds: string[];
}
export interface ScheduleConfig {
  enabled: boolean;
  weekly: Weekly;
  daysOff: string[];
  staff: Person[];
  resources: Resource[];
  services: Service[];
  step: number;
  leadMinutes: number;
  advanceDays: number;
  cancelHours: number;
}
export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
export const defaultWeekly = (): Weekly =>
  Array.from({ length: 7 }, (_, i) =>
    i === 0 ? [] : [{ start: 540, end: 1080 }],
  );
export function defaultSchedule(): ScheduleConfig {
  return {
    enabled: false,
    weekly: defaultWeekly(),
    daysOff: [],
    staff: [
      { id: "staff-1", name: "担当者1", weekly: defaultWeekly(), daysOff: [] },
    ],
    resources: [],
    services: [
      {
        id: "service-1",
        name: "相談・カウンセリング",
        duration: 60,
        buffer: 15,
        price: 0,
        staffIds: ["staff-1"],
        resourceIds: [],
      },
    ],
    step: 15,
    leadMinutes: 120,
    advanceDays: 60,
    cancelHours: 24,
  };
}
const idPattern = /^[a-zA-Z0-9_-]{1,64}$/;
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const tokenPattern = /^[a-f0-9]{64}$/;
export function validDay(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("設定の形式が正しくありません");
  return v as Record<string, unknown>;
}
function num(v: unknown, min: number, max: number): number {
  if (!Number.isInteger(v) || Number(v) < min || Number(v) > max)
    throw Error(`数値は${min}〜${max}の整数で入力してください`);
  return Number(v);
}
function text(v: unknown, max = 80): string {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    throw Error("名前を入力してください（80文字以内）");
  return v.trim();
}
function id(v: unknown): string {
  if (typeof v !== "string" || !idPattern.test(v))
    throw Error("識別子が正しくありません");
  return v;
}
function list<T>(v: unknown, max: number, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(v) || v.length > max)
    throw Error("設定の件数が上限を超えています");
  return v.map(parse);
}
function days(v: unknown) {
  return list(v, 366, (x) => {
    if (!validDay(x)) throw Error("休業日を正しく入力してください");
    return x;
  });
}
function weekly(v: unknown): Weekly {
  const result = list(v, 7, (x) =>
    list(x, 4, (y) => {
      const z = obj(y);
      const start = num(z.start, 0, 1439),
        end = num(z.end, 1, 1440);
      if (start >= end) throw Error("終了時刻は開始時刻より後にしてください");
      return { start, end };
    }),
  );
  if (result.length !== 7) throw Error("曜日は7日分必要です");
  for (const intervals of result) {
    intervals.sort((a, b) => a.start - b.start);
    if (intervals.some((a, i) => i > 0 && a.start < intervals[i - 1].end))
      throw Error("営業時間が重複しています");
  }
  return result;
}
export function parseSchedule(input: unknown): ScheduleConfig {
  const v = obj(input);
  if (typeof v.enabled !== "boolean") throw Error("受付設定が正しくありません");
  const staff = list(v.staff, 30, (x) => {
    const p = obj(x);
    return {
      id: id(p.id),
      name: text(p.name),
      weekly: weekly(p.weekly),
      daysOff: days(p.daysOff),
    };
  });
  const resources = list(v.resources, 30, (x) => {
    const p = obj(x);
    return { id: id(p.id), name: text(p.name) };
  });
  const services = list(v.services, 50, (x) => {
    const p = obj(x);
    return {
      id: id(p.id),
      name: text(p.name),
      duration: num(p.duration, 5, 480),
      buffer: num(p.buffer, 0, 180),
      price: num(p.price, 0, 10000000),
      staffIds: list(p.staffIds, 30, id),
      resourceIds: list(p.resourceIds, 30, id),
    };
  });
  for (const items of [staff, resources, services])
    if (new Set(items.map((x) => x.id)).size !== items.length)
      throw Error("識別子が重複しています");
  for (const service of services) {
    if (
      !service.staffIds.length ||
      service.staffIds.some((x) => !staff.some((p) => p.id === x)) ||
      service.resourceIds.some((x) => !resources.some((p) => p.id === x))
    )
      throw Error("メニューの担当者・設備を選び直してください");
    if (
      new Set(service.staffIds).size !== service.staffIds.length ||
      new Set(service.resourceIds).size !== service.resourceIds.length
    )
      throw Error("担当者・設備が重複しています");
  }
  if (v.enabled && (!staff.length || !services.length))
    throw Error("受付にはメニューと担当者が必要です");
  const step = num(v.step, 5, 60);
  if (![5, 10, 15, 20, 30, 60].includes(step))
    throw Error("予約間隔が正しくありません");
  return {
    enabled: v.enabled,
    weekly: weekly(v.weekly),
    daysOff: days(v.daysOff),
    staff,
    resources,
    services,
    step,
    leadMinutes: num(v.leadMinutes, 0, 10080),
    advanceDays: num(v.advanceDays, 1, 180),
    cancelHours: num(v.cancelHours, 0, 168),
  };
}
export function jstDay(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
export function clock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function dateLabel(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
