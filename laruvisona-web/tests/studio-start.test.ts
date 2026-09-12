import test from "node:test";
import assert from "node:assert/strict";
import { makeStarterSite, STARTER_EXAMPLES } from "../lib/studio-start";
import { exportToHTML } from "../lib/html-export";
import { canRecoverStudioDraft } from "../lib/studio-draft";
import { checkPublishReadiness } from "../lib/publish-readiness";
import { INDUSTRY_TEMPLATES } from '../lib/templates';
const intake = {
  industry: "construction",
  name: "未来設計室",
  area: "国立市",
  audience: "家族で暮らす家を考えている方",
  description: "木の家を設計します",
  goal: "contact" as const,
};
for (const goal of ["booking", "contact", "visit", "buy"] as const)
  test(`starter ${goal}: CTA has an actual rendered destination`, () => {
    const s = makeStarterSite({ ...intake, goal }, "refined");
    const hero = s.pages[0].blocks.find((b) => b.type === "hero")!;
    const html = exportToHTML(s.pages, s.pages[0].seo!, s.settings, s.name);
    assert.ok(html.includes(`id="${String(hero.data.ctaLink).slice(1)}"`));
    assert.ok(
      s.pages[0].blocks.some((b) =>
        JSON.stringify(b.data).includes(intake.audience),
      ),
    );
  });
test("industry examples keep the same content when selecting another design", () => {
  for (const industry of Object.keys(STARTER_EXAMPLES)) {
    const a = makeStarterSite({ ...intake, industry }, "calm"),
      b = makeStarterSite({ ...intake, industry }, "refined");
    assert.equal(a.name, b.name);
    assert.deepEqual(
      a.pages[0].blocks.map((x) => [x.id, x.type]),
      b.pages[0].blocks.map((x) => [x.id, x.type]),
    );
    assert.equal(
      a.pages[0].blocks.find((x) => x.type === "hero")!.data.bgImage,
      STARTER_EXAMPLES[industry].photo,
    );
  }
});
test("sample photography is flagged by publishing readiness", () => {
  const s = makeStarterSite(intake, "refined");
  assert.equal(
    checkPublishReadiness(s).find((i) => i.id === "placeholder")!.ok,
    false,
  );
});
test('every industry starts without invented testimonials, prices or achievements', () => {
  for (const industry of Object.keys(INDUSTRY_TEMPLATES)) {
    const s = makeStarterSite({ ...intake, industry }, 'refined');
    const blocks = s.pages[0].blocks;
    assert.ok(!blocks.some(b => b.type === 'testimonials' || b.type === 'team'), industry);
    const content = JSON.stringify(blocks);
    assert.doesNotMatch(content, /500件|中間マージン|高橋様|3回の施術|10kg|送料無料|駐車場完備/, industry);
    for (const b of blocks) {
      if (b.type === 'services') for (const item of b.data.items as Record<string, unknown>[]) {
        assert.equal(item.price, '', industry);
        assert.match(String(item.title), /^【例】/, industry);
      }
      if (b.type === 'price-table') for (const plan of b.data.plans as Record<string, unknown>[]) {
        assert.equal(plan.price, '料金を入力してください', industry);
      }
    }
    // 写真の alt を直しただけでは、本文に残る候補名を確認済みにしない。
    for (const b of blocks) if (b.type === 'hero') b.data.bgImageAlt = '自分の写真';
    assert.equal(checkPublishReadiness(s).find(i => i.id === 'placeholder')!.ok, false, industry);
    const html = exportToHTML(s.pages, s.pages[0].seo!, s.settings, s.name);
    assert.match(html, /【例】|入力してください/, industry);
    assert.doesNotMatch(html, /施工実績500件以上|中間マージンなし|高橋様/, industry);
  }
});
test('construction buy labels and destination agree; owner-supplied facts remain intact', () => {
  const s = makeStarterSite({ ...intake, goal: 'buy', description: '施工実績500件。料金1200円。' }, 'refined');
  const target = s.pages[0].blocks.find(b => b.data.anchorId === 'start-products')!;
  assert.equal(target.data.heading, '商品について');
  assert.ok(JSON.stringify(s.pages).includes('施工実績500件。料金1200円。'));
});
const site = makeStarterSite(intake, "refined");
const draft = {
  account: "owner-a",
  siteId: null,
  intake,
  site,
  step: "edit",
  at: 100_000,
};
test("draft is never shown before identifying its account", () => {
  assert.equal(canRecoverStudioDraft(draft, null, null, 100_000), false);
  assert.equal(canRecoverStudioDraft(draft, null, "owner-b", 100_000), false);
  assert.equal(canRecoverStudioDraft(draft, null, "owner-a", 100_000), true);
});
test("anonymous draft may transfer only to a new site", () => {
  assert.equal(
    canRecoverStudioDraft(
      { ...draft, account: null },
      null,
      "owner-b",
      100_000,
    ),
    true,
  );
  assert.equal(
    canRecoverStudioDraft(
      { ...draft, account: null, siteId: "site-a" },
      "site-a",
      "owner-b",
      100_000,
    ),
    false,
  );
});
test("draft must match site and time and have editable contents", () => {
  assert.equal(
    canRecoverStudioDraft({ ...draft, siteId: "a" }, "b", "owner-a", 100_000),
    false,
  );
  assert.equal(
    canRecoverStudioDraft({ ...draft, at: 1 }, null, "owner-a", 90_000_000),
    false,
  );
  assert.equal(
    canRecoverStudioDraft({ ...draft, at: NaN }, null, "owner-a", 100_000),
    false,
  );
  assert.equal(
    canRecoverStudioDraft({ ...draft, at: 999_999 }, null, "owner-a", 100_000),
    false,
  );
  assert.equal(
    canRecoverStudioDraft({ ...draft, site: {} }, null, "owner-a", 100_000),
    false,
  );
});

test('新しいサイトの特徴・サービスに既定の絵文字を持ち込まない', () => {
  for (const industry of ['beauty', 'restaurant', 'construction', 'retail']) {
    const site = makeStarterSite({ ...intake, industry }, 'refined');
    for (const block of site.pages[0].blocks) {
      if (block.type === 'services') {
        for (const item of block.data.items as { icon?: string }[]) assert.equal(item.icon, '');
      }
      if (block.type === 'three-col') {
        for (const n of [1, 2, 3]) assert.equal(block.data[`col${n}Icon`], '');
      }
    }
  }
});
