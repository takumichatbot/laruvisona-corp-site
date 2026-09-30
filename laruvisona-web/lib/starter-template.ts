import type { Block } from '@/types/laruHP';

/** 初回の回答にない事実を、業種テンプレートから利用者の情報として引き継がない。
 * 既存サイトや採用済みの作品データには適用しない。
 * 候補名は本文でも「例」と分かる形にし、公開前チェックでも入力待ちにする。
 */
const FEATURE_EXAMPLES: Array<[string, string]> = [
  ['【例】大切にしていること', '【例】仕事で大切にしている考え方を書きます'],
  ['【例】選ばれている理由', '【例】お客様に喜ばれている点を、事実の範囲で書きます'],
  ['【例】はじめての方へ', '【例】初めての方が安心できる案内（流れ・準備など）を書きます'],
];

export function starterTemplate(blocks: Block[], description: string): Block[] {
  return blocks.flatMap((block): Block[] => {
    const d = structuredClone(block.data);
    const examples = (value: unknown) => Array.isArray(value) ? value as Record<string, unknown>[] : [];
    switch (block.type) {
      case 'hero': break; // 呼び出し側が、回答と目的に基づく内容で上書きする。
      case 'heading': d.subtext = ''; break;
      case 'paragraph': d.text = description || '【例】お店を始めたきっかけや、大切にしていることを短く書きます'; break;
      case 'services':
        d.items = examples(d.items).map(item => ({
          icon: '', title: `【例】${String(item.title || 'サービス')}`,
          description: '【例】どんな内容か、どんな方に向いているかを書きます', price: '',
        }));
        break;
      case 'price-table':
        d.subtext = '';
        d.plans = examples(d.plans).map(plan => ({
          name: `【例】${String(plan.name || 'プラン')}`, price: '【例】○○円', // 金額は作らない。料金の欄だと一目で分かる形にする
          period: '', description: '', features: [], highlighted: !!plan.highlighted,
          buttonText: 'ご予約の相談', buttonLink: '#booking',
        }));
        break;
      case 'three-col':
        // 3つとも同じ文だと記入欄に見えるので、書く観点を分けて見せる
        FEATURE_EXAMPLES.forEach(([title, text], i) => {
          d[`col${i + 1}Icon`] = '';
          d[`col${i + 1}Title`] = title;
          d[`col${i + 1}Text`] = text;
        });
        break;
      case 'two-col':
        d.col1Text = `【例】「${String(d.col1Title || 'ご案内')}」について、お客様に伝えたいことを書きます`;
        d.col2Text = `【例】「${String(d.col2Title || 'ご案内')}」について、お客様に伝えたいことを書きます`;
        break;
      case 'hours':
        d.schedule = examples(d.schedule).map(row => ({ ...row, hours: '', closed: false }));
        d.note = '【例】定休日や、最終受付の時間を書きます';
        break;
      case 'booking':
        d.heading = 'ご予約のご相談';
        d.subtext = '希望日時をお送りください。確認後にご連絡します。';
        d.serviceTypes = []; d.timeSlots = []; d.buttonText = '希望日時を送る';
        break;
      case 'contact': d.subtext = 'ご相談内容をお送りください。'; break;
      case 'cta':
        d.heading = 'お気軽にご相談ください'; d.subtext = '';
        d.buttonText = 'お問い合わせ'; d.buttonLink = '#contact';
        break;
      case 'faq':
        d.items = examples(d.items).map(row => ({ q: `【例】${String(row.q || 'よくある質問')}`, a: '【例】よくいただく質問への答えを、短く書きます' }));
        break;
      case 'gallery': d.images = []; break;
      case 'map': d.embedUrl = ''; break;
      case 'divider': break;
      // 架空の人物・体験談・実績写真・自由HTML等を、本人の実績として始めない。
      // 新しいテンプレートの種類も、内容を確認してここへ追加するまでは取り込まない。
      default: return [];
    }
    return [{ ...block, data: d }];
  });
}
