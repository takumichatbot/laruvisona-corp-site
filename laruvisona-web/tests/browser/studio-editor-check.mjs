import { createRequire } from "node:module";
import fs from "node:fs";
import { installLocalFonts } from "./_local-fonts.mjs";
const require = createRequire(
  process.env.PLAYWRIGHT_FROM
    ? process.env.PLAYWRIGHT_FROM + "/"
    : import.meta.url,
);
const { chromium } = require("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:3319",
  fixture = "http://127.0.0.1:54999";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Local fixture only");
const out = process.env.OUTPUT_DIR || "/tmp/laruhp-editor";
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(ok ? "OK" : "FAIL", name, detail || "");
  if (!ok) throw Error(name);
};
const control = async (data) =>
  fetch(fixture + "/__control", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
const session = {
  access_token: "stub",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "r",
  user: {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    email: "owner@example.com",
    aud: "authenticated",
    role: "authenticated",
  },
};
const b = await chromium.launch();
try {
  for (const width of [320, 390, 1440]) {
    const ctx = await b.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      locale: "ja-JP",
    });
    await ctx.addCookies(
      ["sb-127-auth-token", "sb-localhost-auth-token"].map((name) => ({
        name,
        value:
          "base64-" + Buffer.from(JSON.stringify(session)).toString("base64"),
        domain: "127.0.0.1",
        path: "/",
      })),
    );
    const fonts = await installLocalFonts(ctx);
    await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, (r) =>
      r.abort(),
    );
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base + "/laruHP/studio", { waitUntil: "networkidle" });
    await p.locator(".ls-start-grid[data-ready=true]").waitFor();
    await p
      .locator(".ls-industry-pills button")
      .filter({ hasText: "工事" })
      .click();
    await p
      .getByLabel("店名・屋号", { exact: false })
      .fill("編集テスト" + width);
    await p.getByRole("button", { name: "雰囲気を選ぶ" }).click();
    await p.getByRole("button", { name: "この見せ方で編集する" }).click();
    await p.locator(".se-editor").waitFor();
    let f = p.frameLocator('iframe[title="できあがりの見え方"]');
    await f.locator("h1").waitFor();
    await p.waitForTimeout(400);
    check(
      width + " no outer overflow",
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    check(
      width + " preview visible",
      await p
        .locator(".se-frame-box")
        .evaluate((el) => el.getBoundingClientRect().width > 250),
    );
    if (width < 900) {
      check(
        width + " panels initially closed",
        !(await p.locator(".se-settings").isVisible()) &&
          !(await p.locator(".se-blocks").isVisible()),
      );
      check(
        width + " mobile preview default",
        await f.locator("html").evaluate(() => innerWidth === 390),
      );
    }
    await f.locator("h1").click();
    await p.locator(".se-settings").waitFor();
    await p.locator("[data-field-key=heading].se-focused-field").waitFor();
    check(
      width + " text click opens text field",
      await p
        .locator("[data-field-key=heading]")
        .evaluate((el) => el.classList.contains("se-focused-field")),
    );
    await p
      .locator("[data-field-key=heading] textarea")
      .fill("暮らしから、設計する。");
    await p.waitForTimeout(450);
    await f
      .locator("h1")
      .filter({ hasText: "暮らしから、設計する。" })
      .waitFor();
    check(width + " text changes actual preview", true);
    if (width < 900)
      await p.getByRole("button", { name: "完成像", exact: true }).click();
    await f.locator(".lhp-hero-img").click();
    await p.locator("[data-field-key=bgImage].se-focused-field").waitFor();
    check(
      width + " photo click opens image field",
      await p
        .locator("[data-field-key=bgImage]")
        .evaluate((el) => el.classList.contains("se-focused-field")),
    );
    const upload = p.waitForResponse(
      (r) =>
        r.url().endsWith("/api/images/upload") &&
        r.request().method() === "POST",
    );
    await p
      .getByLabel("写真のファイル", { exact: true })
      .setInputFiles("public/company/concepts/ceramics.webp");
    const response = await upload;
    const json = await response.json();
    check(width + " real upload API succeeds", response.status() === 200, json);
    await p.getByText("写真を差し替えました。", { exact: false }).waitFor();
    const bytes = await (await fetch(json.url)).arrayBuffer();
    check(
      width + " uploaded WebP served",
      Buffer.from(bytes).subarray(8, 12).toString() === "WEBP",
    );
    await p.waitForTimeout(400);
    check(
      width + " new photo in rendered HTML",
      (
        await p
          .locator('iframe[title="できあがりの見え方"]')
          .getAttribute("srcdoc")
      ).includes(json.url),
    );
    await control({ failStorage: true });
    const failed = p.waitForResponse(
      (r) =>
        r.url().endsWith("/api/images/upload") &&
        r.request().method() === "POST",
    );
    await p
      .getByLabel("写真のファイル", { exact: true })
      .setInputFiles("public/company/concepts/retreat.webp");
    check(width + " storage failure returned", (await failed).status() === 500);
    await p.locator(".se-image-error").waitFor();
    check(
      width + " failed upload keeps previous image",
      (await p.locator(".se-image-pick img").getAttribute("src")) === json.url,
    );
    await control({ failStorage: false });
    const focal = p
      .locator(".se-focal")
      .filter({ hasText: "写真の見せ場（スマホ）" });
    await focal.getByRole("button", { name: "上・右", exact: true }).click();
    check(
      width + " focal position selected",
      (await focal
        .getByRole("button", { name: "上・右", exact: true })
        .getAttribute("aria-pressed")) === "true",
    );
    await p.waitForTimeout(400);
    check(
      width + " focal setting in real export",
      (
        await p
          .locator('iframe[title="できあがりの見え方"]')
          .getAttribute("srcdoc")
      ).includes("--lhp-hero-pos-sp:80% 20%"),
    );
    check(
      width + " layout remains within screen",
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await p.mouse.move(0, 0);
    await p.screenshot({ path: out + "/" + width + "-photo-edit.png" });
    if (width < 900) {
      await p.getByRole("button", { name: "完成像", exact: true }).click();
      await p.screenshot({ path: out + "/" + width + "-preview.png" });
      await p
        .getByRole("button", { name: "ページの中身", exact: true })
        .click();
      check(
        width + " block list opens",
        await p.locator(".se-blocks").isVisible(),
      );
      await p.getByRole("button", { name: "完成像", exact: true }).click();
    }
    if (width < 900)
      await p
        .getByRole("button", { name: "ページの中身", exact: true })
        .click();
    await p
      .locator('.se-blocks [role="button"]')
      .filter({ hasText: "商品・サービス" })
      .click();
    check(
      width + " service fields editable",
      await p.getByLabel("名前", { exact: true }).first().isVisible(),
    );
    if (width < 900)
      await p
        .getByRole("button", { name: "ページの中身", exact: true })
        .click();
    const features = p
      .locator('.se-blocks [role="button"]')
      .filter({ hasText: "3つの特徴" });
    await features.focus();
    await p.keyboard.press("Enter");
    await p
      .getByLabel("特徴1の見出し", { exact: true })
      .fill("暮らしを聞くところから");
    await p.waitForTimeout(400);
    check(
      width + " keyboard selection and feature editing",
      (
        await p
          .locator('iframe[title="できあがりの見え方"]')
          .getAttribute("srcdoc")
      ).includes("暮らしを聞くところから"),
    );
    if(width===390){
      await p.getByRole('button',{name:'ページの中身',exact:true}).click();
      await p.locator('.se-blocks [role="button"]').filter({hasText:'写真をならべる'}).click();
      if(await p.getByLabel('写真 1のファイル',{exact:true}).count()===0)await p.getByRole('button',{name:'＋ 追加する',exact:true}).click();
      await control({slowStorageMs:1200});
      const galleryUpload=p.waitForResponse(r=>r.url().endsWith('/api/images/upload')&&r.request().method()==='POST');
      await p.getByLabel('写真 1のファイル',{exact:true}).setInputFiles('public/company/concepts/retreat.webp');
      await p.getByText('写真を保存しています…',{exact:false}).waitFor();
      check('gallery structure disabled during upload',await p.getByRole('button',{name:'＋ 追加する',exact:true}).isDisabled()&&await p.locator('.se-settings-body').getByRole('button',{name:'削除',exact:true}).first().isDisabled());
      check('gallery real upload API', (await galleryUpload).status()===200);
      await control({slowStorageMs:0});await p.getByText('写真を差し替えました。',{exact:false}).waitFor();
    }
    const saved = p.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/sites" &&
        r.request().method() === "POST",
    );
    await p
      .locator("header")
      .getByRole("button", { name: "保存", exact: true })
      .click();
    const savedResponse = await saved;
    const row = (await savedResponse.json()).site;
    check(
      width + " changes saved through real API",
      savedResponse.ok() && !!row?.id,
    );
    const db = (
      await (await fetch(fixture + "/rest/v1/sites?id=eq." + row.id)).json()
    )[0];
    const hero = db.blocks_json.pages[0].blocks.find((b) => b.type === "hero");
    check(
      width + " photo and position persisted",
      hero.data.bgImage === json.url &&
        hero.data.bgImagePositionSp === "80% 20%",
    );
    await p.goto(base + "/laruHP/studio?siteId=" + row.id, {
      waitUntil: "networkidle",
    });
    await p
      .frameLocator('iframe[title="できあがりの見え方"]')
      .locator("h1")
      .filter({ hasText: "暮らしから、設計する。" })
      .waitFor();
    check(width + " reopening retains edited content", true);
    check(width + " no JS errors", errors.length === 0, errors);
    await ctx.close();
    await fonts.close();
  }
} finally {
  await control({ failStorage: false, slowStorageMs:0 });
  await b.close();
  fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
}
console.log("Passed " + results.length);
