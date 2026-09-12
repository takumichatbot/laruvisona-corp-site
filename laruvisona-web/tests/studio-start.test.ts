import test from "node:test";
import assert from "node:assert/strict";
import { makeStarterSite, STARTER_EXAMPLES } from "../lib/studio-start";
import { exportToHTML } from "../lib/html-export";
import { canRecoverStudioDraft } from "../lib/studio-draft";
import { checkPublishReadiness } from "../lib/publish-readiness";
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
