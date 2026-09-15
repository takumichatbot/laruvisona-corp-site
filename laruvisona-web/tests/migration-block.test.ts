import test from 'node:test';
import assert from 'node:assert/strict';
import { migrationBlockData } from '../lib/migration-block.ts';
import { exportToHTML } from '../lib/html-export.ts';

test('移行した見出し・サービス・営業時間が実際の公開HTMLに残る', () => {
  const facts = { catchphrase: '地域の暮らしを支える', description: '創業者の思い', services: [{ name: '屋根点検', description: '現地で確認', price: '見積もり後に提示' }], hours: ['平日 9時〜18時', '祝日は休業'] };
  const blocks = ['hero', 'services', 'hours'].map(type => ({ id: type, type, data: migrationBlockData(type, {}, facts) }));
  const html = exportToHTML([{ id: 'home', name: 'ホーム', path: '/', blocks, seo: {} }] as never, {} as never, {} as never, 'テスト店');
  for (const expected of ['地域の暮らしを支える', '創業者の思い', '屋根点検', '現地で確認', '見積もり後に提示', '平日 9時〜18時', '祝日は休業']) assert.ok(html.includes(expected), expected);
});

test('取得できなかった項目で既存の文章や営業時間を消さない', () => {
  const original = { heading: '現在の見出し', schedule: [{ day: '月', hours: '10時〜18時', closed: false }], items: [{ title: '既存サービス' }] };
  for (const type of ['hero', 'services', 'hours', 'contact']) assert.deepEqual(migrationBlockData(type, original, { hours: [], services: [] }), original);
});
