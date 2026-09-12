import { createRequire } from 'node:module';
import fs from 'node:fs';
import { installLocalFonts } from './_local-fonts.mjs';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:3319';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local fixture only');
const out = process.env.OUTPUT_DIR || '/tmp/laruhp-studio-review';
fs.mkdirSync(out,{recursive:true});
const results=[];
function check(name,ok,detail) { results.push({name,ok,detail}); console.log(ok?'OK':'FAIL',name,detail??''); if(!ok)throw Error(name); }
const browser=await chromium.launch();
try {
  for(const [width,industry] of [[320,'construction'],[390,'restaurant'],[430,'construction'],[1440,'restaurant']]) {
    const ctx=await browser.newContext({viewport:{width,height:844},locale:'ja-JP'});
    const session={access_token:'stub',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'r',user:{id:'7c9e6679-7425-40de-944b-e07fc1f90ae7',email:'owner@example.com',aud:'authenticated',role:'authenticated'}};
    await ctx.addCookies(['sb-127-auth-token','sb-localhost-auth-token'].map(name=>({name,value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64'),domain:'127.0.0.1',path:'/'})));
    const fonts=await installLocalFonts(ctx);
    await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/,r=>r.abort());
    const p=await ctx.newPage(), errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    // 同じサイト内の前ページまで本当に戻れるかも確認する。
    await p.goto(base+'/laruHP',{waitUntil:'domcontentloaded'});
    await p.goto(base+'/laruHP/studio',{waitUntil:'networkidle'});
    await p.locator('.ls-start-grid[data-ready=true]').waitFor();
    await p.waitForTimeout(500);
    const history=await p.evaluate(()=>window.history.length);
    await p.getByLabel('すべての業種から選ぶ').selectOption(industry);
    const name=p.getByLabel('店名・屋号',{exact:false});
    for (const text of ['山','山本','山本工','山本工務店']) {
      await name.fill(text); await p.waitForTimeout(300);
    }
    check(width+' 入力・業種変更で履歴を増やさない',await p.evaluate(()=>window.history.length)===history);
    if(width<761) {
      const toggle=p.getByRole('button',{name:'いまの完成イメージを見る',exact:false});
      const rect=await toggle.boundingBox();
      check(width+' 冒頭から完成像を開ける',rect.y>=0 && rect.y+rect.height<=844,rect);
      check(width+' 帯に写真と入力した店名',await toggle.locator('.ls-preview-thumb').count()===1 && (await toggle.innerText()).includes('山本工務店'));
      await p.screenshot({path:out+'/'+width+'-intake-closed.png'});
      await toggle.click();
      const f=p.frameLocator('iframe[title="作りはじめるサイトの完成イメージ"]');
      await f.locator('h1').filter({hasText:'山本工務店'}).waitFor();
      check(width+' 開いた完成像は実際の入力',true);
      await p.screenshot({path:out+'/'+width+'-intake.png'});
      await p.getByRole('button',{name:'完成イメージを閉じる',exact:false}).click();
    }
    await p.getByRole('button',{name:'雰囲気を選ぶ',exact:true}).click();
    await p.locator('.ls-mood-options').waitFor();
    check(width+' 見せ方へ1段だけ進む',new URL(p.url()).searchParams.get('step')==='mood' && await p.evaluate(()=>window.history.length)===history+1);
    await p.reload({waitUntil:'networkidle'});
    await p.locator('.ls-mood-options').waitFor();
    check(width+' 再読込でも見せ方と入力を復元',await p.locator('.ls-preview iframe').getAttribute('srcdoc').then(x=>x.includes('山本工務店')));
    await p.goBack(); await p.locator('.ls-start-grid').waitFor();
    check(width+' 戻るは前の段・入力保持',await name.inputValue()==='山本工務店');
    await p.goForward(); await p.locator('.ls-mood-options').waitFor();
    await p.getByRole('button',{name:'この見せ方で編集する',exact:true}).click();
    await p.locator('.se-editor').waitFor();
    const f=p.frameLocator('iframe[title="できあがりの見え方"]');
    await f.locator('h1').waitFor();
    await p.waitForTimeout(600);
    check(width+' 編集画面は横にはみ出さない',await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
    check(width+' プレビューは帯にならない',(await p.locator('.se-frame-box').boundingBox()).width>250);
    check(width+' 原点を分離したまま',await f.locator('html').evaluate(()=>{try{void parent.document.body;return false;}catch{return true;}}));
    await f.locator('h1').click();
    const input=p.locator('[data-field-key=heading] textarea');
    const editorHistory=await p.evaluate(()=>window.history.length);
    for(const text of ['これから','これからも','これからも、ここで。']) { await input.fill(text); await p.waitForTimeout(350); }
    await f.locator('h1').filter({hasText:'これからも、ここで。'}).waitFor();
    check(width+' 編集でも履歴を増やさない',await p.evaluate(()=>window.history.length)===editorHistory);
    await p.goBack(); await p.locator('.ls-mood-options').waitFor();
    await p.goForward(); await p.locator('.se-editor').waitFor();
    await f.locator('h1').filter({hasText:'これからも、ここで。'}).waitFor();
    check(width+' 戻る・進むで編集を失わない',true);
    const html=await p.locator('iframe[title="できあがりの見え方"]').getAttribute('srcdoc');
    check(width+' 架空の実績・体験談・料金を出さない',!/施工実績500件|中間マージンなし|高橋様|1,200円|4,500円|800円/.test(html));
    check(width+' 本文にも候補と入力待ちを明示',html.includes('【例】')&&html.includes('入力してください'));
    if(width<900)await p.getByRole('button',{name:'ページの中身',exact:true}).click();
    check(width+' 節の名前は日本語',! /\b(services|testimonials|three-col)\b/.test(await p.locator('.se-blocks').innerText()));
    await p.locator('header').getByRole('button',{name:'公開の準備',exact:true}).click();
    check(width+' 候補が残ることを公開前に案内',await p.getByText('「【例】」「入力してください」などが残っています。',{exact:false}).isVisible());
    check(width+' 設定欄を開いても横にはみ出さない',await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
    await p.screenshot({path:out+'/'+width+'-readiness.png'});
    if(width===390 || width===430) {
      const created=p.waitForResponse(r=>r.url().endsWith('/api/sites') && r.request().method()==='POST');
      await p.locator('header').getByRole('button',{name:'保存',exact:true}).click();
      const response=await created, saved=await response.json();
      check(width+' 所有者の実APIで保存',response.status()===201, saved.site?.id);
      await p.waitForURL(url=>url.searchParams.get('siteId')===saved.site.id);
      await p.waitForTimeout(400);
      await p.reload({waitUntil:'networkidle'});
      await p.locator('.se-editor').waitFor();
      await f.locator('h1').filter({hasText:'これからも、ここで。'}).waitFor();
      check(width+' 保存後の再読込も同じサイト・編集内容',new URL(p.url()).searchParams.get('siteId')===saved.site.id);
      await p.locator('header').getByRole('button',{name:'公開の準備',exact:true}).click();
      const published=p.waitForResponse(r=>r.url().endsWith('/publish') && r.request().method()==='POST');
      await p.getByRole('button',{name:'公開する',exact:true}).click();
      check(width+' 実APIで公開', (await published).status()===200);
      const publicResponse=await p.request.get(base+'/hp/'+encodeURIComponent(saved.site.slug));
      const publicHtml=await publicResponse.text();
      check(width+' 実公開ページでも架空の証言・料金を出さない',publicResponse.status()===200 && !/施工実績500件|中間マージンなし|高橋様|1,200円|4,500円|800円/.test(publicHtml));
      check(width+' 公開本文の候補も例と表示',publicHtml.includes('【例】')&&publicHtml.includes('入力してください'));
    }
    if(width===320) {
      p.on('dialog', dialog => dialog.accept());
      await p.goBack(); await p.locator('.ls-mood-options').waitFor();
      await p.goBack(); await p.locator('.ls-start-grid').waitFor();
      await p.goBack(); await p.waitForURL(url=>url.pathname==='/laruHP');
      check(width+' 戻るで案内ページまで戻れる',new URL(p.url()).pathname==='/laruHP');
    }
    check(width+' JS例外なし',errors.length===0,errors);
    await ctx.close(); await fonts.close();
  }
} finally { await browser.close(); fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2)); }
console.log('Studio review checks passed: '+results.length);
