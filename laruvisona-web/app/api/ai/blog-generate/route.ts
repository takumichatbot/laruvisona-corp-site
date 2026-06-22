import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const INDUSTRY_LABELS: Record<string, string> = {
  beauty: '美容室・サロン', restaurant: '飲食店・カフェ', clinic: '整体・接骨院',
  fitness: 'フィットネス・ジム', legal: '弁護士・士業', construction: '工務店・建設',
  realestate: '不動産会社', retail: '小売店・ショップ', hotel: 'ホテル・旅館',
  dental: '歯科クリニック', education: '教育・スクール', wedding: 'ウェディング',
  pet: 'ペットサロン', photo: 'フォトスタジオ', accounting: '税理士・会計士',
};

const SEO_KEYWORD_TEMPLATES: Record<string, string[]> = {
  beauty: ['カット 値段', 'カラー 種類', 'ヘアケア おすすめ', 'パーマ 長持ち'],
  restaurant: ['ランチ おすすめ', '個室 予約', 'テイクアウト メニュー', 'ディナー コース'],
  clinic: ['腰痛 改善', '肩こり 原因', '整体 効果', '慢性痛 治療'],
  fitness: ['ダイエット 方法', '筋トレ 初心者', 'パーソナルトレーニング 効果', 'プロテイン 選び方'],
  legal: ['相続 手続き', '離婚 費用', '交通事故 示談', '会社設立 方法'],
  construction: ['リフォーム 費用', '注文住宅 流れ', '外壁塗装 時期', '増築 注意点'],
  realestate: ['マンション 買い方', '土地 選び方', '賃貸 注意点', '不動産投資 始め方'],
  retail: ['商品 選び方', 'ネット通販 安全', 'ポイント 活用', 'セール 時期'],
  hotel: ['温泉 効能', '記念日 プラン', 'チェックイン 時間', '周辺 観光'],
  dental: ['虫歯 予防', 'ホワイトニング 方法', '矯正 費用', '定期健診 重要性'],
  education: ['英語 学習法', 'プログラミング 入門', '子供 習い事', '資格 取得'],
  wedding: ['結婚式 費用', '少人数婚 メリット', 'フォトウェディング', 'ドレス 選び方'],
  pet: ['トリミング 頻度', '犬 シャンプー', 'ペット 健康管理', 'ワクチン 必要性'],
  accounting: ['確定申告 方法', '節税 対策', '会計 ソフト', '法人化 タイミング'],
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId, keyword, save = false } = await req.json() as {
    siteId: string;
    keyword?: string;
    save?: boolean;
  };

  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  // Verify site ownership
  const { data: site } = await supabase
    .from('sites')
    .select('id, name, industry, slug')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single();

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  // Check plan supports blog (hp-bot-seo or higher)
  const { data: profile } = await supabase.from('profiles').select('plan, subscription_status').eq('id', user.id).single();
  const plan = (profile as { plan?: string; subscription_status?: string } | null)?.plan ?? 'hp';
  const status = (profile as { subscription_status?: string } | null)?.subscription_status ?? 'inactive';
  const allowedPlans = ['hp-bot-seo', 'agency'];
  if (status === 'active' && !allowedPlans.includes(plan)) {
    return NextResponse.json({ error: 'このプランではAIブログ生成は利用できません。HP + Bot + SEOプラン以上が必要です。' }, { status: 403 });
  }

  const industryLabel = INDUSTRY_LABELS[site.industry || ''] || '事業';
  const templates = SEO_KEYWORD_TEMPLATES[site.industry || ''] || ['サービス 特徴', 'よくある質問', '料金 案内'];

  // Pick keyword: use provided or auto-select
  const targetKeyword = keyword || templates[Math.floor(Math.random() * templates.length)];
  const location = site.slug?.split('-')[0] || '地域';

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `あなたは日本のローカルビジネス向けSEOライターです。

以下の条件でSEOに最適化されたブログ記事を日本語で書いてください。

## 条件
- ビジネス名: ${site.name}
- 業種: ${industryLabel}
- キーワード: 「${targetKeyword}」
- 文字数: 800〜1200文字
- 構成: H2見出し3〜4個 + 各段落2〜3文

## 必須要素
- 冒頭でキーワードを自然に含める
- 読者の悩みや疑問から始める
- 具体的な数字や事例を含める
- 末尾に「${site.name}へのお問い合わせ」への導線を含める
- Markdownの見出し（##）を使う

## 出力形式 (JSONのみ、説明不要)
{
  "title": "SEOに効くタイトル（25〜35文字、キーワード含む）",
  "category": "カテゴリ（お知らせ/ブログ/イベント/キャンペーンのいずれか）",
  "content": "本文（Markdown形式）"
}`;

  let generated: { title: string; category: string; content: string } | null = null;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      generated = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    return NextResponse.json({ error: 'AI generation failed', detail: String(e) }, { status: 500 });
  }

  if (!generated) {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  }

  // Optionally save as draft to news_posts
  if (save) {
    const { data: post, error } = await supabase.from('news_posts').insert({
      site_id: siteId,
      title: generated.title,
      content: generated.content,
      category: generated.category || 'ブログ',
      published: false,
      published_at: new Date().toISOString().split('T')[0],
    }).select('id').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, postId: post?.id, keyword: targetKeyword, ...generated });
  }

  return NextResponse.json({ ok: true, keyword: targetKeyword, ...generated });
}
