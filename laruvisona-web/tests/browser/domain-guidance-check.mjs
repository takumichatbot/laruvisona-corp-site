import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';

const requireFrom = process.env.PLAYWRIGHT_FROM
  ? createRequire(`${process.env.PLAYWRIGHT_FROM}/`)
  : createRequire(import.meta.url);
const { chromium } = requireFrom('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:3337';
const output = process.env.OUTPUT_DIR || '/tmp/laruhp-domain-guidance';
fs.mkdirSync(output, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(ok ? 'OK' : 'FAIL', name, detail);
  if (!ok) throw Error(name);
}

function requestPublicPath(path) {
  return new Promise((resolve, reject) => {
    const target = new URL(base);
    const req = http.get({ hostname: target.hostname, port: target.port, path, headers: { host: 'laruhp.com' } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
  });
}

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, locale: 'ja-JP' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(`${base}/laruHP/domains`, { waitUntil: 'networkidle' });
    check(`${width} HTTP 200`, response?.status() === 200, String(response?.status()));
    check(`${width} 横にはみ出さない`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    check(`${width} 二つの開始地点`, await page.getByRole('link', { name: 'まだ持っていない', exact: true }).isVisible()
      && await page.getByRole('link', { name: 'すでに持っている', exact: true }).isVisible());
    check(`${width} 取得先が二社`, await page.locator('a[target="_blank"]').count() === 2);
    check(`${width} メール保護を表示`, await page.getByRole('heading', { name: '独自ドメインのメールを利用中の方へ' }).isVisible());
    check(`${width} 設定はログイン側origin`, await page.getByRole('link', { name: '接続設定を開く' }).getAttribute('href') === 'https://laruvisona.jp/laruHP/settings?tab=domain');
    check(`${width} 例外なし`, errors.length === 0, errors.join('\n'));
    await page.screenshot({ path: `${output}/${width}.png`, fullPage: true });
    await context.close();
  }

  const publicResponse = await requestPublicPath('/domains');
  check('laruhp.com /domains を内部ページへ配信', publicResponse.status === 200 && publicResponse.body.includes('あなたの名前で'));
  check('canonical は専用ドメイン', publicResponse.body.includes('https://laruhp.com/domains'));
} finally {
  await browser.close();
  fs.writeFileSync(`${output}/results.json`, JSON.stringify({ base, results }, null, 2));
}
