import type { Block } from '@/types/laruHP';

type TemplateBlocks = Omit<Block, 'id'>[];

const makeId = () => `t-${Math.random().toString(36).slice(2)}`;
const b = (type: Block['type'], data: Record<string, unknown>): Block => ({ id: makeId(), type, data });

const makeHours = (weekSat = '9:00〜18:00', sun = '') => ({
  heading: '営業時間',
  schedule: [
    { day: '月', hours: weekSat, closed: false },
    { day: '火', hours: weekSat, closed: false },
    { day: '水', hours: weekSat, closed: false },
    { day: '木', hours: weekSat, closed: false },
    { day: '金', hours: weekSat, closed: false },
    { day: '土', hours: weekSat, closed: false },
    { day: '日', hours: sun, closed: !sun },
  ],
  note: '',
});

const contactBlock = b('contact', {
  heading: 'お問い合わせ',
  subtext: 'お気軽にご相談ください。通常2営業日以内にご返信いたします。',
  fields: ['name', 'email', 'phone', 'message'],
  buttonText: '送信する',
  buttonColor: '#1e3a8a',
  bgColor: '#f8fafc',
});

export interface IndustryTemplate {
  label: string;
  emoji: string;
  colorScheme: string;
  bgColor: string;
  schemaType: string;
  seoTitleTemplate: string;
  blocks: Block[];
}

