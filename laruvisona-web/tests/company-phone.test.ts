import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPANY_PHONE, COMPANY_PHONE_LABEL } from '../lib/company-contact';
import { organizationLd, organizationWithAreaLd } from '../lib/organization-ld';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('公式電話は1か所：050-1792-3437・tel:+815017923437・AI電話受付', () => {
  assert.equal(COMPANY_PHONE.display, '050-1792-3437');
  assert.equal(COMPANY_PHONE.e164, '+815017923437');
  assert.equal(COMPANY_PHONE.href, 'tel:+815017923437');
  assert.equal(COMPANY_PHONE_LABEL, '050-1792-3437（AI電話受付）');
});

test('Organization の telephone は E.164（地域ページも同じ）', () => {
  assert.equal(organizationLd().telephone, '+815017923437');
  assert.equal((organizationWithAreaLd() as { telephone?: string }).telephone, '+815017923437');
  assert.match(read('app/laruHP/layout.tsx'), /telephone: COMPANY_PHONE\.e164/);
});

test('会社の連絡先を出す場所は、すべて同じ正本から出す（番号を直書きしない）', () => {
  for (const p of ['components/company/CompanyFooter.tsx', 'app/contact/page.tsx', 'app/services/page.tsx', 'app/laruHP/contact/page.tsx', 'app/local/page.tsx', 'components/immersive/CompanyExperience.tsx']) {
    const s = read(p);
    assert.match(s, /COMPANY_PHONE\.href/, p);
    assert.ok(!s.includes('1792-3437') && !s.includes('815017923437'), `${p} に番号を直書きしない`);
  }
  for (const p of ['app/privacy/page.tsx', 'app/laruHP/privacy/page.tsx', 'app/laruHP/tokusho/page.tsx']) assert.match(read(p), /COMPANY_PHONE_LABEL/, p);
  assert.ok(!read('app/laruHP/tokusho/page.tsx').includes('ご請求があれば遅滞なく開示'), '特商法の電話番号欄は番号を表示');
});

test('試験用の旧番号（050-1792-2286）を会社の連絡先に使わない', () => {
  for (const p of ['lib/company-contact.ts', 'lib/organization-ld.ts', 'components/company/CompanyFooter.tsx', 'app/laruHP/tokusho/page.tsx']) {
    assert.ok(!/1792-?2286|815017922286/.test(read(p)), p);
  }
});
