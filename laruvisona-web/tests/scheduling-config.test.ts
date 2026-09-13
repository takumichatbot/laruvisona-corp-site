import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultSchedule,
  parseSchedule,
  validDay,
  jstDay,
} from "../lib/scheduling/config.ts";
import { reserveInput } from "../lib/scheduling/server.ts";
test("標準設定は受付停止・明示的な日本時間で有効", () => {
  const c = defaultSchedule();
  assert.deepEqual(parseSchedule(c), c);
  assert.equal(c.enabled, false);
  assert.equal(jstDay(new Date("2026-09-13T16:00:00Z")), "2026-09-14");
});
test("昼休みの間隔は維持し営業時間の重複は拒否", () => {
  const c = defaultSchedule();
  c.weekly[1] = [
    { start: 540, end: 720 },
    { start: 780, end: 1080 },
  ];
  assert.deepEqual(parseSchedule(c).weekly[1], c.weekly[1]);
  c.weekly[1][1].start = 710;
  assert.throws(() => parseSchedule(c), /重複/);
});
test("あり得ない日付と曜日不足、無限の枠生成を拒否", () => {
  assert.equal(validDay("2026-02-30"), false);
  for (const patch of [
    { step: 0 },
    { step: 7 },
    { advanceDays: 10000 },
    { leadMinutes: -1 },
    { weekly: [] },
  ])
    assert.throws(() => parseSchedule({ ...defaultSchedule(), ...patch }));
});
test("担当者・設備の存在を確かめ、重複と参照漏れを拒否", () => {
  const c = defaultSchedule();
  c.services[0].resourceIds = ["missing"];
  assert.throws(() => parseSchedule(c));
  c.services[0].resourceIds = [];
  c.staff.push(c.staff[0]);
  assert.throws(() => parseSchedule(c), /重複/);
});
test("担当者不在のメニューは公開しない", () => {
  const c = defaultSchedule();
  c.services[0].staffIds = [];
  assert.throws(() => parseSchedule(c));
});
test("予約入力は価格・所要時間・設備の指定を信頼せず必要項目だけ取り出す", () => {
  const b = {
    configVersion: 1,
    clientKey: "11111111-1111-4111-8111-111111111111",
    token: "a".repeat(64),
    name: " 来店者 ",
    email: "TEST@example.com",
    phone: "",
    serviceId: "s1",
    staffId: "",
    startsAt: "2026-09-14T10:00:00+09:00",
    price: 1,
    duration: 1,
    resourceId: "other",
  };
  const p = reserveInput(b);
  assert.equal(p.name, "来店者");
  assert.equal(p.email, "test@example.com");
  assert.equal(p.startsAt, "2026-09-14T01:00:00.000Z");
  assert.ok(!("price" in p));
  assert.ok(!("resourceId" in p));
  assert.throws(() => reserveInput({ ...b, email: "x\ny@example.com" }));
  assert.throws(() => reserveInput({ ...b, token: "bad" }));
});

test("PostgRESTのUTC空き枠をそのまま予約でき、JST・Z表記と同じ時刻になる", () => {
  const b = {
    configVersion: 1,
    clientKey: "11111111-1111-4111-8111-111111111111",
    token: "a".repeat(64), name: "内部テスト", email: "test@example.invalid",
    phone: "", serviceId: "s1", staffId: "staff-1",
  };
  for (const startsAt of ["2026-09-16T00:00:00+00:00", "2026-09-16T00:00:00Z", "2026-09-16T09:00:00+09:00"])
    assert.equal(reserveInput({ ...b, startsAt }).startsAt, "2026-09-16T00:00:00.000Z");
  for (const startsAt of ["2026-09-16T00:00:00", "2026-09-16T00:00:00+99:00", "invalid"])
    assert.throws(() => reserveInput({ ...b, startsAt }));
});

test("固定枠との互換: 未適用だけは旧予約を使い、DB障害は不存在扱いしない", async () => {
  const { scheduledBookingLink } = await import("../lib/scheduling/legacy.ts");
  const fake = (result: unknown) => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => result }) }),
    }),
  });
  assert.equal(
    await scheduledBookingLink(
      fake({ data: null, error: { code: "42P01" } }) as never,
      "x",
    ),
    null,
  );
  assert.match(
    (await scheduledBookingLink(
      fake({ data: { config: { enabled: true } }, error: null }) as never,
      "site x",
    ))!,
    /siteId=site%20x$/,
  );
  await assert.rejects(() =>
    scheduledBookingLink(
      fake({ data: null, error: { code: "08006" } }) as never,
      "x",
    ),
  );
});
