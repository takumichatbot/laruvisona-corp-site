import type { Block } from '@/types/laruHP';

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
