import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('旧ウィザードURLは入力を保って制作スタジオへ転送する',()=>{
  const route=read('app/laruHP/onboarding/page.tsx');
  assert.match(route,/redirect\(`\/laruHP\/studio/);
  for(const key of ['industry','ref','mood'])assert.match(route,new RegExp(`'${key}'`));
  assert.doesNotMatch(route,/🍽|✨|AI一括/u);
});

test('新規登録・紹介・主要な管理導線は制作スタジオを正規入口にする',()=>{
  const signup=read('app/laruHP/auth/signup/SignupClient.tsx');
  const referral=read('app/laruHP/r/[code]/page.tsx');
  const dashboard=read('app/laruHP/dashboard/DashboardClient.tsx');
  assert.match(signup,/safeLaruHpRedirect\(searchParams\.get\('redirectTo'\), '\/laruHP\/studio'\)/);
  assert.match(referral,/redirect\(`\/laruHP\/studio\?ref=/);
  assert.match(dashboard,/label: '制作スタジオ'/);
  assert.doesNotMatch(dashboard,/href: '\/laruHP\/onboarding'/);
});

test('紹介情報は転送後も登録まで保持する',()=>{
  const studio=read('app/laruHP/studio/page.tsx');
  const signup=read('app/laruHP/auth/signup/SignupClient.tsx');
  assert.match(studio,/sessionStorage\.setItem\('laruHP_ref', referralParam\)/);
  assert.match(signup,/sessionStorage\.getItem\('laruHP_ref'\)/);
});
