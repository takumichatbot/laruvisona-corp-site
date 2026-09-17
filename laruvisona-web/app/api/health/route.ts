import { NextResponse } from 'next/server';

/**
 * いま本番で動いているのが、どのコミットかを返す。
 *
 * push は成功したのに反映されていない、という状態が**どこからも見えなかった。**
 * 出荷係のログは push までしか知らない。Vercel の画面を人が開くまで、
 * 「上げたのに古いまま」が誰にも分からない。
 *
 * ここが返す commit と、出荷したコミットを突き合わせれば、
 * push から公開までが一本の線でつながる（scripts/ship/ship-watch.sh）。
 *
 * 鍵になるものは返さない。コミットの識別子と時刻だけ。
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      env: process.env.VERCEL_ENV ?? null,
      now: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store, private' } },
  );
}
