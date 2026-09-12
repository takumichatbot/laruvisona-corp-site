import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceHistory, startHistory } from '../lib/studio-history';

test('写真の差し替えも取り消すと元のpicture情報まで戻る',()=>{
 const before={photo:'/old.jpg',sources:['/old.avif'],text:'保持'};
 const edited=reduceHistory(startHistory(before),{type:'edit',value:{photo:'/new.jpg',sources:[],text:'保持'},at:1});
 const undone=reduceHistory(edited,{type:'undo'});
 assert.equal(undone.present,before);
 assert.deepEqual(reduceHistory(undone,{type:'redo'}).present,edited.present);
});
test('続けて打った同じ欄の文字をまとめ、別欄とフォーカス境界は混ぜない',()=>{
 let h=startHistory('');
 for(const [at,value] of [[1,'a'],[100,'ab'],[200,'abc']] as const)h=reduceHistory(h,{type:'edit',value,group:'heading',at});
 assert.equal(h.past.length,1);
 h=reduceHistory(h,{type:'break'});
 h=reduceHistory(h,{type:'edit',value:'abcd',group:'heading',at:201});
 assert.equal(reduceHistory(h,{type:'undo'}).present,'abc');
 h=reduceHistory(h,{type:'edit',value:'other',group:'body',at:202});
 assert.equal(reduceHistory(h,{type:'undo'}).present,'abcd');
});
test('取り消したあと別案を選ぶと、古い未来は復活しない',()=>{
 let h=reduceHistory(startHistory('old'),{type:'edit',value:'first',group:'x',at:1});
 h=reduceHistory(h,{type:'undo'});
 h=reduceHistory(h,{type:'edit',value:'second',group:'x',at:2});
 assert.equal(h.future.length,0);
 assert.equal(reduceHistory(h,{type:'redo'}).present,'second');
 assert.equal(reduceHistory(h,{type:'undo'}).present,'old');
});
test('読み込み・下書き復旧のリセットで別サイトや空の開始状態へ戻せない',()=>{
 let h=reduceHistory(startHistory('site-a'),{type:'edit',value:'edited-a',at:1});
 h=reduceHistory(h,{type:'undo'});
 h=reduceHistory(h,{type:'reset',value:'site-b'});
 assert.equal(h.past.length,0);assert.equal(h.future.length,0);
 assert.equal(reduceHistory(h,{type:'undo'}).present,'site-b');
 assert.equal(reduceHistory(h,{type:'redo'}).present,'site-b');
});
test('保存境界を挟んだ編集をまとめず、履歴は50手に制限する',()=>{
 let h=startHistory(0);
 for(let i=1;i<=80;i++)h=reduceHistory(h,{type:'edit',value:i,at:i});
 assert.equal(h.past.length,50);
 for(let i=0;i<60;i++)h=reduceHistory(h,{type:'undo'});
 assert.equal(h.present,30);
 for(let i=0;i<60;i++)h=reduceHistory(h,{type:'redo'});
 assert.equal(h.present,80);
});

test('短い休止を超えた入力は、同じ欄でも新しい1手として戻せる',()=>{
 let h=reduceHistory(startHistory(''),{type:'edit',value:'a',group:'heading',at:100});
 h=reduceHistory(h,{type:'edit',value:'ab',group:'heading',at:1100});
 assert.equal(reduceHistory(h,{type:'undo'}).present,'a');
});
