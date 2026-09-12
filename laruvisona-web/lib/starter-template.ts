import type { Block } from '@/types/laruHP';

/** 初回の回答にない事実を、業種テンプレートから利用者の情報として引き継がない。
 * 既存サイトや採用済みの作品データには適用しない。
 * 候補名は本文でも「例」と分かる形にし、公開前チェックでも入力待ちにする。
 */
export function starterTemplate(blocks: Block[], description: string): Block[] {
  return blocks.flatMap((block): Block[] => {
    const d = structuredClone(block.data);
    const examples = (value: unknown) => Array.isArray(value) ? value as Record<string, unknown>[] : [];
    switch (block.type) {
      case 'hero': break; // 呼び出し側が、回答と目的に基づく内容で上書きする。
      case 'heading': d.subtext = ''; break;
      case 'paragraph': d.text = description || '紹介文を入力してください'; break;
      case 'services':
        d.items = examples(d.items).map(item => ({
          icon: '', title: `【例】${String(item.title || 'サービス')}`,
          description: '実際に提供する内容を入力してください', price: '',
        }));
        break;
      case 'price-table':
        d.subtext = '';
        d.plans = examples(d.plans).map(plan => ({
          name: `【例】${String(plan.name || 'プラン')}`, price: '料金を入力してください',
          period: '', description: '', features: [], highlighted: !!plan.highlighted,
          buttonText: 'ご予約の相談', buttonLink: '#booking',
        }));
        break;
      case 'three-col':
        for (const n of [1, 2, 3]) {
          d[`col${n}Icon`] = '';
          d[`col${n}Title`] = '特徴を入力してください';
          d[`col${n}Text`] = '実際の取り組みを入力してください';
        }
        break;
      case 'two-col':
        d.col1Text = 'ご案内を入力してください';
        d.col2Text = 'ご案内を入力してください';
        break;
      case 'hours':
        d.schedule = examples(d.schedule).map(row => ({ ...row, hours: '', closed: false }));
        d.note = '営業時間・定休日を入力してください';
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
        d.items = examples(d.items).map(row => ({ q: `【例】${String(row.q || 'よくある質問')}`, a: '回答を入力してください' }));
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
