// ローカル本番用ビルドを3325で起動。2つのoriginを保って検証用サーバへ転送する。
import {createRequire} from 'node:module';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const {chromium}=createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url)('playwright');
const root=fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');

const results=[];const out=process.env.OUTPUT_DIR || '/tmp/laruhp-domain-check';fs.mkdirSync(out,{recursive:true});
function check(name,ok,detail){results.push({name,ok,detail});console.log(ok?'OK':'FAIL',name,detail||'');if(!ok)throw Error(name);}
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
try{for(const width of [390,1440]){
const c=await browser.newContext({viewport:{width,height:width===390?844:1000},locale:'ja-JP'});
await c.route('**/*',async r=>{const u=new URL(r.request().url());if(['laruhp.com','www.laruhp.com','laruvisona.jp'].includes(u.hostname)){
 const response=await r.fetch({url:'http://127.0.0.1:3325'+u.pathname+u.search,headers:{...r.request().headers(),host:u.hostname},maxRedirects:0});await r.fulfill({response});
}else if(['127.0.0.1','localhost','fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))await r.continue();else await r.abort();});
const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
const response=await p.goto('https://laruhp.com/?utm_source=domain-test',{waitUntil:'networkidle'});
check(width+' root 200',response.status()===200);
check(width+' LP headline',/その仕事に、/.test(await p.locator('h1').innerText()));
check(width+' canonical',new URL(await p.locator('link[rel=canonical]').getAttribute('href')).href==='https://laruhp.com/');
check(width+' no overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
check(width+' company link',await p.getByRole('link',{name:'運営会社',exact:true}).getAttribute('href')==='https://laruvisona.jp/');
check(width+' login origin',await p.getByRole('link',{name:'ログイン',exact:true}).getAttribute('href')==='https://laruvisona.jp/laruHP/auth/login');
await p.waitForFunction(()=>{let v=document.querySelector('video');return v&&v.currentTime>.2},{timeout:30000});
check(width+' video plays',await p.locator('video').evaluate(v=>v.videoWidth>0&&!v.paused));
await p.screenshot({path:out+'/'+width+'-landing.png'});
await p.locator('#experience').scrollIntoViewIfNeeded();await p.locator('.cl-lab[data-ready=true]').waitFor({timeout:45000});
check(width+' demo displays',await p.locator('.cl-lab iframe').count()===1);
await p.locator('.cl-industries').getByRole('button',{name:'飲食',exact:true}).click();
await p.locator('.cl-name input').fill('ドメイン確認喫茶');
await p.getByRole('button',{name:'このまま制作を続ける',exact:true}).click();
await p.waitForURL('https://laruvisona.jp/laruHP/studio?creation=*',{timeout:45000});
await p.getByText('案内ページでつくった内容を引き継ぎました。',{exact:false}).waitFor({timeout:45000});
check(width+' cross origin transfer',p.url().startsWith('https://laruvisona.jp/laruHP/studio?creation='));
check(width+' transfer hash removed',new URL(p.url()).hash==='');
check(width+' edited name preserved',await p.locator('input').evaluateAll(els=>els.some(el=>el.value==='ドメイン確認喫茶')));
check(width+' no exceptions',errors.length===0,errors);
await p.screenshot({path:out+'/'+width+'-studio.png'});await c.unrouteAll({behavior:'ignoreErrors'});await c.close();
}}finally{await browser.close();fs.writeFileSync(out+'/local-browser.json',JSON.stringify({conditions:'Production build, isolated fixture, requests routed to local server preserving host, Google Fonts allowed, no production writes',results},null,2));}
