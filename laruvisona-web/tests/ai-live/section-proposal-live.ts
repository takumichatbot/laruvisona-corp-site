// 実モデル試験（6回まで）：本体の提案API（POST /api/ai/section-proposal）を、手元の検証環境から呼ぶ。
//   認証・DB は偽DB（tests/http/fixture.cjs、契約中の利用者 7c9e…）。AI への呼び出しだけが実モデル（記録用の中継経由）。
//   指示文・入力処理・出力の確かめは本番と同じ route のまま。試験用の別プロンプトは作らない。
//   1ケース1回。失敗しても引き直さない。
//   実行: OUT=<結果のJSON> node --import ./tests/_resolve-ts.mjs tests/ai-live/section-proposal-live.ts
import { writeFileSync } from 'node:fs';
import { makeStarterSite, STARTER_EXAMPLES } from '../../lib/studio-start';
import { aiData, aiFields } from '../../lib/studio-ai';
import type { Block } from '../../types/laruHP';

const base = 'http://127.0.0.1:3319';
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const cookie = 'sb-127-auth-token=base64-' + Buffer.from(JSON.stringify(session)).toString('base64');
const draft = (industry: string, name: string) => makeStarterSite({ name, area: '東京都足立区', audience: '', description: '', industry, goal: STARTER_EXAMPLES[industry]?.goal ?? 'contact' } as never, 'strong').pages[0].blocks as Block[];

// 今回のための公開用テスト情報（実在の事業者の情報・実績は使わない）
const CASES = [
  { id: 'construction-enough', industry: 'construction', name: '足立住まい工房（テスト）', type: 'services', path: 'items.0.description',
    facts: '店名は足立住まい工房（テスト）。蛇口・トイレ・給湯器など水回りの修理と交換に対応。対応地域は足立区と葛飾区。費用は現地を確認してから見積もる。' },
  { id: 'construction-short', industry: 'construction', name: '足立住まい工房（テスト）', type: 'three-col', path: 'col2Text',
    facts: '店名は足立住まい工房（テスト）。' },
  { id: 'beauty-enough', industry: 'beauty', name: 'サロン・ミナモ（テスト）', type: 'price-table', path: 'plans.0.description',
    facts: '店名はサロン・ミナモ（テスト）。カットはシャンプーとブロー込みで、所要時間は約60分。初めての方も同じ内容。' },
  { id: 'beauty-short', industry: 'beauty', name: 'サロン・ミナモ（テスト）', type: 'paragraph', path: 'text',
    facts: '店名はサロン・ミナモ（テスト）。' },
  { id: 'restaurant-enough', industry: 'restaurant', name: '食堂こもれび（テスト）', type: 'services', path: 'items.0.description',
    facts: '店名は食堂こもれび（テスト）。日替わり定食は、季節の野菜の小鉢が二品、味噌汁、ご飯付き。ランチの時間だけ出している。' },
  { id: 'restaurant-short', industry: 'restaurant', name: '食堂こもれび（テスト）', type: 'two-col', path: 'col2Text',
    facts: '店名は食堂こもれび（テスト）。ランチ営業をしている。' },
];

const out: unknown[] = [];
for (const c of CASES) {
  const block = draft(c.industry, c.name).find((b) => b.type === c.type);
  if (!block) throw Error('節が無い: ' + c.id);
  const fields = aiFields(block);
  if (!Object.hasOwn(fields, c.path)) throw Error('欄が無い: ' + c.id);
  const res = await fetch(base + '/api/ai/section-proposal', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ block: { id: block.id, type: block.type, data: aiData(block) }, prompt: '', facts: c.facts, only: [c.path] }),
  });
  const body = await res.json().catch(() => null);
  out.push({ ...c, blockId: block.id, before: fields[c.path], status: res.status, body });
  console.log(c.id, res.status, JSON.stringify(body).slice(0, 300));
}
writeFileSync(process.env.OUT || '/tmp/claude-0/ai-live-results.json', JSON.stringify(out, null, 2));
