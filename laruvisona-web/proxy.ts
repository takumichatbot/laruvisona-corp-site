import { LARUHP_ORIGIN, LARUHP_APP_ORIGIN, isLaruHpHost } from './lib/laruhp-host';
import { internalLaruHpPath, laruHpSitemapXml, publicPathFromLegacy } from './lib/laruhp-public';
import { createServerClient } from '@supabase/ssr';
import {
  sitePasswordCookieName, sitePasswordCookieValid, sitePasswordMatches,
  sitePasswordPageHtml, sitePasswordToken,
} from '@/lib/site-password';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = [
  '/laruHP/dashboard',
  '/laruHP/builder',
  '/laruHP/settings',
  '/laruHP/contacts',
  '/laruHP/crm',
  '/laruHP/booking',
  '/laruHP/newsletter',
  '/laruHP/blog',
  '/laruHP/larubot-logs',
  '/laruHP/agency',
  '/laruHP/onboarding',
  // /laruHP/admin は PIN 認証のみ（Supabase auth 不要）
];
// 新規ユーザー向けの導線。未ログインならログインではなく「新規登録」へ誘導する
// （LPのCTA「初月無料で始める」→ /laruHP/onboarding は新規顧客が大半のため）
const SIGNUP_FIRST = ['/laruHP/onboarding'];

const MAIN_HOST = (process.env.NEXT_PUBLIC_APP_URL || '')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

// 独自ドメイン → 公開中サイトの slug
//
// 以前は独自ドメインを一律 /hp/by-domain/<host> へ rewrite していたため、
// /shop も /post/<id> も存在しないパスもトップページが 200 で返っていた。
// ホストから slug を引いて /hp/<slug><path> へ渡すと、
// パス形式・サブドメイン形式と同じルートを通るので、
// 下層ページも 404 も本来の挙動になる。
//
// キャッシュは持たない。
// 5分キャッシュを入れていたときは、割当を A→B に変えても
// 同じインスタンスが旧Aへ案内し続けた（解除直後も同じ）。
// プロセス内Mapは複数インスタンス間で整合しないので、
// 「配信先の決定」には使わない。
// 参照は毎回1回のRESTで、ホストが顧客ドメインのときだけ走る。
async function slugForCustomDomain(host: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(
      `${url}/rest/v1/sites?custom_domain=eq.${encodeURIComponent(host)}&published=is.true&select=slug&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' },
    );
    const d = await r.json();
    if (Array.isArray(d) && d.length > 0 && typeof d[0]?.slug === 'string') return d[0].slug;
  } catch { /* 引けなければ未知のホストとして扱う */ }
  return null;
}

// 別名ホスト（apex/www のもう一方、旧ドメイン）→ そのサイトの正規URL
//
// sites.custom_domain は「主な公開URL」1つだけ。
// 同じサイトに確認済みのホストがもう1つある場合（apex と www の両方、
// 独自ドメインを変えたあとの旧ホストなど）、そのホストは配信先ではなく
// 主な公開URLへの転送元として扱う。
//
// 転送先は必ず「そのホストが属するサイト自身」の正規URLから作る。
// site_domains.redirects_to（外部の転送設定を観測した記録）は使わない。
// 観測値を配信の宛先にすると、別サイトのホストや自分自身を指し得るため。
//
// キャッシュは持たない（slugForCustomDomain と同じ理由）。
async function aliasTargetForHost(host: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(
      `${url}/rest/v1/site_domains`
      + `?host=eq.${encodeURIComponent(host)}`
      + `&status=in.(connected,legacy,alias)`
      + `&select=site_id,sites!inner(slug,custom_domain,published)`
      + `&sites.published=is.true&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' },
    );
    const d = await r.json();
    if (!Array.isArray(d) || d.length === 0) return null;
    const site = d[0]?.sites as { slug?: unknown; custom_domain?: unknown } | undefined;
    if (!site) return null;

    const primary = typeof site.custom_domain === 'string' ? site.custom_domain.toLowerCase() : null;
    // 主な公開URLが自分自身 → 転送すると輪になる。転送しない。
    if (primary && primary === host.toLowerCase()) return null;
    if (primary) return `https://${primary}`;

    // 主な公開URLがまだ独自ドメインでないサイト（旧ホストだけ残っている等）は
    // 標準URLへ返す。MAIN_HOST が無ければ転送先を作れないので転送しない。
    if (!MAIN_HOST || typeof site.slug !== 'string' || !site.slug) return null;
    return `https://${MAIN_HOST}/hp/${site.slug}`;
  } catch { /* 引けなければ未知のホストとして扱う */ }
  return null;
}