export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  restaurant: {
    label: '飲食店・カフェ',
    emoji: '🍜',
    colorScheme: 'warm-earth',
    bgColor: '#78350f',
    schemaType: 'Restaurant',
    seoTitleTemplate: '{name} | {area}のカフェ・レストラン',
    blocks: [
      b('hero', { heading: '{name}', subheading: '心を込めた料理でお迎えします', ctaText: 'ご予約はこちら', ctaLink: '#contact', bgColor: '#7c2d12', textColor: '#ffffff' }),
      b('heading', { text: '私たちについて', subtext: 'お店のこだわりをご紹介します', align: 'center' }),
      b('paragraph', { text: '{description}', align: 'left' }),
      b('services', { heading: 'おすすめメニュー', columns: '3', items: [{ icon: '🍽', title: 'ランチコース', description: '旬の食材を使った日替わりランチ', price: '1,200円〜' }, { icon: '🍷', title: 'ディナーコース', description: 'シェフ特選のコース料理', price: '4,500円〜' }, { icon: '☕', title: 'カフェタイム', description: '手作りスイーツと厳選コーヒー', price: '800円〜' }] }),
      b('gallery', { heading: '店内・料理ギャラリー', images: ['', '', '', ''], columns: '2' }),
      b('two-col', {
        col1Title: '営業時間', col1Text: 'ランチ 11:30〜14:30\nディナー 17:30〜22:00\n※月曜定休',
        col2Title: 'アクセス', col2Text: '{address}\nお車でのご来店もOK。駐車場完備。',
      }),
      contactBlock,
    ],
  },

  beauty: {
    label: '美容室・サロン',
    emoji: '💇',
    colorScheme: 'modern-pink',
    bgColor: '#831843',
    schemaType: 'BeautySalon',
    seoTitleTemplate: '{name} | {area}の美容室・ヘアサロン',
    blocks: [
      b('hero', { heading: '{name}', subheading: 'あなたの美しさを最大限に引き出します', ctaText: '今すぐ予約する', ctaLink: '#contact', bgColor: '#831843', textColor: '#ffffff' }),
      b('heading', { text: 'サロンについて', subtext: '', align: 'center' }),
      b('paragraph', { text: '{description}', align: 'left' }),
      b('services', { heading: 'メニュー・料金', columns: '3', items: [{ icon: '✂️', title: 'カット', description: 'シャンプー・ブロー込み', price: '6,000円〜' }, { icon: '🎨', title: 'カラー', description: 'ダメージレスカラー', price: '8,000円〜' }, { icon: '🌀', title: 'パーマ', description: 'デジタルパーマ対応', price: '12,000円〜' }] }),
      b('testimonials', { heading: 'お客様の声', items: [{ name: '山田様', age: '30代', rating: 5, text: 'スタイリストさんの提案がすごく良くて、毎回おまかせしています！' }, { name: '鈴木様', age: '40代', rating: 5, text: '丁寧なカウンセリングで安心して任せられます。' }, { name: '佐藤様', age: '20代', rating: 5, text: '友達にも紹介しました。また来ます！' }] }),
      b('gallery', { heading: 'スタイルギャラリー', images: ['', '', '', ''], columns: '2' }),
      b('hours', makeHours('10:00〜20:00')),
      contactBlock,
    ],
  },

  clinic: {
    label: '整体・クリニック',
    emoji: '💊',
    colorScheme: 'fresh-green',
    bgColor: '#064e3b',
    schemaType: 'MedicalClinic',
    seoTitleTemplate: '{name} | {area}の整体院・接骨院',
    blocks: [
      b('hero', { heading: '{name}', subheading: '根本から改善。あなたの体の悩みに寄り添います', ctaText: '初回無料相談', ctaLink: '#contact', bgColor: '#064e3b', textColor: '#ffffff' }),
      b('heading', { text: 'こんなお悩みありませんか？', subtext: '', align: 'center' }),
      b('three-col', { col1Icon: '😫', col1Title: '肩こり・首の痛み', col1Text: 'デスクワークや姿勢の悪さからくる慢性的なこりに', col2Icon: '🦵', col2Title: '腰痛', col2Text: '立ち仕事・重い物の持ち運びによる腰の痛みに', col3Icon: '🦷', col3Title: '頭痛・めまい', col3Text: '筋肉の緊張から来る頭痛・自律神経の乱れに' }),
      b('heading', { text: '当院の特徴', subtext: '{description}', align: 'center' }),
      b('services', { heading: '施術メニュー', columns: '3', items: [{ icon: '🙌', title: '全身矯正', description: '骨盤・背骨の歪みを根本から整える', price: '5,500円' }, { icon: '💆', title: '肩こり・腰痛集中', description: '痛みの原因にアプローチ', price: '3,500円' }, { icon: '🌿', title: '初回体験', description: 'カウンセリング込みのお試しコース', price: '1,000円' }] }),
      b('testimonials', { heading: 'ご利用者様の声', items: [{ name: '田中様', age: '50代', rating: 5, text: '長年の腰痛が3回の施術で楽になりました。もっと早く来ればよかった。' }, { name: '山本様', age: '30代', rating: 5, text: '肩こりがひどくて来院。丁寧な説明で安心できました。' }, { name: '木村様', age: '40代', rating: 5, text: '定期的に通っています。体が軽くなって毎日快適です。' }] }),
      b('hours', makeHours('9:00〜20:00', '10:00〜17:00')),
      contactBlock,
    ],
  },

  legal: {
    label: '士業・コンサル',
    emoji: '⚖️',
    colorScheme: 'elegant-dark',
    bgColor: '#111827',
    schemaType: 'LegalService',
    seoTitleTemplate: '{name} | {area}の{type}事務所',
    blocks: [
      b('hero', { heading: '{name}', subheading: '豊富な実績と専門知識で、お客様の課題を解決します', ctaText: '無料相談を予約する', ctaLink: '#contact', bgColor: '#111827', textColor: '#ffffff' }),
      b('heading', { text: '事務所について', subtext: '{description}', align: 'left' }),
      b('services', { heading: 'サービス内容', columns: '3', items: [{ icon: '📄', title: 'ご相談・診断', description: '初回無料でご相談を承ります', price: '無料' }, { icon: '📋', title: '書類作成', description: '各種申請書類の作成代行', price: '要見積' }, { icon: '🤝', title: 'コンサルティング', description: '継続的なサポート・顧問契約', price: '月額制' }] }),
      b('cta', { heading: 'まずは無料相談から', subtext: 'お電話・メール・ZOOMでのご相談も承ります。お気軽にお問い合わせください。', buttonText: '無料相談を予約する', buttonLink: '#contact', bgColor: '#1e3a8a', textColor: '#ffffff' }),
      b('hours', makeHours('9:00〜18:00')),
      contactBlock,
    ],
  },

  construction: {
    label: '建設・工務店',
    emoji: '🏗️',
    colorScheme: 'bold-orange',
    bgColor: '#7c2d12',
    schemaType: 'HomeAndConstructionBusiness',
    seoTitleTemplate: '{name} | {area}の{type}・リフォーム',
    blocks: [
      b('hero', { heading: '{name}', subheading: '地域密着30年。確かな技術でお客様の夢を形に', ctaText: '無料お見積りはこちら', ctaLink: '#contact', bgColor: '#7c2d12', textColor: '#ffffff' }),
      b('heading', { text: '私たちの強み', subtext: '{description}', align: 'center' }),
      b('three-col', { col1Icon: '🏆', col1Title: '施工実績500件以上', col1Text: '地域のお客様から長年信頼いただいています', col2Icon: '💰', col2Title: '適正価格', col2Text: '中間マージンなし。材料費から透明性のある見積もり', col3Icon: '🔧', col3Title: 'アフターフォロー万全', col3Text: '施工後も安心の保証付き。何かあればすぐ駆けつけます' }),
      b('services', { heading: '施工事例・サービス', columns: '3', items: [{ icon: '🏠', title: '新築工事', description: '注文住宅・建売住宅の施工', price: '要見積' }, { icon: '🔨', title: 'リフォーム', description: 'キッチン・バス・外壁など', price: '10万円〜' }, { icon: '🌿', title: '外構・庭工事', description: 'フェンス・駐車場・造園', price: '5万円〜' }] }),
      b('gallery', { heading: '施工実績', images: ['', '', '', ''], columns: '2' }),
      b('testimonials', { heading: 'お客様の声', items: [{ name: '高橋様', age: '40代', rating: 5, text: '丁寧な工事で大満足です。近所の方にも紹介しました。' }, { name: '中村様', age: '50代', rating: 5, text: '見積もりが明確で安心して依頼できました。' }, { name: '小林様', age: '60代', rating: 5, text: '質問に丁寧に答えてくれて信頼できる会社です。' }] }),
      contactBlock,
    ],
  },

  realestate: {
    label: '不動産',
    emoji: '🏠',
    colorScheme: 'professional-blue',
    bgColor: '#1e3a8a',
    schemaType: 'RealEstateAgent',
    seoTitleTemplate: '{name} | {area}の不動産',
    blocks: [
      b('hero', { heading: '{name}', subheading: '理想の暮らしを、あなたと一緒に探します', ctaText: '物件を探す', ctaLink: '#contact', bgColor: '#1e3a8a', textColor: '#ffffff' }),
      b('heading', { text: '私たちにお任せください', subtext: '{description}', align: 'center' }),
      b('services', { heading: 'サービス', columns: '3', items: [{ icon: '🏢', title: '賃貸仲介', description: '豊富な物件情報からお探しします', price: '仲介手数料1ヶ月' }, { icon: '🏡', title: '売買仲介', description: 'マイホーム・投資物件のご購入', price: '要相談' }, { icon: '📊', title: '査定・売却', description: '無料査定から売却サポートまで', price: '無料査定' }] }),
      b('cta', { heading: '無料相談・物件査定はこちら', subtext: '地域の不動産に精通したスタッフが丁寧にご対応します。', buttonText: 'お問い合わせ・相談予約', buttonLink: '#contact', bgColor: '#1e40af', textColor: '#ffffff' }),
      b('hours', makeHours('9:00〜18:00')),
      contactBlock,
    ],
  },

  retail: {
    label: '小売・EC',
    emoji: '🛍️',
    colorScheme: 'bold-orange',
    bgColor: '#7c2d12',
    schemaType: 'Store',
    seoTitleTemplate: '{name} | {area}の専門店',
    blocks: [
      b('hero', { heading: '{name}', subheading: 'こだわりの商品をお届けします', ctaText: '商品を見る', ctaLink: '#services', bgColor: '#7c2d12', textColor: '#ffffff' }),
      b('heading', { text: 'おすすめ商品', subtext: '{description}', align: 'center' }),
      b('services', { heading: '商品ラインアップ', columns: '3', items: [{ icon: '⭐', title: '商品1', description: '商品説明を入力してください', price: '3,000円' }, { icon: '🌟', title: '商品2', description: '商品説明を入力してください', price: '5,000円' }, { icon: '💫', title: '商品3', description: '商品説明を入力してください', price: '8,000円' }] }),
      b('gallery', { heading: '商品ギャラリー', images: ['', '', '', ''], columns: '2' }),
      b('two-col', { col1Title: '送料・お届けについて', col1Text: '全国送料無料（一部地域除く）\nご注文から3〜5営業日でお届け', col2Title: '返品・交換', col2Text: '商品到着後7日以内であれば返品可能\n未使用・未開封に限ります' }),
      contactBlock,
    ],
  },

  fitness: {
    label: 'フィットネス・ジム',
    emoji: '💪',
    colorScheme: 'bold-orange',
    bgColor: '#7c2d12',
    schemaType: 'ExerciseGym',
    seoTitleTemplate: '{name} | {area}のジム・フィットネス',
    blocks: [
      b('hero', { heading: '{name}', subheading: '理想の体を、今日から始めよう', ctaText: '無料体験を申し込む', ctaLink: '#contact', bgColor: '#1c1917', textColor: '#ffffff' }),
      b('three-col', { col1Icon: '🏋️', col1Title: '最新設備', col1Text: '最新のトレーニングマシンを完備', col2Icon: '👨‍🏫', col2Title: 'プロトレーナー', col2Text: '経験豊富なパーソナルトレーナーが在籍', col3Icon: '🎯', col3Title: '結果にコミット', col3Text: '目標達成まで徹底サポート' }),
      b('services', { heading: 'プラン・料金', columns: '3', items: [{ icon: '🥈', title: 'ベーシック', description: '設備使い放題・グループレッスン', price: '8,000円/月' }, { icon: '🥇', title: 'プレミアム', description: 'パーソナル月4回込み', price: '20,000円/月' }, { icon: '⚡', title: '体験入会', description: 'トレーナー付き体験1回', price: '無料' }] }),
      b('testimonials', { heading: 'ビフォーアフター・お客様の声', items: [{ name: '田中様', age: '30代', rating: 5, text: '3ヶ月で10kg減量に成功！トレーナーのサポートが手厚くて続けられました。' }, { name: '佐藤様', age: '40代', rating: 5, text: '体型だけでなく、体力もついて仕事のパフォーマンスが上がりました。' }, { name: '渡辺様', age: '20代', rating: 5, text: '初めてのジムで不安でしたが、丁寧に指導してもらえて安心です。' }] }),
      b('hours', makeHours('6:00〜23:00', '8:00〜20:00')),
      contactBlock,
    ],
  },

  hotel: {
    label: 'ホテル・旅館',
    emoji: '🏨',
    colorScheme: 'elegant-dark',
    bgColor: '#111827',
    schemaType: 'Hotel',
    seoTitleTemplate: '{name} | {area}のホテル・旅館',
    blocks: [
      b('hero', { heading: '{name}', subheading: '特別なひとときを、心を込めておもてなしします', ctaText: '空室・料金を確認する', ctaLink: '#contact', bgColor: '#1c1917', textColor: '#ffffff' }),
      b('heading', { text: '施設のご案内', subtext: '{description}', align: 'center' }),
      b('services', { heading: 'プラン', columns: '3', items: [{ icon: '🌸', title: '素泊まりプラン', description: '気ままに自由な旅を', price: '8,000円〜/泊' }, { icon: '🍽', title: '朝食付きプラン', description: '地産地消の朝食を楽しむ', price: '12,000円〜/泊' }, { icon: '🥂', title: '夕食付きプラン', description: '旬の会席料理で贅沢な夜を', price: '20,000円〜/泊' }] }),
      b('gallery', { heading: '客室・施設', images: ['', '', '', ''], columns: '2' }),
      b('two-col', { col1Title: 'チェックイン・アウト', col1Text: 'チェックイン: 15:00〜\nチェックアウト: 〜11:00\n\n早期チェックインは要相談', col2Title: 'アクセス', col2Text: '{address}\n最寄り駅から徒歩10分\n無料送迎バスあり（要予約）' }),
      contactBlock,
    ],
  },

  education: {
    label: '教育・スクール',
    emoji: '📚',
    colorScheme: 'professional-blue',
    bgColor: '#1e3a8a',
    schemaType: 'EducationalOrganization',
    seoTitleTemplate: '{name} | {area}の塾・スクール',
    blocks: [
      b('hero', { heading: '{name}', subheading: 'お子様の可能性を最大限に伸ばします', ctaText: '無料体験授業を申し込む', ctaLink: '#contact', bgColor: '#1e3a8a', textColor: '#ffffff' }),
      b('heading', { text: '選ばれる理由', subtext: '{description}', align: 'center' }),
      b('three-col', { col1Icon: '📈', col1Title: '成績向上実績', col1Text: '通塾3ヶ月で平均20点アップの実績', col2Icon: '👩‍🏫', col2Title: '熟練の講師陣', col2Text: '教育経験豊富な講師が個別に指導', col3Icon: '😊', col3Title: '楽しく続けられる', col3Text: 'やる気を引き出す独自のカリキュラム' }),
      b('services', { heading: 'コース・料金', columns: '3', items: [{ icon: '📐', title: '小学生コース', description: '基礎から応用まで丁寧に', price: '10,000円/月' }, { icon: '📚', title: '中学生コース', description: '高校受験対策まで完全対応', price: '15,000円/月' }, { icon: '🎓', title: '高校生コース', description: '大学受験に向けた集中指導', price: '20,000円/月' }] }),
      b('cta', { heading: '無料体験授業、受付中', subtext: 'まずはお子様の現状を把握するところから。無料でご相談ください。', buttonText: '無料体験を申し込む', buttonLink: '#contact', bgColor: '#1e3a8a', textColor: '#ffffff' }),
      b('hours', makeHours('14:00〜21:00', '')),
      contactBlock,
    ],
  },
};

