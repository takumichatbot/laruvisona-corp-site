import test from "node:test";
import assert from "node:assert/strict";
import { editStudioBlock } from "../lib/studio-image";
import type { Block } from "../types/laruHP";
const hero: Block = {
  id: "h",
  type: "hero",
  data: {
    bgImage: "/old.jpg",
    bgImageSources: [{ srcset: "/old.avif 900w" }],
    bgImageWidth: 900,
    bgImageHeight: 600,
    bgImageSizes: "90vw",
    bgImagePositionSp: "80% 20%",
    bgImageAlt: "サンプル写真。差し替えてください",
    heading: "店名",
  },
};
test("写真交換で古いpictureと寸法を残さず、構図と文章は保つ", () => {
  const b = editStudioBlock(hero, "bgImage", "/new.jpg");
  for (const key of [
    "bgImageSources",
    "bgImageWidth",
    "bgImageHeight",
    "bgImageSizes",
  ])
    assert.equal(b.data[key], undefined);
  assert.equal(b.data.bgImagePositionSp, "80% 20%");
  assert.equal(b.data.heading, "店名");
  assert.equal(b.data.bgImageAlt, "");
  assert.equal(hero.data.bgImageWidth, 900);
});
test("他の編集や同一URLの再設定はpictureを壊さない", () => {
  assert.deepEqual(
    editStudioBlock(hero, "heading", "新しい店名").data.bgImageSources,
    hero.data.bgImageSources,
  );
  assert.deepEqual(editStudioBlock(hero, "bgImage", "/old.jpg"), hero);
});
test("利用者の写真説明を勝手に消さない", () => {
  assert.equal(
    editStudioBlock(
      { ...hero, data: { ...hero.data, bgImageAlt: "国立のお店の外観" } },
      "bgImage",
      "/new.jpg",
    ).data.bgImageAlt,
    "国立のお店の外観",
  );
});
