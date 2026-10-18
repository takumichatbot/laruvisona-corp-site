/**
 * 待ちの取り出し（selectDue）を、本物の PostgreSQL 16 + PostgREST 12 に対して確かめる（手元専用。本番・Supabase には繋がない）。
 * 偽 DB だけが受け付ける書き方になっていないこと（->> の並べ替え・nullsfirst・id の安定順・limit の順）を見る。
 *   PGRST_URL=http://127.0.0.1:55433 node --import ./tests/_resolve-ts.mjs tests/http/retry-selection-postgrest-check.ts
 */
import { PostgrestClient } from '@supabase/postgrest-js';
import { selectDue, RECOVERY_KEY, ENT_KEY, RETRY_BATCH } from '../../lib/hp-entitlement-sync';

const db = new PostgrestClient(process.env.PGRST_URL || 'http://127.0.0.1:55433');
const now = new Date('2026-10-18T00:00:00.000Z');
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail?: unknown) => { if (ok) pass++; else fail++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok ? '' : ' ' + JSON.stringify(detail)}`); };

(async () => {
  // 前と同じ取り出し方（並べ替えなしで 200 件 → あとで時刻判定）だと、期限到来の 201 件目は入らない（物理順で最後に入れてある）
  const old = await db.from('sites').select('id, settings_json').eq(`settings_json->${RECOVERY_KEY}->>state`, 'pending').limit(200);
  const oldDue = ((old.data ?? []) as Array<{ settings_json: Record<string, { next_at?: string }> }>).filter((s) => { const n = s.settings_json[RECOVERY_KEY]?.next_at; return !n || Date.parse(n) <= now.getTime(); });
  console.log(`参考（修正前の取り出し）：200 件中 期限到来 ${oldDue.length} 件`);

  const r = await selectDue(db, RECOVERY_KEY, 'state', 'pending', 'first_at', now);
  const ids = r.rows.map((x) => x.id);
  check('復帰待ち：next_at なし（先頭）と、期限到来の 201 件目を取り出す・時刻前は入れない', ids.length === 2 && ids[0] === '00000000-0000-4000-8000-100000000001' && ids[1] === '00000000-0000-4000-8000-000000000200', ids);
  check('復帰待ち：state が pending でない行は入れない・more=false', !ids.includes('00000000-0000-4000-8000-100000000002') && r.more === false, r.more);

  const e = await selectDue(db, ENT_KEY, 'status', 'pending', 'first_failed_at', now);
  check('権利の控え：前の 50 件が時刻前でも、期限到来の 51 件目を取り出す', e.rows.length === 1 && e.rows[0].id === '00000000-0000-4000-9000-000000000050', e.rows.map((x) => x.id));

  // 期限が来たのが 20 件を超える：期限の早い順 → 同じ時刻は id 順で 20 件。more=true
  const late = new Date('2026-10-18T07:00:00.000Z');
  const a = await selectDue(db, RECOVERY_KEY, 'state', 'pending', 'first_at', late);
  const b = await selectDue(db, RECOVERY_KEY, 'state', 'pending', 'first_at', late);
  const want = ['00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-000000000200', ...Array.from({ length: RETRY_BATCH - 2 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)];
  check('20 件超：期限の早い順・同じ時刻は id 順で 20 件・more=true', JSON.stringify(a.rows.map((x) => x.id)) === JSON.stringify(want) && a.more === true, a.rows.map((x) => x.id).slice(0, 4));
  check('同じ条件で読み直しても同じ順（安定）', JSON.stringify(a.rows.map((x) => x.id)) === JSON.stringify(b.rows.map((x) => x.id)));
  console.log(`${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
})();