export function getTemplateForIndustry(industry: string): IndustryTemplate | null {
  return INDUSTRY_TEMPLATES[industry] ?? null;
}

export function applyTemplateData(template: IndustryTemplate, data: {
  name: string;
  address: string;
  description: string;
  catchphrase: string;
  phone: string;
  services: Array<{ name: string; description: string; price: string }>;
  hours: Array<{ day: string; open: string; close: string; closed: boolean }>;
}): Block[] {
  const replace = (text: string) =>
    text
      .replace(/{name}/g, data.name || '店舗名を入力')
      .replace(/{address}/g, data.address || '住所を入力')
      .replace(/{description}/g, data.description || 'お店の紹介文を入力してください。')
      .replace(/{area}/g, data.address?.split('区')[0]?.split('市')[0] || '地域');

  const applyToBlock = (block: Block): Block => {
    const newData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(block.data)) {
      if (typeof value === 'string') {
        newData[key] = replace(value);
      } else if (Array.isArray(value)) {
        newData[key] = value;
      } else {
        newData[key] = value;
      }
    }

    // Inject custom services if provided
    if (block.type === 'services' && data.services.some(s => s.name)) {
      newData['items'] = data.services
        .filter(s => s.name)
        .map(s => ({ icon: '⭐', title: s.name, description: s.description, price: s.price }));
    }

    // Inject custom hours if provided
    if (block.type === 'hours' && data.hours.length > 0) {
      newData['schedule'] = data.hours.map(h => ({
        day: h.day.slice(0, 1),
        hours: h.closed ? '' : `${h.open}〜${h.close}`,
        closed: h.closed,
      }));
    }

    return { ...block, data: newData };
  };

  return template.blocks.map(applyToBlock);
}
