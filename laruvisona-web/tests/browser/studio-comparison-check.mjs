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
const out = process.env.OUTPUT_DIR || "/tmp/laruhp-compare";
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
      .fill("比較テスト" + width);
    await p.getByRole("button", { name: "雰囲気を選ぶ" }).click();
    await p.getByRole("button", { name: "この見せ方で編集する" }).click();
    await p.locator(".se-editor").waitFor();


    const f=p.frameLocator('iframe[title="できあがりの見え方"]');
    await f.locator('h1').waitFor();
    const original=await f.locator('h1').innerText();
    const originalPhoto=await f.locator('.lhp-hero-img').getAttribute('src');
    await p.getByRole('button',{name:'いまの案を残す',exact:false}).click();
    check(width+' pin is not a site edit',await p.getByRole('button',{name:'取り消す',exact:true}).isDisabled());
    await f.locator('h1').click();
    await p.locator('[data-field-key=heading] textarea').fill('この場所から、新しい毎日へ。');
    if(width<900)await p.getByRole('button',{name:'色・書体',exact:true}).click();
    else await p.getByRole('button',{name:'サイト全体',exact:true}).click();
    await p.getByRole('button',{name:'深い森',exact:true}).click();
    // Open immediately: comparisons must not use the delayed preview HTML.
    let apiCalls=[];
    const api=r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiCalls.push(r.url())};
    p.on('request',api);
    await p.getByRole('button',{name:'案を見比べる',exact:false}).click();
    await p.getByRole('dialog').waitFor();
    const a=p.frameLocator('iframe[title="残した案の完成像"]');
    const c=p.frameLocator('iframe[title="編集中の完成像"]');
    await c.locator('h1').waitFor();
    check(width+' current snapshot fresh',(await c.locator('h1').innerText())==='この場所から、新しい毎日へ。');
    if(width<700)await p.locator('.sc-tabs').getByRole('button',{name:'残した案',exact:true}).click();
    await a.locator('h1').waitFor();
    check(width+' pinned snapshot is immutable',(await a.locator('h1').innerText())===original);
    check(width+' original photo retained',(await a.locator('.lhp-hero-img').getAttribute('src'))===originalPhoto);
    check(width+' real changes reported',await p.getByText('内容を変えた節 1',{exact:true}).isVisible()&&await p.getByText('サイト全体の設定変更',{exact:true}).isVisible());
    check(width+' script isolation',await a.locator('script').count()===1&&(await p.locator('iframe[title="残した案の完成像"]').getAttribute('sandbox'))==='allow-scripts');
    check(width+' cannot read parent document',await a.locator('body').evaluate(()=>{try{void parent.document.body;return false}catch{return true}}));
    check(width+' forms cannot submit',await a.locator('button:not([disabled]),input:not([disabled]),a[href]').count()===0);
    const select=p.getByLabel('比べる場所');
    const options=await select.locator('option').allTextContents();
    const target=options.find(x=>x.includes('問い合わせ'));
    if(target){await select.selectOption({label:target});await p.waitForTimeout(250);check(width+' section navigation actually scrolls',await a.locator('body').evaluate(()=>scrollY>100));}
    await select.selectOption('');
    if(width<700){
      check(width+' one mobile preview visible',await p.locator('[data-side=before]').isVisible()&&!(await p.locator('[data-side=current]').isVisible()));
      await p.locator('.sc-tabs').getByRole('button',{name:'編集中の案',exact:true}).click();
      check(width+' switch mobile comparison',await p.locator('[data-side=current]').isVisible()&&!(await p.locator('[data-side=before]').isVisible()));
    }else check('desktop side by side',await p.locator('[data-side=before]').isVisible()&&await p.locator('[data-side=current]').isVisible());
    check(width+' comparison fits viewport',await p.getByRole('dialog').evaluate(el=>el.scrollWidth<=innerWidth&&el.getBoundingClientRect().height<=innerHeight));
    for(let i=0;i<14;i++)await p.keyboard.press('Tab');
    check(width+' keyboard stays inside comparison',await p.getByRole('dialog').evaluate(el=>el.contains(document.activeElement)));
    await p.locator('.sc-close').focus();await p.keyboard.press('Control+z');
    await p.waitForTimeout(200);
    check(width+' no background undo inside modal',(await f.locator('h1').innerText())==='この場所から、新しい毎日へ。');
    await p.screenshot({path:out+'/'+width+'-compare.png'});
    await p.keyboard.press('Escape');
    check(width+' escape closes comparison',!(await p.getByRole('dialog').isVisible()));
    check(width+' focus returns to trigger',await p.getByRole('button',{name:'案を見比べる',exact:false}).evaluate(el=>el===document.activeElement));
    await p.getByRole('button',{name:'案を見比べる',exact:false}).click();
    await p.getByRole('button',{name:'残した案に戻す',exact:true}).click();
    await p.waitForTimeout(300);
    check(width+' restore applies actual pinned content',(await f.locator('h1').innerText())===original);
    await p.getByRole('button',{name:'取り消す',exact:true}).click();await p.waitForTimeout(300);
    check(width+' undo reverses adoption',(await f.locator('h1').innerText())==='この場所から、新しい毎日へ。');
    check(width+' comparison sends no API calls',apiCalls.length===0,apiCalls);
    p.off('request',api);
    await p.getByRole('button',{name:'案を見比べる',exact:false}).click();
    await p.getByRole('button',{name:'今の案を、新しい比較用の案にする',exact:true}).click();
    await p.getByRole('button',{name:'置き換える',exact:true}).click();
    await p.getByRole('button',{name:'案を見比べる',exact:false}).click();
    check(width+' replacement uses current snapshot',await p.getByRole('button',{name:'残した案に戻す',exact:true}).isDisabled());
    await p.getByRole('button',{name:'今の案で続ける',exact:false}).click();
    const saved=p.waitForResponse(r=>r.url().endsWith('/api/sites')&&r.request().method()==='POST');
    await p.getByRole('button',{name:'保存',exact:true}).click();
    const id=(await (await saved).json()).site.id;
    await p.locator('.se-header-actions > span').filter({hasText:'に保存'}).waitFor();
    await p.goto(base+'/laruHP/studio?siteId='+id,{waitUntil:'networkidle'});
    await f.locator('h1').waitFor();
    check(width+' snapshot reset on reload',await p.getByRole('button',{name:'いまの案を残す',exact:false}).isVisible());
    check(width+' no browser exceptions',errors.length===0,errors);
    await fonts.close();await ctx.close();
  }
}finally{await b.close();fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2))}
console.log('passed',results.length);
