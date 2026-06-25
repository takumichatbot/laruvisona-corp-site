import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get('audio') as Blob | null;
    const projectName = (formData.get('projectName') as string | null) ?? '不明';
    const historyRaw = (formData.get('history') as string | null) ?? '[]';

    if (!audioBlob || audioBlob.size === 0) {
      return NextResponse.json({ error: '音声データがありません' }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) throw new Error('OPENAI_API_KEY が未設定です');
    const openai = new OpenAI({ apiKey: openaiKey });

    let history: { role: string; text: string }[] = [];
    try { history = JSON.parse(historyRaw); } catch { /* ignore */ }

    // 1. Whisper 音声認識
    const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());
    const blobType = audioBlob.type || 'audio/webm';
    const ext = blobType.includes('mp4') || blobType.includes('m4a') ? 'm4a'
      : blobType.includes('ogg') ? 'ogg'
      : 'webm';
    const audioFile = new File([audioBuffer], `recording.${ext}`, { type: blobType });

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      language: 'ja',
    });

    const transcript = transcription.text.trim();
    if (!transcript) {
      return NextResponse.json({ transcript: '', response: '音声が聞き取れませんでした。もう一度話してください。', directive: '', audio: null });
    }

    // 2. AI 応答 (Claude 優先 → GPT fallback)
    const systemPrompt = `あなたは「Bridge」というAIコーディングアシスタントです。プロジェクト: ${projectName}。
日本語で簡潔に会話し、ユーザーの開発意図を把握して具体的な実装指示に変換してください。
タスクが明確になったら末尾に "→ AI Team に送信できます: [指示文]" を追加してください。
返答は2〜3文で簡潔に。コードブロックは不要です。`;

    const historyMsgs = history.slice(-4).map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.text,
    }));

    let response = '';
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (anthropicKey) {
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const r = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: systemPrompt,
        messages: [...historyMsgs, { role: 'user', content: transcript }],
      });
      response = r.content[0].type === 'text' ? r.content[0].text : '';
    } else {
      const r = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMsgs.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: transcript },
        ],
      });
      response = r.choices[0].message.content ?? '';
    }

    // Directive 検出
    const directiveMatch = response.match(/→ AI Team に送信できます[：:]\s*(.+?)(?:\n|$)/);
    const directive = directiveMatch?.[1]?.trim() ?? '';

    // 3. TTS 音声合成
    const ttsText = response.replace(/→ AI Team に送信できます.+/, '').trim().slice(0, 500);
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'shimmer',
      input: ttsText || '応答しました',
      speed: 1.1,
    });

    const audioData = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = audioData.toString('base64');

    return NextResponse.json({ transcript, response, directive, audio: base64Audio });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '音声処理エラー';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
