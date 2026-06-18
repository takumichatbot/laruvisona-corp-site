import type { Block } from '@/types/laruHP';

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

const mapBlock = b('map', {
  heading: 'アクセス',
  embedUrl: '',
  height: 400,
});

export interface IndustryTemplate {
  label: string;
  emoji: string;
  colorScheme: string;
  bgColor: string;
  schemaType: string;
  seoTitleTemplate: string;
  designStyle: string;
  fontFamily: string;
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
    designStyle: 'rounded',
    fontFamily: 'rounded',
    blocks: [
      b('hero', { heading: '{name}', subheading: '心を込めた料理でお迎えします', ctaText: 'ご予約はこちら', ctaLink: '#booking', bgColor: '#7c2d12', textColor: '#ffffff' }),
      b('heading', { text: '私たちについて', subtext: 'お店のこだわりをご紹介します', align: 'center' }),
      b('paragraph', { text: '{description}', align: 'left' }),
      b('services', { heading: 'おすすめメニュー', columns: '3', items: [{ icon: '🍽', title: 'ランチコース', description: '旬の食材を使った日替わりランチ', price: '1,200円〜' }, { icon: '🍷', title: 'ディナーコース', description: 'シェフ特選のコース料理', price: '4,500円〜' }, { icon: '☕', title: 'カフェタイム', description: '手作りスイーツと厳選コーヒー', price: '800円〜' }] }),
      b('gallery', { heading: '店内・料理ギャラリー', images: ['', '', '', ''], columns: '2' }),
      b('two-col', {
        col1Title: '営業時間', col1Text: 'ランチ 11:30〜14:30\nディナー 17:30〜22:00\n※月曜定休',
        col2Title: 'アクセス', col2Text: '{address}\nお車でのご来店もOK。駐車場完備。',
      }),
      mapBlock,
      b('booking', {
        heading: 'ご予約',
        subtext: 'お電話でのご予約も承っております',
        serviceTypes: ['ランチ', 'ディナーコース', '個室', 'パーティー利用'],
        timeSlots: ['11:30', '12:00', '12:30', '17:30', '18:00', '18:30', '19:00', '19:30'],
        buttonText: '予約を申し込む',
        buttonColor: '#7c2d12',
        bgColor: '#fffbf7',
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
    designStyle: 'elegant',
    fontFamily: 'mincho',
    blocks: [
      b('hero', { heading: '{name}', subheading: 'あなたの美しさを最大限に引き出します', ctaText: '今すぐ予約する', ctaLink: '#booking', bgColor: '#831843', textColor: '#ffffff' }),
      b('heading', { text: 'サロンについて', subtext: '', align: 'center' }),
      b('paragraph', { text: '{description}', align: 'left' }),
      b('price-table', {
        heading: 'メニュー・料金プラン',
        subtext: '全てシャンプー・ブロー込みの価格です',
        plans: [
          { name: 'カット', price: '6,000円', period: '〜', description: 'カット+シャンプー+ブロー', features: ['カウンセリング無料', 'スタイリング剤込み', '仕上がり保証'], highlighted: false, buttonText: '予約する', buttonLink: '#booking' },
          { name: 'カラー', price: '8,000円', period: '〜', description: 'ダメージレスカラー対応', features: ['カラー診断無料', 'ホームケア提案', 'リタッチ対応'], highlighted: true, buttonText: '予約する', buttonLink: '#booking' },
          { name: 'パーマ', price: '12,000円', period: '〜', description: 'デジタルパーマ・コールドパーマ', features: ['デジタルパーマ対応', 'スタイリング指導', '持続性重視施術'], highlighted: false, buttonText: '予約する', buttonLink: '#booking' },
        ],
      }),
      b('testimonials', { heading: 'お客様の声', items: [{ name: '山田様', age: '30代', rating: 5, text: 'スタイリストさんの提案がすごく良くて、毎回おまかせしています！' }, { name: '鈴木様', age: '40代', rating: 5, text: '丁寧なカウンセリングで安心して任せられます。' }, { name: '佐藤様', age: '20代', rating: 5, text: '友達にも紹介しました。また来ます！' }] }),
      b('gallery', { heading: 'スタイルギャラリー', images: ['', '', '', ''], columns: '2' }),
      b('hours', makeHours('10:00〜20:00')),
      b('booking', {
        heading: 'ご予約',
        subtext: 'LINEでのご予約も受け付けております',
        serviceTypes: ['カット', 'カラー', 'パーマ', 'カット+カラー', 'トリートメント'],
        timeSlots: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
        buttonText: '予約する',
        buttonColor: '#831843',
        bgColor: '#fff1f2',
      }),
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
    designStyle: 'modern',
    fontFamily: 'noto',
    blocks: [
      b('hero', { heading: '{name}', subheading: '根本から改善。あなたの体の悩みに寄り添います', ctaText: '初回無料相談', ctaLink: '#booking', bgColor: '#064e3b', textColor: '#ffffff' }),
      b('heading', { text: 'こんなお悩みありませんか？', subtext: '', align: 'center' }),
      b('three-col', { col1Icon: '😫', col1Title: '肩こり・首の痛み', col1Text: 'デスクワークや姿勢の悪さからくる慢性的なこりに', col2Icon: '🦵', col2Title: '腰痛', col2Text: '立ち仕事・重い物の持ち運びによる腰の痛みに', col3Icon: '🦷', col3Title: '頭痛・めまい', col3Text: '筋肉の緊張から来る頭痛・自律神経の乱れに' }),
      b('heading', { text: '当院の特徴', subtext: '{description}', align: 'center' }),
      b('services', { heading: '施術メニュー', columns: '3', items: [{ icon: '🙌', title: '全身矯正', description: '骨盤・背骨の歪みを根本から整える', price: '5,500円' }, { icon: '💆', title: '肩こり・腰痛集中', description: '痛みの原因にアプローチ', price: '3,500円' }, { icon: '🌿', title: '初回体験', description: 'カウンセリング込みのお試しコース', price: '1,000円' }] }),
      b('testimonials', { heading: 'ご利用者様の声', items: [{ name: '田中様', age: '50代', rating: 5, text: '長年の腰痛が3回の施術で楽になりました。もっと早く来ればよかった。' }, { name: '山本様', age: '30代', rating: 5, text: '肩こりがひどくて来院。丁寧な説明で安心できました。' }, { name: '木村様', age: '40代', rating: 5, text: '定期的に通っています。体が軽くなって毎日快適です。' }] }),
      b('hours', makeHours('9:00〜20:00', '10:00〜17:00')),
      mapBlock,
      b('booking', {
        heading: '予約・お問い合わせ',
        subtext: '初回無料カウンセリング実施中',
        serviceTypes: ['全身矯正', '肩こり・腰痛集中', '初回体験（無料カウンセリング）', 'その他相談'],
        timeSlots: ['9:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
        buttonText: '予約を申し込む',
        buttonColor: '#064e3b',
        bgColor: '#f0fdf4',
      }),
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
    designStyle: 'minimal',
    fontFamily: 'biz',
    blocks: [
      b('hero', { heading: '{name}', subheading: '豊富な実績と専門知識で、お客様の課題を解決します', ctaText: '無料相談を予約する', ctaLink: '#booking', bgColor: '#111827', textColor: '#ffffff' }),
      b('heading', { text: '事務所について', subtext: '{description}', align: 'left' }),
      b('services', { heading: 'サービス内容', columns: '3', items: [{ icon: '📄', title: 'ご相談・診断', description: '初回無料でご相談を承ります', price: '無料' }, { icon: '📋', title: '書類作成', description: '各種申請書類の作成代行', price: '要見積' }, { icon: '🤝', title: 'コンサルティング', description: '継続的なサポート・顧問契約', price: '月額制' }] }),
      b('cta', { heading: 'まずは無料相談から', subtext: 'お電話・メール・ZOOMでのご相談も承ります。お気軽にお問い合わせください。', buttonText: '無料相談を予約する', buttonLink: '#booking', bgColor: '#1e3a8a', textColor: '#ffffff' }),
      b('hours', makeHours('9:00〜18:00')),
      b('booking', {
        heading: '無料相談のご予約',
        subtext: 'ZOOMでのオンライン相談も可能です',
        serviceTypes: ['初回無料相談', '書類作成依頼', '顧問契約相談', 'その他'],
        timeSlots: ['9:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
        buttonText: '相談を予約する',
        buttonColor: '#111827',
        bgColor: '#f8fafc',
      }),
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
    designStyle: 'bold',
    fontFamily: 'zen',
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
    designStyle: 'sharp',
    fontFamily: 'zen',
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
    designStyle: 'rounded',
    fontFamily: 'noto',
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
    designStyle: 'bold',
    fontFamily: 'zen',
    blocks: [
      b('hero', { heading: '{name}', subheading: '理想の体を、今日から始めよう', ctaText: '無料体験を申し込む', ctaLink: '#booking', bgColor: '#1c1917', textColor: '#ffffff' }),
      b('three-col', { col1Icon: '🏋️', col1Title: '最新設備', col1Text: '最新のトレーニングマシンを完備', col2Icon: '👨‍🏫', col2Title: 'プロトレーナー', col2Text: '経験豊富なパーソナルトレーナーが在籍', col3Icon: '🎯', col3Title: '結果にコミット', col3Text: '目標達成まで徹底サポート' }),
      b('price-table', {
        heading: '料金プラン',
        subtext: '全プラン無料体験あり',
        plans: [
          { name: 'ビジター', price: '2,200円', period: '/回', description: '1回から気軽にトレーニング', features: ['全設備使用可', 'タオル貸し出し', 'シャワー使用可'], highlighted: false, buttonText: '今すぐ来館', buttonLink: '#contact' },
          { name: 'スタンダード', price: '8,000円', period: '/月', description: '毎日来ても使い放題', features: ['設備使い放題', 'グループレッスン参加', 'ロッカー使用', 'トレーナー相談月1回'], highlighted: true, buttonText: '入会する', buttonLink: '#booking' },
          { name: 'パーソナル', price: '30,000円', period: '/月', description: 'プロが完全サポート', features: ['全て含む', 'パーソナル月8回', '食事指導', '進捗管理アプリ'], highlighted: false, buttonText: '無料相談', buttonLink: '#booking' },
        ],
      }),
      b('testimonials', { heading: 'ビフォーアフター・お客様の声', items: [{ name: '田中様', age: '30代', rating: 5, text: '3ヶ月で10kg減量に成功！トレーナーのサポートが手厚くて続けられました。' }, { name: '佐藤様', age: '40代', rating: 5, text: '体型だけでなく、体力もついて仕事のパフォーマンスが上がりました。' }, { name: '渡辺様', age: '20代', rating: 5, text: '初めてのジムで不安でしたが、丁寧に指導してもらえて安心です。' }] }),
      b('hours', makeHours('6:00〜23:00', '8:00〜20:00')),
      b('booking', {
        heading: '無料体験を申し込む',
        subtext: 'まずは見学だけでもOKです',
        serviceTypes: ['施設見学（無料）', '体験入会（無料）', 'パーソナルトレーニング体験', '入会相談'],
        timeSlots: ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
        buttonText: '体験予約をする',
        buttonColor: '#ea580c',
        bgColor: '#fff7ed',
      }),
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
    designStyle: 'elegant',
    fontFamily: 'mincho',
    blocks: [
      b('hero', { heading: '{name}', subheading: '特別なひとときを、心を込めておもてなしします', ctaText: '空室・料金を確認する', ctaLink: '#booking', bgColor: '#1c1917', textColor: '#ffffff' }),
      b('heading', { text: '施設のご案内', subtext: '{description}', align: 'center' }),
      b('services', { heading: 'プラン', columns: '3', items: [{ icon: '🌸', title: '素泊まりプラン', description: '気ままに自由な旅を', price: '8,000円〜/泊' }, { icon: '🍽', title: '朝食付きプラン', description: '地産地消の朝食を楽しむ', price: '12,000円〜/泊' }, { icon: '🥂', title: '夕食付きプラン', description: '旬の会席料理で贅沢な夜を', price: '20,000円〜/泊' }] }),
      b('gallery', { heading: '客室・施設', images: ['', '', '', ''], columns: '2' }),
      b('two-col', { col1Title: 'チェックイン・アウト', col1Text: 'チェックイン: 15:00〜\nチェックアウト: 〜11:00\n\n早期チェックインは要相談', col2Title: 'アクセス', col2Text: '{address}\n最寄り駅から徒歩10分\n無料送迎バスあり（要予約）' }),
      mapBlock,
      b('booking', {
        heading: '宿泊予約',
        subtext: '直前でもお気軽にお問い合わせください',
        serviceTypes: ['素泊まりプラン', '朝食付きプラン', '夕食付きプラン', '特別記念日プラン'],
        timeSlots: ['15:00〜', '16:00〜', '17:00〜', '18:00〜'],
        buttonText: '予約する',
        buttonColor: '#1c1917',
        bgColor: '#fffbeb',
      }),
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
    designStyle: 'rounded',
    fontFamily: 'noto',
    blocks: [
      b('hero', { heading: '{name}', subheading: 'お子様の可能性を最大限に伸ばします', ctaText: '無料体験授業を申し込む', ctaLink: '#booking', bgColor: '#1e3a8a', textColor: '#ffffff' }),
      b('heading', { text: '選ばれる理由', subtext: '{description}', align: 'center' }),
      b('three-col', { col1Icon: '📈', col1Title: '成績向上実績', col1Text: '通塾3ヶ月で平均20点アップの実績', col2Icon: '👩‍🏫', col2Title: '熟練の講師陣', col2Text: '教育経験豊富な講師が個別に指導', col3Icon: '😊', col3Title: '楽しく続けられる', col3Text: 'やる気を引き出す独自のカリキュラム' }),
      b('price-table', {
        heading: 'コース・料金',
        subtext: '全コース無料体験授業あり',
        plans: [
          { name: '小学生コース', price: '10,000円', period: '/月', description: '基礎から応用まで丁寧に', features: ['週2回授業', '宿題サポート', '保護者面談月1回'], highlighted: false, buttonText: '体験を申し込む', buttonLink: '#booking' },
          { name: '中学生コース', price: '15,000円', period: '/月', description: '高校受験対策まで完全対応', features: ['週3回授業', '定期テスト対策', '模擬試験月1回', '保護者面談'], highlighted: true, buttonText: '体験を申し込む', buttonLink: '#booking' },
          { name: '高校生コース', price: '20,000円', period: '/月', description: '大学受験に向けた集中指導', features: ['週3〜5回授業', '志望校別対策', '過去問演習', '入試直前講習'], highlighted: false, buttonText: '体験を申し込む', buttonLink: '#booking' },
        ],
      }),
      b('cta', { heading: '無料体験授業、受付中', subtext: 'まずはお子様の現状を把握するところから。無料でご相談ください。', buttonText: '無料体験を申し込む', buttonLink: '#booking', bgColor: '#1e3a8a', textColor: '#ffffff' }),
      b('hours', makeHours('14:00〜21:00', '')),
      b('booking', {
        heading: '無料体験授業のお申し込み',
        subtext: '体験当日は手ぶらでお越しください',
        serviceTypes: ['小学生コース体験', '中学生コース体験', '高校生コース体験', '保護者相談のみ'],
        timeSlots: ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
        buttonText: '体験予約をする',
        buttonColor: '#1e3a8a',
        bgColor: '#eff6ff',
      }),
      contactBlock,
    ],
  },

  wedding: {
    label: 'ウェディング・ブライダル',
    emoji: '💒',
    colorScheme: 'elegant-dark',
    bgColor: '#1c1917',
    schemaType: 'EventVenue',
    seoTitleTemplate: '{name} | {area}のウェディング・結婚式場',
    designStyle: 'elegant',
    fontFamily: 'mincho',
    blocks: [
      b('hero', { heading: '{name}', subheading: '二人の特別な日を、最高の思い出に', ctaText: '見学・相談を予約する', ctaLink: '#booking', bgColor: '#1c1917', textColor: '#ffffff' }),
      b('countdown', {
        heading: '次の挙式まであと',
        subtext: '限定日程でのご予約受付中',
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        bgColor: '#1c1917',
        textColor: '#ffffff',
      }),
      b('heading', { text: '私たちのこだわり', subtext: '{description}', align: 'center' }),
      b('three-col', { col1Icon: '💐', col1Title: 'おふたりだけの式', col1Text: '完全貸切でプライベートな空間をご提供', col2Icon: '👨‍🍳', col2Title: '一流シェフの料理', col2Text: '旬の食材を使ったコース料理でゲストをおもてなし', col3Icon: '📸', col3Title: '専属カメラマン', col3Text: 'プロカメラマンが最高の瞬間を記録します' }),
      b('price-table', {
        heading: 'プランと料金',
        subtext: '全プラン無料見学・相談会あり',
        plans: [
          { name: 'シンプルプラン', price: '380,000円', period: '〜', description: '少人数・家族挙式向け', features: ['挙式のみ（20名以下）', '衣装・ブーケ込み', 'フォト撮影', '演出小物一式'], highlighted: false, buttonText: '相談する', buttonLink: '#booking' },
          { name: 'スタンダードプラン', price: '800,000円', period: '〜', description: '最も人気の定番プラン', features: ['挙式＋披露宴（50名）', '衣装・ヘアメイク込み', '料理（フルコース）', 'ムービー制作', '装花アレンジ'], highlighted: true, buttonText: '見学を予約', buttonLink: '#booking' },
          { name: 'プレミアムプラン', price: '150万円', period: '〜', description: '完全オーダーメイド', features: ['全て含む', '完全オリジナル演出', 'ドレスフルオーダー', 'ハネムーン手配', '専属プランナー'], highlighted: false, buttonText: '相談する', buttonLink: '#booking' },
        ],
      }),
      b('gallery', { heading: '実際の式場・装飾', images: ['', '', '', ''], columns: '2' }),
      b('testimonials', { heading: 'ご利用されたカップルの声', items: [{ name: '佐藤 様ご夫妻', age: '20代', rating: 5, text: '担当プランナーさんが本当に親身になってくれて、理想以上の式になりました。ゲスト全員が喜んでくれました。' }, { name: '田中 様ご夫妻', age: '30代', rating: 5, text: '料理がとても美味しかったと親族に大好評。アットホームな雰囲気が素晴らしかったです。' }, { name: '山口 様ご夫妻', age: '20代', rating: 5, text: 'ゼロから一緒に考えてもらえて、二人だけのオリジナルの式ができました。' }] }),
      b('faq', {
        heading: 'よくあるご質問',
        items: [
          { q: '見学・相談は無料ですか？', a: 'はい、見学・ブライダル相談は完全無料です。お気軽にお申し込みください。' },
          { q: '少人数でも対応できますか？', a: 'ご家族のみ10名様からでもご対応可能です。むしろ少人数での温かみのある式は大変ご好評をいただいています。' },
          { q: '持ち込み料はかかりますか？', a: 'ドレスや小物の持ち込みに対応しています。詳細はご相談時にご確認ください。' },
        ],
      }),
      b('booking', {
        heading: '見学・ブライダル相談のご予約',
        subtext: '所要時間約1時間。お二人でのご来場歓迎です',
        serviceTypes: ['式場見学（無料）', 'ブライダル相談（無料）', 'フェア参加', '資料請求'],
        timeSlots: ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00'],
        buttonText: '見学を予約する',
        buttonColor: '#1c1917',
        bgColor: '#fdf8f0',
      }),
      contactBlock,
    ],
  },

  pet: {
    label: 'ペットサロン・トリミング',
    emoji: '🐾',
    colorScheme: 'fresh-green',
    bgColor: '#052e16',
    schemaType: 'LocalBusiness',
    seoTitleTemplate: '{name} | {area}のペットサロン・トリミング',
    designStyle: 'rounded',
    fontFamily: 'rounded',
    blocks: [
      b('hero', { heading: '{name}', subheading: '大切なペットを、丁寧に心を込めてケアします', ctaText: 'トリミングを予約する', ctaLink: '#booking', bgColor: '#052e16', textColor: '#ffffff' }),
      b('heading', { text: '私たちのこだわり', subtext: '{description}', align: 'center' }),
      b('three-col', { col1Icon: '✂️', col1Title: '国家資格保有スタッフ', col1Text: 'トリマー国家資格（愛玩動物飼養管理士）保有スタッフが担当', col2Icon: '🛁', col2Title: '低刺激シャンプー', col2Text: '敏感肌・アレルギーのお子にも安心の低刺激・無添加シャンプー使用', col3Icon: '📸', col3Title: '仕上がり写真送付', col3Text: 'トリミング後はLINEでかわいい仕上がり写真をお送りします' }),
      b('price-table', {
        heading: 'トリミング料金',
        subtext: 'シャンプー・ブロー・爪切り・耳掃除込み',
        plans: [
          { name: '小型犬', price: '4,500円', period: '〜', description: 'チワワ・トイプードル・ダックスなど', features: ['シャンプー＆ブロー', '爪切り・耳掃除', '足裏カット', 'カット込み'], highlighted: false, buttonText: '予約する', buttonLink: '#booking' },
          { name: '中型犬', price: '6,500円', period: '〜', description: 'シュナウザー・コーギーなど', features: ['シャンプー＆ブロー', '爪切り・耳掃除', '足裏カット', 'カット込み', '肛門腺絞り'], highlighted: true, buttonText: '予約する', buttonLink: '#booking' },
          { name: '大型犬', price: '9,000円', period: '〜', description: 'ゴールデン・ラブラドールなど', features: ['シャンプー＆ブロー', '爪切り・耳掃除', '足裏カット', 'カット込み', '肛門腺絞り', '歯磨きオプション'], highlighted: false, buttonText: '予約する', buttonLink: '#booking' },
        ],
      }),
      b('gallery', { heading: 'トリミング before/after', images: ['', '', '', ''], columns: '2' }),
      b('testimonials', { heading: 'オーナー様の声', items: [{ name: '木村様（チワワ）', age: '40代', rating: 5, text: 'いつも嫌がっているトリミングが、こちらでは大人しく受けてくれます。スタッフさんが優しいからですね。' }, { name: '中村様（トイプー）', age: '30代', rating: 5, text: '仕上がり写真を毎回楽しみにしています！いつもかわいくしてもらえて感謝です。' }, { name: '田中様（ダックス）', age: '50代', rating: 5, text: '肌が弱い子ですが、低刺激シャンプーで肌荒れも出ず安心して任せられます。' }] }),
      b('hours', makeHours('10:00〜18:00', '')),
      b('booking', {
        heading: 'トリミングのご予約',
        subtext: 'ご予約はお電話またはフォームから',
        serviceTypes: ['小型犬トリミング', '中型犬トリミング', '大型犬トリミング', 'シャンプーのみ', '爪切り・耳掃除のみ'],
        timeSlots: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
        buttonText: '予約を申し込む',
        buttonColor: '#052e16',
        bgColor: '#f0fdf4',
      }),
      contactBlock,
    ],
  },
  dental: {
    label: '歯科クリニック',
    emoji: '🦷',
    colorScheme: 'professional-blue',
    bgColor: '#0c4a6e',
    schemaType: 'Dentist',
    seoTitleTemplate: '{name} | {area}の歯科・歯医者',
    designStyle: 'modern',
    fontFamily: 'noto',
    blocks: [
      b('hero', { heading: '{name}', subheading: '痛みの少ない治療と丁寧な説明で、お口の健康をサポートします', ctaText: '初診のご予約', ctaLink: '#booking', bgColor: '#0c4a6e', textColor: '#ffffff' }),
      b('heading', { text: '当院の特徴', subtext: '患者様に選ばれる理由', align: 'center' }),
      b('three-col', { col1Icon: '😊', col1Title: '痛みに配慮した治療', col1Text: '表面麻酔＋極細注射針で、注射の痛みを最小限に抑えた治療を行います', col2Icon: '🔬', col2Title: '最新機器完備', col2Text: 'デジタルレントゲン・口腔内カメラで状態を患者様にわかりやすくご説明', col3Icon: '🦷', col3Title: '予防歯科に注力', col3Text: '定期クリーニング・フッ素塗布で虫歯・歯周病の予防を徹底サポート' }),
      b('services', { heading: '診療メニュー', columns: '3', items: [{ icon: '🦷', title: '一般歯科', description: '虫歯治療・抜歯・詰め物', price: '保険適用' }, { icon: '✨', title: '審美歯科', description: 'ホワイトニング・セラミック', price: '自費診療' }, { icon: '👶', title: '小児歯科', description: 'お子様の歯の定期検診・予防', price: '保険適用' }, { icon: '🔧', title: '矯正歯科', description: 'ワイヤー・マウスピース矯正', price: '要相談' }, { icon: '🦴', title: 'インプラント', description: '天然歯に近い人工歯根', price: '自費診療' }, { icon: '😴', title: '訪問歯科', description: 'ご自宅・施設への往診対応', price: '保険適用' }] }),
      b('faq', { heading: 'よくある質問', items: [{ q: '初めて受診する場合、何を持参すればいいですか？', a: '健康保険証・医療券（お持ちの方）・お薬手帳をご持参ください。問診票は受付でご記入いただきます。' }, { q: '予約なしでも診てもらえますか？', a: '急患の場合は可能な限り対応いたします。ただし待ち時間が発生する場合がございますので、事前予約をおすすめします。' }, { q: 'クレジットカードは使えますか？', a: '自費診療に限り、主要クレジットカード・PayPayがご利用いただけます。' }] }),
      b('hours', makeHours('9:00〜12:30 / 14:30〜18:30', '9:00〜13:00')),
      b('booking', { heading: '診療のご予約', subtext: 'ネット予約は24時間受付中。お急ぎの方はお電話ください', serviceTypes: ['一般歯科（虫歯・歯石除去）', '定期検診・クリーニング', '審美・ホワイトニング', '矯正相談（無料）', '急患・痛みがある'], timeSlots: ['9:00', '10:00', '11:00', '14:30', '15:30', '16:30', '17:30'], buttonText: '予約を申し込む', buttonColor: '#0c4a6e', bgColor: '#f0f9ff' }),
      mapBlock,
      contactBlock,
    ],
  },

  photo: {
    label: 'フォトスタジオ・カメラマン',
    emoji: '📷',
    colorScheme: 'elegant-gray',
    bgColor: '#111827',
    schemaType: 'LocalBusiness',
    seoTitleTemplate: '{name} | {area}のフォトスタジオ・カメラマン',
    designStyle: 'minimal',
    fontFamily: 'kaisei',
    blocks: [
      b('hero', { heading: '{name}', subheading: '大切な瞬間を、美しく永遠に残します', ctaText: '撮影を予約する', ctaLink: '#booking', bgColor: '#111827', textColor: '#ffffff' }),
      b('heading', { text: '撮影メニュー', subtext: '様々なシーンに対応したプロ撮影プラン', align: 'center' }),
      b('services', { heading: '', columns: '3', items: [{ icon: '👶', title: 'ニューボーン・お宮参り', description: '生後7〜14日以内の記念撮影', price: '30,000円〜' }, { icon: '👨‍👩‍👧', title: '家族写真・七五三', description: 'ご家族の大切な節目を記念に', price: '25,000円〜' }, { icon: '💍', title: 'ウェディング', description: '前撮り・後撮り・フォトウェディング', price: '50,000円〜' }, { icon: '🏢', title: 'ビジネスポートレート', description: 'プロフィール・HP用写真', price: '15,000円〜' }, { icon: '🏪', title: '商品・物件撮影', description: 'EC・不動産向け商品撮影', price: '20,000円〜' }, { icon: '🎓', title: '入学・卒業・成人式', description: '人生の記念日を美しく', price: '20,000円〜' }] }),
      b('gallery', { heading: 'ポートフォリオ', images: ['', '', '', '', '', ''], columns: '3' }),
      b('paragraph', { text: '{description}', align: 'center' }),
      b('testimonials', { heading: 'お客様の声', items: [{ name: '山田様', age: '30代', rating: 5, text: 'ニューボーン撮影をお願いしました。赤ちゃんのペースに合わせてくれて、とても自然な表情が撮れました。' }, { name: '田中様ご夫婦', age: '20代', rating: 5, text: '前撮りをお願いしました。緊張していましたが、カメラマンさんのリードで自然に笑えました。仕上がりに大満足です。' }] }),
      b('price-table', { heading: 'プラン詳細', subtext: '全プラン データ納品込み', plans: [{ name: 'ベーシック', price: '15,000円', period: '〜', description: '撮影1時間・データ20枚', features: ['1時間撮影', 'データ20枚', 'オンライン納品', '2週間以内'], highlighted: false, buttonText: '予約する', buttonLink: '#booking' }, { name: 'スタンダード', price: '30,000円', period: '〜', description: '撮影2時間・データ50枚', features: ['2時間撮影', 'データ50枚', 'オンライン納品', '1週間以内', 'アルバム1冊'], highlighted: true, buttonText: '予約する', buttonLink: '#booking' }, { name: 'プレミアム', price: '60,000円', period: '〜', description: '撮影半日・データ全点', features: ['半日撮影', 'データ全点', 'オンライン納品', '1週間以内', 'アルバム2冊', '額装写真1枚'], highlighted: false, buttonText: '予約する', buttonLink: '#booking' }] }),
      b('booking', { heading: '撮影のご予約', subtext: 'ご希望の撮影内容をお選びください', serviceTypes: ['ニューボーン撮影', '家族写真・七五三', 'ウェディング前撮り', 'ビジネスポートレート', '商品・物件撮影', 'その他・ご相談'], timeSlots: ['10:00', '12:00', '14:00', '16:00'], buttonText: '撮影を予約する', buttonColor: '#111827', bgColor: '#f9fafb' }),
      contactBlock,
    ],
  },

  accounting: {
    label: '税理士・会計事務所',
    emoji: '📊',
    colorScheme: 'professional-blue',
    bgColor: '#1e3a5f',
    schemaType: 'AccountingService',
    seoTitleTemplate: '{name} | {area}の税理士・会計事務所',
    designStyle: 'minimal',
    fontFamily: 'biz',
    blocks: [
      b('hero', { heading: '{name}', subheading: '中小企業の経営をデータで支える、頼れるパートナー', ctaText: '無料相談を予約する', ctaLink: '#booking', bgColor: '#1e3a5f', textColor: '#ffffff' }),
      b('heading', { text: '選ばれる理由', subtext: '数字を通じて、経営者を支援します', align: 'center' }),
      b('three-col', { col1Icon: '⚡', col1Title: 'レスポンスが速い', col1Text: 'LINEやメールでの相談に原則24時間以内に回答。緊急時も安心です', col2Icon: '💻', col2Title: 'クラウド会計対応', col2Text: 'freee・マネフォワード・弥生クラウド完全対応。テレワーク支援も', col3Icon: '🤝', col3Title: '税務調査も安心', col3Text: '税務調査の立ち会いから対応まで、事務所が全面サポートします' }),
      b('services', { heading: '対応業務', columns: '3', items: [{ icon: '📝', title: '記帳代行・会計', description: '月次決算・試算表作成', price: '月額20,000円〜' }, { icon: '📊', title: '税務申告', description: '法人税・所得税・消費税申告', price: '年間120,000円〜' }, { icon: '💰', title: '給与計算・社会保険', description: '給与計算・年末調整・労務手続き', price: '月額15,000円〜' }, { icon: '🏢', title: '会社設立・創業支援', description: '設立手続き・創業融資相談', price: '110,000円〜' }, { icon: '📈', title: '経営計画策定', description: '事業計画・資金繰り改善', price: '別途見積り' }, { icon: '🏠', title: '相続税・贈与税', description: '相続対策・申告代行', price: '別途見積り' }] }),
      b('faq', { heading: 'よくある質問', items: [{ q: '顧問契約なしで単発の確定申告だけお願いできますか？', a: '可能です。個人事業主の確定申告のみのご依頼もお受けしております。まずはお気軽にご相談ください。' }, { q: '記帳は自分でやっているのですが、申告だけお願いできますか？', a: 'はい、申告のみのご依頼も承っております。データをご提出いただく形で対応いたします。' }, { q: '創業したばかりで何から始めればいいかわかりません', a: '創業支援パッケージをご用意しております。会社設立手続きから初年度の申告まで、一貫してサポートいたします。' }] }),
      b('testimonials', { heading: 'クライアントの声', items: [{ name: '山田社長（飲食業）', age: '40代', rating: 5, text: '毎月の試算表を分かりやすく説明してもらえるので、経営判断がしやすくなりました。レスポンスも速くて安心です。' }, { name: '鈴木様（個人事業主・デザイナー）', age: '30代', rating: 5, text: '確定申告を任せてから、節税の選択肢を教えてもらえて税負担が減りました。毎年お願いしています。' }] }),
      b('booking', { heading: '無料相談のご予約', subtext: '初回相談は無料です。お気軽にご予約ください', serviceTypes: ['個人の確定申告相談', '法人の税務・会計相談', '会社設立・創業支援', '相続・贈与税相談', '給与計算・社会保険相談'], timeSlots: ['9:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'], buttonText: '無料相談を予約する', buttonColor: '#1e3a5f', bgColor: '#f8fafc' }),
      mapBlock,
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
