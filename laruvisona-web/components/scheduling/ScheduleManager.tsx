"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, CalendarDays, Settings2, ArrowLeft } from "lucide-react";
import {
  defaultSchedule,
  defaultWeekly,
  WEEKDAYS,
  clock,
  jstDay,
  dateLabel,
  type ScheduleConfig,
  type Weekly,
} from "@/lib/scheduling/config";
import BookingShare from "./BookingShare";
import { bookingPublicUrl } from "@/lib/scheduling/setup";
import type { Appointment } from "./PublicBooking";
import s from "./scheduling.module.css";
type Site = {
  id: string;
  name: string;
  slug: string;
  custom_domain?: string;
  published?: boolean;
};
type Event = {
  id: string;
  revision: number;
  appointment_id: string;
  action: string;
  created_at: string;
  notified: boolean;
};
async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "読み込みに失敗しました");
  return d;
}
function HoursEditor({
  value,
  onChange,
}: {
  value: Weekly;
  onChange: (w: Weekly) => void;
}) {
  const put = (day: number, items: Weekly[number]) =>
    onChange(value.map((x, i) => (i === day ? items : x)));
  return (
    <div>
      {value.map((items, day) => (
        <div className={s.hours} key={day}>
          <strong>{WEEKDAYS[day]}</strong>
          <div className={s.intervals}>
            {items.map((range, i) => (
              <div key={i} className={s.interval}>
                <input
                  aria-label={`${WEEKDAYS[day]}曜 ${i + 1} 開始`}
                  type="time"
                  value={clock(range.start)}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    put(
                      day,
                      items.map((x, j) =>
                        i === j ? { ...x, start: h * 60 + m } : x,
                      ),
                    );
                  }}
                />
                <span>〜</span>
                <input
                  aria-label={`${WEEKDAYS[day]}曜 ${i + 1} 終了`}
                  type="time"
                  value={clock(range.end % 1440)}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    put(
                      day,
                      items.map((x, j) =>
                        i === j ? { ...x, end: h * 60 + m || 1440 } : x,
                      ),
                    );
                  }}
                />
                <button
                  type="button"
                  className={s.secondary}
                  onClick={() =>
                    put(
                      day,
                      items.filter((_, j) => j !== i),
                    )
                  }
                >
                  削除
                </button>
              </div>
            ))}
            <button
              type="button"
              className={s.secondary}
              disabled={items.length >= 4}
              onClick={() =>
                put(day, [
                  ...items,
                  {
                    start: items.length
                      ? Math.min(items[items.length - 1].end + 60, 1380)
                      : 540,
                    end: items.length
                      ? Math.min(items[items.length - 1].end + 180, 1440)
                      : 1080,
                  },
                ])
              }
            >
              {items.length ? "時間帯を追加" : "休業・勤務なし → 時間を設定"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
function DaysOff({
  days,
  onChange,
}: {
  days: string[];
  onChange: (days: string[]) => void;
}) {
  const [day, setDay] = useState("");
  return (
    <div>
      <label className={s.field}>
        休業日・お休み
        <div className={s.row}>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
          <button
            type="button"
            className={s.secondary}
            disabled={!day}
            onClick={() => {
              onChange([...new Set([...days, day])].sort());
              setDay("");
            }}
          >
            追加
          </button>
        </div>
      </label>
      <div className={s.chips}>
        {days.map((x) => (
          <button
            type="button"
            className={s.secondary}
            key={x}
            onClick={() => onChange(days.filter((d) => d !== x))}
          >
            {x} を解除
          </button>
        ))}
      </div>
    </div>
  );
}
export default function ScheduleManager() {
  const [sites, setSites] = useState<Site[]>([]),
    [siteId, setSiteId] = useState(""),
    [config, setConfig] = useState<ScheduleConfig>(defaultSchedule),
    [version, setVersion] = useState(0),
    [day, setDay] = useState(jstDay()),
    [appointments, setAppointments] = useState<Appointment[]>([]),
    [events, setEvents] = useState<Event[]>([]);
  const [guided, setGuided] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [accessFailed, setAccessFailed] = useState(false);
  const steps = ["営業時間", "担当者", "部屋・設備", "メニュー", "受付ルール"];
  const [tab, setTab] = useState<"agenda" | "settings" | "share">("agenda"),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [migration, setMigration] = useState(false);
  const [edit, setEdit] = useState<Appointment | null>(null),
    [editDay, setEditDay] = useState(jstDay()),
    [editStaff, setEditStaff] = useState(""),
    [editStart, setEditStart] = useState(""),
    [editSlots, setEditSlots] = useState<{ startsAt: string }[]>([]);
  const generation = useRef(0),
    current = useRef(siteId),
    dayRef = useRef(day),
    slotSequence = useRef(0);
  current.current = siteId;
  dayRef.current = day;
  const load = useCallback(
    async (id: string, date: string, includeConfig: boolean) => {
      const gen = ++generation.current;
      setError("");
      setAccessFailed(false);
      if (includeConfig) setLoaded(false);
      try {
        const d = await api(`/api/sites/${id}/schedule?day=${date}`);
        if (gen !== generation.current || current.current !== id) return;
        if (includeConfig) {
          setSites(prev => prev.map(x => x.id === id ? { ...x, ...d.site } : x));
          setConfig(d.config);
          setVersion(d.version);
          setDirty(false);
        }
        setAppointments(d.appointments || []);
        setEvents(d.events || []);
        setMigration(false);
      } catch (e) {
        if (gen === generation.current) {
          setError((e as Error).message);
          setAccessFailed(true);
          setMigration((e as Error).message.includes("準備中"));
        }
      } finally {
        if (gen === generation.current) setLoaded(true);
      }
    },
    [],
  );
  useEffect(() => {
    let active = true;
    api("/api/sites")
      .then((d) => {
        if (!active) return;
        setSites(d.sites || []);
        const requested = new URL(window.location.href).searchParams.get("siteId");
        if (requested && !d.sites?.some((x: Site) => x.id === requested)) {
          setError("指定したサイトは見つかりません。サイト一覧から開き直してください。");
          setAccessFailed(true); setLoaded(true); return;
        }
        if (d.sites?.length) setSiteId(requested || d.sites[0].id);
        else setLoaded(true);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setAccessFailed(true);
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (siteId) {
      setLoaded(false);
      slotSequence.current++;
      setEdit(null);
      setGuided(false); setGuideStep(0);
      void load(siteId, dayRef.current, true);
    }
  }, [siteId, load]); // day changes reload only the agenda, preserving unsaved settings
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const patch = (x: Partial<ScheduleConfig>) => {
    setConfig((c) => ({ ...c, ...x }));
    setDirty(true);
    setMessage("");
  };
  async function save() {
    setBusy(true);
    setError("");
    try {
      const d = await api(`/api/sites/${siteId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, version }),
      });
      setConfig(d.config);
      setVersion(d.version);
      setDirty(false);
      setMessage("予約設定を保存しました");
      if (guided) setTab("share");
    } catch (e) {
      setError((e as Error).message);
      setGuided(false);
    } finally {
      setBusy(false);
    }
  }
  async function cancel(a: Appointment) {
    if (!confirm(`${a.name}様の予約をキャンセルしますか？`)) return;
    setBusy(true);
    try {
      await api(`/api/sites/${siteId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: a.id,
          revision: a.revision,
          action: "cancel",
        }),
      });
      await load(siteId, day, false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function choices(a: Appointment, date: string, staff: string) {
    const seq = ++slotSequence.current;
    setEditSlots([]);
    setEditStart("");
    try {
      const d = await api(
        `/api/sites/${siteId}/schedule/slots?day=${date}&serviceId=${a.service_id}&staffId=${staff}&appointmentId=${a.id}`,
      );
      if (seq === slotSequence.current) setEditSlots(d.slots || []);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function move() {
    if (!edit || !editStart) return;
    setBusy(true);
    try {
      await api(`/api/sites/${siteId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: edit.id,
          revision: edit.revision,
          action: "reschedule",
          startsAt: editStart,
          staffId: editStaff,
        }),
      });
      setEdit(null);
      await load(siteId, day, false);
      setMessage("予約日時を変更しました");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const site = sites.find((x) => x.id === siteId),
    bookingUrl = site
      ? bookingPublicUrl(site)
      : "";
  return (
    <main className={s.shell}>
      <fieldset
        disabled={busy}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <div className={s.container}>
          <header className={s.header}>
            <div>
              <p className={s.eyebrow}>LARU HP / お店の予約</p>
              <h1 className={s.title}>一日の流れを、ひと目で。</h1>
              <p className={s.intro}>
                担当者と設備の空きを合わせて、お客様の予約を受け付けます。
              </p>
            </div>
            <Link href="/laruHP/dashboard">
              <ArrowLeft size={14} /> ダッシュボード
            </Link>
          </header>
          <div className={s.row}>
            <label className={s.field}>
              管理するサイト
              <select
                value={siteId}
                disabled={busy}
                onChange={(e) => {
                  if (!dirty || confirm("未保存の設定を破棄して切り替えますか？")) {
                    const next = e.target.value;
                    setSiteId(next);
                    const url = new URL(window.location.href);
                    url.searchParams.set("siteId", next);
                    window.history.replaceState(null, "", url);
                  }
                }}
              >
                {sites.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            {bookingUrl && site?.published && loaded && !accessFailed && (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
                className={s.secondary}
              >
                予約ページを見る
              </a>
            )}
          </div>
          <nav className={s.tabs} aria-label="予約管理">
            <button
              className={s.tab}
              aria-pressed={tab === "agenda"}
              onClick={() => setTab("agenda")}
            >
              <CalendarDays size={16} /> 予約一覧
            </button>
            <button
              className={s.tab}
              aria-pressed={tab === "settings"}
              onClick={() => setTab("settings")}
            >
              <Settings2 size={16} /> 受付の設定{dirty ? "・未保存" : ""}
            </button>
            <button className={s.tab} aria-pressed={tab === "share"} onClick={() => setTab("share")}>サイトに設置・共有</button>
            <Link href="/laruHP/booking" className={s.tab}>
              以前の固定枠・リクエスト
            </Link>
          </nav>
          {error && (
            <div role="alert" className={`${s.notice} ${s.error}`}>
              {error}
              <br />
              <button
                className={s.secondary}
                onClick={() => {
                  if (
                    !dirty ||
                    confirm("未保存の設定を破棄して読み直しますか？")
                  )
                    void load(siteId, day, true);
                }}
              >
                読み直す
              </button>
            </div>
          )}
          {message && (
            <p role="status" className={s.notice}>
              {message}
            </p>
          )}
          {loaded && site && !accessFailed && !migration && tab !== "share" && (
            <section className={s.setupIntro}>
              <div><strong>{version === 0 ? "予約受付を準備しましょう" : "設定からサイトへの設置まで"}</strong><p>営業時間・担当者・設備・メニュー・受付ルールを順番に整えます。設備を使わないお店は登録不要です。</p></div>
              <button className={s.button} onClick={() => {setTab("settings");setGuided(true);setGuideStep(0);}}>順番に設定する</button>
            </section>
          )}
          {!loaded ? (
            <div className={s.loading}>予約を読み込んでいます…</div>
          ) : accessFailed && !migration ? (
            <p className={s.notice}>設定を取得できていないため編集はできません。読み直すか、管理するサイトを選び直してください。</p>
          ) : !sites.length ? (
            <section className={s.card}>
              <h2>まずサイトを作成してください</h2>
              <Link href="/laruHP/studio" className={s.button}>
                制作画面へ
              </Link>
            </section>
          ) : migration ? (
            <section className={s.card}>
              <h2>本格予約の公開準備中です</h2>
              <p>
                これまでの予約は、以前の固定枠・リクエスト画面で確認できます。
              </p>
            </section>
          ) : tab === "share" && site ? (
            <BookingShare key={siteId} siteId={siteId} url={bookingUrl} published={!!site.published}
              enabled={config.enabled} version={version} dirty={dirty}
              onSettings={() => {setTab("settings"); setGuided(true); setGuideStep(4);}}
              onRefresh={() => { if (!dirty || confirm("未保存の設定を破棄して読み直しますか？")) void load(siteId, day, true); }}/>
          ) : tab === "agenda" ? (
            <div className={s.grid}>
              <section className={s.card}>
                <div className={s.row}>
                  <h2>予約一覧</h2>
                  <label className={s.field}>
                    日付（日本時間）
                    <input
                      type="date"
                      value={day}
                      onChange={(e) => {
                        if (e.target.value) {
                          setDay(e.target.value);
                          void load(siteId, e.target.value, false);
                        }
                      }}
                    />
                  </label>
                  <button
                    className={s.secondary}
                    disabled={busy}
                    onClick={() => void load(siteId, day, false)}
                  >
                    更新
                  </button>
                </div>
                {!appointments.length ? (
                  <p className={s.empty}>この日の予約はありません。</p>
                ) : (
                  appointments.map((a) => (
                    <article className={s.appointment} key={a.id}>
                      <time>
                        {new Date(a.starts_at).toLocaleTimeString("ja-JP", {
                          timeZone: "Asia/Tokyo",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                      <div>
                        <strong>{a.name} 様</strong>{" "}
                        <span className={s.status}>
                          {a.status === "canceled" ? "キャンセル" : "確定"}
                        </span>
                        <p>
                          {a.service_name}・{a.price.toLocaleString()}円<br />
                          {a.staff_name}
                          {a.resource_name ? " ／ " + a.resource_name : ""}
                        </p>
                        <p>
                          <a href={"mailto:" + a.email}>{a.email}</a>
                          {a.phone && (
                            <>
                              {" "}
                              ／ <a href={"tel:" + a.phone}>{a.phone}</a>
                            </>
                          )}
                        </p>
                        {a.status === "confirmed" && (
                          <div className={s.row}>
                            <button
                              className={s.secondary}
                              disabled={busy}
                              onClick={() => {
                                setEdit(a);
                                const d = jstDay(new Date(a.starts_at));
                                setEditDay(d);
                                setEditStaff(a.staff_id);
                                void choices(a, d, a.staff_id);
                              }}
                            >
                              日時変更
                            </button>
                            <button
                              className={`${s.secondary} ${s.danger}`}
                              disabled={busy}
                              onClick={() => void cancel(a)}
                            >
                              キャンセル
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))
                )}
                {edit && (
                  <section
                    className={`${s.section}`}
                    aria-label="予約日時を変更"
                  >
                    <h3>{edit.name} 様の日時変更</h3>
                    <label className={s.field}>
                      変更先の日付
                      <input
                        type="date"
                        value={editDay}
                        min={jstDay()}
                        onChange={(e) => {
                          setEditDay(e.target.value);
                          if (e.target.value)
                            void choices(edit, e.target.value, editStaff);
                        }}
                      />
                    </label>
                    <label className={s.field}>
                      担当者
                      <select
                        value={editStaff}
                        onChange={(e) => {
                          setEditStaff(e.target.value);
                          void choices(edit, editDay, e.target.value);
                        }}
                      >
                        <option value="">指名なし</option>
                        {config.staff
                          .filter((p) =>
                            config.services
                              .find((x) => x.id === edit.service_id)
                              ?.staffIds.includes(p.id),
                          )
                          .map((x) => (
                            <option value={x.id} key={x.id}>
                              {x.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <div className={s.slots}>
                      {editSlots.map((x) => (
                        <button
                          key={x.startsAt}
                          className={s.slot}
                          aria-pressed={editStart === x.startsAt}
                          onClick={() => setEditStart(x.startsAt)}
                        >
                          {new Date(x.startsAt).toLocaleTimeString("ja-JP", {
                            timeZone: "Asia/Tokyo",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </button>
                      ))}
                    </div>
                    {!editSlots.length && (
                      <p className={s.small}>
                        変更できる空き時間がありません。
                      </p>
                    )}
                    <div className={`${s.row} ${s.section}`}>
                      <button
                        className={s.button}
                        disabled={busy || !editStart}
                        onClick={move}
                      >
                        変更を確定
                      </button>
                      <button
                        className={s.secondary}
                        onClick={() => {
                          slotSequence.current++;
                          setEdit(null);
                        }}
                      >
                        閉じる
                      </button>
                    </div>
                  </section>
                )}
              </section>
              <aside className={s.card}>
                <h2>{config.enabled ? "予約受付中" : "予約受付を停止中"}</h2>
                <p className={s.small}>
                  受付停止中も、入っている予約の確認・キャンセルはできます。
                </p>
                <button
                  className={s.secondary}
                  onClick={() => setTab("settings")}
                >
                  受付の設定へ
                </button>
                <h3 className={s.section}>最近の変更</h3>
                {events.slice(0, 10).map((e) => (
                  <p className={s.small} key={e.id}>
                    {dateLabel(e.created_at)}
                    <br />
                    {e.action === "created"
                      ? "予約が入りました"
                      : e.action === "cancel"
                        ? "キャンセルがありました"
                        : "日時が変更されました"}
                    {!e.notified && (
                      <>
                        <br />
                        <span>メール通知は未確認</span>
                        <button
                          className={s.secondary}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const d = await api(
                                `/api/sites/${siteId}/schedule`,
                                {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    action: "retry-notification",
                                    id: e.appointment_id,
                                    revision: e.revision,
                                  }),
                                },
                              );
                              setMessage(
                                d.notified
                                  ? "通知メールを送信しました"
                                  : "通知できませんでした。通知先・メール設定を確認してください。受付から23時間以上経過した通知は自動再送しません。",
                              );
                              await load(siteId, day, false);
                            } catch (err) {
                              setError((err as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          通知を再送
                        </button>
                      </>
                    )}
                  </p>
                ))}
              </aside>
            </div>
          ) : (
            <>
            {guided && <nav className={s.setupSteps} aria-label="予約受付の設定手順">
              {steps.map((label, i) => <button key={label} aria-current={guideStep === i ? "step" : undefined} onClick={() => setGuideStep(i)}><span>{i+1}</span>{label}</button>)}
              <button onClick={() => setGuided(false)}>すべて表示</button>
            </nav>}
            <div className={guided ? s.guidedGrid : s.grid}>
              <div hidden={guided && guideStep === 4}>
                <section className={s.card} hidden={guided && guideStep !== 0}>
                  <h2>営業時間</h2>
                  <p className={s.small}>
                    日本時間で設定します。昼休みは時間帯を分けてください。終了00:00は翌日0時です。
                  </p>
                  <HoursEditor
                    value={config.weekly}
                    onChange={(weekly) => patch({ weekly })}
                  />
                  <div className={s.section}>
                    <DaysOff
                      days={config.daysOff}
                      onChange={(daysOff) => patch({ daysOff })}
                    />
                  </div>
                </section>
                <section className={s.card} hidden={guided && guideStep !== 1}>
                  <h2>担当者</h2>
                  <p className={s.small}>
                    営業時間と勤務時間が重なる時間だけ予約できます。
                  </p>
                  {config.staff.map((p, i) => (
                    <div key={p.id} className={i ? s.section : undefined}>
                      <label className={s.field}>
                        表示名
                        <input
                          value={p.name}
                          maxLength={80}
                          onChange={(e) =>
                            patch({
                              staff: config.staff.map((x) =>
                                x.id === p.id
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <details>
                        <summary className={s.secondary}>
                          勤務時間・お休み
                        </summary>
                        <HoursEditor
                          value={p.weekly}
                          onChange={(weekly) =>
                            patch({
                              staff: config.staff.map((x) =>
                                x.id === p.id ? { ...x, weekly } : x,
                              ),
                            })
                          }
                        />
                        <DaysOff
                          days={p.daysOff}
                          onChange={(daysOff) =>
                            patch({
                              staff: config.staff.map((x) =>
                                x.id === p.id ? { ...x, daysOff } : x,
                              ),
                            })
                          }
                        />
                      </details>
                      <button
                        className={`${s.secondary} ${s.danger}`}
                        style={{ marginTop: 12 }}
                        onClick={() =>
                          patch({
                            staff: config.staff.filter((x) => x.id !== p.id),
                            services: config.services.map((x) => ({
                              ...x,
                              staffIds: x.staffIds.filter((id) => id !== p.id),
                            })),
                          })
                        }
                      >
                        担当者を削除
                      </button>
                    </div>
                  ))}
                  <button
                    className={s.secondary}
                    style={{ marginTop: 20 }}
                    disabled={config.staff.length >= 30}
                    onClick={() =>
                      patch({
                        staff: [
                          ...config.staff,
                          {
                            id: crypto.randomUUID(),
                            name: "",
                            weekly: defaultWeekly(),
                            daysOff: [],
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={16} /> 担当者を追加
                  </button>
                </section>
                <section className={s.card} hidden={guided && guideStep !== 2}>
                  <h2>部屋・設備</h2>
                  <p className={s.small}>
                    施術ベッドや相談室など、同時に使えないものを1つずつ登録します。
                  </p>
                  {config.resources.map((p) => (
                    <div className={s.row} key={p.id}>
                      <label className={s.field}>
                        設備名
                        <input
                          value={p.name}
                          maxLength={80}
                          onChange={(e) =>
                            patch({
                              resources: config.resources.map((x) =>
                                x.id === p.id
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <button
                        className={`${s.secondary} ${s.danger}`}
                        onClick={() =>
                          patch({
                            resources: config.resources.filter(
                              (x) => x.id !== p.id,
                            ),
                            services: config.services.map((x) => ({
                              ...x,
                              resourceIds: x.resourceIds.filter(
                                (id) => id !== p.id,
                              ),
                            })),
                          })
                        }
                      >
                        削除
                      </button>
                    </div>
                  ))}
                  <button
                    className={s.secondary}
                    disabled={config.resources.length >= 30}
                    onClick={() =>
                      patch({
                        resources: [
                          ...config.resources,
                          { id: crypto.randomUUID(), name: "" },
                        ],
                      })
                    }
                  >
                    <Plus size={16} /> 設備を追加
                  </button>
                </section>
                <section className={s.card} hidden={guided && guideStep !== 3}>
                  <h2>メニュー</h2>
                  {config.services.map((p, i) => (
                    <div key={p.id} className={i ? s.section : undefined}>
                      <label className={s.field}>
                        メニュー名
                        <input
                          value={p.name}
                          maxLength={80}
                          onChange={(e) =>
                            patch({
                              services: config.services.map((x) =>
                                x.id === p.id
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <div className={s.row}>
                        {(["duration", "buffer", "price"] as const).map(
                          (key) => (
                            <label className={s.field} key={key}>
                              {key === "duration"
                                ? "所要時間（分）"
                                : key === "buffer"
                                  ? "後片付け・準備（分）"
                                  : "来店時の料金（円）"}
                              <input
                                type="number"
                                min={key === "duration" ? 5 : 0}
                                max={
                                  key === "duration"
                                    ? 480
                                    : key === "buffer"
                                      ? 180
                                      : 10000000
                                }
                                value={p[key]}
                                onChange={(e) =>
                                  patch({
                                    services: config.services.map((x) =>
                                      x.id === p.id
                                        ? {
                                            ...x,
                                            [key]: Number(e.target.value),
                                          }
                                        : x,
                                    ),
                                  })
                                }
                              />
                            </label>
                          ),
                        )}
                      </div>
                      <p className={s.small}>対応できる担当者（1人以上）</p>
                      <div className={s.chips}>
                        {config.staff.map((x) => (
                          <label className={s.check} key={x.id}>
                            <input
                              type="checkbox"
                              checked={p.staffIds.includes(x.id)}
                              onChange={(e) =>
                                patch({
                                  services: config.services.map((y) =>
                                    y.id === p.id
                                      ? {
                                          ...y,
                                          staffIds: e.target.checked
                                            ? [...y.staffIds, x.id]
                                            : y.staffIds.filter(
                                                (id) => id !== x.id,
                                              ),
                                        }
                                      : y,
                                  ),
                                })
                              }
                            />
                            {x.name || "未入力"}
                          </label>
                        ))}
                      </div>
                      <p className={s.small}>
                        使用する設備候補（選んだ中から空いている1つを確保。未選択なら設備不要）
                      </p>
                      <div className={s.chips}>
                        {config.resources.map((x) => (
                          <label className={s.check} key={x.id}>
                            <input
                              type="checkbox"
                              checked={p.resourceIds.includes(x.id)}
                              onChange={(e) =>
                                patch({
                                  services: config.services.map((y) =>
                                    y.id === p.id
                                      ? {
                                          ...y,
                                          resourceIds: e.target.checked
                                            ? [...y.resourceIds, x.id]
                                            : y.resourceIds.filter(
                                                (id) => id !== x.id,
                                              ),
                                        }
                                      : y,
                                  ),
                                })
                              }
                            />
                            {x.name || "未入力"}
                          </label>
                        ))}
                      </div>
                      <button
                        className={`${s.secondary} ${s.danger}`}
                        style={{ marginTop: 12 }}
                        onClick={() =>
                          patch({
                            services: config.services.filter(
                              (x) => x.id !== p.id,
                            ),
                          })
                        }
                      >
                        メニューを削除
                      </button>
                    </div>
                  ))}
                  <button
                    className={s.secondary}
                    style={{ marginTop: 20 }}
                    disabled={config.services.length >= 50}
                    onClick={() =>
                      patch({
                        services: [
                          ...config.services,
                          {
                            id: crypto.randomUUID(),
                            name: "",
                            duration: 60,
                            buffer: 15,
                            price: 0,
                            staffIds: config.staff.map((x) => x.id),
                            resourceIds: [],
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={16} /> メニューを追加
                  </button>
                </section>
              </div>
              <aside className={`${s.card} ${s.summary}`} hidden={guided && guideStep !== 4}>
                <h2>受付ルール</h2>
                <label className={s.check}>
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => patch({ enabled: e.target.checked })}
                  />
                  オンライン予約を受け付ける
                </label>
                <div className={s.section}>
                  <label className={s.field}>
                    開始時刻の間隔
                    <select
                      value={config.step}
                      onChange={(e) => patch({ step: Number(e.target.value) })}
                    >
                      {[5, 10, 15, 20, 30, 60].map((n) => (
                        <option value={n} key={n}>
                          {n}分
                        </option>
                      ))}
                    </select>
                  </label>
                  {(["leadMinutes", "advanceDays", "cancelHours"] as const).map(
                    (key) => (
                      <label className={s.field} key={key}>
                        {key === "leadMinutes"
                          ? "何分前まで予約できるか"
                          : key === "advanceDays"
                            ? "何日先まで予約できるか"
                            : "何時間前まで変更・キャンセルできるか"}
                        <input
                          type="number"
                          min={key === "advanceDays" ? 1 : 0}
                          max={
                            key === "leadMinutes"
                              ? 10080
                              : key === "advanceDays"
                                ? 180
                                : 168
                          }
                          value={config[key]}
                          onChange={(e) =>
                            patch({ [key]: Number(e.target.value) })
                          }
                        />
                      </label>
                    ),
                  )}
                </div>
                <p className={s.small}>
                  予約は即時確定・来店時のお支払いです。設定変更で既存の予約は変更されません。今後の予約がある担当者・設備・メニューは削除できません。
                </p>
                <button
                  className={`${s.button} ${s.wide}`}
                  disabled={busy || (!dirty && version > 0)}
                  onClick={save}
                >
                  {busy ? "保存しています…" : "設定を保存"}
                </button>
                <p className={s.small}>
                  {dirty ? "未保存の変更があります" : "保存した設定を表示中"}
                </p>
                <p className={s.small}>
                  保存後は「サイトに設置・共有」から予約ボタンの設置と公開状態を確認できます。
                </p>
                <button className={`${s.secondary} ${s.wide}`} disabled={dirty || !version} onClick={() => setTab("share")}>サイトへの設置へ進む</button>
              </aside>
            </div>
            {guided && <div className={s.setupFooter}>
              <button className={s.secondary} disabled={guideStep === 0} onClick={() => setGuideStep(i => i-1)}>戻る</button>
              <span>{guideStep + 1} / {steps.length}・{steps[guideStep]}<small>最後にまとめて保存します</small></span>
              {guideStep < 4 && <button className={s.button} onClick={() => setGuideStep(i => i+1)}>次へ</button>}
            </div>}
            </>
          )}
        </div>
      </fieldset>
    </main>
  );
}
