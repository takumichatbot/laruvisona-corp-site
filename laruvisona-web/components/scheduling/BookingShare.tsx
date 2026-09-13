"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Download, ExternalLink } from 'lucide-react';
import s from './scheduling.module.css';

export default function BookingShare({ siteId, url, published, enabled, version, dirty, onSettings, onRefresh }: {
  siteId: string; url: string; published: boolean; enabled: boolean;
  version: number; dirty: boolean; onSettings: () => void; onRefresh: () => void;
}) {
  const ready = published && enabled && version > 0 && !dirty;
  const [qr, setQr] = useState<{url: string; data: string} | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    if (ready) void import('qrcode').then(m => m.toDataURL(url, { width: 640, margin: 4, errorCorrectionLevel: 'M' }))
      .then(data => { if (active) setQr({url, data}); })
      .catch(() => { if (active) setNotice('QRコードを作れませんでした。URLをコピーしてご利用ください。'); });
    return () => { active = false; };
  }, [ready, url]);
  return <div className={s.grid}>
    <section className={s.card}>
      <p className={s.eyebrow}>設定の次は、サイトへ</p>
      <h2>予約を受け付ける準備</h2>
      <ul className={s.launchList}>
        <li><span>{version > 0 && !dirty ? <Check size={18}/> : '1'}</span><div><strong>受付の設定を保存</strong><p>{dirty ? '編集した設定がまだ保存されていません。' : version > 0 ? '保存済みです。' : '営業時間・担当者・メニューを設定してください。'}</p><button className={s.secondary} onClick={onSettings}>設定を確認する</button></div></li>
        <li><span>2</span><div><strong>予約ボタンを置いて、サイトを公開</strong><p>制作画面で予約欄を設置し、保存 → 公開してください。すでに公開済みでも、追加した内容は再公開が必要です。</p>
          <Link className={s.button} aria-disabled={dirty} onClick={e => { if (dirty) { e.preventDefault(); setNotice('先に受付の設定を保存してください。'); } }} href={`/laruHP/studio?siteId=${encodeURIComponent(siteId)}&booking=schedule`}>制作画面で予約ボタンを設置</Link>
          <p>{published ? 'サイトは公開済みです。予約ボタンの反映は公開ページで確認してください。' : 'サイトはまだ非公開です。'}</p></div></li>
        <li><span>{enabled && !dirty ? <Check size={18}/> : '3'}</span><div><strong>オンライン受付を開始</strong><p>{enabled && !dirty ? '受付する設定が保存されています。' : '受付ルールで「オンライン予約を受け付ける」を選び、保存してください。'}</p></div></li>
      </ul>
      <button className={s.secondary} onClick={onRefresh}>公開・受付状態を更新</button>
    </section>
    <aside className={`${s.card} ${s.summary}`}>
      <h2>URL・QRでご案内</h2>
      {!ready ? <p className={s.notice}>公開と受付開始が済むと、配布用URLとQRコードを使えます。{dirty && '先に未保存の設定を保存してください。'}</p> : <>
        <label className={s.field}>お客様向けの予約URL<input readOnly value={url} onFocus={e => e.currentTarget.select()}/></label>
        <button className={`${s.button} ${s.wide}`} onClick={async () => {
          try { await navigator.clipboard.writeText(url); setNotice('予約URLをコピーしました'); }
          catch { setNotice('コピーできませんでした。URL欄を選択してコピーしてください。'); }
        }}><Copy size={16}/> URLをコピー</button>
        <a className={`${s.secondary} ${s.wide}`} href={url} target="_blank" rel="noreferrer" style={{marginTop: 12}}><ExternalLink size={16}/>予約ページを確認</a>
        {qr?.url === url && <div className={s.qr}>
          {/* Local PNG, never an external QR service. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.data} width={240} height={240} alt="お客様向け予約ページのQRコード"/>
          <a className={s.secondary} href={qr.data} download="laruhp-booking-qr.png"><Download size={16}/>QR画像を保存</a>
        </div>}
        <p className={s.small}>店頭の案内やSNSに使えます。配布前にスマホで読み取り、正しい店舗の予約ページが開くことを確認してください。独自ドメインを変更したときはQRも作り直してください。</p>
      </>}
      {notice && <p role="status" className={s.notice}>{notice}</p>}
    </aside>
  </div>;
}
