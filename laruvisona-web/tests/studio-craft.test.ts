import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aiFields,
  parseSectionProposal,
  applySectionProposal,
} from '../lib/studio-ai';
import {
  buildComposition,
  initialComposition,
  parseComposition,
  storeComposition,
  readComposition,
  clearComposition,
  COMPOSITION_INDUSTRIES,
} from '../lib/studio-composition';
import { composeIndustry, INDUSTRY_BLUEPRINTS } from '../lib/studio-blueprints';
import { exportToHTML, EXPORT_VERSION } from '../lib/html-export';
import { checkPublishReadiness } from '../lib/publish-readiness';
import type { Block } from '../types/laruHP';
const block: Block = {
  id: 'hero-a',
  type: 'hero',
  data: {
    heading: '暮らしをつくる',
    subheading: '家族の時間を大切に。',
    bgImage: '/photo.jpg',
    ctaLink: '#contact',
  },
};
test('section AI: only editable copy is sent; no image/link/settings', () => {
  const f = aiFields(block);
  assert.equal(f.heading, block.data.heading);
  assert.ok(!('bgImage' in f));
  assert.ok(!('ctaLink' in f));
});
test('section AI: reject actions, unknown fields, invalid shapes and oversized text', () => {
  for (const bad of [
    { ctaLink: 'https://x.test' },
    { css: 'body{}' },
    { heading: 3 },
    { heading: 'x'.repeat(2001) },
    [],
    null,
    { heading: 'changed', removeBlock: true },
  ])
    assert.equal(parseSectionProposal(block, bad), null);
});
test('section AI: accepting one field leaves all other data intact', () => {
  const p = parseSectionProposal(block, {
    heading: '暮らしから、設計する。',
    subheading: '変更候補',
  })!;
  const result = applySectionProposal(block, p, ['heading'])!;
  assert.equal(result.data.heading, '暮らしから、設計する。');
  assert.equal(result.data.subheading, block.data.subheading);
  assert.equal(result.data.bgImage, block.data.bgImage);
  assert.equal(block.data.heading, '暮らしをつくる');
});
test('section AI: stale manual edits and other blocks cannot be overwritten', () => {
  const p = parseSectionProposal(block, { heading: '提案' })!;
  assert.equal(
    applySectionProposal(
      { ...block, data: { ...block.data, heading: '先に手編集' } },
      p,
      ['heading'],
    ),
    null,
  );
  assert.equal(
    applySectionProposal({ ...block, id: 'another' }, p, ['heading']),
    null,
  );
  assert.equal(applySectionProposal(block, p, ['bgImage']), null);
  assert.equal(applySectionProposal(block, p, []), null);
});
test('section AI: markup in a proposal is rejected', () => {
  assert.equal(
    parseSectionProposal(block, { heading: '<b>新しい言葉</b>' }),
    null,
  );
});
for (const industry of COMPOSITION_INDUSTRIES)
  test(`creation ${industry}: selected copy/photo/layout persists exactly`, () => {
    const c = {
      ...initialComposition(industry),
      name: '実在店入力',
      heading: '私の見出し\n次の行',
      description: '私の紹介文',
      preset: 'warm',
      photo: 'architecture',
      presentation: 'left' as const,
    };
    const parsed = parseComposition(JSON.parse(JSON.stringify(c)))!;
    assert.deepEqual(parsed, c);
    const { site, intake } = buildComposition(parsed);
    const hero = site.pages[0].blocks.find((b) => b.type === 'hero')!;
    assert.equal(site.name, c.name);
    assert.equal(hero.data.heading, c.heading);
    assert.equal(hero.data.bgImage, '/company/concepts/architecture.webp');
    assert.equal(hero.data.heroLayout, 'left');
    assert.equal(site.settings.designPreset, 'warm');
    assert.equal(intake.industry, industry);
    assert.equal(
      checkPublishReadiness(site).find((i) => i.id === 'placeholder')!.ok,
      false,
    );
  });
