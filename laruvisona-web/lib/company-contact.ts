/**
 * 株式会社LaruVisona の公式の電話窓口（1か所だけで持つ）。
 *
 * LARU CALL（AI電話受付）の本番回線。tenant 74「株式会社LaruVisona」に紐づく番号（2026-10-05 公開の判断）。
 * 人が必ず直接出る番号と誤解させないよう、表示には「AI電話受付」を添える。
 * 顧客サイトの電話番号・入力例とは関係がない（ここは会社自身の連絡先だけ）。
 */
export const COMPANY_PHONE = {
  display: '050-1792-3437',
  e164: '+815017923437',
  href: 'tel:+815017923437',
  note: 'AI電話受付',
} as const;

/** 画面に出す形：050-1792-3437（AI電話受付） */
export const COMPANY_PHONE_LABEL = `${COMPANY_PHONE.display}（${COMPANY_PHONE.note}）`;
