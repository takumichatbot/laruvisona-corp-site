'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Slot {
  id: string;
  datetime: string; // ISO string
  duration: number; // minutes
  label: string;
  available: boolean;
}

interface BookingConfig {
  slots: Slot[];
  bufferMinutes: number;
  maxAdvanceDays: number;
}

interface Site { id: string; name: string; data: { bookingConfig?: BookingConfig } }
interface Booking { id: string; name: string; email: string; phone: string | null; extra_fields: Record<string, string> | null; created_at: string }

const DEFAULT_CONFIG: BookingConfig = { slots: [], bufferMinutes: 15, maxAdvanceDays: 30 };

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatDt(iso: string) {
  const d = new Date(iso);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}(${days[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function newId() { return crypto.randomUUID(); }

export default function BookingPage() {
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [config, setConfig] = useState<BookingConfig>(DEFAULT_CONFIG);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newSlot, setNewSlot] = useState({ date: '', time: '10:00', duration: 60, label: '相談・カウンセリング' });
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('sites').select('id, name, data').eq('user_id', user.id);
    setSites(data ?? []);
    if (data && data.length > 0 && !siteId) setSiteId(data[0].id);
  }, [supabase, siteId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!siteId) return;
    const site = sites.find(s => s.id === siteId);
    setConfig(site?.data?.bookingConfig ?? DEFAULT_CONFIG);
    supabase.from('contacts').select('*').eq('site_id', siteId).eq('type', 'booking').order('created_at', { ascending: false })
      .then(({ data }) => setBookings(data ?? []));
  }, [siteId, sites, supabase]);

  const save = async (cfg: BookingConfig) => {
    if (!siteId) return;
    setSaving(true);
    const site = sites.find(s => s.id === siteId);
    const newData = { ...(site?.data ?? {}), bookingConfig: cfg };
    await supabase.from('sites').update({ data: newData }).eq('id', siteId);
    setSites(prev => prev.map(s => s.id === siteId ? { ...s, data: newData } : s));
    setConfig(cfg);
    setSaving(false);
  };

  const addSlot = () => {
    if (!newSlot.date) return;
    const iso = `${newSlot.date}T${newSlot.time}:00`;
    const slot: Slot = { id: newId(), datetime: iso, duration: newSlot.duration, label: newSlot.label, available: true };
    const updated = { ...config, slots: [...config.slots, slot].sort((a, b) => a.datetime.localeCompare(b.datetime)) };
    save(updated);
    setShowAdd(false);
  };

  const addBulk = (startDate: string, endDate: string, times: string[], duration: number, label: string, excludeWeekends: boolean) => {
    const slots: Slot[] = [];
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      const dow = cur.getDay();
      if (!excludeWeekends || (dow !== 0 && dow !== 6)) {
        for (const t of times) {
          const [h, m] = t.split(':').map(Number);
          const dt = new Date(cur);
          dt.setHours(h, m, 0, 0);
          slots.push({ id: newId(), datetime: dt.toISOString(), duration, label, available: true });
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
    const updated = { ...config, slots: [...config.slots, ...slots].sort((a, b) => a.datetime.localeCompare(b.datetime)) };
    save(updated);
  };

  const toggleSlot = (id: string) => {
    const updated = { ...config, slots: config.slots.map(s => s.id === id ? { ...s, available: !s.available } : s) };
    save(updated);
  };

  const deleteSlot = (id: string) => {
    const updated = { ...config, slots: config.slots.filter(s => s.id !== id) };
    save(updated);
  };

  const takenSlotIds = new Set(bookings.map(b => b.extra_fields?.slot_id).filter(Boolean));

  const today = new Date();
  const upcoming = config.slots.filter(s => new Date(s.datetime) >= today);
  const past = config.slots.filter(s => new Date(s.datetime) < today);

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <div className="border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/laruHP/dashboard" className="text-slate-400 hover:text-white text-sm">← ダッシュボード</Link>
          <h1 className="font-bold text-white">予約枠管理</h1>
          {saving && <span className="text-slate-500 text-xs">保存中...</span>}
          <div className="ml-auto flex items-center gap-3">
            <select value={siteId} onChange={e => setSiteId(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white outline-none">
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6 flex gap-6">
        {/* Main: slot list */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-semibold text-white">予約枠一覧</h2>
            <span className="text-slate-500 text-sm">{upcoming.length}件（今後）</span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setShowAdd(v => !v)}
                className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-all">
                + 枠を追加
              </button>
              <BulkAddButton onAdd={addBulk} />
            </div>
          </div>

          {showAdd && (
            <div className="bg-[#1e293b] border border-white/10 rounded-xl p-4 mb-4">
              <div className="text-sm font-semibold mb-3 text-white">新しい予約枠</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-slate-400 text-xs block mb-1">日付</label>
                  <input type="date" value={newSlot.date} onChange={e => setNewSlot(v => ({ ...v, date: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">時刻</label>
                  <input type="time" value={newSlot.time} onChange={e => setNewSlot(v => ({ ...v, time: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">所要時間（分）</label>
                  <select value={newSlot.duration} onChange={e => setNewSlot(v => ({ ...v, duration: Number(e.target.value) }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none">
                    {[30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d}分</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">ラベル</label>
                  <input type="text" value={newSlot.label} onChange={e => setNewSlot(v => ({ ...v, label: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addSlot} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold transition-all">追加</button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-all">キャンセル</button>
              </div>
            </div>
          )}

          {/* Upcoming slots */}
          <div className="space-y-2 mb-6">
            {upcoming.length === 0 && (
              <div className="text-slate-500 text-sm text-center py-12 border border-dashed border-white/10 rounded-xl">
                予約枠がありません。「+ 枠を追加」から追加してください。
              </div>
            )}
            {upcoming.map(slot => {
              const taken = takenSlotIds.has(slot.id);
              const booking = bookings.find(b => b.extra_fields?.slot_id === slot.id);
              return (
                <div key={slot.id} className={`flex items-center gap-3 p-4 rounded-xl border transition-all
                  ${taken ? 'bg-blue-900/20 border-blue-500/30' : slot.available ? 'bg-white/5 border-white/10' : 'bg-white/5 border-white/10 opacity-50'}`}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: taken ? '#3b82f6' : slot.available ? '#22c55e' : '#6b7280' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{formatDt(slot.datetime)}</span>
                      <span className="text-slate-500 text-xs">{slot.duration}分</span>
                      <span className="text-slate-400 text-xs">{slot.label}</span>
                    </div>
                    {taken && booking && (
                      <button onClick={() => setDetailBooking(booking)} className="text-blue-400 text-xs hover:underline mt-0.5">
                        {booking.name} が予約済み →
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!taken && (
                      <button onClick={() => toggleSlot(slot.id)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${slot.available ? 'border-white/20 text-slate-400 hover:bg-white/10' : 'border-green-500/50 text-green-400 hover:bg-green-900/30'}`}>
                        {slot.available ? '無効化' : '有効化'}
                      </button>
                    )}
                    {!taken && (
                      <button onClick={() => deleteSlot(slot.id)} className="text-red-400/60 hover:text-red-400 text-xs px-2 transition-all">✕</button>
                    )}
                    {taken && <span className="text-xs text-blue-400 font-bold bg-blue-900/30 px-2.5 py-1 rounded-lg border border-blue-500/30">予約済</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Past slots */}
          {past.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-slate-500 text-sm mb-2 hover:text-slate-400">
                過去の枠 ({past.length}件)
              </summary>
              <div className="space-y-1 mt-2">
                {past.slice(-10).map(slot => {
                  const taken = takenSlotIds.has(slot.id);
                  const booking = bookings.find(b => b.extra_fields?.slot_id === slot.id);
                  return (
                    <div key={slot.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] opacity-60">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: taken ? '#3b82f6' : '#374151' }} />
                      <span className="text-slate-400 text-sm">{formatDt(slot.datetime)}</span>
                      <span className="text-slate-600 text-xs">{slot.duration}分</span>
                      {taken && booking && <span className="text-blue-400/60 text-xs">{booking.name}</span>}
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>

        {/* Sidebar: settings + bookings */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* Settings */}
          <div className="bg-[#1e293b] border border-white/10 rounded-xl p-4">
            <div className="font-semibold text-sm mb-3 text-white">設定</div>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs block mb-1">バッファー（前後の空き）</label>
                <select value={config.bufferMinutes}
                  onChange={e => { const c = { ...config, bufferMinutes: Number(e.target.value) }; setConfig(c); save(c); }}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none">
                  {[0, 10, 15, 30, 60].map(m => <option key={m} value={m}>{m}分</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">最大予約可能日数（先）</label>
                <select value={config.maxAdvanceDays}
                  onChange={e => { const c = { ...config, maxAdvanceDays: Number(e.target.value) }; setConfig(c); save(c); }}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none">
                  {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d}日</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Recent bookings */}
          <div className="bg-[#1e293b] border border-white/10 rounded-xl p-4">
            <div className="font-semibold text-sm mb-3 text-white">予約リスト</div>
            {bookings.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-4">まだ予約はありません</div>
            ) : (
              <div className="space-y-2">
                {bookings.slice(0, 10).map(b => {
                  const slotId = b.extra_fields?.slot_id;
                  const slot = config.slots.find(s => s.id === slotId);
                  return (
                    <button key={b.id} onClick={() => setDetailBooking(b)}
                      className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all">
                      <div className="font-semibold text-white text-sm truncate">{b.name}</div>
                      {slot && <div className="text-blue-400/80 text-xs">{formatDt(slot.datetime)}</div>}
                      <div className="text-slate-500 text-xs">{b.email}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking detail modal */}
      {detailBooking && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setDetailBooking(null)}>
          <div className="bg-[#1e293b] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white">{detailBooking.name}</h2>
              <button onClick={() => setDetailBooking(null)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex gap-2"><span className="text-slate-500 w-20">メール</span><a href={`mailto:${detailBooking.email}`} className="text-blue-400 hover:underline">{detailBooking.email}</a></div>
              {detailBooking.phone && <div className="flex gap-2"><span className="text-slate-500 w-20">電話</span><span>{detailBooking.phone}</span></div>}
              {detailBooking.extra_fields?.slot_id && (() => {
                const slot = config.slots.find(s => s.id === detailBooking.extra_fields?.slot_id);
                return slot ? <div className="flex gap-2"><span className="text-slate-500 w-20">予約枠</span><span className="text-blue-300">{formatDt(slot.datetime)} ({slot.duration}分)</span></div> : null;
              })()}
              {detailBooking.extra_fields?.message && <div className="flex gap-2"><span className="text-slate-500 w-20">メッセージ</span><span className="text-slate-300 flex-1">{detailBooking.extra_fields.message}</span></div>}
              <div className="flex gap-2"><span className="text-slate-500 w-20">受付日時</span><span className="text-slate-400 text-xs">{new Date(detailBooking.created_at).toLocaleString('ja-JP')}</span></div>
            </div>
            <a href={`mailto:${detailBooking.email}?subject=ご予約確定のお知らせ`}
              className="w-full block text-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all">
              メールで返信する →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function BulkAddButton({ onAdd }: { onAdd: (s: string, e: string, t: string[], d: number, l: string, ex: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    startDate: '', endDate: '', times: '09:00,10:00,11:00,14:00,15:00,16:00',
    duration: 60, label: '相談・カウンセリング', excludeWeekends: true,
  });

  const handleAdd = () => {
    if (!form.startDate || !form.endDate) return;
    onAdd(form.startDate, form.endDate, form.times.split(',').map(t => t.trim()).filter(Boolean), form.duration, form.label, form.excludeWeekends);
    setOpen(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="text-sm px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all">一括追加</button>
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="bg-[#1e293b] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-white mb-4">一括追加</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs block mb-1">開始日</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" />
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">終了日</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-xs block mb-1">時刻（カンマ区切り）</label>
            <input type="text" value={form.times} onChange={e => setForm(f => ({ ...f, times: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs block mb-1">所要時間</label>
              <select value={form.duration} onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none">
                {[30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d}分</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">ラベル</label>
              <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.excludeWeekends} onChange={e => setForm(f => ({ ...f, excludeWeekends: e.target.checked }))}
              className="w-4 h-4 rounded accent-blue-500" />
            <span className="text-slate-400 text-sm">土日を除く</span>
          </label>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleAdd} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all">一括追加</button>
          <button onClick={() => setOpen(false)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl text-sm transition-all">キャンセル</button>
        </div>
      </div>
    </div>
  );
}
