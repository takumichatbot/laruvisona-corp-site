/**
 * 業種 → schema.org の型。
 *
 * 「業種別の構造化データが自動で入る」と売っているのに、実際に業種別に
 * なっていたのは5業種だけで、残り10業種は汎用の LocalBusiness に落ちていた。
 * 業種の一覧（lib/laruhp-facts.ts の INDUSTRIES）と、この表は必ず揃える。
 *
 * 迷ったら、より広い型にする。存在しない型名を書くと、構造化データ全体が
 * 読まれなくなる（誤った型 > 汎用型 ではない）。
 */
export const INDUSTRY_SCHEMA_TYPE: Record<string, string> = {
  restaurant: 'Restaurant',
  beauty: 'BeautySalon',
  clinic: 'MedicalClinic',
  construction: 'HomeAndConstructionBusiness',
  retail: 'Store',
  dental: 'Dentist',
  legal: 'LegalService',
  education: 'EducationalOrganization',
  fitness: 'ExerciseGym',
  photo: 'ProfessionalService',
  pet: 'HealthAndBeautyBusiness',
  realestate: 'RealEstateAgent',
  hotel: 'Hotel',
  wedding: 'EventVenue',
  accounting: 'AccountingService',
};

export function schemaTypeFor(industry?: string | null): string {
  if (!industry) return 'LocalBusiness';
  return INDUSTRY_SCHEMA_TYPE[industry] || 'LocalBusiness';
}
