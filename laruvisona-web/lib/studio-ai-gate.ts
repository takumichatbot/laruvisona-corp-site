import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasServiceAccess } from '@/lib/subscription-access';
import { hasFeature } from '@/lib/plan-limits';
import { requireAiAccess } from '@/lib/ai-access';

/**
 * 制作画面の AI（文案・言葉で直す・公開前の見直し）の入口の判定を1か所に。
 * 「AIに相談」（app/api/ai/section-proposal）と同じ条件：ログイン・プランに制作機能・契約が有効。
 * 運営アカウントも契約が無ければ使えない（押す前の表示と押した後の答えを変えない）。
 */
export type StudioAiAvailability = { available: true } | { available: false; reason: 'login' | 'contract' | 'not-ready' };

export async function studioAiAvailability(sb: SupabaseClient): Promise<StudioAiAvailability> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { available: false, reason: 'login' };
  const { data: profile, error } = await sb.from('profiles').select('plan, subscription_status').eq('id', user.id).single();
  if (error || !profile || !hasFeature(profile.plan, 'builder') || !hasServiceAccess(profile.subscription_status)) return { available: false, reason: 'contract' };
  if (!process.env.ANTHROPIC_API_KEY) return { available: false, reason: 'not-ready' };
  return { available: true };
}

/** 呼び出す前の確認。通れば null。利用回数（1時間あたり）もここで数える */
export async function requireStudioAi(sb: SupabaseClient, scope: string, hourlyLimit: number): Promise<NextResponse | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'ログインしてからAIをご利用ください。' }, { status: 401 });
  const { data: profile, error } = await sb.from('profiles').select('plan, subscription_status').eq('id', user.id).single();
  if (error || !profile || !hasFeature(profile.plan, 'builder') || !hasServiceAccess(profile.subscription_status))
    return NextResponse.json({ error: 'ご契約の状態を確認してください。' }, { status: 403 });
  return requireAiAccess(sb, user.id, scope, hourlyLimit);
}
