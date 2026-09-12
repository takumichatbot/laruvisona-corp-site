import type { Block } from "@/types/laruHP";
/** 写真を交換したら、以前の写真を優先するpicture sourceと寸法だけを外す。 */
export function editStudioBlock(
  block: Block,
  key: string,
  value: unknown,
): Block {
  const data = { ...block.data, [key]: value };
  if (
    block.type === "hero" &&
    key === "bgImage" &&
    value !== block.data.bgImage
  ) {
    for (const name of [
      "bgImageSources",
      "bgImageWidth",
      "bgImageHeight",
      "bgImageSizes",
    ])
      delete data[name];
    if (String(data.bgImageAlt || "").startsWith("サンプル写真。"))
      data.bgImageAlt = "";
  }
  return { ...block, data };
}
