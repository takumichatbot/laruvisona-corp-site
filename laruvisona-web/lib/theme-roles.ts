import type { Block } from '@/types/laruHP';

/**
 * 節の色を「テーマのどの役割に従うか」で持つ。
 *
 * 節には bgColor / buttonColor などの色が数値で入っている。数値のままだと、あとで
 * 配色を変えても古い色が残る（問い合わせのボタンが紺のまま、など）。
 * 役割を持つ欄は、描画のときにテーマの CSS 変数（--lhp-d-*）で塗る。数値は消さずに残す。
 *
 * 役割は、利用者が見た目の案を採用したときだけ付く。既存の色が利用者の指定か
 * ひな形の既定かは判別できないので、勝手に役割へ置き換えない（推測しない）。
 * 利用者がその欄の色を選び直したら、役割を外して、選んだ色を優先する。
 */
export type ColorRole = 'accent' | 'onAccent' | 'ink' | 'bg' | 'surface' | 'line';
export const ROLE_KEYS = ['bgColor', 'textColor', 'buttonColor'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

const ROLE_VAR: Record<ColorRole, string> = {
  accent: '--lhp-d-accent',
  onAccent: '--lhp-d-on-accent',
  ink: '--lhp-d-ink',
  bg: '--lhp-d-bg',
  surface: '--lhp-d-surface',
  line: '--lhp-d-line',
};
export const ROLE_LABEL: Record<ColorRole, string> = {
  accent: '差し色',
  onAccent: '差し色の上の文字の色',
  ink: '文字の色',
  bg: '地の色',
  surface: '薄い面の色',
  line: '罫線の色',
};

const isRole = (v: unknown): v is ColorRole => typeof v === 'string' && Object.hasOwn(ROLE_VAR, v);
const isRoleKey = (k: string): k is RoleKey => (ROLE_KEYS as readonly string[]).includes(k);

/** 保存されている役割のうち、形の正しいものだけ */
export function colorRolesOf(data: Record<string, unknown> | undefined): Partial<Record<RoleKey, ColorRole>> {
  const raw = data?.colorRoles;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Partial<Record<RoleKey, ColorRole>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (isRoleKey(k) && isRole(v)) out[k] = v;
  return out;
}

/**
 * 描画用。役割のある欄だけ、テーマの CSS 変数に差し替えた節を返す（元の節は変えない）。
 * CSS 変数は「サイト全体」の設定（designCss）がある作品にしか無いので、呼ぶ側で限る。
 */
export function resolveColorRoles(block: Block): Block {
  const roles = colorRolesOf(block.data);
  const keys = Object.keys(roles) as RoleKey[];
  if (!keys.length) return block;
  const data = { ...block.data };
  for (const k of keys) data[k] = `var(${ROLE_VAR[roles[k]!]})`;
  return { ...block, data };
}

/** 利用者が色を選び直した欄は、役割を外す（選んだ色を優先する） */
export function releaseEditedColorRoles(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const roles = colorRolesOf(next);
  const changed = (Object.keys(roles) as RoleKey[]).filter(k => next[k] !== prev[k]);
  if (!changed.length) return next;
  const kept = { ...roles };
  for (const k of changed) delete kept[k];
  const out = { ...next };
  if (Object.keys(kept).length) out.colorRoles = kept;
  else delete out.colorRoles;
  return out;
}
