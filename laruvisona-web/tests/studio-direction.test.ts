import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeDirection, DIRECTIONS } from '@/lib/studio-direction';
import {
  buildComposition,
  initialComposition,
  parseComposition,
} from '@/lib/studio-composition';
import { exportToHTML } from '@/lib/html-export';
import { checkPublishReadiness } from '@/lib/publish-readiness';
import type { Block } from '@/types/laruHP';
const source: Block[] = [
  {
    id: 'hero',
    type: 'hero',
    data: {
      heading: '私の文章',
      bgImage: 'https://example.com/my.jpg',
      bgImagePositionSp: '20% 80%',
      ctaLink: '#my-contact',
    },
  },
  { id: 'intro', type: 'paragraph', data: { text: '私の紹介文' } },
  {
    id: 'gallery',
    type: 'gallery',
    data: { images: ['/one.jpg', '/two.jpg'] },
  },
  { id: 'service-title', type: 'heading', data: { text: 'サービスの説明' } },
  {
    id: 'services',
    type: 'services',
    data: { items: [{ title: '実際のメニュー', price: '1500円' }] },
  },
  {
    id: 'contact',
    type: 'contact',
    data: { anchorId: 'my-contact', notifyEmail: 'owner@example.com' },
  },
];
for (const d of DIRECTIONS)
  test(`direction ${d.id}: preserves all input, identity and destination`, () => {
    const before = JSON.stringify(source);
    const result = arrangeDirection(source, d.id);
    assert.equal(JSON.stringify(source), before);
    assert.deepEqual(
      new Set(result.map((b) => b.id)),
      new Set(source.map((b) => b.id)),
    );
    for (const original of source) {
      const after = result.find((b) => b.id === original.id)!;
      for (const [key, value] of Object.entries(original.data))
        assert.deepEqual(after.data[key], value);
    }
    assert.equal(result[0].id, 'hero');
    assert.equal(result.at(-1)?.id, 'contact');
    assert.equal(
      result.findIndex((b) => b.id === 'service-title') + 1,
      result.findIndex((b) => b.id === 'services'),
    );
    assert.equal(result[0].data.heroLayout, d.layout);
    assert.deepEqual(arrangeDirection(result, d.id), result);
  });
test('three directions differ in meaningful section order', () => {
  const orders = DIRECTIONS.map((d) =>
    arrangeDirection(source, d.id)
      .map((b) => b.id)
      .join(','),
  );
  assert.equal(new Set(orders).size, 3);
});
test('unknown free composition retains its authored position', () => {
  const input = [
    ...source.slice(0, 2),
    { id: 'free', type: 'free', data: { elements: [] } } as Block,
    ...source.slice(2),
  ];
  assert.deepEqual(
    arrangeDirection(input, 'catalog').map((b) => b.id),
    input.map((b) => b.id),
  );
});
for (const industry of [
  'beauty',
  'restaurant',
  'construction',
  'retail',
  'clinic',
])
  test(`reference ${industry}: usable structure, marked examples and distinct services`, () => {
    const c = initialComposition(industry);
    assert.ok(parseComposition(c));
    const { site } = buildComposition(c);
    const b = site.pages[0].blocks;
    const gallery = b.find((b) => b.type === 'gallery')!;
    assert.ok((gallery.data.images as string[]).length > 0);
    assert.match(String(gallery.data.heading), /【例】/);
    assert.equal(
      checkPublishReadiness(site).find((x) => x.id === 'placeholder')?.ok,
      false,
    );
    assert.doesNotMatch(JSON.stringify(b), /500件|★5|高橋様|必ず治る/);
    const ids = b.map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const d of DIRECTIONS) {
      const variant = buildComposition({ ...c, presentation: d.layout });
      assert.equal(
        variant.site.pages[0].blocks.find((b) => b.type === 'hero')?.data
          .heroLayout,
        d.layout,
      );
    }
  });
test('adaptive export is scoped, safely encoded and does not truncate copy', () => {
  const { site } = buildComposition(initialComposition());
  site.pages[0].blocks = arrangeDirection(source, 'immersive');
  const h = site.pages[0].blocks[0];
  h.data.heading =
    'とても長い言葉を省略せずに最後までお客様にお伝えしたいときにも整うページ';
  h.data.mobilePhotoFit = 'contain';
  const html = exportToHTML(
    site.pages,
    site.pages[0].seo,
    site.settings,
    site.name,
  );
  assert.match(html, /data-heading-density="long"/);
  assert.match(html, /class="lhp-adaptive-mobile-photo"/);
  assert.ok(html.includes(h.data.heading as string));
  site.pages[0].blocks = structuredClone(source);
  const old = exportToHTML(
    site.pages,
    site.pages[0].seo,
    site.settings,
    site.name,
  );
  assert.doesNotMatch(old, /data-composition=/);
  assert.doesNotMatch(old, /\[data-composition\]/);
  site.pages[0].blocks[0].data.compositionStyle =
    'editorial" onclick="alert(1)';
  assert.doesNotMatch(
    exportToHTML(site.pages, site.pages[0].seo, site.settings, site.name),
    /data-composition=/,
  );
});
