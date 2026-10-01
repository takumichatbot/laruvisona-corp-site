/**
 * 編集欄の近くに出す「書き方」の短い案内。制作画面だけで使い、公開HTML・OG・構造化データには入れない。
 *
 * まず共通の案内（どの業種でも成り立つもの）。工事・施工／美容／飲食だけ、言い回しを業種に寄せる。
 * 業種が不明なサイトは共通の案内になる。案内は事実の書き方だけを示し、実績・年数・料金などの数字を例として出さない。
 */
type GuideKey = string;   // `${blockType}.${field}` か `${blockType}.${field}.${sub}`

const COMMON: Record<GuideKey, string> = {
  'hero.heading': '誰の、どんな困りごとに応えるのかを一文で。店名だけより伝わります。',
  'hero.subheading': '地域・業種・店名など、来た人が「自分向けか」を判断できる情報を。',
  'heading.text': 'この下の節で伝えることを、短く。',
  'paragraph.text': '大切にしていること・成り立ちを、ご自身の言葉で。実際にしていることだけを書きます。',
  'services.items.title': '実際に受けている仕事・メニューの名前を。',
  'services.items.description': '何をしてもらえるか、どんな人に向いているかを1〜2文で。',
  'services.items.price': '実際の料金だけを。決まっていなければ「お見積り」など、決め方をそのまま書きます。',
  'price-table.plans.name': 'メニューの名前を。',
  'price-table.plans.price': '実際の金額だけを。税込・税別も実際のとおりに。',
  'price-table.plans.description': '含まれる内容・所要時間など、事実を短く。',
  'three-col.col1Title': '選ばれる理由を短く。年数・資格・保証は、実際にあるものだけ。',
  'three-col.col1Text': '理由の中身を、事実で1〜2文。',
  'faq.items.q': '実際によく聞かれる質問を、来た人の言葉で。',
  'faq.items.a': '答えは短く。料金・期間は実際の決め方のとおりに。',
  'tabs.items.label': '問い合わせから完了までの段階の名前を、実際の順に。',
  'tabs.items.body': 'その段階で何をするか、来た人が何をすればよいかを。',
  'testimonials.items.text': '掲載の許可を得た、実際のお客様の声だけを。無ければ、この節を載せない選択もできます。',
  'contact.subtext': '返信までの目安・受付時間など、実際の運用どおりに。',
  'two-col.col1Text': 'この欄の題名に合う内容を、実際の情報で（住所・最寄り駅・営業時間・定休日など）。',
  'two-col.col2Text': 'この欄の題名に合う内容を、実際の情報で（住所・最寄り駅・営業時間・定休日など）。',
  'hours.note': '定休日・臨時休業・予約の要否など、実際の運用どおりに。',
  'gallery.images': 'ご自身の仕事・お店・商品の写真を。人が写る写真は掲載の許可を得たものだけ。',
  'hero.bgImage': 'ご自身の仕事・お店の雰囲気が伝わる写真を1枚。',
  'team.items.bio': '担当する人の得意なこと・経歴を、ご本人が確認した内容で。',
};

const BY_INDUSTRY: Record<string, Record<GuideKey, string>> = {
  construction: {
    'services.items.description': '工事の内容（水回り・外壁など）と、対応している範囲を。費用は「現地確認のあと見積り」など、実際の決め方で。',
    'gallery.images': '施工の前後や現場の写真を。お客様の家が写る写真は、掲載の許可を得たものだけ。',
    'tabs.items.body': '相談・現地確認・見積り・工事・引き渡しなど、実際の進め方を順に。',
  },
  beauty: {
    'services.items.description': 'メニューの内容と所要時間を。仕上がりの約束はせず、していることを書きます。',
    'gallery.images': '仕上がりの写真を。お客様が写る写真は、掲載の許可を得たものだけ。',
    'price-table.plans.description': '含まれる施術・所要時間を。料金は税込の実際の金額で。',
  },
  restaurant: {
    'services.items.description': '料理・飲み物の特徴を、素材や作り方など事実で。',
    'gallery.images': '料理・飲み物・店内の写真を。',
    'price-table.plans.price': 'メニュー表と同じ、実際の価格を。',
    'hours.note': 'ラストオーダー・定休日・貸切の有無など、実際の運用どおりに。',
  },
};

/** 3つの特徴は col1〜col3 で同じ案内 */
const normalize = (blockType: string, field: string) =>
  blockType === 'three-col' ? field.replace(/^col[23]/, 'col1') : field;

export function guideFor(industry: string | null | undefined, blockType: string, field: string, sub?: string): string {
  const key = `${blockType}.${normalize(blockType, field)}${sub ? `.${sub}` : ''}`;
  return (industry && BY_INDUSTRY[industry]?.[key]) || COMMON[key] || '';
}
