import type { Block } from '@/types/laruHP';
import { sortSections } from '@/lib/section-order';

/**
 * 最初の下書きに置く「書き方の見本」。
 *
 * 「入力してください」だけが並ぶと、開いた瞬間に記入用紙に見える。
 * かといって、実績・料金・お客様の声を本人のものとして書くことはしない。
 * だから文は必ず【例】で始め、何をどう書けばよいかが読めば分かる形にする。
 * 【例】は公開前の確認で「例文のまま」として止まる（lib/placeholder-text.ts）。
 * {area} は、入力された地域に置き換える（無ければ「〇〇市」）。
 */
export interface StarterGuide {
  /** 「サービス」の各項目。キーはひな形の項目名 */
  services?: Record<string, string>;
  /** 「メニューと料金」の各項目の説明。キーはひな形のメニュー名 */
  plans?: Record<string, string>;
  /** 見出しの下の3つの枠。[見出し, 本文] */
  features?: Array<[string, string]>;
  /** 相談からの流れ。flow と同じ数 */
  flowText?: string[];
  /** 紹介文（ひとことが空のとき） */
  intro?: string;
}

export const INDUSTRY_BLUEPRINTS: Record<
  string,
  {
    label: string;
    reason: string;
    gallery: string;
    services: string;
    flow: string[];
    order: string[];
    guide?: StarterGuide;
  }
