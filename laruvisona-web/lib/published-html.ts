/*
  公開HTML（published_html）を配信ページへ差し込む前の手当て。

  published_html は「1枚で完結する文書」として作られている
  （lib/html-export.ts）。顧客が書き出して自分のサーバーに置ける形なので、
  <head> に title・description・og:・twitter:・canonical が入っている。
  これは書き出し（app/api/sites/[id]/export-html）では正しい。

  ところが laruvisona.jp/hp/<slug> では、その文書を丸ごと
  <div dangerouslySetInnerHTML> に入れている（components/PublishedSite.tsx）。
  <html>・<head>・<body> のタグ自体は断片の解釈で落ちるが、
  **中身のタグは残る。** 結果、配信ページの <body> に meta が13個並び、
  配信ページ自身が <head> に出しているものと二重になる。

  2026-09-18 に本番で確かめた（テストECショップ）:

    head の og:image … /hp/<slug>/opengraph-image?…   ← 自動生成のカード（正しい）
    body の og:image … 別のUnsplash画像               ← 焼き込みの古い値

  同じページが2つの og:image を名乗っている。head だけ読む取得器は
  正しいほうを見るが、文書全体を正規表現で拾う取得器は後ろを取る。
  canonical も同じ形で二重に出ており、独自ドメインで公開している人では
  **body 側だけが laruvisona.jp を指す**（焼き込み時点の値のため）。

  見た目には何も出ないので、誰も気づかない。

  ここでは配信のときだけ、head 相当の位置にある「文書の身元を名乗るタグ」と
  「計測タグ（GA / Clarity）」を落とす。<style> と、それ以外の <script> は
  落とさない（見た目と動きがそれで決まる）。
  published_html そのものは書き換えない。書き出しは今までどおり完全な文書。
*/

/** 落とすのは、配信ページ自身が <head> で出しているものだけ。 */
const DUPLICATE_TAGS: RegExp[] = [
  /<title\b[^>]*>[\s\S]*?<\/title>\s*/gi,
  /<meta\b[^>]*\bname\s*=\s*["']?(?:description|robots|keywords)["']?[^>]*>\s*/gi,
  /<meta\b[^>]*\bproperty\s*=\s*["']?og:[^"'\s>]*["']?[^>]*>\s*/gi,
  /<meta\b[^>]*\bname\s*=\s*["']?twitter:[^"'\s>]*["']?[^>]*>\s*/gi,
  /<link\b[^>]*\brel\s*=\s*["']?canonical["']?[^>]*>\s*/gi,
  /*
    計測タグも二重になっていた（2026-09-19 に確認）。

    書き出し用の <head> には GA（gtag の読み込み＋config）と Clarity が
    焼き込まれている。一方、配信ページ（app/hp/[slug]/page.tsx）も
    settings_json を読んで**同じタグをその場で出す。**
    結果、1回の表示で gtag('config') が2回走り、**ページビューが2倍に数えられる。**
    さらに、計測IDを変えて保存しても、公開し直すまで**古いIDに送り続ける。**

    配信ページ側が正なので、焼き込みのほうを落とす。
    ⚠️ 本文側の gtag('event', …)（フォーム送信・CTA・スクロール深度）は落とさない。
       あれは配信ページが出す gtag を使うので、config が1つになれば正しく動く。
    ⚠️ 書き出し（ダウンロード）は完全な文書のまま。ここは配信のときだけ。
  */
  /<script\b[^>]*\bsrc\s*=\s*["']https:\/\/www\.googletagmanager\.com\/gtag\/js[^"']*["'][^>]*><\/script>\s*/gi,
  /<script\b[^>]*>[^<]*gtag\('config'[^<]*<\/script>\s*/gi,
  /<script\b[^>]*>[^<]*clarity\.ms\/tag[^<]*<\/script>\s*/gi,
];

/**
 * 配信ページに差し込む前に、二重になる身元のタグを落とす。
 *
 * ⚠️ 落とすのは **<body> より前だけ**。本文に同じ形の文字列があっても触らない。
 *   （本文の「<」は書き出しの時点で &lt; になっているので実際には現れないが、
 *     ここで範囲を切らないと、将来そうでなくなったときに本文が壊れる。）
 */
export function stripDuplicateHeadMeta(html: string): string {
  const s = String(html ?? '');
  const bodyAt = s.search(/<body\b/i);
  const head = bodyAt >= 0 ? s.slice(0, bodyAt) : s;
  const rest = bodyAt >= 0 ? s.slice(bodyAt) : '';

  let cleaned = head;
  for (const re of DUPLICATE_TAGS) cleaned = cleaned.replace(re, '');
  return cleaned + rest;
}

/*
  A/Bテストの「勝者を確定」を、公開側に効かせる。

  2026-09-19 に確認: 画面は「勝者として確定し、A/Bテストを終了しました」と言うが、
  公開HTMLに焼き込まれた振り分け script は abWinner を知らず、**確定後も
  50/50 で負けた方を出し続けていた。** しかも公開し直しても直らない。

  振り分け script は lib/html-export.ts が生成する決まった文字列なので、
  配信時にその2箇所だけを置き換える。
    v=Math.random()<0.5?'a':'b'   → v='<勝者>'
    var isNew=!v;                  → var isNew=false;   （集計への送信を止める）
  ⚠️ 本文には触らない。置き換えは <script> の中の、この2つの文字列だけ。
*/
export function applyAbWinner(html: string, winner: unknown): string {
  if (winner !== 'a' && winner !== 'b') return html;
  const s = String(html ?? '');
  if (!s.includes("v=Math.random()<0.5?'a':'b'")) return s;
  return s
    .replace("v=Math.random()<0.5?'a':'b'", `v='${winner}'`)
    .replace('var isNew=!v;', 'var isNew=false;');
}
