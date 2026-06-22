import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

// POST /api/ai/site-audit
// body: { siteId }
// Returns scored list of improvements + overall score

interface AuditResult {
  score: number;
  summary: string;
  items: Array<{
    category: string;
    issue: string;
    suggestion: string;
    impact: 'high' | 'medium' | 'low';
    score: number;
  }>;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId } = await req.json() as { siteId: string };
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const { data: site } = await supabase
    .from('sites')
    .select('id, name, industry, slug, blocks_json, seo_json, published, page_title, meta_description, settings_json')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single();

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  // Count blocks and check types
  const blocks = (site.blocks_json as Array<{ type: string; data?: Record<string, unknown> }>) || [];
  const blockTypes = blocks.map((b) => b.type);
  const hasContact = blockTypes.includes('contact');
  const hasBlog = blockTypes.includes('news');
  const hasMap = blockTypes.includes('map');
  const hasGallery = blockTypes.includes('gallery') || blockTypes.includes('photo');
  const hasFaq = blockTypes.includes('faq');
  const hasReview = blockTypes.includes('review');
  const blockCount = blocks.length;

  const seo = (site.seo_json as Record<string, unknown>) || {};
  const settings = (site.settings_json as Record<string, unknown>) || {};
  const hasMetaDesc = !!site.meta_description;
  const hasOgImage = !!(seo.ogImage);
  const hasKeywords = !!(seo.keywords);
  const hasChatbot = !!(settings.larubot_enabled);
  const hasAnalytics = !!(settings.ga_id);

  const auditContext = {
    siteName: site.name,
    industry: site.industry,
    published: site.published,
    blockCount,
    blockTypes,
    hasContact,
    hasBlog,
    hasMap,
    hasGallery,
    hasFaq,
    hasReview,
    hasMetaDesc,
    hasOgImage,
    hasKeywords,
    hasChatbot,
    hasAnalytics,
    pageTitle: site.page_title,
  };

  const prompt = `あなたは日本のローカルビジネスのWebサイト診断専門家です。
以下のサイト情報を分析して、改善点と総合スコアを出力してください。

## サイト情報
${JSON.stringify(auditContext, null, 2)}

## 診断カテゴリ
1. SEO最適化（メタ情報、キーワード、OGP）
2. コンテンツ充実度（ブロック構成、FAQ、実績・口コミ）
3. 集客・コンバージョン（問い合わせ動線、チャットボット）
4. ローカルSEO（地図、業種別コンテンツ）
5. アクセス解析（GA連携、データ活用）

## 出力形式 (JSONのみ)
{
  "score": 75,
  "summary": "全体的な評価（2〜3文）",
  "items": [
    {
      "category": "SEO最適化",
      "issue": "具体的な問題点",
      "suggestion": "具体的な改善アクション（actionableに）",
      "impact": "high",
      "score": 60
    }
  ]
}

各カテゴリから最低1件、合計5〜8件の改善項目を出力してください。
impactはhigh/medium/lowのいずれか。scoreは各カテゴリの現状スコア（0〜100）。
総合scoreは全体の加重平均（0〜100）。`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: 'Parse failed' }, { status: 500 });

    const result = JSON.parse(match[0]) as AuditResult;

    // Cache result in site settings_json
    await supabase.from('sites').update({
      settings_json: { ...(settings as object), last_audit: result, last_audit_at: new Date().toISOString() },
    }).eq('id', siteId);

    return NextResponse.json({ ok: true, audit: result, auditedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
