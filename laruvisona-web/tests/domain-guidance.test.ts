import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dnsInstructions, looksLikeApex } from '../lib/domain.ts';

const settings = readFileSync(new URL('../app/laruHP/settings/DomainSettings.tsx', import.meta.url), 'utf8');

test('画面の案内が、実際の手順と合っている', () => {
  // DNSレコードは「追加」を押してサーバーがトークンを発行してから出る。
  // 「入力すると表示します」と書いてあると、入力しても何も起きず壊れて見える。
  assert.doesNotMatch(settings.replace(/\{\/\*[\s\S]*?\*\/\}/g, ''), /下の欄へ入力すると、そのドメイン専用のDNS設定を表示します/);
  assert.match(settings, /「追加」を押すと、そのドメイン専用のDNS設定を表示します/);
});

test('配信先は、AとCNAMEの両方を出す', () => {
  // どちらが正しいかは顧客のDNSゾーン次第。片方だけ出すと、置けない人が詰まる。
  const rows = dnsInstructions('example.com', 'tok', { expectedTarget: 'x.onrender.com', expectedApexIp: '1.2.3.4' });
  const delivery = rows.filter(r => r.group === 'delivery');
  assert.deepEqual(delivery.map(r => r.type).sort(), ['A', 'CNAME']);
  assert.equal(delivery.filter(r => r.recommended).length, 1, 'おすすめが1つでない');
});

test('co.jp のような複数ラベルでも、頂点だと分かる', () => {
  // ラベル数だけで判定すると example.co.jp をサブドメイン扱いし、
  // 多くのレジストラで置けないCNAMEを勧めてしまう。
  assert.equal(looksLikeApex('example.co.jp'), true);
  assert.equal(looksLikeApex('www.example.co.jp'), false);
  assert.equal(looksLikeApex('example.com'), true);
  assert.equal(looksLikeApex('www.example.com'), false);

  const apex = dnsInstructions('example.co.jp', 'tok', { expectedTarget: 'x.onrender.com', expectedApexIp: '1.2.3.4' });
  assert.equal(apex.find(r => r.type === 'A')!.recommended, true);
  const sub = dnsInstructions('www.example.co.jp', 'tok', { expectedTarget: 'x.onrender.com', expectedApexIp: '1.2.3.4' });
  assert.equal(sub.find(r => r.type === 'CNAME')!.recommended, true);
});

test('所有確認のTXTは、消さないよう断ってある', () => {
  // 接続後に消されると、あとで確認が落ちる。既存のSPFを上書きされるのも困る。
  const rows = dnsInstructions('example.com', 'tok', { expectedTarget: 'x', expectedApexIp: '1.2.3.4' });
  const txt = rows.find(r => r.type === 'TXT')!;
  assert.match(txt.note!, /接続後も残して/);
  assert.match(txt.note!, /消さずに追加/);
});
