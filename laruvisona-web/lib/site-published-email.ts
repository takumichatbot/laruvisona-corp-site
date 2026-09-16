import { escapeEmailHtml } from './scheduled-email';

/**
 * はじめてサイトを公開したときに本人へ送る便り。
 *
 * これが無かった。公開ボタンを押すと画面にURLが出るだけで、
 * タブを閉じたら自分のサイトがどこにあるのか分からなくなる。
 * 人に見せるにも、あとで自分で開くにも、手元に残るものが要る。
 *
 * 文面を作るところだけを切り出してある（送信は呼び出し側）。
 */
export function sitePublishedEmail(input: { siteName: string; url: string }) {
  const name = escapeEmailHtml(input.siteName || 'あなたのサイト');
  const url = escapeEmailHtml(input.url);
  return {
    subject: `【LARU HP】${input.siteName || 'サイト'}を公開しました`,
    html: `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:36px 40px">
      <div style="font-size:16px;font-weight:900;color:white;letter-spacing:-0.5px;margin-bottom:16px">LARU<span style="font-weight:300">HP</span></div>
      <h1 style="color:white;font-size:22px;font-weight:800;margin:0">サイトを公開しました</h1>
    </div>
    <div style="padding:36px 40px">
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px">${name} が、いまインターネットで見られる状態になりました。</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px 24px;margin-bottom:28px">
        <div style="color:#0369a1;font-size:13px;font-weight:600;margin-bottom:6px">サイトのURL</div>
        <a href="${url}" style="color:#0f172a;font-size:15px;font-weight:700;text-decoration:none;word-break:break-all">${url}</a>
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 20px">
        名刺やSNS、お店の張り紙にこのURLを載せてください。<br>
        中身はいつでも直せます。直したあと「公開」を押すと、その場で反映されます。
      </p>
      <a href="${escapeEmailHtml(process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp')}/laruHP/dashboard" style="display:block;text-align:center;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;font-weight:800;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;margin-bottom:20px">ダッシュボードを開く →</a>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">ご不明な点は <a href="mailto:info@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">info@laruvisona.jp</a> までどうぞ</p>
    </div>
  </div>
</body></html>`,
  };
}
