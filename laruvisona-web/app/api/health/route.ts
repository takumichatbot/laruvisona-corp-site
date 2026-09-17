import { NextResponse } from 'next/server';

/**
 * いま本番で動いているのが、どのコミットかを返す。
 *
 * push は成功したのに反映されていない、という状態が**どこからも見えなかった。**
 * 出荷係のログは push までしか知らない。誰かが管理画面を開くまで、
 * 「上げたのに古いまま」が誰にも分からない。
 *
 * ここが返す commit と、出荷したコミットを突き合わせれば、
 * push から公開までが一本の線でつながる（scripts/ship/ship-watch.sh）。
 *
 * 識別子は、置き場所によって入る変数が違う。だから
 *   1. ビルド時に焼き込んだもの（next.config.ts の BUILD_COMMIT）
 *   2. 各社が入れる変数
 * の順に見る。どれも無ければ null を返す（嘘の値は返さない）。
 *
 * 鍵になるものは返さない。platform は「その名前の変数があるか」だけで、
 * 中身は一切返さない。
 */
export const dynamic = 'force-dynamic';

const STARTED_AT = new Date().toISOString();

const PLATFORM_HINTS = [
  'VERCEL', 'RENDER', 'FLY_APP_NAME', 'RAILWAY_ENVIRONMENT',
  'K_SERVICE', 'AWS_EXECUTION_ENV', 'DYNO', 'WEBSITE_INSTANCE_ID', 'PM2_HOME',
] as const;

function commitSha(): string | null {
  const candidates = [
    process.env.BUILD_COMMIT,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.GIT_COMMIT_SHA,
    process.env.RENDER_GIT_COMMIT,
    process.env.SOURCE_VERSION,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && /^[0-9a-f]{7,40}$/.test(value)) return value;
  }
  return null;
}

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      commit: commitSha(),
      builtAt: process.env.BUILD_TIME ?? null,
      startedAt: STARTED_AT,
      now: new Date().toISOString(),
      platform: PLATFORM_HINTS.filter((key) => !!process.env[key]),
    },
    { headers: { 'Cache-Control': 'no-store, private' } },
  );
}
