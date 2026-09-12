// ローカルの本番用ビルドで、案内ページとスマホの節操作を実行する。
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { installLocalFonts } from './_local-fonts.mjs';
const { chromium } = createRequire(
  process.env.PLAYWRIGHT_FROM
    ? process.env.PLAYWRIGHT_FROM + '/'
    : import.meta.url,
)('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:3319';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw Error('Local only');
const out = process.env.OUTPUT_DIR || '/tmp/landing-polish';
fs.mkdirSync(out, { recursive: true });
const result = [];
function check(name, ok, detail) {
  result.push({ name, ok, detail });
  console.log(ok ? 'OK' : 'FAIL', name, detail || '');
  if (!ok) throw Error(name);
}
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 1440]) {
    const ctx = await browser.newContext({
        viewport: { width, height: width === 1440 ? 1000 : 844 },
        locale: 'ja-JP',
      }),
      fonts = await installLocalFonts(ctx);
    await ctx.route(/googletagmanager|clarity\.ms|larubot\.tokyo/, (r) =>
      r.abort(),
    );
    const p = await ctx.newPage(),
      errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(base + '/laruHP', { waitUntil: 'networkidle' });
    check(
      width + ' 横はみ出しなし',
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    check(
      width + ' 見出しが最初に読める',
      await p
        .locator('h1')
        .evaluate((el) => el.getBoundingClientRect().bottom < innerHeight),
    );
    check(
      width + ' 完成例が最初の画面内にある',
      await p
        .locator('.lp-main-window')
        .evaluate((el) => el.getBoundingClientRect().top < innerHeight - 160),
    );
    check(
      width + ' 主導線は52px以上',
      await p
        .locator('.lp-hero-actions .lp-button')
        .evaluate((el) => el.getBoundingClientRect().height >= 52),
    );
    check(
      width + ' 業種選択は44px以上',
      await p
        .locator('.lp-industry-tabs button')
        .evaluateAll((a) =>
          a.every((el) => el.getBoundingClientRect().height >= 44),
        ),
    );
    await p.screenshot({ path: out + `/案内-${width}-冒頭.png` });
    for (const [id, label] of [
      ['restaurant', '飲食店・カフェ'],
      ['construction', '工務店・設計'],
      ['retail', 'お店・物販'],
    ]) {
      await p.getByRole('radio', { name: label, exact: true }).click();
      check(
        width + ' ' + id + ' 作例切替',
        await p
          .locator('.lp-main-window img')
          .getAttribute('src')
          .then((s) => s.includes(id)),
      );
      check(
        width + ' ' + id + ' 制作先へ業種を渡す',
        (await p.locator('.lp-showcase-caption a').getAttribute('href')) ===
          '/laruHP/studio?industry=' + id,
      );
    }
    await p
      .getByRole('radio', { name: 'お店・物販', exact: true })
      .press('Home');
    check(
      width + ' 業種のキーボード操作',
      (await p
        .getByRole('radio', { name: '美容室・サロン', exact: true })
        .getAttribute('aria-checked')) === 'true',
    );
    await p.locator('#experience').scrollIntoViewIfNeeded();
    await p
      .locator('.lp-demo-surface iframe')
      .first()
      .waitFor({ state: 'attached' });
    await p.waitForFunction(
      () =>
        [...document.querySelectorAll('.lp-demo-surface iframe')].some(
          (f) => f.style.opacity !== '0',
        ),
      null,
      { timeout: 15000 },
    );
    await p.getByRole('radio', { name: /やわらかい/ }).click();
    await p.waitForTimeout(1600);
    check(
      width + ' 実物デモの見せ方を変えられる',
      (await p
        .getByRole('radio', { name: /やわらかい/ })
        .getAttribute('aria-checked')) === 'true',
    );
    check(
      width + ' デモに入力できるフレームがある',
      p.frames().some((f) => f.url() === 'about:srcdoc'),
    );
    await p.screenshot({ path: out + `/案内-${width}-作り心地.png` });
    await p.locator('.lp-faq summary').first().click();
    check(
      width + ' FAQを開ける',
      await p
        .locator('.lp-faq details')
        .first()
        .evaluate((el) => el.open),
    );
    await p.screenshot({
      path: out + `/案内-${width}-全体.png`,
      fullPage: true,
    });
    await p.goto(base + '/laruHP/studio?industry=construction', {
      waitUntil: 'networkidle',
    });
    await p.locator('.ls-start-grid[data-ready=true]').waitFor();
    check(
      width + ' 業種の引き継ぎ',
      await p
        .locator('.ls-industry-pills button')
        .filter({ hasText: '工事' })
        .getAttribute('aria-pressed')
        .then((v) => v === 'true'),
    );
    await p.getByLabel('店名・屋号', { exact: false }).fill('設計室の見本');
    await p.getByRole('button', { name: '雰囲気を選ぶ', exact: true }).click();
    await p.getByRole('button', { name: 'この見せ方で編集する' }).click();
    await p.locator('.se-editor').waitFor();
    if (width < 900)
      await p
        .getByRole('button', { name: 'ページの中身', exact: true })
        .click();
    check(
      width + ' 中身の一覧に横はみ出しなし',
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    check(
      width + ' 一覧は絵文字を使わない',
      !/[\p{Extended_Pictographic}]/u.test(
        await p.locator('.se-block-list').innerText(),
      ),
    );
    check(
      width + ' 節がSVGアイコンを持つ',
      await p
        .locator('.se-block-list')
        .evaluate(
          (el) =>
            el.querySelectorAll('.se-block-symbol svg').length ===
            el.querySelectorAll('.se-block-item').length,
        ),
    );
    check(
      width + ' ボタンの入れ子がない',
      (await p.locator('.se-block-list button button').count()) === 0,
    );
    const initial = await p
      .locator('.se-block-select strong')
      .allTextContents();
    await p.locator('.se-block-more').nth(1).click();
    check(
      width + ' 並べ替えの操作が見える',
      await p.getByRole('button', { name: '上へ', exact: true }).isVisible(),
    );
    check(
      width + ' 並べ替えは44px以上',
      await p
        .getByRole('button', { name: '上へ', exact: true })
        .evaluate((el) => el.getBoundingClientRect().height >= 44),
    );
    await p.getByRole('button', { name: '上へ', exact: true }).click();
    check(
      width + ' 上へ並べ替え',
      (await p.locator('.se-block-select strong').first().innerText()) ===
        initial[1],
    );
    await p.getByRole('button', { name: '下へ', exact: true }).click();
    check(
      width + ' 下へ並べ替え',
      JSON.stringify(
        await p.locator('.se-block-select strong').allTextContents(),
      ) === JSON.stringify(initial),
    );
    p.once('dialog', (d) => d.accept());
    await p.getByRole('button', { name: '削除', exact: true }).click();
    check(
      width + ' 削除を反映',
      (await p.locator('.se-block-item').count()) === initial.length - 1,
    );
    await p.getByRole('button', { name: '取り消す', exact: false }).click();
    check(
      width + ' 削除を取り消せる',
      (await p.locator('.se-block-item').count()) === initial.length,
    );
    await p.screenshot({ path: out + `/制作-${width}-中身.png` });
    await p.getByRole('button', { name: '節を足す', exact: true }).click();
    check(
      width + ' 追加の一覧も絵文字なし',
      !/[\p{Extended_Pictographic}]/u.test(
        await p.locator('.se-blocks').innerText(),
      ),
    );
    await p.locator('.se-add-option').filter({ hasText: '1枚の写真' }).click();
    check(
      width + ' 節追加後は編集欄へ',
      await p.locator('.se-settings').isVisible(),
    );
    check(
      width + ' 写真の編集が開く',
      (await p.locator('.se-image-field').count()) > 0,
    );
    check(width + ' JavaScript例外なし', errors.length === 0, errors);
    await ctx.close();
    await fonts.close();
  }
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const fonts = await installLocalFonts(ctx);
  const p = await ctx.newPage();
  await p.goto(base + '/laruHP', { waitUntil: 'networkidle' });
  check(
    '動きを減らす設定で作例の入場アニメーション停止',
    await p
      .locator('.lp-main-window')
      .evaluate((el) => getComputedStyle(el).animationName === 'none'),
  );
  await ctx.close();
  await fonts.close();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(out + '/results.json', JSON.stringify(result, null, 2));
  await browser.close();
}
