import { createRequire } from "node:module";
import fs from "node:fs";
import { installLocalFonts } from "./_local-fonts.mjs";
const require = createRequire(
  process.env.PLAYWRIGHT_FROM
    ? process.env.PLAYWRIGHT_FROM + "/"
    : import.meta.url,
);
const { chromium } = require("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:3319";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Local fixture only");
const out = process.env.OUTPUT_DIR || "/tmp/laruhp-studio-start";
fs.mkdirSync(out, { recursive: true });
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) throw Error(name + ": " + JSON.stringify(detail));
}
const b = await chromium.launch();
try {
  for (const width of [320, 390, 1440]) {
    const ctx = await b.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      locale: "ja-JP",
    });
    const fonts = await installLocalFonts(ctx);
    await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, (r) =>
      r.abort(),
    );
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base + "/laruHP/studio", { waitUntil: "domcontentloaded" });
    await p.locator('.ls-start-grid[data-ready="true"]').waitFor();
    await p.waitForFunction(
      () => document.querySelectorAll(".ls-start-grid").length === 1,
    );
    check(
      width + " empty name cannot continue",
      await p.locator(".ls-continue").isDisabled(),
    );
    await p
      .locator(".ls-industry-pills button")
      .filter({ hasText: "工事" })
      .click();
    await p.getByLabel("店名・屋号", { exact: false }).fill("こもれび設計室");
    await p
      .getByLabel("活動している地域", { exact: false })
      .fill("東京都国立市");
    if (width < 761)
      await p.getByRole("button", { name: "いまの完成イメージを見る" }).click();
    await p.locator(".ls-preview").scrollIntoViewIfNeeded();
    await p.waitForTimeout(900);
    let frame = p.frameLocator(
      'iframe[title="作りはじめるサイトの完成イメージ"]',
    );
    await frame.locator("h1").filter({ hasText: "こもれび設計室" }).waitFor();
    check(width + " live preview uses entered name", true);
    check(
      width + " industry illustration",
      await p
        .locator(".ls-preview iframe")
        .getAttribute("srcdoc")
        .then((x) => x.includes("/company/concepts/architecture.webp")),
    );
    check(
      width + " no horizontal overflow",
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await p.mouse.move(0, 0);
    await p.screenshot({
      path: out + "/" + width + "-intake.png",
      fullPage: true,
    });
    if (width < 761) await p.getByRole('button', {name: '完成イメージを閉じる', exact: false}).click();
    await p.getByRole("button", { name: "雰囲気を選ぶ" }).click();
    await p.locator(".ls-mood-options").waitFor();
    for (const id of ["calm", "refined", "warm"]) {
      await p.locator(`[data-preset="${id}"]`).click();
      check(
        width + " choose " + id,
        (await p
          .locator(`[data-preset="${id}"]`)
          .getAttribute("aria-checked")) === "true",
      );
    }
    await p.locator('[data-preset="warm"]').focus();
    await p.keyboard.press("ArrowDown");
    check(
      width + " keyboard changes choice",
      (await p.locator('[data-preset="warm"]').getAttribute("aria-checked")) ===
        "false",
    );
    await p.locator('[data-preset="refined"]').click();
    await p.waitForTimeout(900);
    check(
      width + " single real preview",
      (await p.locator(".ls-preview iframe").count()) === 1,
    );
    const before = await p.locator(".ls-preview iframe").getAttribute("srcdoc");
    check(
      width + " industry remains after style change",
      before.includes("/company/concepts/architecture.webp"),
    );
    await p.locator(".ls-preview").scrollIntoViewIfNeeded();
    await p.waitForTimeout(250);
    await p.mouse.move(0, 0);
    await p.screenshot({
      path: out + "/" + width + "-mood.png",
      fullPage: true,
    });
    await p.getByRole("button", { name: "この見せ方で編集する" }).click();
    await p
      .locator("header")
      .getByRole("button", { name: "公開の準備", exact: true })
      .waitFor();
    await p.waitForTimeout(900);
    const exported = await p
      .locator('iframe[title="できあがりの見え方"]')
      .getAttribute("srcdoc");
    check(
      width + " chosen content carries to editor",
      exported.includes("こもれび設計室") &&
        exported.includes("/company/concepts/architecture.webp"),
    );
    check(
      width + " selected font carries to editor",
      exported.includes("Shippori"),
    );
    check(width + " editor no JS errors", errors.length === 0, errors);
    await ctx.close();
    await fonts.close();
  }
} finally {
  await b.close();
  fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
}
console.log("Studio start checks passed: " + results.length);
