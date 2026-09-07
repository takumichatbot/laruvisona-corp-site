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
}): Promise<{ url: string | null; reason?: string }> {
  const apiKey = getGeminiKey();
  if (!apiKey) return { url: null, reason: 'no_api_key' };

  const duration = opts.durationSeconds || '4';
  const maxWait = opts.maxWaitMs ?? 4 * 60 * 1000;

  // 種画像（Imagenで作ったヒーロー）を JPEG にして渡す。webp のままだと受け付けない。
  let image: { inlineData: { mimeType: string; data: string } } | undefined;
  if (opts.seedImageUrl) {
    try {
      const res = await fetch(opts.seedImageUrl);
      if (res.ok) {
        const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
          .resize({ width: 1280, height: 720, fit: 'cover' })
          .jpeg({ quality: 90 })
          .toBuffer();
        image = { inlineData: { mimeType: 'image/jpeg', data: jpeg.toString('base64') } };
      }
    } catch {
      // 種画像が取れなくても text-to-video で続行する
    }
  }

  // 1) 生成を開始（長時間処理なので即座に operation 名が返る）
  let opName: string;
  try {
    const start = await fetch(`${API_BASE}/models/${VEO_MODEL}:predictLongRunning?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: buildShowcaseVideoPrompt(opts.industry), ...(image ? { image } : {}) }],
        parameters: { aspectRatio: '16:9', resolution: '720p', durationSeconds: duration },
      }),
    });
    if (!start.ok) return { url: null, reason: `start_failed_${start.status}` };
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
      if (op.error?.message) return { url: null, reason: 'generation_error' };
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
    return { url: admin.storage.from('site-images').getPublicUrl(path).data.publicUrl };
  } catch {
    return { url: null, reason: 'download_error' };
  }
}
