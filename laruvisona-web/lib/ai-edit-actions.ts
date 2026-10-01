import type { Block } from '@/types/laruHP';
import { withoutSampleMarkOnReplace } from '@/lib/studio-image';
import { releaseEditedColorRoles } from '@/lib/theme-roles';

export type SafeAiEditAction={
  type:'update_block';
  blockId:string;
  data:Record<string,string>;
};

export function aiBlockSummary(blocks:Block[]){
  return blocks.slice(0,40).map(block=>({
    id:block.id.slice(0,100),
    type:block.type,
    preview:Object.entries(block.data)
      .filter(([,value])=>typeof value==='string'&&value.length>0)
      .slice(0,6)
      .map(([key,value])=>[key,(value as string).slice(0,300)]),
  }));
}

export function safeAiEditResult(raw:unknown,blocks:Block[]):{
  reply:string;
  actions:SafeAiEditAction[];
}{
  const value=raw&&typeof raw==='object'&&!Array.isArray(raw)
    ? raw as Record<string,unknown>:{};
  const reply=typeof value.reply==='string'?value.reply.slice(0,1000):'';
  const byId=new Map(blocks.map(block=>[block.id,block]));
  const actions:SafeAiEditAction[]=[];
  if(!Array.isArray(value.actions))return {reply,actions};

  for(const candidate of value.actions.slice(0,10)){
    if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))continue;
    const action=candidate as Record<string,unknown>;
    if(action.type!=='update_block'||typeof action.blockId!=='string')continue;
    const block=byId.get(action.blockId);
    if(!block||!action.data||typeof action.data!=='object'||Array.isArray(action.data))continue;
    const data:Record<string,string>={};
    for(const [key,next] of Object.entries(action.data as Record<string,unknown>)){
      if(typeof next!=='string'||next.length>5000||typeof block.data[key]!=='string')continue;
      data[key]=next;
    }
    if(Object.keys(data).length)actions.push({type:'update_block',blockId:block.id,data});
  }
  return {reply,actions};
}

/**
 * AIチャットの結果を、既存の節へ「差分として」重ねる。
 *
 * 以前は返ってきた data で節のデータを丸ごと置き換えていた。AIは変更する欄しか返さないので、
 * 見出しだけ直すと写真・ボタンの行き先・繰り返し項目など、返さなかった欄がすべて消えていた。
 * （AIへの指示文は「マージされます」と説明していた。）
 *
 * 変更できるのは、いま文字列である1段目の欄だけ（サーバ側 safeAiEditResult と同じ条件をここでも確かめる）。
 * 配列・オブジェクトの欄は置き換えないので、中身の構造は壊れない。
 * 入力の blocks は書き換えない（取り消し用に控えた状態をそのまま戻せるように）。
 */
export function applyAiEditActions(
  blocks: Block[],
  actions: ReadonlyArray<{ type: string; blockId: string; data: Record<string, unknown> }>,
): Block[] {
  return blocks.map(block => {
    const patch: Record<string, string> = {};
    for (const action of actions) {
      if (action.type !== 'update_block' || action.blockId !== block.id) continue;
      if (!action.data || typeof action.data !== 'object' || Array.isArray(action.data)) continue;
      for (const [key, next] of Object.entries(action.data)) {
        if (typeof next !== 'string' || next.length > 5000 || typeof block.data[key] !== 'string') continue;
        patch[key] = next;
      }
    }
    if (!Object.keys(patch).length) return block;
    const merged = releaseEditedColorRoles(block.data, { ...block.data, ...patch });
    return { ...block, data: block.type === 'hero' ? withoutSampleMarkOnReplace(block.data, merged) : merged };
  });
}
