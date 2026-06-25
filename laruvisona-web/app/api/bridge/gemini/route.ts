import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

function getModel(modelName = 'gemini-2.0-flash') {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY が未設定です');
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: modelName });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── 1. 指示を強化 ────────────────────────────────────────────────────────
    if (action === 'enhance') {
      const { input, projectName, recentHistory } = body;
      const ctx = (recentHistory as { role: string; content: string }[])
        ?.slice(-4)
        .map(m => `${m.role === 'user' ? 'User' : 'Claude'}: ${m.content.slice(0, 300)}`)
        .join('\n') || '';
      const prompt = `あなたはClaude Code（AIコーディングアシスタント）への指示を最適化する専門家です。
プロジェクト: ${projectName}
${ctx ? `\n直近の会話:\n${ctx}\n` : ''}
ユーザーの指示: "${input}"

この指示をClaude Codeが正確に実行できるよう、具体的で明確なプロンプトに変換してください。
- ファイルパスや具体的な変更点を明示
- あいまいな表現を具体化
- 日本語で回答
- 変換後の指示のみ出力（説明不要）`;
      const result = await getModel().generateContent(prompt);
      return NextResponse.json({ result: result.response.text() });
    }

    // ── 2. 画像解析 ──────────────────────────────────────────────────────────
    if (action === 'image') {
      const { imageBase64, mimeType } = body;
      const result = await getModel().generateContent([
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
        `このスクリーンショット/画像を見て、Claude Code（AIコーディングアシスタント）への具体的なコーディング指示を日本語で生成してください。
UIのデザイン、エラーメッセージ、コードなどを分析して「〜を実装して」「〜を修正して」という形式の指示を1つ出力してください。
指示のみ出力（説明不要）。`,
      ]);
      return NextResponse.json({ result: result.response.text() });
    }

    // ── 3. 音声文字起こし ────────────────────────────────────────────────────
    if (action === 'transcribe') {
      const { audioBase64, mimeType } = body;
      const result = await getModel().generateContent([
        { inlineData: { mimeType: mimeType || 'audio/webm', data: audioBase64 } },
        '音声を正確に書き起こして日本語テキストのみ出力してください。',
      ]);
      return NextResponse.json({ result: result.response.text() });
    }

    // ── 4. 出力要約 ──────────────────────────────────────────────────────────
    if (action === 'summarize') {
      const { content, projectName } = body;
      const prompt = `以下はClaude Code（AIコーディングアシスタント）の実行結果です。プロジェクト: ${projectName}

${content.slice(0, 4000)}

この実行結果を3行以内で日本語要約してください:
- 何をしたか
- 成功/失敗の結果
- 重要な変更点やエラー（あれば）`;
      const result = await getModel().generateContent(prompt);
      return NextResponse.json({ result: result.response.text() });
    }

    // ── 5. Gemini Live 指示生成（音声会話からコーディング指示に変換）────────
    if (action === 'live_intent') {
      const { transcript, projectName, recentHistory } = body;
      const ctx = (recentHistory as { role: string; content: string }[])
        ?.slice(-4)
        .map(m => `${m.role === 'user' ? 'User' : 'Claude'}: ${m.content.slice(0, 200)}`)
        .join('\n') || '';
      const prompt = `あなたはClaude Code（AIコーディングアシスタント）への指示を生成する専門家です。
プロジェクト: ${projectName}
${ctx ? `\n直近の会話:\n${ctx}\n` : ''}
ユーザーの音声発言: "${transcript}"

この発言をClaude Codeへの具体的なコーディング指示に変換してください。
指示のみ出力（説明不要）。`;
      const result = await getModel().generateContent(prompt);
      return NextResponse.json({ result: result.response.text() });
    }

    // ── 6. エラー自動診断 ────────────────────────────────────────────────────
    if (action === 'diagnose') {
      const { error, projectName } = body;
      const prompt = `以下のエラーを分析して原因と修正方法を教えてください。
プロジェクト: ${projectName}
エラー:
${error}

以下の形式で日本語で回答してください:
**原因:** （簡潔に1-2行）
**修正方法:** （具体的な手順）
**Claude Codeへの指示:** （そのままClaude Codeに送れる形式で1行）`;
      const result = await getModel().generateContent(prompt);
      return NextResponse.json({ result: result.response.text() });
    }

    // ── 7. プロジェクト概要生成 ──────────────────────────────────────────────
    if (action === 'project_summary') {
      const { files, projectName } = body;
      const fileContents = (files as { path: string; content: string }[])
        .map(f => `## ${f.path}\n${f.content.slice(0, 1500)}`)
        .join('\n\n');
      const prompt = `以下のファイルを元にプロジェクト「${projectName}」の概要を日本語でまとめてください。
技術スタック、主な機能、アーキテクチャを3-5行で。

${fileContents}`;
      const result = await getModel().generateContent(prompt);
      return NextResponse.json({ result: result.response.text() });
    }

    // ── 8. コミットメッセージ生成 ────────────────────────────────────────────
    if (action === 'commit_message') {
      const { diff, projectName } = body;
      const prompt = `以下のgit diffを見て、適切なコミットメッセージを生成してください。
プロジェクト: ${projectName}

${diff.slice(0, 4000)}

形式: 「feat/fix/refactor/docs: 変更内容を日本語で1行」
コミットメッセージのみ出力してください。`;
      const result = await getModel().generateContent(prompt);
      return NextResponse.json({ result: result.response.text() });
    }

    return NextResponse.json({ error: '不明なアクション' }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Gemini APIエラー';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
