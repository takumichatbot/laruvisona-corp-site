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
import { hasPlaceholderText, isPlaceholderText } from './placeholder-text';
import { BLOCK_DEFS } from './studio-schema';

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
  /**
   * ログイン中の利用者のメールアドレス（分かる画面だけ渡す）。
   * 実APIは専用の届け先（notifyEmail）が空のとき、これへ送る
   * （app/api/contact/route.ts 187行目、app/api/stripe/webhook/route.ts 126行目）。
   * 渡されない画面では「所有者のメールは確認できない」ものとして扱う。
   */
  ownerEmail?: string | null;
}

/** 素朴なメール形式チェック。RFCの厳密な検査はしない。実APIも形式は検査していない。 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function d(block: { data?: unknown }): Record<string, unknown> {
  return (block.data ?? {}) as Record<string, unknown>;
}

export function checkPublishReadiness(input: ReadyInput): ReadyItem[] {
  const pages = input.pages ?? [];
  const blocks = pages.flatMap(p => p.blocks ?? []);
  const firstPage = pages[0];
  const items: ReadyItem[] = [];

  // ── must ───────────────────────────────────────────────
  items.push({
    id: 'name',
    ok: !!input.name?.trim(),
    level: 'must',
    label: '店名が入っている',
    detail: input.name?.trim() || '店名を入れてください',
  });

  // 一覧は lib/placeholder-text.ts にだけ置く。ここに書き写すと、
  // 説明文を作る側（lib/auto-description.ts）と食い違う。実際そうなっていた。
  const hasPlaceholder = hasPlaceholderText(blocks) || blocks.some(b => b.data?.starterExampleName && b.data.starterExampleName === input.name);
  const where = placeholderPlaces(pages);
  items.push({
    id: 'placeholder',
    ok: !hasPlaceholder,
    level: 'must',
    label: '例文のままの場所が残っていない',
    detail: hasPlaceholder
      ? `${where.length ? `残っている場所：${where.slice(0, 6).join('・')}${where.length > 6 ? ` ほか${where.length - 6}か所` : ''}。` : ''}「【例】」「入力してください」などを実際の内容・料金に直すか、不要な節を削除してください。`
      : '大丈夫です',
  });

  const hasForm = blocks.some(b => b.type === 'contact' || b.type === 'booking');
  const notify = (input.notifyEmail ?? '').trim();
  const ownerGiven = input.ownerEmail !== undefined && input.ownerEmail !== null;
  const owner = (input.ownerEmail ?? '').trim();

  if (!hasForm) {
    items.push({
      id: 'notify',
      ok: true,
      level: 'must',
      label: '受け取ったお知らせの届け先が決まっている（送信は試していません）',
      detail: '連絡を受け取る欄がないので、届け先は要りません',
    });
  } else if (notify) {
    // 専用の届け先が入力されている場合、形式だけ確認する（実際に送れるかは別）
    items.push({
      id: 'notify',
      ok: EMAIL_SHAPE.test(notify),
      level: 'must',
      label: '受け取ったお知らせの届け先が決まっている（送信は試していません）',
      detail: EMAIL_SHAPE.test(notify)
        ? `${notify} へ届きます（メールアドレスの形は確認済み。実際に届くかまでは確認していません）`
        : `「${notify}」はメールアドレスの形になっていません`,
    });
  } else if (ownerGiven && owner && EMAIL_SHAPE.test(owner)) {
    // 専用の届け先が空でも、実APIは所有者のメールへ送る
    // （app/api/contact/route.ts:187, app/api/stripe/webhook/route.ts:126）
    items.push({
      id: 'notify',
      ok: true,
      level: 'must',
      label: '受け取ったお知らせの届け先が決まっている（送信は試していません）',
      detail: `専用の届け先は未指定。アカウントのメール（${owner}）へ届きます（実際に届くかまでは確認していません）`,
    });
  } else if (ownerGiven) {
    // 所有者のメールを確認できたが、空または形式が不正 → 実APIも送り先が無く400になる
    items.push({
      id: 'notify',
      ok: false,
      level: 'must',
      label: '受け取ったお知らせの届け先が決まっている（送信は試していません）',
      detail: '届け先が決まっていません。専用の届け先か、アカウントのメールのどちらかを、正しいメール形式で用意してください',
    });
  } else {
    // この画面ではアカウントのメールを確認できない。実APIは所有者メールへ送るはずだが、断言はしない
    items.push({
      id: 'notify',
      ok: true,
      level: 'must',
      label: '受け取ったお知らせの届け先が決まっている（送信は試していません）',
      detail: '専用の届け先は未指定。アカウントのメールが使われます（この画面ではアカウントのメールを確認できません）',
    });
  }

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
  const heroPhoto = !!d(hero ?? {}).bgImage;
  // 最初の下書きは見本の写真で始まる（説明文に「サンプル写真」と入っている）。
  // それを「入っています ✓」と見せると、差し替えを忘れたまま公開してしまう。
  const samplePhoto = heroPhoto && isPlaceholderText(d(hero ?? {}).bgImageAlt);
  items.push({
    id: 'hero-photo',
    ok: heroPhoto && !samplePhoto,
    level: 'better',
    label: '最初の画面に自分の写真が入っている',
    detail: samplePhoto
      ? '見本の写真のままです。「最初の画面」で、ご自身の仕事・お店の写真に差し替えてください'
      : heroPhoto ? '入っています' : '写真があると、来た人がすぐ雰囲気を掴めます',
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

/**
 * 例文が残っている節を、画面に出ている名前で返す。
 * 「例文が残っています」だけでは、7つの節のどこを開けばよいか分からなかった。
 * 見出しの直下の節は、その見出しの言葉で呼ぶ（「私たちの強み」など）。
 */
export function placeholderPlaces(pages: Page[]): string[] {
  const names: string[] = [];
  const multi = pages.length > 1;
  for (const page of pages) {
    const list = page.blocks ?? [];
    list.forEach((b, i) => {
      if (b.type === 'heading') return; // 見出しは、直下の節と一緒に数える
      const data = d(b);
      const prev = list[i - 1];
      const title = (v: unknown) => (typeof v === 'string' && v.trim() && !isPlaceholderText(v) ? v.trim() : '');
      let name = title(data.heading)
        || (prev?.type === 'heading' ? title(d(prev).text) : '')
        || BLOCK_DEFS[b.type]?.label || '節';
      let hit = hasPlaceholderText(data) || (prev?.type === 'heading' && hasPlaceholderText(d(prev)));
      if (b.type === 'hero') {
        const { bgImageAlt, ...rest } = data;
        const photo = isPlaceholderText(bgImageAlt);
        hit = hasPlaceholderText(rest);
        name = BLOCK_DEFS.hero?.label || '最初の画面';
        if (photo) names.push(`${name}の写真`);
      }
      if (hit) names.push(multi ? `${page.name}の${name}` : name);
    });
  }
  return [...new Set(names)];
}

/** 公開を止めるべき項目だけ */
export function blockingItems(items: ReadyItem[]): ReadyItem[] {
  return items.filter(i => i.level === 'must' && !i.ok);
}

/** 直したほうが良い項目だけ */
export function adviceItems(items: ReadyItem[]): ReadyItem[] {
  return items.filter(i => i.level === 'better' && !i.ok);
}
