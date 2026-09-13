"use client";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ArrowLeft } from "lucide-react";
import {
  dateLabel,
  jstDay,
  tokenPattern,
  uuidPattern,
  type Service,
} from "@/lib/scheduling/config";
import s from "./scheduling.module.css";
type Config = {
  version: number;
  services: Service[];
  staff: { id: string; name: string }[];
  advanceDays: number;
  cancelHours: number;
};
export type Appointment = {
  id: string;
  service_id: string;
  service_name: string;
  staff_id: string;
  staff_name: string;
  resource_name: string | null;
  starts_at: string;
  ends_at: string;
  price: number;
  name: string;
  email: string;
  phone: string;
  status: string;
  revision: number;
};
type Result = {
  notified?: boolean;
  config?: Config;
  slots?: { startsAt: string; endsAt: string }[];
  appointment?: Appointment;
  error?: string;
};
async function request(url: string, options?: RequestInit): Promise<Result> {
  const r = await fetch(url, { ...options, cache: "no-store" });
  const d = await r.json();
  if (!r.ok) {
    const e = new Error(d.error || "通信できませんでした") as Error & {
      definite?: boolean;
    };
    e.definite =
      r.status === 400 ||
      r.status === 404 ||
      r.status === 409 ||
      r.status === 429;
    throw e;
  }
  return d;
}
export default function PublicBooking({
  siteId,
  name,
  home,
}: {
  siteId: string;
  name: string;
  home: string;
}) {
  const [config, setConfig] = useState<Config | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [serviceId, setServiceId] = useState(""),
    [staffId, setStaffId] = useState(""),
    [day, setDay] = useState(jstDay()),
    [slots, setSlots] = useState<{ startsAt: string; endsAt: string }[]>([]),
    [selected, setSelected] = useState("");
  const [uncertain, setUncertain] = useState(false),
    [notifyFailed, setNotifyFailed] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false),
    [form, setForm] = useState({ name: "", email: "", phone: "" }),
    [appointment, setAppointment] = useState<Appointment | null>(null),
    [changing, setChanging] = useState(false),
    [manage, setManage] = useState<{ id: string; token: string } | null>(null),
    [copied, setCopied] = useState(false);
  const intent = useRef<{
      fingerprint: string;
      clientKey: string;
      token: string;
    } | null>(null),
    sent = useRef(false),
    sequence = useRef(0);
  const base = "/api/hp/scheduling",
    storageKey = "laruhp-booking-pending:" + siteId;
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    const hash = new URLSearchParams(location.hash.slice(1));
    const id = hash.get("booking") || "",
      token = hash.get("key") || "";
    const boot = async () => {
      try {
        let saved = null;
        try {
          saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
        } catch {}
        if (
          !id &&
          saved &&
          tokenPattern.test(saved.token) &&
          uuidPattern.test(saved.clientKey)
        ) {
          // Recover a response lost in transit before allowing another reservation.
          intent.current = saved;
          pending.current = true;
          setUncertain(true);
          const restored = await request(base, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              siteId,
              action: "recover",
              clientKey: saved.clientKey,
              token: saved.token,
            }),
          });
          if (restored.appointment) {
            const key = { id: restored.appointment.id, token: saved.token };
            if (active) {
              setAppointment(restored.appointment);
              setManage(key);
              history.replaceState(
                null,
                "",
                location.pathname +
                  "#" +
                  new URLSearchParams({ booking: key.id, key: key.token }),
              );
              setUncertain(false);
              pending.current = false;
            }
            sessionStorage.removeItem(storageKey);
          } else {
            const f = JSON.parse(saved.fingerprint);
            if (active) {
              setForm({ name: f.name, email: f.email, phone: f.phone });
              setServiceId(f.serviceId);
              setStaffId(f.staffId);
              setSelected(f.startsAt);
              setDay(jstDay(new Date(f.startsAt)));
            }
          }
        }

        if (uuidPattern.test(id) && tokenPattern.test(token)) {
          const d = await request(base, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify({ siteId, id, action: "lookup" }),
          });
          if (active) {
            setAppointment(d.appointment!);
            setManage({ id, token });
            setServiceId(d.appointment!.service_id);
          }
        }
        const d = await request(base + "?siteId=" + siteId);
        if (active) {
          setConfig(d.config!);
          if (!id && !pending.current)
            setServiceId(d.config!.services[0]?.id || "");
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void boot();
    return () => {
      active = false;
    };
  }, [siteId, storageKey]);
  useEffect(() => {
    if (!config || !serviceId || uncertain || (appointment && !changing))
      return;
    let active = true;
    const seq = ++sequence.current;
    setSelected("");
    setSlots([]);
    setSlotLoading(true);
    setError("");
    const q = new URLSearchParams({ siteId, day, serviceId, staffId });
    if (manage) q.set("appointmentId", manage.id);
    request(base + "?" + q, {
      headers: manage ? { Authorization: "Bearer " + manage.token } : undefined,
    })
      .then((d) => {
        if (active && seq === sequence.current) setSlots(d.slots || []);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setSlotLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    siteId,
    config,
    serviceId,
    staffId,
    day,
    appointment,
    changing,
    manage,
    uncertain,
  ]);
  const service = config?.services.find((x) => x.id === serviceId);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sent.current || !selected) return;
    sent.current = true;
    setBusy(true);
    setError("");
    try {
      let data: Result;
      if (changing && manage && appointment) {
        data = await request(base, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + manage.token,
          },
          body: JSON.stringify({
            siteId,
            id: manage.id,
            action: "reschedule",
            revision: appointment.revision,
            startsAt: selected,
            staffId,
          }),
        });
      } else {
        const input =
            uncertain && intent.current
              ? JSON.parse(intent.current.fingerprint)
              : {
                  ...form,
                  serviceId,
                  staffId,
                  startsAt: selected,
                  configVersion: config!.version,
                },
          fingerprint = JSON.stringify(input);
        if (!intent.current || intent.current.fingerprint !== fingerprint)
          intent.current = {
            fingerprint,
            clientKey: crypto.randomUUID(),
            token: Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
              x.toString(16).padStart(2, "0"),
            ).join(""),
          };
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(intent.current));
        } catch {
          throw Object.assign(
            new Error(
              "予約結果を保護するため、ブラウザのサイトデータ保存を許可してからお試しください",
            ),
            { definite: true },
          );
        }
        pending.current = true;
        data = await request(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId,
            action: "reserve",
            ...input,
            clientKey: intent.current.clientKey,
            token: intent.current.token,
          }),
        });
        const key = { id: data.appointment!.id, token: intent.current.token };
        setManage(key);
        history.replaceState(
          null,
          "",
          location.pathname +
            "#" +
            new URLSearchParams({ booking: key.id, key: key.token }),
        );
      }
      sessionStorage.removeItem(storageKey);
      pending.current = false;
      setAppointment(data.appointment!);
      setChanging(false);
      setUncertain(false);
      setNotifyFailed(data.notified === false);
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (e) {
      const known = (e as Error & { definite?: boolean }).definite;
      setUncertain(!known);
      if (known) {
        sessionStorage.removeItem(storageKey);
        pending.current = false;
      }
      setError(
        known
          ? (e as Error).message
          : "予約結果を確認できません。入力を変えずに、同じ内容で再確認してください。二重には作成しません。",
      );
    } finally {
      sent.current = false;
      setBusy(false);
    }
  }
  async function cancel() {
    if (
      !manage ||
      !appointment ||
      busy ||
      !confirm("この予約をキャンセルしますか？")
    )
      return;
    setBusy(true);
    setError("");
    try {
      const d = await request(base, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + manage.token,
        },
        body: JSON.stringify({
          siteId,
          id: manage.id,
          action: "cancel",
          revision: appointment.revision,
        }),
      });
      setAppointment(d.appointment!);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={s.shell}>
      <div className={s.container}>
        <header className={s.header}>
          <div>
            <p className={s.eyebrow}>{name}</p>
            <h1 className={s.title}>ご予約</h1>
            <p className={s.intro}>
              メニューと空き時間を選んで、ご予約いただけます。
            </p>
          </div>
          <a href={home} className={s.link}>
            <ArrowLeft size={14} /> サイトに戻る
          </a>
        </header>
        {error && (
          <div role="alert" className={`${s.notice} ${s.error}`}>
            {error}
          </div>
        )}
        {loading ? (
          <div className={s.loading}>空き状況を確認しています…</div>
        ) : appointment && !changing ? (
          <section className={`${s.card} ${s.success}`}>
            <Check size={32} />
            <h2>
              {appointment.status === "canceled"
                ? "キャンセルしました"
                : "ご予約が確定しています"}
            </h2>
            <p>{dateLabel(appointment.starts_at)}</p>
            <p>
              {appointment.service_name} ／ {appointment.staff_name}
            </p>
            <p>{appointment.name} 様</p>
            <p className={s.small}>
              料金 {appointment.price.toLocaleString()}
              円・お支払いはご来店時です。
            </p>
            {notifyFailed && (
              <p role="status" className={s.notice}>
                予約は確定しましたが、確認メールの送信は確認できていません。この確認リンクを必ず保存してください。
              </p>
            )}
            <div className={s.notice}>
              このページが予約の確認・変更画面です。確認リンクを保存してください。リンクを知っている方は予約を変更できるため、他の方へ共有しないでください。
            </div>
            <button
              className={s.secondary}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.href);
                  setCopied(true);
                } catch {
                  setError(
                    "ブラウザの共有機能で、このページのURLを保存してください",
                  );
                }
              }}
            >
              {copied ? "コピーしました" : "確認リンクをコピー"}
            </button>
            {appointment.status === "confirmed" && (
              <div className={`${s.row} ${s.section}`}>
                <button
                  className={s.button}
                  disabled={busy || !config}
                  onClick={() => {
                    setServiceId(appointment.service_id);
                    setStaffId(appointment.staff_id);
                    setDay(jstDay(new Date(appointment.starts_at)));
                    setChanging(true);
                  }}
                >
                  日時を変更する
                </button>
                <button
                  className={`${s.secondary} ${s.danger}`}
                  disabled={busy}
                  onClick={cancel}
                >
                  キャンセルする
                </button>
              </div>
            )}
            <p className={s.small}>
              オンライン変更・キャンセルは開始{config?.cancelHours ?? 24}
              時間前まで。期限後はお店へ直接ご連絡ください。
            </p>
          </section>
        ) : config ? (
          <form onSubmit={submit} className={s.grid}>
            <div>
              <section className={s.card}>
                <h2>1. メニューを選ぶ</h2>
                <div className={s.services}>
                  {config.services
                    .filter(
                      (x) => !changing || x.id === appointment?.service_id,
                    )
                    .map((x) => (
                      <button
                        type="button"
                        key={x.id}
                        className={s.choice}
                        disabled={busy || uncertain}
                        aria-pressed={serviceId === x.id}
                        onClick={() => {
                          setServiceId(x.id);
                          setStaffId("");
                        }}
                      >
                        <span>
                          <strong>{x.name}</strong>
                          <small>{x.duration}分</small>
                        </span>
                        <span>{x.price.toLocaleString()}円</span>
                      </button>
                    ))}
                </div>
              </section>
              <section className={s.card}>
                <h2>2. 担当者と日時</h2>
                <label className={s.field}>
                  担当者
                  <select
                    value={staffId}
                    disabled={busy || uncertain}
                    onChange={(e) => setStaffId(e.target.value)}
                  >
                    <option value="">指名なし（空いている担当者）</option>
                    {config.staff
                      .filter((x) => service?.staffIds.includes(x.id))
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className={s.field}>
                  日付（日本時間）
                  <input
                    type="date"
                    required
                    value={day}
                    min={jstDay()}
                    max={jstDay(
                      new Date(Date.now() + config.advanceDays * 86400000),
                    )}
                    disabled={busy || uncertain}
                    onChange={(e) => {
                      if (e.target.value) setDay(e.target.value);
                    }}
                  />
                </label>
                <div aria-live="polite">
                  {slotLoading ? (
                    <p className={s.empty}>空き時間を確認しています…</p>
                  ) : slots.length ? (
                    <div className={s.slots}>
                      {slots.map((x) => (
                        <button
                          type="button"
                          key={x.startsAt}
                          className={s.slot}
                          disabled={busy || uncertain}
                          aria-pressed={selected === x.startsAt}
                          onClick={() => setSelected(x.startsAt)}
                        >
                          {new Date(x.startsAt).toLocaleTimeString("ja-JP", {
                            timeZone: "Asia/Tokyo",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className={s.empty}>
                      この日の空き枠はありません。
                      <br />
                      別の日付・担当者をお選びください。
                    </p>
                  )}
                </div>
              </section>
              {!changing && (
                <section className={s.card}>
                  <h2>3. お客様情報</h2>
                  <label className={s.field}>
                    お名前（必須）
                    <input
                      required
                      autoComplete="name"
                      maxLength={100}
                      disabled={busy || uncertain}
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </label>
                  <label className={s.field}>
                    メールアドレス（必須）
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      maxLength={254}
                      disabled={busy || uncertain}
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </label>
                  <label className={s.field}>
                    電話番号（任意）
                    <input
                      type="tel"
                      autoComplete="tel"
                      maxLength={40}
                      disabled={busy || uncertain}
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </label>
                </section>
              )}
            </div>
            <aside className={`${s.card} ${s.summary}`}>
              <CalendarDays size={22} />
              <h2 style={{ marginTop: 16 }}>ご予約内容</h2>
              <dl>
                <dt>メニュー</dt>
                <dd>{service?.name || "未選択"}</dd>
                <dt>日時</dt>
                <dd>
                  {selected ? dateLabel(selected) : "空き時間を選んでください"}
                </dd>
                <dt>料金</dt>
                <dd>
                  {(appointment?.price ?? service?.price ?? 0).toLocaleString()}
                  円<br />
                  <small>来店時のお支払い</small>
                </dd>
              </dl>
              <p className={s.small}>
                変更・キャンセルは開始{config.cancelHours}
                時間前まで。設備は必要に応じて自動で確保されます。
              </p>
              <button
                className={`${s.button} ${s.wide}`}
                disabled={busy || !selected || slotLoading}
              >
                {busy
                  ? "予約を確認しています…"
                  : uncertain
                    ? "同じ内容で予約結果を確認"
                    : changing
                      ? "この日時に変更する"
                      : "この内容で予約を確定"}
              </button>
              {changing && (
                <button
                  type="button"
                  className={`${s.secondary} ${s.wide}`}
                  style={{ marginTop: 12 }}
                  disabled={busy}
                  onClick={() => setChanging(false)}
                >
                  変更せず戻る
                </button>
              )}
            </aside>
          </form>
        ) : null}
      </div>
    </main>
  );
}
