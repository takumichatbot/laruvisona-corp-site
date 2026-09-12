import test from 'node:test';
import assert from 'node:assert/strict';
import { STUDIO_PALETTES } from '../lib/studio-palettes';
const luminance=(hex:string)=>{
 const c=hex.slice(1).match(/../g)!.map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
 return c[0]*.2126+c[1]*.7152+c[2]*.0722;
};
const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
for(const p of STUDIO_PALETTES)test(`${p.name}: 本文とボタンの文字に4.5:1以上の明暗差`,()=>{
 assert.ok(contrast(p.bg,p.ink)>=4.5);
 assert.ok(contrast(p.surface,p.ink)>=4.5);
 assert.ok(contrast(p.accent,p.onAccent)>=4.5);
});
