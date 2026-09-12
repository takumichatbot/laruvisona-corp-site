import test from 'node:test';
import assert from 'node:assert/strict';
import {studioChanges} from '../lib/studio-comparison';
import {makeStarterSite} from '../lib/studio-start';
const make=()=>makeStarterSite({name:'比較用のお店',industry:'beauty',area:'国立',goal:'booking',audience:'',description:''},'editorial');
test('比較用の案と同一内容なら差分を作らない',()=>{const a=make();assert.deepEqual(studioChanges(a,structuredClone(a)),[])});
test('配色だけを試しても写真や文章の変更として数えない',()=>{const a=make(),b=structuredClone(a);b.settings.accentColor='#333333';assert.deepEqual(studioChanges(a,b),['サイト全体の設定変更'])});
test('節の編集、追加、削除を実際のIDと内容から区別する',()=>{
 const a=make(),b=structuredClone(a);b.pages[0].blocks[0].data.heading='新しい言葉';b.pages[0].blocks.pop();b.pages[0].blocks.push({id:'new',type:'heading',data:{text:'追加'}});
 assert.deepEqual(studioChanges(a,b),['追加した節 1','削除した節 1','内容を変えた節 1']);
});
test('並べ替えを内容変更や削除と混同しない',()=>{
 const a=make(),b=structuredClone(a);b.pages[0].blocks.reverse();assert.deepEqual(studioChanges(a,b),['節・ページの並び変更']);
});
test('復元対象に含まれるサイト名と検索用情報も知らせる',()=>{
 const a=make(),b=structuredClone(a);b.name='新しいお店';b.pages[0].seo.description='新しい説明';assert.deepEqual(studioChanges(a,b),['サイト名の変更','ページ・検索用情報の変更']);
});
