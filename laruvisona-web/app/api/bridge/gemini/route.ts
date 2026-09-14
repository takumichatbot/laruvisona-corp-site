import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { bridgeText, readBridgeJson } from '@/lib/bridge-input';

function textHistory(value: unknown, limit: number) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 50) throw Error('invalid');
  return value.slice(-limit).map(entry => {
    if (!entry || typeof entry !== 'object') throw Error('invalid');
    const item = entry as Record<string, unknown>;
    if (item.role !== 'user' && item.role !== 'assistant') throw Error('invalid');
    return { role: item.role, content: bridgeText(item.content, 10_000, true) };
  });
}

function base64(value: unknown, max: number) {
  const text = bridgeText(value, max, true);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw Error('invalid');
  return text;
}

function getModel(modelName = 'gemini-2.0-flash') {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY が未設定です');
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: modelName });
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await readBridgeJson(req, 8 * 1024 * 1024);
    const { action } = body;

    // ── 1. 指示を強化 ────────────────────────────────────────────────────────
    if (action === 'enhance') {
      const input = bridgeText(body.input, 20_000, true);
      const projectName = bridgeText(body.projectName, 200);
      const ctx = textHistory(body.recentHistory, 4)
        .map(m => `${m.role === 'user' ? 'User' : 'Claude'}: ${m.content.slice(0, 300)}`)
        .join('\n');
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
      const imageBase64 = base64(body.imageBase64, 7_500_000);
      const mimeType = bridgeText(body.mimeType, 100) || 'image/jpeg';
      if (!/^image\/(?:jpeg|png|webp|gif)$/.test(mimeType)) throw Error('invalid');
      const result = await getModel().generateContent([
        { inlineData: { mimeType, data: imageBase64 } },
        `このスクリーンショット/画像を見て、Claude Code（AIコーディングアシスタント）への具体的なコーディング指示を日本語で生成してください。
UIのデザイン、エラーメッセージ、コードなどを分析して「〜を実装して」「〜を修正して」という形式の指示を1つ出力してください。
指示のみ出力（説明不要）。`,
      ]);
      return NextResponse.json({ result: result.response.text() });
    }

    // ── 3. 音声文字起こし ────────────────────────────────────────────────────
    if (action === 'transcribe') {
      const audioBase64 = base64(body.audioBase64, 7_500_000);
      const mimeType = bridgeText(body.mimeType, 100) || 'audio/webm';
      if (!/^audio\/(?:webm|mpeg|mp4|wav|ogg)$/.test(mimeType)) throw Error('invalid');
      const result = await getModel().generateContent([
        { inlineData: { mimeType, data: audioBase64 } },
        '音声を正確に書き起こして日本語テキストのみ出力してください。',
      ]);
      return NextResponse.json({ result: result.response.text() });
    }

    // ── 4. 出力要約 ──────────────────────────────────────────────────────────
    if (action === 'summarize') {
      const content = bridgeText(body.content, 100_000, true);
      const projectName = bridgeText(body.projectName, 200);
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
      const transcript = bridgeText(body.transcript, 20_000, true);
      const projectName = bridgeText(body.projectName, 200);
      const ctx = textHistory(body.recentHistory, 4)
        .map(m => `${m.role === 'user' ? 'User' : 'Claude'}: ${m.content.slice(0, 200)}`)
        .join('\n');
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
      const error = bridgeText(body.error, 100_000, true);
      const projectName = bridgeText(body.projectName, 200);
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
      const projectName = bridgeText(body.projectName, 200);
      if (!Array.isArray(body.files) || body.files.length > 50) throw Error('invalid');
      const fileContents = body.files.map(entry => {
        if (!entry || typeof entry !== 'object') throw Error('invalid');
        const file = entry as Record<string, unknown>;
        return { path: bridgeText(file.path, 500, true), content: bridgeText(file.content, 20_000) };
      })
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
      const diff = bridgeText(body.diff, 100_000, true);
      const projectName = bridgeText(body.projectName, 200);
      const prompt = `以下のgit diffを見て、適切なコミットメッセージを生成してください。
プロジェクト: ${projectName}

${diff.slice(0, 4000)}

形式: 「feat/fix/refactor/docs: 変更内容を日本語で1行」
コミットメッセージのみ出力してください。`;
      const result = await getModel().generateContent(prompt);
      return NextResponse.json({ result: result.response.text() });
    }

    // ── 9. Visual → AI Team ディレクティブ変換 ───────────────────────────────
    if (action === 'visual_to_directive') {
      const imageBase64 = base64(body.imageBase64, 7_500_000);
      const mimeType = bridgeText(body.mimeType, 100) || 'image/jpeg';
      if (!/^image\/(?:jpeg|png|webp|gif)$/.test(mimeType)) throw Error('invalid');
      const projectName = bridgeText(body.projectName, 200);
      const fileTree = bridgeText(body.fileTree, 50_000);
      const result = await getModel('gemini-2.5-flash-preview-05-20').generateContent([
        { inlineData: { mimeType, data: imageBase64 } },
        `あなたはソフトウェア開発の要件定義専門家です。
プロジェクト: ${projectName}
${fileTree ? `\nプロジェクト構造の一部:\n${(fileTree as string).slice(0, 1200)}\n` : ''}

この画像（UIデザイン・競合サービスのスクリーンショット・モックアップ・手書きスケッチ等）を詳細に分析して、
AIソフトウェアチームへの包括的な開発指示を生成してください。

## 指示文の要件
- 何を実装するか（具体的な機能・UI要素・API等）
- 使用すべき技術スタック（既存プロジェクトに合わせて）
- データ構造・状態管理の方針
- UX/デザインの詳細（色・レイアウト・アニメーション）
- 既存コードとの統合箇所

## 出力形式
開発チームへの指示文（300-500文字、日本語）のみ出力。タイトルや前置き不要。`,
      ]);
      return NextResponse.json({ result: result.response.text() });
    }

    // ── 10. PM ビジョン → エピック/ストーリー分解 ────────────────────────────
    if (action === 'pm_breakdown') {
      const vision = bridgeText(body.vision, 100_000, true);
      const projectName = bridgeText(body.projectName, 200);
      const mdl = body.model;
      const prompt = `あなたはアジャイル開発のプロダクトマネージャーです。
プロジェクト: ${projectName}

以下のプロダクトビジョンを分析し、実装可能なエピックとユーザーストーリーに分解してください。

## ビジョン
${vision}

## 出力形式 (JSONのみ)
{
  "productName": "プロダクト名",
  "summary": "ビジョン要約（2行）",
  "epics": [
    {
      "id": "epic_1",
      "title": "エピックタイトル",
      "description": "このエピックの目的",
      "priority": "high|medium|low",
      "stories": [
        {
          "id": "story_1_1",
          "title": "ユーザーストーリータイトル",
          "description": "ユーザーとして〜したい、なぜなら〜",
          "points": 3,
          "directive": "AIチームへの実装指示（具体的・実行可能）"
        }
      ]
    }
  ]
}`;
      const allowed = new Set(['claude-haiku-4-5-20251001', 'claude-sonnet-4-6']);
      if (mdl != null && !allowed.has(String(mdl))) return NextResponse.json({ error: 'モデルを確認してください' }, { status: 400 });
      const client2 = new (await import('@anthropic-ai/sdk')).default({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 });
      const resp = await client2.messages.create({
        model: mdl == null ? 'claude-sonnet-4-6' : String(mdl),
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
      let jsonStr = text.trim();
      const fence = jsonStr.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
      if (fence) jsonStr = fence[1].trim();
      const brace = jsonStr.match(/\{[\s\S]*\}/);
      if (brace) jsonStr = brace[0];
      try {
        return NextResponse.json({ plan: JSON.parse(jsonStr) });
      } catch {
        return NextResponse.json({ error: 'PMプラン生成失敗', raw: text.slice(0, 300) }, { status: 500 });
      }
    }

    // ── 11. Chat → AI Team 指示変換 ─────────────────────────────────────────
    if (action === 'chat_to_directive') {
      const pn = bridgeText(body.projectName, 200);
      const conv = textHistory(body.messages, 12)
        .map(m => `${m.role === 'user' ? 'User' : 'Claude'}: ${m.content.slice(0, 400)}`)
        .join('\n');
      const prompt = `以下のClaude Codeとの会話を分析して、AIソフトウェアチームへの包括的な実装指示を生成してください。
プロジェクト: ${pn}

会話:
${conv}

## 指示文の要件
- 会話から実装すべき機能・修正点をすべて抽出
- 具体的なファイル名・関数名・技術スタックを含める
- AIチームが迷わず実行できる詳細さ（200-400文字）
- 日本語のみ

指示文のみ出力してください。`;
      const result = await getModel().generateContent(prompt);
      return NextResponse.json({ result: result.response.text() });
    }

    return NextResponse.json({ error: '不明なアクション' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[bridge/gemini] failed', e instanceof Error ? e.name : 'unknown');
    return NextResponse.json({ error: 'Gemini APIエラー' }, { status: 502 });
  }
}
