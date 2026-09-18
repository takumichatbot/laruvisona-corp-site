'use client';
import { useEffect, useState } from 'react';
import {
  SEO_STATE_LABEL, seoNextAction, seoPublishedCount, seoQuota, formatSeoDateTime,
  type SeoDisplayState,
} from '@/lib/larubot-seo';

/*
  LARU SEO の様子を1枚だけ出す。

  ⚠️ 数えているのはこちらではない。記事数も未使用キーワードも枠も、
     すべて LARUbot の status をそのまま出す（2026-09-18 の取り決め）。
  ⚠️ 連携していない人には **何も出さない。** SEOを契約していない人の
     画面に、意味の分からない枠が増えないようにする。
  ⚠️ 開くたびに1回だけ聞く。ポーリングしない。
*/

interface SeoStatus {
  linked: boolean;
  reachable?: boolean;
  state: SeoDisplayState;
  label: string;
  seo?: Record<string, unknown> | null;
}

const TONE: Record<string, string> = {
  waiting: 'bg-sky-50 text-sky-700 border-sky-200',
  no_keywords: 'bg-amber-50 text-amber-800 border-amber-200',
  quota_reached: 'bg-amber-50 text-amber-800 border-amber-200',
  stopped: 'bg-gray-100 text-gray-600 border-gray-300',
  failed: 'bg-red-50 text-red-700 border-red-200',
  draft: 'bg-amber-50 text-amber-800 border-amber-200',
  unknown: 'bg-gray-100 text-gray-600 border-gray-300',
};

export default function SeoStatusCard({ siteId }: { siteId: string | null }) {
  const [status, setStatus] = useState<SeoStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!siteId) return () => { alive = false; };
    /*
      前のサイトの状態を出したままにしない。
      効果の中で同期に消すと描画が二重になるので、取得の結果で入れ替える。
    */
    fetch(`/api/sites/${siteId}/seo-status`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => { if (alive) { setStatus(d as SeoStatus); setFailed(false); } })
      .catch(() => { if (alive) { setStatus(null); setFailed(true); } });
    return () => { alive = false; };
  }, [siteId]);

  // 連携していない人の画面は、これまでどおり何も変えない
  if (failed || !status || !status.linked) return null;

  /*
    届かなかったことを、届いて0件だったことと混ぜない。
    ここで「0本」と出すと、動いていないのに動いている顔をする。
  */
  if (status.reachable === false) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <h2 className="font-bold text-sm text-gray-900 mb-1">LARU SEO</h2>
        <p className="text-xs text-gray-500">いまの状態を確認できませんでした。時間をおいて開き直してください。</p>
      </div>
    );
  }

  const seo = status.seo ?? null;
  const published = seoPublishedCount(seo);
  const quota = seoQuota(seo);
  const nextRun = formatSeoDateTime((seo as Record<string, unknown> | null)?.next_run_at);
  const action = seoNextAction(status.state, seo);
  const label = status.label || SEO_STATE_LABEL[status.state];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-bold text-sm text-gray-900">LARU SEO</h2>
        <span className="text-xs text-gray-500">
          公開 <strong className="text-gray-900 text-sm">{published}</strong> 本
        </span>
      </div>

      <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold mb-3 ${TONE[status.state] ?? TONE.unknown}`}>
        {label}
      </div>

      <dl className="text-xs text-gray-600 space-y-1 mb-3">
        <div className="flex gap-2">
          <dt className="text-gray-500 w-20 flex-shrink-0">次回の生成</dt>
          <dd className="text-gray-900">{nextRun || '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-gray-500 w-20 flex-shrink-0">今月の枠</dt>
          <dd className="text-gray-900">{quota ? `${quota.used} / ${quota.limit} 本` : '—'}</dd>
        </div>
      </dl>

      {action && <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">{action}</p>}
    </div>
  );
}
