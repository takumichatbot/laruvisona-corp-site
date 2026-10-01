import type { Block } from "@/types/laruHP";
import { releaseEditedColorRoles } from "@/lib/theme-roles";

/**
 * 最初の下書きが入れる見本写真には、説明文にこの印を付けてある（lib/studio-start.ts）。
 * 写真を差し替えると印を外す。URLの見た目ではなく、この印で「見本のまま」を判別する。
 */
export const SAMPLE_PHOTO_ALT_PREFIX = "サンプル写真。";
export const isStarterSamplePhoto = (data: Record<string, unknown> | undefined): boolean =>
  !!data?.bgImage && String(data.bgImageAlt || "").startsWith(SAMPLE_PHOTO_ALT_PREFIX);

/** 最初の画面の写真を差し替えたときだけ、見本の印を外した data を返す。 */
export function withoutSampleMarkOnReplace(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  if (next.bgImage !== prev.bgImage && String(next.bgImageAlt || "").startsWith(SAMPLE_PHOTO_ALT_PREFIX))
    return { ...next, bgImageAlt: "" };
  return next;
}
/** 写真を交換したら、以前の写真を優先するpicture sourceと寸法だけを外す。 */
export function editStudioBlock(
  block: Block,
  key: string,
  value: unknown,
): Block {
  // 色を選び直した欄は、テーマの色への追従（lib/theme-roles.ts）を外す
  const data = releaseEditedColorRoles(block.data, { ...block.data, [key]: value });
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
    if (String(data.bgImageAlt || "").startsWith(SAMPLE_PHOTO_ALT_PREFIX))
      data.bgImageAlt = "";
  }
  return { ...block, data };
}
