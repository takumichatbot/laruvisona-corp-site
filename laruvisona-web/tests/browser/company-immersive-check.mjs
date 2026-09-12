/** Real-browser checks of the company redesign. External requests/writes are blocked.
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/browser/company-immersive-check.mjs
 * BASE_URL defaults to local preview. OUTPUT_DIR receives evidence, never production data.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:3218";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Local preview only");
const out = process.env.OUTPUT_DIR || "/tmp/laruvisona-immersive-check";
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  if (!ok) throw Error(name + ": " + JSON.stringify(detail));
};
const browser = await chromium.launch({
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
try {
  for (const width of [320, 390, 1440]) {
    const p = await browser.newPage({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      locale: "ja-JP",
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("**/*", (r) => {
      const u = new URL(r.request().url());
      return ["127.0.0.1", "localhost"].includes(u.hostname) &&
        ["GET", "HEAD"].includes(r.request().method())
        ? r.continue()
        : r.abort();
    });
    const response = await p.goto(base, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await p.waitForFunction(
      () =>
        document.querySelector(".lv-water-canvas")?.dataset.render === "webgl",
    );
    check(`${width}: HTTP200`, response.status() === 200);
    check(
      `${width}: overflow`,
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    check(`${width}: h1 once`, (await p.locator("h1").count()) === 1);
    check(
      `${width}: concrete services`,
      (await p.locator(".lv-hero-foot").innerText()).includes(
        "Web制作・AI・システム開発",
      ),
    );
    check(
      `${width}: consultation destination`,
      (await p.locator(".lv-hero .lv-button").getAttribute("href")) ===
        "/contact",
    );
    const clock = () => p.locator(".lv-water-canvas").getAttribute("data-time");
    const t1 = await clock();
    await p.waitForTimeout(250);
    check(`${width}: animated geometry`, (await clock()) !== t1);
    await p.locator("#page-motion").click();
    await p.waitForTimeout(100);
    const frozen = await clock();
    await p.waitForTimeout(450);
    check(`${width}: shader clock frozen`, (await clock()) === frozen);
    const y = await p.evaluate(() => scrollY);
    await p.locator("#page-motion").click();
    await p.waitForTimeout(150);
    check(
      `${width}: pause does not scroll`,
      Math.abs((await p.evaluate(() => scrollY)) - y) < 2,
    );
    await p.screenshot({ path: path.join(out, `${width}-hero.png`) });
    // Each product ribbon selects the matching product, not always LARU HP.
    await p.locator(".lv-product-ribbon a").nth(2).click();
    await p.waitForTimeout(900);
    check(
      `${width}: ribbon selects SEO`,
      (await p.locator("[role=tabpanel]").getAttribute("data-product")) ===
        "seo",
    );
    for (const id of ["hp", "bot", "seo", "flastal"]) {
      await p.locator("#tab-" + id).click();
      check(
        `${width}: product ${id}`,
        (await p.locator("[role=tabpanel]").getAttribute("data-product")) ===
          id,
      );
    }
    check(
      `${width}: client attribution`,
      (await p.locator("[role=tabpanel]").innerText()).includes(
        "クライアントのサービス開発",
      ),
    );
    await p.locator("#tab-hp").focus();
    await p.keyboard.press("ArrowRight");
    check(
      `${width}: keyboard tabs`,
      (await p.locator("#tab-bot").getAttribute("aria-selected")) === "true",
    );
    await p.keyboard.press("End");
    check(
      `${width}: tab end`,
      (await p.locator("#tab-flastal").getAttribute("aria-selected")) ===
        "true",
    );
    await p.screenshot({ path: path.join(out, `${width}-products.png`) });
    for (const [i, id] of ["architecture", "retreat", "ceramics"].entries()) {
      await p.locator(".lv-concept-picker button").nth(i).click();
      await p.waitForFunction(() => {
        const i = document.querySelector(".lv-concept-photo");
        return i && i.complete && i.naturalWidth > 0;
      });
      check(
        `${width}: concept ${id}`,
        (await p.locator(".lv-concept-frame").getAttribute("data-concept")) ===
          id,
      );
    }
    check(
      `${width}: fictional label`,
      (await p.locator(".lv-disclosure").innerText()).includes(
        "納品実績ではありません",
      ),
    );
    await p.locator(".lv-concept-picker button").first().click();
    await p.locator(".lv-concept-frame").scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(out, `${width}-concept.png`) });
    await p.locator(".lv-service summary").first().click();
    check(
      `${width}: service opens`,
      (await p.locator(".lv-service").first().getAttribute("open")) !== null,
    );
    await p.locator(".lv-service-body a").first().focus();
    check(
      `${width}: service keyboard link`,
      await p
        .locator(".lv-service-body a")
        .first()
        .evaluate((e) => e === document.activeElement),
    );
    // Closing logo must have intermediate positions in a short section.
    const top = await p
      .locator("#lv-contact")
      .evaluate((e) => e.getBoundingClientRect().top + scrollY);
    const height = await p.evaluate(() => innerHeight);
    const logo = [];
    for (const f of [0.72, 0.49, 0.18]) {
      await p.evaluate(
        (y) => window.scrollTo({ top: y, behavior: "instant" }),
        top - height * f,
      );
      await p.waitForTimeout(300);
      logo.push(
        Number(
          await p
            .locator(".lv-water-canvas")
            .getAttribute("data-logo-progress"),
        ),
      );
    }
    check(
      `${width}: continuous logo assembly`,
      logo[0] > 0 && logo[0] < logo[1] && logo[1] < logo[2] && logo[2] < 1,
      logo,
    );
    await p.locator("#page-motion").click();
    await p.waitForTimeout(100);
    const logoFrozen = await p
      .locator(".lv-water-canvas")
      .getAttribute("data-logo-progress");
    await p.evaluate(() => window.scrollBy(0, 30));
    await p.waitForTimeout(150);
    check(
      `${width}: logo pause`,
      (await p
        .locator(".lv-water-canvas")
        .getAttribute("data-logo-progress")) === logoFrozen,
    );
    await p.locator("#page-motion").click();
    await p.locator("#lv-contact").scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(out, `${width}-closing.png`) });
    if (width < 760) {
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await p.waitForTimeout(200);
      await p.locator(".lv-menu-toggle").click();
      check(
        `${width}: menu opens`,
        await p.locator("#lv-mobile-nav").isVisible(),
      );
      await p.keyboard.press("Escape");
      check(
        `${width}: escape restores focus`,
        (await p
          .locator(".lv-menu-toggle")
          .evaluate((e) => e === document.activeElement)) &&
          (await p.locator("#lv-mobile-nav").count()) === 0,
      );
    }
    check(`${width}: no JS errors`, errors.length === 0, errors);
    await p.close();
  }
  const p = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await p.route("**/*", (r) => {
    const u = new URL(r.request().url());
    return ["127.0.0.1", "localhost"].includes(u.hostname) &&
      ["GET", "HEAD"].includes(r.request().method())
      ? r.continue()
      : r.abort();
  });
  await p.goto(base, { waitUntil: "networkidle" });
  await p.waitForFunction(
    () =>
      document.querySelector(".lv-water-canvas")?.dataset.render === "webgl",
  );
  check(
    "Reduced: no resume button",
    (await p.locator("#page-motion").count()) === 0,
  );
  check(
    "Reduced: explanation",
    await p.locator("#page-motion-note").isVisible(),
  );
  const time = await p.locator(".lv-water-canvas").getAttribute("data-time");
  await p.waitForTimeout(450);
  check(
    "Reduced: no clock advance",
    (await p.locator(".lv-water-canvas").getAttribute("data-time")) === time,
  );
  await p.locator("#tab-bot").click();
  check(
    "Reduced: tabs work",
    (await p.locator("[role=tabpanel]").getAttribute("data-product")) === "bot",
  );
  await p.locator("#lv-contact").scrollIntoViewIfNeeded();
  await p.waitForTimeout(150);
  check(
    "Reduced: assembled logo",
    (await p.locator(".lv-water-canvas").getAttribute("data-logo-progress")) ===
      "1.000",
  );
  await p.evaluate(() => {
    const canvas = document.querySelector(".lv-water-canvas canvas");
    window.__testContext = canvas
      .getContext("webgl2")
      .getExtension("WEBGL_lose_context");
    window.__testContext.loseContext();
  });
  await p.waitForFunction(
    () =>
      document.querySelector(".lv-water-canvas").dataset.render === "fallback",
  );
  await p.evaluate(() => window.scrollBy(0, 40));
  await p.waitForTimeout(200);
  check(
    "GPU context loss: fallback survives scroll",
    (await p.locator(".lv-water-canvas").getAttribute("data-render")) ===
      "fallback",
  );
  await p.evaluate(() => window.__testContext.restoreContext());
  await p.waitForFunction(
    () => document.querySelector(".lv-water-canvas").dataset.render === "webgl",
  );
  check(
    "GPU context restored: scene returns",
    (await p.locator(".lv-water-canvas").getAttribute("data-render")) ===
      "webgl",
  );
  await p.close();
  const fallback = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      return type.includes("webgl") ? null : original.call(this, type, ...rest);
    };
  });
  await fallback.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : r.abort(),
  );
  await fallback.goto(base, { waitUntil: "networkidle" });
  await fallback.waitForFunction(
    () =>
      document.querySelector(".lv-water-canvas")?.dataset.render === "fallback",
  );
  check(
    "No WebGL: headline available",
    await fallback.locator("h1").isVisible(),
  );
  check(
    "No WebGL: consultation available",
    await fallback.locator(".lv-hero .lv-button").isVisible(),
  );
  await fallback.close();
  console.log(`${results.length} passed`);
} finally {
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
