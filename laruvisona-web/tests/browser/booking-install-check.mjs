// Local production build; real save/publish routes with isolated Supabase fixture.
import {createRequire} from 'node:module';
import fs from 'node:fs';
const {chromium}=createRequire(process.env.PLAYWRIGHT_FROM+'/')('playwright');
const base='http://127.0.0.1:3331', fix='http://127.0.0.1:55019';
const owner='7c9e6679-7425-40de-944b-e07fc1f90ae7';
const seed=(await(await fetch(fix+'/rest/v1/sites?slug=eq.yuian')).json())[0];
const session={access_token:'stub-access-token',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'stub-refresh',user:{id:owner,email:'owner@example.invalid',aud:'authenticated',role:'authenticated'}};
const browser=await chromium.launch();const results=[];
const check=(name,ok)=>{results.push({name,ok});console.log(ok?'OK':'FAIL',name);if(!ok)throw Error(name);};
const out=process.env.OUTPUT_DIR||'/tmp/hp-setup-install';fs.mkdirSync(out,{recursive:true});
try {
 const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
 await ctx.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64'),url:base}]);
 await ctx.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const url=base+`/laruHP/studio?siteId=${seed.id}&booking=schedule`;
 await p.goto(url);
 const install=p.getByRole('button',{name:'予約欄を本格予約に切り替える',exact:true});await install.waitFor();
 const before=(await(await fetch(fix+'/rest/v1/sites?id=eq.'+seed.id)).json())[0];
 check('URLを開いただけでは既存予約を変更しない',JSON.stringify(before.blocks_json)===JSON.stringify(seed.blocks_json)&&!before.blocks_json.pages[0].blocks.some(b=>b.type==='booking'&&b.data.mode==='schedule'));
 await install.click();
 await p.getByRole('button',{name:'予約ボタンを準備済み',exact:true}).waitFor();
 check('切り替え後は同じ欄を重複追加しない',await p.getByRole('button',{name:'予約ボタンを準備済み',exact:true}).isDisabled());
 await p.getByRole('link',{name:'予約管理へ戻る',exact:true}).click();
 check('未保存の切り替えを捨てて戻らない',p.url().includes('/studio'));
 await p.getByRole('link',{name:'このサイトの予約設定を開く',exact:true}).click();
 check('設定欄のリンクでも未保存の変更を保持',p.url().includes('/studio'));
 await p.getByRole('button',{name:'取り消す',exact:true}).click();
 await install.waitFor();check('取り消すと以前の予約方式に戻る',await install.isVisible());
 await install.click();
 await p.frameLocator('iframe[title="できあがりの見え方"]').getByRole('link',{name:'空き時間を見て予約する',exact:true}).waitFor({state:'visible'});
 for(const width of [320,390,1440]) {
  await p.setViewportSize({width,height:900});
  await p.frameLocator('iframe[title="できあがりの見え方"]').getByRole('link',{name:'空き時間を見て予約する',exact:true}).waitFor({state:'visible'});
  check(width+'制作画面の横はみ出しなし',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:out+`/${width}-install.png`});
 }
 await p.setViewportSize({width:390,height:844});
 const saved=p.waitForResponse(r=>r.url().endsWith('/api/sites/'+seed.id)&&r.request().method()==='PUT');
 await p.getByRole('button',{name:'保存',exact:true}).click();check('通常の保存APIが成功',(await saved).status()===200);
 await p.reload();await p.getByRole('button',{name:'予約ボタンを準備済み',exact:true}).waitFor();
 check('再読み込みでも本格予約の設定を保持',true);
 const stored=(await(await fetch(fix+'/rest/v1/sites?id=eq.'+seed.id)).json())[0];
 const old=seed.blocks_json.pages[0].blocks, now=stored.blocks_json.pages[0].blocks;
 check('予約以外の節を保持',JSON.stringify(old.filter(b=>b.type!=='booking'))===JSON.stringify(now.filter(b=>b.type!=='booking')));
 check('予約のID・見出し・色を保持',old.filter(b=>b.type==='booking').every(b=>{const n=now.find(x=>x.id===b.id);return n&&n.data.heading===b.data.heading&&n.data.buttonColor===b.data.buttonColor;}));
 await p.getByRole('button',{name:'公開の準備',exact:true}).first().click();
 const published=p.waitForResponse(r=>r.url().endsWith('/api/sites/'+seed.id+'/publish')&&r.request().method()==='POST');
 await p.getByRole('button',{name:'この内容で公開し直す',exact:true}).click();check('通常の公開APIが成功',(await published).status()===200);
 const data=(await(await fetch(fix+'/rest/v1/sites?id=eq.'+seed.id)).json())[0];
 check('公開HTMLにそのサイトの予約リンク',data.published_html.includes('/api/hp/scheduling/link?siteId='+seed.id));
 const pub=await ctx.newPage();await pub.goto(base+'/hp/yuian');
 check('公開ページに実際の予約ボタン',await pub.getByRole('link',{name:'空き時間を見て予約する',exact:true}).count()===1);
 check('公開ボタンのサイトIDが一致',(await pub.getByRole('link',{name:'空き時間を見て予約する',exact:true}).getAttribute('href')).endsWith('siteId='+seed.id));
 check('JavaScript例外なし',errors.length===0);
} finally {await browser.close();fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));}
