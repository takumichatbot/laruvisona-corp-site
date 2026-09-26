import { track } from './analytics';

/*
  LARU HP の申込みまでの流れを GA4 で追うためのイベント（2026-09-26）。

    訪問（page_view・自動） → site_create → sign_up → publish_attempt
      → begin_checkout → purchase_complete → publish

  - 送るのは、事業の判断に要る最小限の属性だけ（業種・プラン・支払い周期・方法）。
    メールアドレス・氏名・電話・住所・サイトの中身は送らない。
    流入元（source / medium / campaign）は GA4 がセッションに自動で付けるので、
    イベントに重ねて送らない（二重の定義になり、食い違ったときにどちらが正か分からなくなる）。
  - 「画面を開いただけ」「再描画」で成果イベントが再送されないよう、
    1回きりのものは trackOnce で鍵を持つ。ボタン1回=1イベントのものは、
    呼び出し側がすでに持っている二重押し防止の内側で呼ぶ。
*/

type Params = Record<string, string | number | boolean | undefined>;

function clean(params?: Params): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * 同じ鍵では1回しか送らない。
 * persist=true は端末に残す（再訪問・再読み込みでも送らない。購入完了など）。
 * 既定はタブの中だけ（同じ画面の再描画・StrictMode の二重実行を防ぐ）。
 * 保存できない環境では「送らない」ほうに倒す（過大計測より過小計測を選ぶ）。
 */
export function trackOnce(event: string, key: string, params?: Params, persist = false): boolean {
  if (typeof window === 'undefined') return false;
  const storageKey = `lv_ev:${event}:${key}`;
  try {
    const store = persist ? window.localStorage : window.sessionStorage;
    if (store.getItem(storageKey)) return false;
    store.setItem(storageKey, '1');
  } catch {
    return false;
  }
  track(event, clean(params));
  return true;
}

export function trackSiteCreate(siteId: string, industry?: string) {
  trackOnce('site_create', siteId, { industry });
}

/** 「公開する」を押した1回ぶん。結果（成功・プランが必要・失敗）は outcome で分ける。 */
export function trackPublishAttempt(outcome: 'published' | 'plan_required' | 'error', params?: Params) {
  track('publish_attempt', clean({ outcome, ...params }));
}

/** 公開できた1回ぶん（出し直しも含む。人数で見るときは GA4 のユーザー数で数える）。 */
export function trackPublish(params?: Params) {
  track('publish', clean(params));
}

/** Stripe の決済画面へ実際に移る直前にだけ送る（ログインへ回り道した分は数えない）。 */
export function trackBeginCheckout(plan?: string, billing?: string) {
  track('begin_checkout', clean({ plan, billing }));
}

/**
 * 決済から戻った画面で1回だけ。戻り先は dashboard / studio / builder の3つあり、
 * どこも ?payment=success で開く。再読み込みで重ねないよう端末に鍵を残す。
 * 鍵は戻ってきたURLと日付。同じ日の再読み込みは重ねず、
 * 解約後に別の日に契約し直した分は数える。
 */
export function trackPurchaseComplete() {
  if (typeof window === 'undefined') return;
  const key = `${window.location.pathname}${window.location.search}:${new Date().toISOString().slice(0, 10)}`;
  trackOnce('purchase_complete', key, undefined, true);
}
