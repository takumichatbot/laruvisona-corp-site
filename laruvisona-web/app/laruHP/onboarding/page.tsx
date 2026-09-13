import { redirect } from 'next/navigation';

type Params = Promise<Record<string, string | string[] | undefined>>;

// 公開済みの旧URLは残すが、制作経路は新しいスタジオへ一本化する。
export default async function OnboardingRedirect({ searchParams }: { searchParams: Params }) {
  const input = await searchParams;
  const output = new URLSearchParams();
  for (const key of ['industry', 'ref', 'mood']) {
    const value = input[key];
    if (typeof value === 'string' && value.length <= 200) output.set(key, value);
  }
  redirect(`/laruHP/studio${output.size ? `?${output}` : ''}`);
}
