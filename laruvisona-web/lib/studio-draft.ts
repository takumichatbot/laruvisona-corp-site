/** 端末の控えは、アカウント確認後にだけ復元する。匿名の控えを引き継げるのは新規作成だけ。 */
export function canRecoverStudioDraft(
  value: unknown,
  siteId: string | null,
  account: string | null,
  now = Date.now(),
): boolean {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  if (
    d.siteId !== siteId ||
    typeof d.at !== "number" ||
    !Number.isFinite(d.at) ||
    d.at > now + 60_000 ||
    now - d.at > 86_400_000
  )
    return false;
  if (
    d.account !== null &&
    (typeof d.account !== "string" || d.account !== account)
  )
    return false;
  if (siteId && !d.account) return false;
  if (!["intake", "mood", "edit"].includes(String(d.step))) return false;
  if (
    !d.site ||
    typeof d.site !== "object" ||
    !d.intake ||
    typeof d.intake !== "object"
  )
    return false;
  const s = d.site as Record<string, unknown>,
    i = d.intake as Record<string, unknown>;
  return (
    typeof s.name === "string" &&
    Array.isArray(s.pages) &&
    !!s.settings &&
    typeof s.settings === "object" &&
    ["name", "industry", "area", "audience", "description", "goal"].every(
      (k) => typeof i[k] === "string",
    )
  );
}