// 代理店の管理画面ドメイン判定（service roleで参照）
//
// ここもキャッシュを持たない。代理店ドメインの解除が最大5分反映されず、
// 解除済みのホストから管理画面へ入れる時間ができるため。
async function isAgencyAdminDomain(host: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  try {
    const r = await fetch(
      `${url}/rest/v1/profiles?agency_admin_domain=eq.${encodeURIComponent(host)}&select=id&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' },
    );
    const d = await r.json();
    return Array.isArray(d) && d.length > 0;
  } catch {
    return false;  // 引けなければ管理ドメインとして扱わない
  }
}

// 閲覧パスワードが設定されたサイトを、**本文を配る前に**止める。
//
// これまでの作りは、ページを丸ごと配信してから、JSで白い覆いを被せるだけ
// だった。パスワードは公開HTMLに平文で入り、本文もそこに全部あった。
// 編集画面は「アクセス時にパスワードの入力が必要になります」と書いている。
// その約束を守るには、配る前に止めるしかない。
//
// ここ（配信の手前）で止める理由:
//   ページ側で出し分けると、ISR（revalidate=3600）のキャッシュに
//   **最初の1回の結果が載って全員に配られる。** 入口の画面が焼き付くか、
//   もっと悪ければ本文が焼き付いて誰でも見られる。
//
// 代わりに、パスワードのあるサイトだけを毎回1回のRESTで引く。
// キャッシュは持たない。持つと「パスワードを設定した直後に開いていられる
// 時間」ができる。このファイルの他の照会も同じ理由でキャッシュを持たない。
async function sitePasswordFor(slug: string): Promise<{ password: string; name: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(
      `${url}/rest/v1/sites?slug=eq.${encodeURIComponent(slug)}&published=is.true`
      + `&select=name,settings_json->>sitePassword&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' },
    );
    const d = await r.json();
    const row = Array.isArray(d) ? d[0] : null;
    const password = row?.sitePassword;
    if (typeof password !== 'string' || !password) return null;
    return { password, name: typeof row?.name === 'string' ? row.name : 'このサイト' };
  } catch {
    // 引けないときは止めない。引けないことを理由に、
    // パスワードを設定していないお店のサイトまで閉じてしまうほうが害が大きい。
    return null;
  }
}

/** 入口で止めるべきなら Response を返す。通してよければ null。 */
async function sitePasswordGate(request: NextRequest, slug: string): Promise<NextResponse | null> {
  const site = await sitePasswordFor(slug);
  if (!site) return null;

  const cookieName = sitePasswordCookieName(slug);
  const noStore = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, private' };

  if (request.method === 'POST') {
    let attempt = '';
    try { attempt = String((await request.formData()).get('password') ?? ''); } catch { attempt = ''; }
    if (attempt && sitePasswordMatches(site.password, attempt)) {
      // 合鍵を渡して、同じURLをもう一度開かせる（再読み込みで再送信にならない）
      const back = NextResponse.redirect(request.nextUrl, 303);
      back.cookies.set(cookieName, sitePasswordToken(slug, site.password), {
        httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 12,
      });
      return back;
    }
    return new NextResponse(sitePasswordPageHtml(site.name, { failed: true }), { status: 401, headers: noStore });
  }

  if (sitePasswordCookieValid(slug, site.password, request.cookies.get(cookieName)?.value)) return null;
  return new NextResponse(sitePasswordPageHtml(site.name), { status: 401, headers: noStore });
}

