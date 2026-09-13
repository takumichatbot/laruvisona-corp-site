// Real Next production server + HTTP adapter backed by disposable PostgreSQL.
// Auth is a fixed test session; email transport disabled, no production services.
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(
  process.env.PLAYWRIGHT_FROM
    ? process.env.PLAYWRIGHT_FROM + "/"
    : import.meta.url,
)("playwright");
const base = process.env.BOOKING_BASE || "http://127.0.0.1:3331";
await fetch('http://127.0.0.1:55019/__reset',{method:'POST'});
const meta = await (await fetch("http://127.0.0.1:55019/health")).json();
const out = process.env.OUTPUT_DIR || "/tmp/hp-schedule-browser";
fs.mkdirSync(out, { recursive: true });
const results = [];
function check(name, ok) {
  results.push({ name, ok });
  console.log(ok ? "OK" : "FAIL", name);
  if (!ok) throw Error(name);
}
const session = {
  access_token: "stub-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "stub-refresh",
  user: {
    id: meta.owner,
    email: "owner@example.invalid",
    aud: "authenticated",
    role: "authenticated",
  },
};
const cookie =
  "base64-" + Buffer.from(JSON.stringify(session)).toString("base64");
async function localOnly(context) {
  await context.route("**/*", (r) =>
    [
      "127.0.0.1",
      "localhost",
      "fonts.googleapis.com",
      "fonts.gstatic.com",
    ].includes(new URL(r.request().url()).hostname)
      ? r.continue()
      : r.abort(),
  );
}
const browser = await chromium.launch();
try {
  const owner = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ja-JP",
  });
  await localOnly(owner);
  await owner.addCookies([
    { name: "sb-127-auth-token", value: cookie, url: base },
  ]);
  const p = await owner.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/laruHP/booking/schedule");
  await p.getByRole("heading", { name: "予約一覧", exact: true }).waitFor();
  check(
    "管理画面は390pxで横にはみ出さない",
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await p.getByRole("button", { name: "受付の設定", exact: true }).click();
  await p.getByRole("heading", { name: "営業時間", exact: true }).waitFor();
  await p.getByLabel("何日先まで予約できるか").fill("45");
  await p.getByRole("button", { name: "設定を保存", exact: true }).click();
  await p.getByText("予約設定を保存しました", { exact: true }).waitFor();
  await p.reload();
  await p.getByRole("button", { name: "受付の設定", exact: true }).click();
  check(
    "実APIで保存した設定が開き直しても残る",
    (await p.getByLabel("何日先まで予約できるか").inputValue()) === "45",
  );
  for (const width of [320, 390, 1440]) {
    await p.setViewportSize({ width, height: 900 });
    check(
      width + "設定画面の横はみ出しなし",
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await p.screenshot({
      path: out + `/${width}-settings.png`,
      fullPage: true,
    });
  }
  await p.setViewportSize({ width: 390, height: 844 });
  // Guided setup and sharing use the same persisted calendar, not a second config.
  await p.getByRole('button',{name:'順番に設定する',exact:true}).click();
  const headings=['営業時間','担当者','部屋・設備','メニュー','受付ルール'];
  for(let i=0;i<headings.length;i++) {
    check('手順 '+(i+1)+' '+headings[i],await p.getByRole('heading',{name:headings[i],exact:true}).isVisible());
    check('手順の選択状態 '+(i+1),await p.locator('[aria-current="step"]').innerText().then(t=>t.includes(headings[i])));
    if(i<4) await p.getByRole('button',{name:'次へ',exact:true}).click();
  }
  await p.getByLabel('何日先まで予約できるか').fill('46');
  await p.getByRole('button',{name:'設定を保存',exact:true}).click();
  await p.getByRole('heading',{name:'予約を受け付ける準備',exact:true}).waitFor();
  const install=p.getByRole('link',{name:'制作画面で予約ボタンを設置',exact:true});
  check('設置先が同じサイト', (await install.getAttribute('href'))===`/laruHP/studio?siteId=${meta.site}&booking=schedule`);
  await p.getByRole('img',{name:'お客様向け予約ページのQRコード'}).waitFor();
  check('QR画像はローカルPNG', (await p.getByRole('img',{name:'お客様向け予約ページのQRコード'}).getAttribute('src')).startsWith('data:image/png;base64,'));
  for (const width of [320,390,1440]) {
    await p.setViewportSize({width,height:900});
    check(width+'共有画面の横はみ出しなし',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await p.screenshot({path:out+`/${width}-sharing.png`,fullPage:true});
  }
  await fetch('http://127.0.0.1:55019/__site-meta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({published:true,custom_domain:'salon.example'})});
  await p.getByRole('button',{name:'公開・受付状態を更新',exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('input[readonly]')?.value==='https://salon.example/reserve');
  check('独自ドメインを再取得して共有URLに反映',await p.getByLabel('お客様向けの予約URL').inputValue()==='https://salon.example/reserve');
  await fetch('http://127.0.0.1:55019/__site-meta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({published:false,custom_domain:null})});
  await p.getByRole('button',{name:'公開・受付状態を更新',exact:true}).click();
  await p.getByText('サイトはまだ非公開です。',{exact:true}).waitFor();
  check('非公開時は配布URLとQRを出さない',await p.getByLabel('お客様向けの予約URL').count()===0 && await p.getByRole('img',{name:'お客様向け予約ページのQRコード'}).count()===0);
  await fetch('http://127.0.0.1:55019/__site-meta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({published:true,custom_domain:null})});
  await p.getByRole('button',{name:'公開・受付状態を更新',exact:true}).click();
  await p.getByLabel('お客様向けの予約URL').waitFor();
  await p.getByRole('button',{name:'設定を確認する',exact:true}).click();
  await p.getByLabel('何日先まで予約できるか').fill('47');
  await p.getByRole('button',{name:'サイトに設置・共有',exact:true}).click();
  check('未保存設定では共有しない',await p.getByLabel('お客様向けの予約URL').count()===0);
  check('未保存のまま制作画面へ移動しない',await p.getByRole('link',{name:'制作画面で予約ボタンを設置',exact:true}).getAttribute('aria-disabled')==='true');
  await p.getByRole('button',{name:'設定を確認する',exact:true}).click();
  await p.getByRole('button',{name:'設定を保存',exact:true}).click();
  await p.getByLabel('お客様向けの予約URL').waitFor();
  await p.goto(base+'/laruHP/booking/schedule?siteId=22222222-2222-4222-8222-222222222222');
  await p.getByRole('alert').filter({hasText:'指定したサイトは見つかりません。サイト一覧から開き直してください。'}).waitFor();
  check('他サイト指定を自分の先頭サイトへすり替えない',await p.getByRole('heading',{name:'営業時間',exact:true}).count()===0);
  await p.goto(base+'/laruHP/booking/schedule?siteId='+meta.site);
  await p.getByRole('heading',{name:'予約一覧',exact:true}).waitFor();
  const noAuth = await fetch(base + `/api/sites/${meta.site}/schedule`);
  check("未ログインは店舗側の予約一覧を読めない", noAuth.status === 401);
  const stranger = await owner.request.get(
    base + "/api/sites/22222222-2222-4222-8222-222222222222/schedule",
  );
  check("他店舗の予約一覧を読めない", stranger.status() === 404);
  const guest = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ja-JP",
    timezoneId: "America/Los_Angeles",
  });
  await localOnly(guest);
  const q = await guest.newPage();
  q.on("pageerror", (e) => errors.push(e.message));
  await q.goto(base + "/hp/" + encodeURIComponent("予約テスト") + "/reserve");
  await q.getByRole("heading", { name: "1. メニューを選ぶ" }).waitFor();
  await q.getByLabel("日付（日本時間）").fill(meta.day);
  await q.getByRole("button", { name: "10:00", exact: true }).waitFor();
  check(
    "米国時刻の端末でも日本の10時が表示される",
    (await q.getByRole("button", { name: "10:00", exact: true }).count()) === 1,
  );
  check(
    "空き枠とフォームは390pxで横にはみ出さない",
    await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await q.getByRole("button", { name: "10:00", exact: true }).click();
  await q.getByLabel("お名前（必須）").fill("予約検証 花子");
  await q.getByLabel("メールアドレス（必須）").fill("guest@example.invalid");
  await q.screenshot({ path: out + "/390-reserve.png", fullPage: true });
  // Drop the successful response once: the DB really commits, but the user sees a network failure.
  let dropped = false;
  await q.route("**/api/hp/scheduling", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.action === "reserve" && !dropped) {
      dropped = true;
      const r = await route.fetch();
      check("失われる応答の裏で予約は確定済み", r.status() === 200);
      await route.abort("failed");
    } else await route.continue();
  });
  await q
    .getByRole("button", { name: "この内容で予約を確定", exact: true })
    .click();
  await q.getByText("予約結果を確認できません。", { exact: false }).waitFor();
  check(
    "応答不明でも入力を残して固定する",
    (await q.getByLabel("お名前（必須）").inputValue()) === "予約検証 花子" &&
      (await q.getByLabel("お名前（必須）").isDisabled()),
  );
  await q.unrouteAll({ behavior: "wait" });
  await q.reload();
  await q.getByRole("heading", { name: "ご予約が確定しています" }).waitFor();
  check(
    "再読み込みで失われた予約結果を回収",
    new URL(q.url()).hash.includes("booking="),
  );
  check('予約確認ページに外部の解析・チャットタグを載せない',await q.locator('script[src*="googletagmanager"],#ga-init,#larubot-embed-script').count()===0);
  const manageUrl = q.url();
  const keys = new URLSearchParams(new URL(manageUrl).hash.slice(1));
  const a = await (
    await guest.request.post(base + "/api/hp/scheduling", {
      headers: { Authorization: "Bearer " + keys.get("key") },
      data: { siteId: meta.site, id: keys.get("booking"), action: "lookup" },
    })
  ).json();
  check(
    "担当者と設備が割り当てられている",
    a.appointment.staff_id === "p1" &&
      a.appointment.resource_name === "相談室1",
  );
  const anonymous = await (
    await fetch(
      base +
        `/api/hp/scheduling?siteId=${meta.site}&serviceId=s1&day=${meta.day}`,
    )
  ).json();
  check(
    "準備時間まで他のお客様の空き枠から除く",
    !anonymous.slots.some((x) =>
      ["10:00", "10:15", "10:30", "10:45", "11:00"].includes(
        new Date(x.startsAt).toLocaleTimeString("ja-JP", {
          timeZone: "Asia/Tokyo",
          hour: "2-digit",
          minute: "2-digit",
        }),
      ),
    ),
  );
  check(
    "空き枠APIに個人情報が出ない",
    !JSON.stringify(anonymous).includes("花子") &&
      !JSON.stringify(anonymous).includes("example.invalid"),
  );
  await q.getByRole("button", { name: "日時を変更する", exact: true }).click();
  await q.getByRole("button", { name: "13:00", exact: true }).waitFor();
  await q.getByRole("button", { name: "13:00", exact: true }).click();
  await q
    .getByRole("button", { name: "この日時に変更する", exact: true })
    .click();
  await q.getByRole("heading", { name: "ご予約が確定しています" }).waitFor();
  check("日時変更後の確認画面は13時", (await q.getByText(/13:00/).count()) > 0);
  await p.getByRole("button", { name: "予約一覧", exact: true }).click();
  await p.getByLabel("日付（日本時間）").fill(meta.day);
  await p.getByText("予約検証 花子 様", { exact: true }).waitFor();
  check(
    "店舗一覧に予約が1件だけある",
    (await p.locator("article").count()) === 1,
  );
  await p.screenshot({ path: out + "/390-agenda.png", fullPage: true });
  q.once("dialog", (d) => d.accept());
  await q.getByRole("button", { name: "キャンセルする", exact: true }).click();
  await q
    .getByRole("heading", { name: "キャンセルしました", exact: true })
    .waitFor();
  const after = await (
    await fetch(
      base +
        `/api/hp/scheduling?siteId=${meta.site}&serviceId=s1&day=${meta.day}`,
    )
  ).json();
  check(
    "キャンセルした枠は再び予約できる",
    after.slots.some(
      (x) =>
        Date.parse(x.startsAt) === Date.parse(meta.day + "T13:00:00+09:00"),
    ),
  );
  const cfg = await (
    await fetch(base + "/api/hp/scheduling?siteId=" + meta.site)
  ).json();
  const second = await (
    await guest.request.post(base + "/api/hp/scheduling", {
      data: {
        action: "reserve",
        siteId: meta.site,
        clientKey: crypto.randomUUID(),
        token: "d".repeat(64),
        configVersion: cfg.config.version,
        serviceId: "s1",
        staffId: "p1",
        startsAt: meta.day + "T14:00:00+09:00",
        name: "店舗変更の検証",
        email: "second@example.invalid",
        phone: "",
      },
    })
  ).json();
  check("店舗側変更用の予約ができた", !!second.appointment);
  await p.getByRole("button", { name: "更新", exact: true }).click();
  await p.getByText("店舗変更の検証 様", { exact: true }).waitFor();
  const entry = p.locator("article").filter({ hasText: "店舗変更の検証" });
  await entry.getByRole("button", { name: "日時変更", exact: true }).click();
  await p.getByRole("button", { name: "15:00", exact: true }).waitFor();
  await p.getByRole("button", { name: "15:00", exact: true }).click();
  await p.getByRole("button", { name: "変更を確定", exact: true }).click();
  await p.getByText("予約日時を変更しました", { exact: true }).waitFor();
  check(
    "店舗側からの日時変更が一覧に反映",
    (await entry.locator("time").innerText()) === "15:00",
  );
  p.once("dialog", (d) => d.accept());
  const cancelResponse = p.waitForResponse((r) =>
    r.url().includes(`/api/sites/${meta.site}/schedule`) &&
    r.request().method() === "PATCH",
  );
  await entry.getByRole("button", { name: "キャンセル", exact: true }).click();
  const cancelResult = await cancelResponse;
  check("店舗側のキャンセルAPIが成功", cancelResult.ok());
  await entry.getByRole("button", { name: "キャンセル", exact: true }).waitFor({ state: "detached" });
  await entry.getByText("キャンセル", { exact: true }).first().waitFor();
  const ownerChanged = await (
    await guest.request.post(base + "/api/hp/scheduling", {
      headers: { Authorization: "Bearer " + "d".repeat(64) },
      data: { action: "lookup", siteId: meta.site, id: second.appointment.id },
    })
  ).json();
  check(
    "店舗からの変更とキャンセルがお客様側にも反映",
    ownerChanged.appointment.status === "canceled" &&
      ownerChanged.appointment.revision === 3,
  );
  const legacy = await (
    await fetch(base + "/api/hp/booking/availability?siteId=" + meta.site)
  ).json();
  check("旧固定枠のAPIは新しい予約入口を案内", !!legacy.scheduleUrl);
  check("実画面のJavaScript例外なし", errors.length === 0);
  await guest.close();
  await owner.close();
} finally {
  await browser.close();
  fs.writeFileSync(
    out + "/results.json",
    JSON.stringify(
      {
        conditions:
          "Next production build + real local PostgreSQL via test HTTP adapter; fixture auth; email disabled",
        results,
      },
      null,
      2,
    ),
  );
}
