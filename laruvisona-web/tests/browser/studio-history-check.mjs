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
const out = process.env.OUTPUT_DIR || "/tmp/laruhp-history";
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
      .fill("履歴テスト" + width);
    await p.getByRole("button", { name: "雰囲気を選ぶ" }).click();
    await p.getByRole("button", { name: "この見せ方で編集する" }).click();
    await p.locator(".se-editor").waitFor();

    const f=p.frameLocator('iframe[title="できあがりの見え方"]');
    await f.locator('h1').waitFor();
    const oldHeading=await f.locator('h1').innerText();
    const undo=p.getByRole('button',{name:'取り消す',exact:true});
    const redo=p.getByRole('button',{name:'やり直す',exact:true});
    check(width+' initial history boundary',await undo.isDisabled()&&await redo.isDisabled());
    await f.locator('h1').click();
    const heading=p.locator('[data-field-key=heading] textarea');
    await heading.fill('暮らしの、その先へ。');
    await p.waitForTimeout(350);
    await undo.click();
    await p.waitForTimeout(350);
    check(width+' undo restores actual HTML',(await f.locator('h1').innerText())===oldHeading);
    await redo.click();
    await p.waitForTimeout(350);
    check(width+' redo restores text',(await f.locator('h1').innerText())==='暮らしの、その先へ。');
    if(width===390){
      const originalPhoto=await f.locator('.lhp-hero-img').getAttribute('src');
      await p.getByRole('button',{name:'完成像',exact:true}).click();
      await f.locator('.lhp-hero-img').click();
      await control({slowStorageMs:1000});
      const upload=p.waitForResponse(r=>r.url().endsWith('/api/images/upload')&&r.request().method()==='POST');
      await p.getByLabel('写真のファイル',{exact:true}).setInputFiles('public/company/concepts/ceramics.webp');
      await p.getByText('写真を保存しています…',{exact:false}).waitFor();
      check('history disabled during image upload',await undo.isDisabled()&&await redo.isDisabled());
      const photo=(await (await upload).json()).url;
      await control({slowStorageMs:0});
      await p.getByText('写真を差し替えました。',{exact:false}).waitFor();await p.waitForTimeout(350);
      await undo.click();await p.waitForTimeout(350);
      check('uploaded photo undo restores original',(await f.locator('.lhp-hero-img').getAttribute('src'))===originalPhoto);
      await redo.click();await p.waitForTimeout(350);
      check('uploaded photo redo restores new image',(await f.locator('.lhp-hero-img').getAttribute('src'))===photo);
      await undo.click();await p.waitForTimeout(350);
    }
    if(width<900)await p.getByRole('button',{name:'色・書体',exact:true}).click();
    else await p.getByRole('button',{name:'サイト全体',exact:true}).click();
    const image=await f.locator('.lhp-hero-img').getAttribute('src');
    const font=await p.locator('.se-settings select').first().inputValue();
    await p.getByRole('button',{name:'深い森',exact:true}).click();
    await p.waitForTimeout(400);
    check(width+' palette active',await p.getByRole('button',{name:'深い森',exact:true}).getAttribute('aria-pressed')==='true');
    check(width+' palette preserves content',(await f.locator('h1').innerText())==='暮らしの、その先へ。'&&(await f.locator('.lhp-hero-img').getAttribute('src'))===image);
    check(width+' palette preserves font',(await p.locator('.se-settings select').first().inputValue())===font);
    check(width+' palette reaches exported CSS',(await f.locator('html').innerHTML()).includes('#20362b'));
    await undo.click();await p.waitForTimeout(350);
    check(width+' color undo',await p.getByRole('button',{name:'深い森',exact:true}).getAttribute('aria-pressed')==='false');
    await p.getByRole('button',{name:'夜明けの青',exact:true}).click();
    check(width+' divergent edit clears redo',await redo.isDisabled());
    await p.locator('.se-design-preset').nth(2).click();
    await p.waitForTimeout(400);
    check(width+' preset preserves text',(await f.locator('h1').innerText())==='暮らしの、その先へ。');
    await undo.click();await p.waitForTimeout(400);
    check(width+' preset undo restores palette',await p.getByRole('button',{name:'夜明けの青',exact:true}).getAttribute('aria-pressed')==='true');
    await p.locator('.se-settings-body').evaluate(el=>el.scrollTo(0,0));
    await p.screenshot({path:out+'/'+width+'-design.png'});
    const before=await p.locator('.se-frame-box').boundingBox();
    await p.getByRole('button',{name:'大きく見る',exact:false}).click();
    const after=await p.locator('.se-frame-box').boundingBox();
    check(width+' enlarged preview',width<900?after.height>before.height:after.width>before.width);
    check(width+' hidden panels inaccessible',!(await p.locator('.se-settings').isVisible())&&!(await p.locator('.se-blocks').isVisible()));
    check(width+' no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await p.screenshot({path:out+'/'+width+'-wide.png'});
    await p.getByRole('button',{name:'編集に戻る',exact:false}).click();
    check(width+' returns to same controls',await p.getByRole('button',{name:'夜明けの青',exact:true}).isVisible());
    const saved=p.waitForResponse(r=>r.url().endsWith('/api/sites')&&r.request().method()==='POST');
    await p.getByRole('button',{name:'保存',exact:true}).click();
    const result=await saved;const id=(await result.json()).site.id;
    await p.locator('.se-header-actions > span').filter({hasText:'に保存'}).waitFor();
    await undo.click();
    await p.waitForTimeout(400);
    check(width+' undo after save is dirty',await p.getByText('未保存',{exact:false}).first().isVisible());
    await redo.click();await p.waitForTimeout(300);
    await p.getByRole('button',{name:'深い森',exact:true}).click();await p.waitForTimeout(300);
    await control({slowWriteMs:1200});
    const write=p.waitForResponse(r=>r.url().endsWith('/api/sites/'+id)&&r.request().method()==='PUT');
    await p.getByRole('button',{name:'保存',exact:true}).click();
    await p.getByText('保存中…',{exact:true}).first().waitFor();
    await undo.click();
    await write;await control({slowWriteMs:0});await p.waitForTimeout(300);
    check(width+' undo during save stays dirty',await p.getByText('未保存',{exact:false}).first().isVisible());
    const final=p.waitForResponse(r=>r.url().endsWith('/api/sites/'+id)&&r.request().method()==='PUT');
    await p.getByRole('button',{name:'保存',exact:true}).click();await final;
    await p.locator('.se-header-actions > span').filter({hasText:'に保存'}).waitFor();
    await p.goto(base+'/laruHP/studio?siteId='+id,{waitUntil:'networkidle'});
    await f.locator('h1').waitFor();
    check(width+' reloaded history cannot cross site boundary',await undo.isDisabled()&&await redo.isDisabled());
    check(width+' saved restored state persists',(await f.locator('h1').innerText())==='暮らしの、その先へ。');
    if(width===390){
      await p.getByRole('button',{name:'色・書体',exact:true}).click();
      await p.getByRole('button',{name:'深い森',exact:true}).click();
      await p.keyboard.press('Control+z');
      check('keyboard undo outside text field',await p.getByRole('button',{name:'夜明けの青',exact:true}).getAttribute('aria-pressed')==='true');
      await p.keyboard.press('Control+Shift+z');
      check('keyboard redo outside text field',await p.getByRole('button',{name:'深い森',exact:true}).getAttribute('aria-pressed')==='true');
      await p.getByRole('button',{name:'完成像',exact:true}).click();
      await f.locator('h1').click();
      const text=p.locator('[data-field-key=heading] textarea');
      await text.focus();
      const prevented=await text.evaluate(el=>{const e=new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented;});
      check('text field keeps native undo',!prevented);
    }
    check(width+' no browser exceptions',errors.length===0,errors);
    await fonts.close();await ctx.close();
  }
} finally {
 await control({slowWriteMs:0,slowStorageMs:0,failWrites:false});
 await b.close();
 fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));
}
console.log('passed',results.length);