export async function proxy(request: NextRequest) {
  const hostname = (request.headers.get('host') || '').split(':')[0];
  const pathname = request.nextUrl.pathname;

  // 旧案内URLは本文を返さず正規ドメインへ恒久転送する。
  // /laruHP/studio・認証・顧客ドメインには適用しない。
  const legacyPublicPath = publicPathFromLegacy(pathname);
  const isCompanyHost = ['laruvisona.jp', 'www.laruvisona.jp'].includes(hostname.toLowerCase());
  const companyPublicPath = pathname === '/plans' ? '/plans' : legacyPublicPath;
  if (isCompanyHost && companyPublicPath && ['GET', 'HEAD'].includes(request.method)) {
    const to = new URL(LARUHP_ORIGIN);
    to.pathname = companyPublicPath;
    to.search = request.nextUrl.search;
    return NextResponse.redirect(to, 308);
  }

  // サービス自身の案内ホスト。顧客ドメインの解決や認証DBには渡さない。
  if (isLaruHpHost(hostname)) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new NextResponse(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    if (hostname.toLowerCase() === 'www.laruhp.com' || pathname === '/laruHP' || pathname === '/laruHP/') {
      const to = new URL(LARUHP_ORIGIN);
      to.pathname = pathname === '/laruHP' || pathname === '/laruHP/' ? '/' : pathname;
      to.search = request.nextUrl.search;
      return NextResponse.redirect(to, 308);
    }
    if (pathname === '/robots.txt') {
      return new NextResponse('User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://laruhp.com/sitemap.xml\n', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    if (pathname === '/sitemap.xml') {
      return new NextResponse(laruHpSitemapXml(), {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      });
    }
    const publicRoute = internalLaruHpPath(pathname);
    if (publicRoute) {
      const to = request.nextUrl.clone();
      to.pathname = publicRoute;
      const response = NextResponse.rewrite(to);
      // 案内サイトの公開ページは、誰が見ても同じ内容で、個人のデータを含まない。
      // /laruHP 配下は force-dynamic のため、既定では private, no-store が付き、
      // CDNに一切乗らない。検索から人が来るページほど、その差が効く。
      // ここだけ、CDNには5分置いてよい・裏で更新してよい、と伝える。
      // 端末側には残さない（s-maxage はCDN向け、max-age=0 は利用者のブラウザ向け）。
      response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
      return response;
    }
    // 公開画像・映像・JS/CSSだけを同じoriginで配る。制作・認証は既存originへ。
    const staticFile = /^\/(?:lp|studio|salon|company|brand|images)\/.*\.(?:avif|webp|png|jpe?g|svg|mp4|webm|woff2?)$/i.test(pathname);
    // 検索エンジンの所有権確認ファイル。これを通さないと laruhp.com を
    // Search Console に登録できず、案内サイト側の検索状況を一切測れない。
    // （laruvisona.jp では配信できているが、この分岐に無いため laruhp.com では 404 になっていた）
    const siteVerification = /^\/google[0-9a-f]{16}\.html$/i.test(pathname);
    if (pathname.startsWith('/_next/') || staticFile || siteVerification ||
        ['/favicon.ico', '/laruhp-icon-192.png', '/laruhp-icon-512.png', '/apple-touch-icon.png', '/laruhp-manifest.json', '/indexnow-key.txt', '/laruHP/opengraph-image', '/api/domain-probe'].includes(pathname)) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/laruHP/')) {
      const to = new URL(LARUHP_APP_ORIGIN);
      to.pathname = pathname;
      to.search = request.nextUrl.search;
      return NextResponse.redirect(to, 307);
    }
    return new NextResponse(null, { status: 404 });
  }

  /*
    標準URL（laruvisona.jp/hp/<slug>）からの直アクセス。

    サブドメインや独自ドメインは下で書き換えるときに見るが、この道は
    書き換えを通らないので、ここで見る。**どの入口も漏らさない。**
    下のパス（/post/x、/shop、sitemap.xml など）も全部止める。
    入口を1つでも開けておくと、そこから本文が読める。
  */
  const directSite = /^\/hp\/([^/]+)(?:\/|$)/.exec(pathname);
  if (directSite && !pathname.startsWith('/hp/post/')) {
    const gated = await sitePasswordGate(request, decodeURIComponent(directSite[1]));
    if (gated) return gated;
  }

  const isSystemHost =
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.onrender.com') ||
    hostname.endsWith('.local') ||
    (MAIN_HOST && (hostname === MAIN_HOST || hostname === `www.${MAIN_HOST}`));

  // Custom domain routing: rewrite non-system hostnames（主ドメインは即スキップ＝DB照会なし）
  //
  // /hp と /laruHP を「素通し」にしていたため、顧客のドメインから
  // /hp/<別サイトのslug>/post/<id> を開くと、そのホスト上に
  // 別サイトの記事・商品が 200 で表示できた。
  // 顧客ホストでは内部パスも例外にせず、必ずそのホストのサイト配下へ写す
  // （結果として存在しないパスになり 404 になる）。
  //
  // 例外は次の3つだけ:
  //   /_next, /api … 基盤。POSTを巻き込まないためにも書き換えない
  //   /hp/post/<id> … 公開済みHTMLの中に残っている旧い記事リンク。
  //                   このルートは本文を描画せず、その記事が属するサイトの
  //                   正規URLへ308で転送するだけなので、
  //                   別サイトの本文がこのホストに出ることはない。
  const isLegacyPostLink = /^\/hp\/post\/[^/]+\/?$/.test(pathname);
  if (
    !isSystemHost &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/api') &&
    !isLegacyPostLink &&
    pathname !== '/favicon.ico'
  ) {
    // サブドメイン: <slug>.MAIN_HOST → /hp/<slug>（robots.txt/sitemap.xml等のサブパスもそのまま透過）
    // ワイルドカードDNS（*.MAIN_HOST → Render）を設定して初めて到達するホスト名なのでDB照会不要
    const sub = MAIN_HOST && hostname.endsWith(`.${MAIN_HOST}`)
      ? hostname.slice(0, -(MAIN_HOST.length + 1))
      : null;
    if (sub && !sub.includes('.')) {
      const gated = await sitePasswordGate(request, sub);
      if (gated) return gated;
      const url = request.nextUrl.clone();
      url.pathname = `/hp/${sub}${pathname === '/' ? '' : pathname}`;
      return NextResponse.rewrite(url);
    }

    // 管理画面の独自ドメインなら、ルートをダッシュボードへ（/laruHP・/api は下で通常処理）
    if (await isAgencyAdminDomain(hostname)) {
      if (pathname === '/') {
        const url = request.nextUrl.clone();
        url.pathname = '/laruHP/dashboard';
        return NextResponse.rewrite(url);
      }
    } else {
      // 独自ドメイン。ホストから公開中サイトの slug を引き、
      // サブドメイン形式と同じルート（/hp/<slug><path>）へ渡す。
      // 未知のホストは 404（トップページを 200 で返さない）。
      const slug = await slugForCustomDomain(hostname);
      if (!slug) {
        // 主な公開URLではないが、このサイトの確認済みホスト（apex/wwwの
        // もう一方、旧ドメイン）なら、パスとクエリを保ったまま正規URLへ転送する。
        const target = await aliasTargetForHost(hostname);
        if (target) {
          const to = new URL(target);
          const base = to.pathname.replace(/\/$/, '');       // /hp/<slug> か ''
          const rest = pathname === '/' ? '' : pathname;
          to.pathname = `${base}${rest}` || '/';
          to.search = request.nextUrl.search;                // クエリはそのまま
          // 念のための輪の防止（同じホスト・同じパスへは転送しない）
          if (!(to.hostname.toLowerCase() === hostname.toLowerCase() && to.pathname === pathname)) {
            return NextResponse.redirect(to, 308);
          }
        }
        return new NextResponse(null, { status: 404 });
      }
      const gated = await sitePasswordGate(request, slug);
      if (gated) return gated;
      const url = request.nextUrl.clone();
      url.pathname = `/hp/${slug}${pathname === '/' ? '' : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // Auth session handling for laruHP routes
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected pages
  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  if (isProtected && !user) {
    const isSignupFirst = SIGNUP_FIRST.some(p => pathname.startsWith(p));
    const dest = isSignupFirst ? '/laruHP/auth/signup' : '/laruHP/auth/login';
    const redirectUrl = new URL(dest, request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Auth pages are always accessible so users can switch accounts
  // The login page itself handles already-logged-in state

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