test('creation rejects unknown images, industry, preset and URL-shaped payload', () => {
  const c = initialComposition();
  for (const patch of [
    { photo: 'https://evil.test/x' },
    { industry: 'invalid' },
    { preset: 'soft' },
    { heading: [] },
  ])
    assert.equal(parseComposition({ ...c, ...patch }), null);
});
test('creation handoff binds token, expires, clears and rejects malformed storage', () => {
  const mem = new Map<string, string>();
  const old = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => mem.get(k) || null,
      setItem: (k: string, v: string) => mem.set(k, v),
      removeItem: (k: string) => mem.delete(k),
    },
  });
  try {
    const c = initialComposition();
    const id = storeComposition(c)!;
    assert.deepEqual(readComposition(id), c);
    assert.equal(readComposition('other'), null);
    assert.equal(readComposition(id, Date.now() + 7200001), null);
    clearComposition();
    assert.equal(readComposition(id), null);
    mem.set('laruhp.creation-choice', '{broken');
    assert.equal(readComposition(id), null);
  } finally {
    if (old) Object.defineProperty(globalThis, 'sessionStorage', old);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});
for (const industry of Object.keys(INDUSTRY_BLUEPRINTS))
  test(`blueprint ${industry}: meaningful order without fabricated achievements`, () => {
    const { site } = buildComposition(
      initialComposition(industry === 'clinic' ? 'beauty' : industry),
    );
    const input = site.pages[0].blocks;
    const before = JSON.stringify(input);
    const result = composeIndustry(input, industry);
    assert.equal(result[0].type, 'hero');
    assert.equal(
      result.find((b) => b.type === 'gallery')?.data.heading,
      INDUSTRY_BLUEPRINTS[industry].gallery,
    );
    assert.doesNotMatch(JSON.stringify(result), /500件|高橋様|中間マージン|★5/);
    assert.equal(JSON.stringify(input), before);
    if (['clinic', 'construction', 'beauty'].includes(industry))
      assert.ok(result.some((b) => b.type === 'tabs'));
  });
test('presentation options are scoped to the configured block', () => {
  const { site } = buildComposition(initialComposition());
  const first = site.pages[0].blocks.find((b) => b.type === 'hero')!;
  site.pages[0].blocks = [
    { ...first, id: 'first', data: { ...first.data, heroLayout: 'left' } },
    { ...first, id: 'second', data: { ...first.data, heroLayout: 'split' } },
  ];
  const html = exportToHTML(
    site.pages,
    site.pages[0].seo,
    site.settings,
    site.name,
  );
  const one = html.indexOf('data-lhp-block="first"'),
    two = html.indexOf('data-lhp-block="second"');
  assert.ok(one >= 0 && two > one);
  assert.doesNotMatch(html.slice(one, two), /class="lhp-hero lhp-hero-split/);
  assert.match(html.slice(two), /lhp-hero-split/);
  assert.equal(EXPORT_VERSION, 13);
});
test('gallery stacking opts in and has reduced motion fallback', () => {
  const { site } = buildComposition(initialComposition());
  const g: Block = {
    id: 'photos',
    type: 'gallery',
    data: {
      heading: '写真',
      images: ['/a.jpg', '/b.jpg'],
      galleryLayout: 'stack',
      paddingTop: 'sm',
      animation: 'zoom',
    },
  };
  site.pages[0].blocks = [g];
  const html = exportToHTML(
    site.pages,
    site.pages[0].seo,
    site.settings,
    site.name,
  );
  assert.match(html, /class="lhp-gallery lhp-gallery-2 lhp-gallery-stack"/);
  assert.match(html, /padding-top:24px/);
  assert.match(html, /data-lhp-anim="zoom"/);
  assert.match(
    html,
    /@media\(prefers-reduced-motion:reduce\)\{\.lhp-gallery-stack \.lhp-gallery-img\{position:static\}/,
  );
  g.data.galleryLayout = 'grid';
  assert.doesNotMatch(
    exportToHTML(site.pages, site.pages[0].seo, site.settings, site.name),
    /class="lhp-gallery lhp-gallery-2 lhp-gallery-stack"/,
  );
});

test('section AI cannot erase pending sample labels', () => {
  const sample = {
    ...block,
    data: { ...block.data, heading: '【例】サービスのご紹介' },
  };
  assert.equal(
    parseSectionProposal(sample, { heading: '実績あるサービス' }),
    null,
  );
  assert.ok(
    parseSectionProposal(sample, { heading: '【例】私たちのサービス' }),
  );
});

test('section AI never silently truncates long existing copy',()=>{const long={...block,data:{...block.data,heading:'長文'.repeat(1500)}};assert.equal(Object.hasOwn(aiFields(long),'heading'),false);assert.equal(parseSectionProposal(long,{heading:'短くなった文章'}),null);const proposal=parseSectionProposal(long,{subheading:'別の説明'})!;assert.equal(applySectionProposal(long,proposal,['subheading'])!.data.heading,long.data.heading);});
