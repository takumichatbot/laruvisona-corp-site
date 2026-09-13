import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readAiJson, requireAiAccess } from '@/lib/ai-access';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Google AI API key not configured' }, { status: 500 });

  const input=await readAiJson(req,2000);
  if(!input.ok)return input.response;
  const { prompt } = input.data;
  if (typeof prompt!=='string'||!prompt.trim()||prompt.length>800) return NextResponse.json({ error: 'prompt required' }, { status: 400 });
  const denied=await requireAiAccess(supabase,user.id,'image-generation',3);
  if(denied)return denied;

  const safePrompt = `Professional business website hero image. ${prompt}. Photorealistic, high quality, wide format, no text, no watermark.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: safePrompt }],
        parameters: { sampleCount: 1, aspectRatio: '16:9' },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message || 'Image generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const data = await res.json() as { predictions?: { bytesBase64Encoded: string; mimeType: string }[] };
  const pred = data.predictions?.[0];
  if (!pred) return NextResponse.json({ error: 'No image returned' }, { status: 500 });

  const dataUrl = `data:${pred.mimeType};base64,${pred.bytesBase64Encoded}`;
  return NextResponse.json({ url: dataUrl });
}
