import sharp from 'sharp';
import { getGeminiKey, getAdminStorage } from '@/lib/imagen';
import { buildShowcaseVideoPrompt, videoStoragePath } from '@/lib/veo-prompt';

// Google Veo 3.1 での短尺ループ動画の生成＋Supabase Storage保存。
//
// 用途は業種別ショーケースの「雰囲気」だけ。数秒・無音・ループ前提で使う。
// 画像ライブラリ(Imagen)と同じ鍵・同じバケットを使い、絵作りも既存のヒーロー画像を
// 種にする（image-to-video）ので、静止画と動画で絵柄がちぐはぐにならない。
//
// 重要: 生成は遅く（数十秒〜数分）、画像より一桁高い。
// 表示のたびに生成する自己修復方式にはせず、管理画面から明示的に作って貯める。

export { buildShowcaseVideoPrompt, videoStoragePath };

const VEO_MODEL = 'veo-3.1-generate-preview';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface VeoOperation {
  name?: string;
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: { video?: { uri?: string } }[];
    };
  };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * 1本生成して Storage に保存し、公開URLを返す。失敗時は理由つきで返す（例外は投げない）。
 * seedImageUrl を渡すと image-to-video になり、既存のヒーロー画像の絵柄を引き継ぐ。
 */
export async function generateVeoToStorage(opts: {
  industry: string;
  seedImageUrl?: string | null;
  durationSeconds?: '4' | '6' | '8';
  maxWaitMs?: number;
  model?: string;
}): Promise<{ url: string | null; reason?: string; detail?: string; usedSeed?: boolean }> {
  const apiKey = getGeminiKey();
  if (!apiKey) return { url: null, reason: 'no_api_key' };

  const duration = opts.durationSeconds || '4';
  const maxWait = opts.maxWaitMs ?? 4 * 60 * 1000;

  // 種画像（Imagenで作ったヒーロー）を JPEG にして渡す。webp のままだと受け付けない。
  let image: { bytesBase64Encoded: string; mimeType: string } | undefined;
  if (opts.seedImageUrl) {
    try {
      const res = await fetch(opts.seedImageUrl);
      if (res.ok) {
        const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
          .resize({ width: 1280, height: 720, fit: 'cover' })
          .jpeg({ quality: 90 })
          .toBuffer();
        // predictLongRunning は inlineData を受け付けない（あれは generateContent 用）。
        image = { bytesBase64Encoded: jpeg.toString('base64'), mimeType: 'image/jpeg' };
      }
    } catch {
      // 種画像が取れなくても text-to-video で続行する
    }
  }

  // 1) 生成を開始（長時間処理なので即座に operation 名が返る）
  const model = opts.model || VEO_MODEL;
  const startOnce = async (withImage: boolean) =>
    fetch(`${API_BASE}/models/${model}:predictLongRunning?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: buildShowcaseVideoPrompt(opts.industry), ...(withImage && image ? { image } : {}) }],
        parameters: { aspectRatio: '16:9', durationSeconds: Number(duration) },
      }),
    });

  let opName: string;
  let usedSeed = !!image;
  try {
    let start = await startOnce(true);
    if (!start.ok && image) {
      // 種画像が原因で弾かれたなら、画像なしで一度だけ作り直す。
      // 絵柄の一致より「動画が1本できること」を優先する。
      const body = await start.text().catch(() => '');
      if (start.status === 400 && /image|inlineData|bytesBase64Encoded/i.test(body)) {
        usedSeed = false;
        start = await startOnce(false);
      } else {
        return {
          url: null, reason: `start_failed_${start.status}`,
          detail: body.replace(/key=[^&"\s]+/g, 'key=***').slice(0, 500),
        };
      }
    }
    if (!start.ok) {
      const body = (await start.text().catch(() => '')).replace(/key=[^&"\s]+/g, 'key=***').slice(0, 500);
      return { url: null, reason: `start_failed_${start.status}`, detail: body };
    }
    const op = await start.json() as VeoOperation;
    if (!op.name) return { url: null, reason: 'no_operation_name' };
    opName = op.name;
  } catch {
    return { url: null, reason: 'start_error' };
  }

  // 2) 完了まで待つ
  const deadline = Date.now() + maxWait;
  let videoUri: string | undefined;
  while (Date.now() < deadline) {
    await sleep(10000);
    try {
      const res = await fetch(`${API_BASE}/${opName}?key=${apiKey}`);
      if (!res.ok) continue;
      const op = await res.json() as VeoOperation;
      if (op.error?.message) {
        // 何で落ちたのかを残す（安全フィルタ・入力画像の拒否などは本文にしか出ない）
        return { url: null, reason: 'generation_error', detail: op.error.message.slice(0, 500) };
      }
      if (!op.done) continue;
      videoUri = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      break;
    } catch {
      // 一時的な失敗は次の巡回で拾う
    }
  }
  if (!videoUri) return { url: null, reason: 'timeout_or_no_uri' };

  // 3) 取得して保存。生成物はGoogle側に2日しか残らないので、必ず自前に置く。
  try {
    const dl = await fetch(videoUri, { headers: { 'x-goog-api-key': apiKey } });
    if (!dl.ok) return { url: null, reason: `download_failed_${dl.status}` };
    const mp4 = Buffer.from(await dl.arrayBuffer());

    const admin = getAdminStorage();
    const path = videoStoragePath(opts.industry);
    const { error } = await admin.storage.from('site-images')
      .upload(path, mp4, { contentType: 'video/mp4', upsert: true });
    if (error) return { url: null, reason: 'storage_upload_failed' };
    return { url: admin.storage.from('site-images').getPublicUrl(path).data.publicUrl, usedSeed };
  } catch {
    return { url: null, reason: 'download_error' };
  }
}


/** この鍵で使えるモデル名の一覧。Veo のモデルIDを実地で確認するための診断用。 */
export async function listAvailableModels(): Promise<{ models: string[] } | { error: string }> {
  const apiKey = getGeminiKey();
  if (!apiKey) return { error: 'no_api_key' };
  try {
    const res = await fetch(`${API_BASE}/models?key=${apiKey}&pageSize=200`);
    if (!res.ok) return { error: `list_failed_${res.status}` };
    const data = await res.json() as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    return {
      models: (data.models || [])
        .filter(m => /veo|video/i.test(m.name || '') || (m.supportedGenerationMethods || []).includes('predictLongRunning'))
        .map(m => `${m.name} [${(m.supportedGenerationMethods || []).join(',')}]`),
    };
  } catch {
    return { error: 'list_error' };
  }
}
