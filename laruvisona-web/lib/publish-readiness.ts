/**
 * 公開前の確認を、制作画面（スタジオ）と編集画面（ビルダー）で1つにそろえる。
 *
 * これまで2画面で別々に持っていた:
 *  - スタジオ側 … 店名・説明文・写真・例文の残り・連絡欄・届け先・節の数（7項目）
 *  - ビルダー側 … Stripe価格IDの未設定と、予約ブロックの重複（2項目）
 * 同じサイトでも、どちらの画面で開いたかによって「準備できている」の意味が
 * 変わってしまっていた。ここに寄せて、両方から同じ関数を呼ぶ。
 *
 * 段階は2つだけ。
 *  must   … 直さずに公開すると、来た人に実害が出る（連絡が届かない、
 *           ボタンが出ない、例文が公開される）
 *  better … 直したほうが良いが、公開できないほどではない
 *
 * 判定はデータだけを見る。外部への問い合わせはしない（画面を止めないため）。
 */
import type { Page } from '@/types/laruHP';

export type ReadyLevel = 'must' | 'better';

export interface ReadyItem {
  id: string;
  ok: boolean;
  level: ReadyLevel;
  /** 何が確認できているか（短く） */
  label: string;
  /** いまの状態、または直し方 */
  detail: string;
}

export interface ReadyInput {
  name: string;
  pages: Page[];
  notifyEmail?: string | null;
}

/** 例文のまま残りやすい言い回し */
const PLACEHOLDER = /ここに|入力してください|サンプル|見出しを入力|商品名を入力/;

function d(block: { data?: unknown }): Record<string, unknown> {
  return (block.data ?? {}) as Record<string, unknown>;
}

export function checkPublishReadiness(input: ReadyInput): ReadyItem[] {
  const pages = input.pages ?? [];
  const blocks = pages.flatMap(p => p.blocks ?? []);
  const firstPage = pages[0];
  const text = JSON.stringify(blocks);
  const items: ReadyItem[] = [];

  // ── must ───────────────────────────────────────────────
  items.push({
    id: 'name',
    ok: !!input.name?.trim(),
    level: 'must',
    label: '店名が入っている',
    detail: input.name?.trim() || '店名を入れてください',
  });

  const hasPlaceholder = PLACEHOLDER.test(text);
  items.push({
    id: 'placeholder',
    ok: !hasPlaceholder,
    level: 'must',
    label: '例文のままの場所が残っていない',
    detail: hasPlaceholder ? '「入力してください」などが残っています' : '大丈夫です',
  });

  const hasForm = blocks.some(b => b.type === 'contact' || b.type === 'booking');
  const notify = (input.notifyEmail ?? '').trim();
  items.push({
    id: 'notify',
    ok: !hasForm || !!notify,
    level: 'must',
    label: '受け取ったお知らせの届け先が決まっている',
    detail: !hasForm
      ? '連絡を受け取る欄がないので、届け先は要りません'
      : notify || 'メールの届け先を入れてください。入れないと、届いた内容を受け取れません',
  });

  // 購入ボタンは、価格IDが無いと公開ページに出ない（黙って消える）
  const badBuy: string[] = [];
  pages.forEach(p => {
    (p.blocks ?? []).forEach(b => {
      if (b.type !== 'stripe-buy') return;
      const pid = String(d(b).priceId ?? '').trim();
      if (!/^price_[A-Za-z0-9]+$/.test(pid)) badBuy.push(p.name || 'ページ');
    });
  });
  if (badBuy.length > 0 || blocks.some(b => b.type === 'stripe-buy')) {
    items.push({
      id: 'stripe',
      ok: badBuy.length === 0,
      level: 'must',
      label: '購入ボタンに価格が結びついている',
      detail: badBuy.length === 0
        ? '大丈夫です'
        : `${[...new Set(badBuy)].join('・')}の購入ボタンに価格IDがありません。このままだと公開ページに出ません`,
    });
  }

  // ── better ─────────────────────────────────────────────
  const desc = (firstPage?.seo?.description ?? '').trim();
  items.push({
    id: 'description',
    ok: !!desc,
    level: 'better',
    label: '検索結果に出る説明文がある',
    detail: desc ? `${desc.slice(0, 40)}…` : '「サイト全体」で入れられます',
  });

  const hero = blocks.find(b => b.type === 'hero');
  items.push({
    id: 'hero-photo',
    ok: !!d(hero ?? {}).bgImage,
    level: 'better',
    label: '最初の画面に写真が入っている',
    detail: d(hero ?? {}).bgImage ? '入っています' : '写真があると、来た人がすぐ雰囲気を掴めます',
  });

  items.push({
    id: 'form',
    ok: hasForm,
    level: 'better',
    label: '連絡を受け取る欄がある',
    detail: hasForm ? '予約または問い合わせの欄があります' : '予約か問い合わせの節を足してください',
  });

  items.push({
    id: 'volume',
    ok: blocks.length >= 4,
    level: 'better',
    label: '中身がひととおり揃っている',
    detail: `${blocks.length}個の節`,
  });

  // 予約ブロックが同じページに2つ以上あると、どちらに入力したのか分からなくなる
  const dupBooking = pages
    .filter(p => (p.blocks ?? []).filter(b => b.type === 'booking').length > 1)
    .map(p => p.name || 'ページ');
  if (dupBooking.length > 0) {
    items.push({
      id: 'booking-dup',
      ok: false,
      level: 'better',
      label: '予約の欄が重なっていない',
      detail: `${dupBooking.join('・')}に予約の欄が2つ以上あります。意図した配置でなければ1つ消してください`,
    });
  }

  return items;
}

/** 公開を止めるべき項目だけ */
export function blockingItems(items: ReadyItem[]): ReadyItem[] {
  return items.filter(i => i.level === 'must' && !i.ok);
}

/** 直したほうが良い項目だけ */
export function adviceItems(items: ReadyItem[]): ReadyItem[] {
  return items.filter(i => i.level === 'better' && !i.ok);
}
