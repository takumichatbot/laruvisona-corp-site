import type { Page } from '@/types/laruHP';
interface ComparableSite { name: string; pages: Page[]; settings: object }
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** Report only differences actually present in the two snapshots. */
export function studioChanges(before:ComparableSite,current:ComparableSite):string[]{
  const result:string[]=[];
  if(before.name!==current.name)result.push('サイト名の変更');
  if(!equal(before.settings,current.settings))result.push('サイト全体の設定変更');
  const collect=(pages:Page[])=>new Map(pages.flatMap(p=>p.blocks.map(b=>[`${p.id}:${b.id}`,b] as const)));
  const old=collect(before.pages),next=collect(current.pages);
  const added=[...next.keys()].filter(id=>!old.has(id)).length;
  const removed=[...old.keys()].filter(id=>!next.has(id)).length;
  const changed=[...next.keys()].filter(id=>old.has(id)&&!equal(old.get(id),next.get(id))).length;
  if(added)result.push(`追加した節 ${added}`);
  if(removed)result.push(`削除した節 ${removed}`);
  if(changed)result.push(`内容を変えた節 ${changed}`);
  const order=(pages:Page[])=>pages.map(p=>[p.id,p.blocks.map(b=>b.id)]);
  if(!added&&!removed&&!equal(order(before.pages),order(current.pages)))result.push('節・ページの並び変更');
  const meta=(pages:Page[])=>pages.map(({blocks,...p})=>{void blocks;return p});
  if(!equal(meta(before.pages),meta(current.pages)))result.push('ページ・検索用情報の変更');
  return result;
}
