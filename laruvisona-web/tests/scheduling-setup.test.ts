import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingPublicUrl, installScheduleBlock } from '../lib/scheduling/setup.ts';
import type { Block } from '../types/laruHP.ts';

test('予約共有URLは主独自ドメイン、なければ日本語を符号化した公開パス', () => {
  assert.equal(bookingPublicUrl({slug:'日本語', custom_domain:'salon.example'}), 'https://salon.example/reserve');
  const path = new URL(bookingPublicUrl({slug:'日本語'}));
  assert.equal(decodeURIComponent(path.pathname), '/hp/日本語/reserve');
  assert.equal(path.search, '');
});
test('予約欄の設置は既存の文章・色・IDを保持し、入力配列を書き換えない', () => {
  const blocks: Block[] = [{id:'h',type:'hero',data:{heading:'残す文章'}}, {id:'b',type:'booking',data:{mode:'simple', heading:'ご予約の相談',buttonColor:'#123456'}}];
  const result = installScheduleBlock(blocks,'new');
  assert.equal(result.length,2);
  assert.equal(result[0],blocks[0]);
  assert.deepEqual(result[1],{...blocks[1],data:{...blocks[1].data,mode:'schedule'}});
  assert.equal(blocks[1].data.mode,'simple');
  assert.deepEqual(installScheduleBlock(result,'new2'),result);
});
test('予約欄がないときだけ追加し、繰り返し操作で増殖しない', () => {
  const blocks: Block[] = [{id:'p',type:'paragraph',data:{text:'本文'}}];
  const result=installScheduleBlock(blocks,'booking-new');
  assert.equal(result.length,2);
  assert.equal(result[0],blocks[0]);
  assert.equal(result[1].data.mode,'schedule');
  assert.deepEqual(installScheduleBlock(result,'another'),result);
});
