import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BLOCK_PROMPTS: Record<string, (ctx: { businessName: string; industry: string; current: string; tone: string }) => string> = {
  hero: ({ businessName, industry, current, tone }) =>
    `業種「${industry}」のビジネス「${businessName}」のホームページヒーロー用コピーを生成してください。
現在のテキスト: ${current || 'なし'}
トーン: ${tone}
JSON形式で出力: { "heading": "見出し（15文字以内）", "subheading": "サブタイトル（40文字以内）", "ctaText": "ボタンテキスト（10文字以内）" }`,

  heading: ({ businessName, industry, current, tone }) =>
    `業種「${industry}」のビジネス「${businessName}」のセクション見出しと説明文を生成してください。
現在のテキスト: ${current || 'なし'}
トーン: ${tone}
JSON形式で出力: { "text": "見出し（20文字以内）", "subtext": "説明文（50文字以内）" }`,

  paragraph: ({ businessName, industry, current, tone }) =>
    `業種「${industry}」のビジネス「${businessName}」のホームページ本文を生成してください。
現在のテキスト: ${current || 'なし'}
トーン: ${tone}
JSON形式で出力: { "text": "本文（100〜150文字）" }`,

  cta: ({ businessName, industry, current, tone }) =>
    `業種「${industry}」のビジネス「${businessName}」の行動喚起セクションのコピーを生成してください。
現在のテキスト: ${current || 'なし'}
トーン: ${tone}
JSON形式で出力: { "heading": "CTA見出し（20文字以内）", "text": "説明文（60文字以内）", "buttonText": "ボタンテキスト（10文字以内）" }`,

  services: ({ businessName, industry, current, tone }) =>
    `業種「${industry}」のビジネス「${businessName}」のサービス・特徴を3つ提案してください。
現在のテキスト: ${current || 'なし'}
トーン: ${tone}
JSON形式で出力: { "heading": "セクション見出し（15文字以内）", "items": [{ "icon": "絵文字1つ", "title": "サービス名（10文字以内）", "description": "説明（40文字以内）" }, ...3件] }`,
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { blockType, businessName, industry, currentText, tone = 'プロフェッショナルかつ親しみやすい' } = await req.json() as {
    blockType: string;
    businessName: string;
    industry: string;
    currentText?: string;
    tone?: string;
  };

  const promptFn = BLOCK_PROMPTS[blockType];
  if (!promptFn) {
    return NextResponse.json({ error: 'Unsupported block type' }, { status: 400 });
  }

  const prompt = promptFn({ businessName: businessName || 'ビジネス', industry: industry || 'ビジネス', current: currentText || '', tone });

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'Parse failed' }, { status: 500 });

    return NextResponse.json({ result: JSON.parse(jsonMatch[0]) });
  } catch (e) {
    console.error('[AI copy]', e);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }
}