> = {
  beauty: {
    label: 'スタイルから、予約の相談へ',
    reason: '仕上がりを知り、メニューを選び、予約を相談する順番です。',
    gallery: 'スタイル・店内',
    services: '施術メニュー',
    flow: ['ご相談', 'メニューのご案内', 'ご来店'],
    order: [
      'hero',
      'gallery',
      'price-table',
      'services',
      'paragraph',
      'tabs',
      'team',
      'faq',
      'hours',
      'map',
      'booking',
      'contact',
      'cta',
    ],
    guide: {
      plans: {
        'カット': '【例】シャンプー・ブロー込み。所要時間は約60分です。',
        'カラー': '【例】根元のリタッチ、全体カラーなど。髪の状態を見てご提案します。',
        'パーマ': '【例】デジタルパーマ・コールドパーマ。仕上がりのイメージを伺ってから決めます。',
      },
      flowText: [
        '【例】ご希望の日時とメニューを、フォームかお電話でお知らせください。',
        '【例】髪の状態とご希望を伺い、合うメニューと料金をご案内します。',
        '【例】当日はそのままお越しください。駐車場の有無や道順もここに書きます。',
      ],
      intro: '【例】お店を始めたきっかけと、どんな方に来てほしいかを2〜3行で書きます。',
    },
  },
  restaurant: {
    label: 'メニューから、来店へ',
    reason: '食事や空間を知り、営業時間と場所を確かめて来店する順番です。',
    gallery: '料理とお店の様子',
    services: 'お食事・お飲み物',
    flow: ['メニューを知る', '営業日を確認', 'ご来店'],
    order: [
      'hero',
      'services',
      'price-table',
      'gallery',
      'paragraph',
      'hours',
      'map',
      'two-col',
      'faq',
      'booking',
      'contact',
      'cta',
    ],
  },
  construction: {
    label: '仕事を知って、相談へ',
    reason: '施工写真と仕事の進め方を見て、安心して相談するための構成です。',
    gallery: '施工写真',
    services: '住まいのご相談',
    flow: ['お問い合わせ', 'ご要望を伺う', '進め方をご案内'],
    order: [
      'hero',
      'gallery',
      'paragraph',
      'services',
      'three-col',
      'tabs',
      'faq',
      'contact',
      'hours',
      'map',
      'cta',
    ],
    guide: {
      services: {
        '新築工事': '【例】土地や資金計画のご相談から、設計・施工までお受けします。',
        'リフォーム': '【例】キッチン・浴室・外壁など、部分的な工事からご相談いただけます。',
        '外構・庭工事': '【例】駐車スペース・フェンス・植栽など、家まわりの工事もお受けします。',
      },
      features: [
        ['対応地域', '【例】{area}を中心に、車で30分ほどの範囲まで伺います。'],
        ['許可・保険', '【例】建設業許可 〇〇県知事（般-00）第00000号／工事の賠償責任保険に加入しています。'],
        ['工期・費用の目安', '【例】水まわりのリフォームは工期2〜5日・50万円前後から。現地を拝見してお見積りします。'],
      ],
      flowText: [
        '【例】お電話かフォームで、工事の内容とご希望の時期をお知らせください。',
        '【例】現地を拝見し、ご予算やお住まいでの困りごとを伺います。',
        '【例】お見積りと工期をご説明し、ご納得いただいてからご契約です。',
      ],
      intro: '【例】どんな工事を、どの地域で、どんな考えでお受けしているかを2〜3行で書きます。',
    },
  },
  retail: {
    label: '商品から、お店への接点へ',
    reason: '商品の魅力と取り扱い内容、場所・購入の案内をまとめます。',
    gallery: '商品ギャラリー',
    services: '取り扱い商品',
    flow: ['商品を知る', '取り扱いを確認', 'お店へ相談'],
    order: [
      'hero',
      'services',
      'gallery',
      'paragraph',
      'tabs',
      'two-col',
      'hours',
      'map',
      'faq',
      'contact',
      'cta',
    ],
  },
  clinic: {
    label: '施術を知って、相談へ',
    reason:
      '対応内容と相談の流れを知ってから予約へ進みます。効果を断定する例文は入れません。',
    gallery: '院内の様子',
    services: '対応内容',
    flow: ['ご相談', 'お困りごとを伺う', 'ご案内'],
    order: [
      'hero',
      'paragraph',
      'three-col',
      'services',
      'tabs',
      'gallery',
      'faq',
      'hours',
      'map',
      'booking',
      'contact',
      'cta',
    ],
    guide: {
      services: {
        '全身矯正': '【例】姿勢と体の使い方を確かめ、全身を整えます（約40分）。',
        '肩こり・腰痛集中': '【例】気になる部位を中心に施術します（約30分）。',
        '初回体験': '【例】お話を伺う時間を長めにとる、初めての方向けのコースです。',
      },
      // 効果を約束する言い方にしない。「こういう方に」までにとどめる。
      features: [
        ['【例】肩・首のこり', '【例】デスクワークで同じ姿勢が続く方に。'],
        ['【例】腰の重さ', '【例】立ち仕事や家事で、腰に負担がかかる方に。'],
        ['【例】姿勢のくせ', '【例】ご自身の体の使い方を見直したい方に。'],
      ],
      flowText: [
        '【例】ご希望の日時を、フォームかお電話でお知らせください。',
        '【例】いつから、どんなときに気になるかを伺います。',
        '【例】施術の内容と料金をご説明してから始めます。',
      ],
      intro: '【例】院を開いた理由と、どんな方に来てほしいかを2〜3行で書きます。',
    },
  },
};
/** 新規作成だけ。既存サイトの並びは自動で変更しない。 */
export function composeIndustry(blocks: Block[], industry: string, ctx: { area?: string } = {}): Block[] {
  const spec = INDUSTRY_BLUEPRINTS[industry];
  if (!spec) return blocks;
  const next = blocks.map((b) => ({ ...b, data: { ...b.data } }));
  if (!next.some((b) => b.type === 'gallery'))
    next.push({
      id: 'start-gallery',
      type: 'gallery',
      data: {
        heading: spec.gallery,
        images: [],
        columns: '2',
        photoRatio: '4:3',
      },
    });
  for (const b of next) {
    if (b.type === 'gallery') b.data.heading = spec.gallery;
    if (b.type === 'services' && b.data.heading !== '商品について')
      b.data.heading = spec.services;
  }
  const guide = spec.guide;
  if (guide) {
    const area = (ctx.area || '').trim() || '〇〇市';
    const fill = (t: string) => t.replace(/\{area\}/g, area);
    // 置き換えるのは、ひな形のまま（入力待ちの文）の箇所だけ。書かれた文には触れない。
    const waiting = (v: unknown) => typeof v === 'string' && (v === '' || /入力してください/.test(v));
    for (const b of next) {
      if (b.type === 'services' && guide.services)
        b.data.items = (b.data.items as Record<string, unknown>[] | undefined)?.map((item) => {
          const key = String(item.title ?? '').replace(/^【例】/, '');
          return guide.services![key] && waiting(item.description) ? { ...item, description: guide.services![key] } : item;
        });
      if (b.type === 'price-table' && guide.plans)
        b.data.plans = (b.data.plans as Record<string, unknown>[] | undefined)?.map((plan) => {
          const key = String(plan.name ?? '').replace(/^【例】/, '');
          return guide.plans![key] && waiting(plan.description) ? { ...plan, description: guide.plans![key] } : plan;
        });
      if (b.type === 'three-col' && guide.features && waiting(b.data.col1Text))
        guide.features.forEach(([title, text], i) => {
          b.data[`col${i + 1}Title`] = fill(title);
          b.data[`col${i + 1}Text`] = fill(text);
        });
      if (b.type === 'paragraph' && guide.intro && waiting(b.data.text)) b.data.text = guide.intro;
    }
  }
  if (
    ['construction', 'clinic', 'beauty'].includes(industry) &&
    !next.some((b) => b.type === 'tabs')
  )
    next.push({
      id: 'start-flow',
      type: 'tabs',
      data: {
        heading: 'ご相談からの流れ',
        items: spec.flow.map((title, i) => ({
          label: `${i + 1}. ${title}`,
          body: spec.guide?.flowText?.[i] || '実際の流れを入力してください',
        })),
      },
    });
  // 見出しは、すぐ下の中身と同じ位置へ動かす（lib/section-order.ts）。
  return sortSections(next, (b) => {
    const i = spec.order.indexOf(b.type);
    return i < 0 ? 5 : i;
  });
}
