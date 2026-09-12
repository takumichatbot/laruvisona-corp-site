import { makeStarterSite, exampleFor } from '@/lib/studio-start';
import { DESIGN_PRESETS } from '@/lib/site-design';
import { cleanIncomingText } from '@/lib/safe-markup';
import { editStudioBlock } from '@/lib/studio-image';
export const COMPOSITION_INDUSTRIES = [
  'beauty',
  'restaurant',
  'construction',
  'retail',
] as const;
export const COMPOSITION_PHOTOS = [
  { id: 'salon', src: '/salon/hero-1200.jpg', label: '自然光の空間' },
  {
    id: 'retreat',
    src: '/company/concepts/retreat.webp',
    label: '緑に囲まれる',
  },
  {
    id: 'architecture',
    src: '/company/concepts/architecture.webp',
    label: '建築と光',
  },
  {
    id: 'ceramics',
    src: '/company/concepts/ceramics.webp',
    label: '素材の表情',
  },
] as const;
export type Composition = {
  industry: string;
  preset: string;
  name: string;
  heading: string;
  description: string;
  photo: string;
  presentation: 'split' | 'center' | 'left';
};
export function initialComposition(industry = 'beauty'): Composition {
  const ex = exampleFor(industry);
  return {
    industry,
    preset: 'refined',
    name: ex.name,
    heading:
      industry === 'beauty'
        ? '朝、鏡の前で\nうまくいく髪を。'
        : industry === 'restaurant'
          ? '一杯の余白を、\n日々のまんなかに。'
          : industry === 'construction'
            ? '暮らしを聞く。\nそこから、つくる。'
            : '暮らしに、\n好きな道具を。',
    description: ex.description,
    photo:
      industry === 'beauty'
        ? 'salon'
        : industry === 'restaurant'
          ? 'retreat'
          : industry === 'construction'
            ? 'architecture'
            : 'ceramics',
    presentation: 'split',
  };
}
export function parseComposition(v: unknown): Composition | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  if (
    !COMPOSITION_INDUSTRIES.includes(d.industry as never) ||
    !DESIGN_PRESETS.some((p) => p.id === d.preset) ||
    !COMPOSITION_PHOTOS.some((p) => p.id === d.photo) ||
    !['split', 'center', 'left'].includes(String(d.presentation))
  )
    return null;
  if (
    !['name', 'heading', 'description'].every(
      (k) => typeof d[k] === 'string' && (d[k] as string).length < 501,
    )
  )
    return null;
  return {
    industry: String(d.industry),
    preset: String(d.preset),
    photo: String(d.photo),
    presentation: d.presentation as Composition['presentation'],
    name: cleanIncomingText(d.name as string, 80),
    heading: cleanIncomingText(d.heading as string, 160),
    description: cleanIncomingText(d.description as string, 400),
  };
}
export function buildComposition(choice: Composition) {
  const intake = {
    industry: choice.industry,
    name: choice.name,
    description: choice.description,
    area: '',
    audience: '',
    goal: exampleFor(choice.industry).goal,
  };
  const site = makeStarterSite(intake, choice.preset);
  site.pages[0].blocks = site.pages[0].blocks.map((b) =>
    b.type === 'hero'
      ? {
          ...editStudioBlock(
            b,
            'bgImage',
            COMPOSITION_PHOTOS.find((p) => p.id === choice.photo)!.src,
          ),
          data: {
            ...editStudioBlock(
              b,
              'bgImage',
              COMPOSITION_PHOTOS.find((p) => p.id === choice.photo)!.src,
            ).data,
            heading: choice.heading,
            subheading: choice.description,
            heroLayout: choice.presentation,
            textColor:
              choice.presentation === 'split'
                ? site.settings.design.ink
                : '#ffffff',
            starterExampleName:
              choice.name === exampleFor(choice.industry).name
                ? choice.name
                : '',
            bgImageAlt:
              'サンプル写真。公開前にご自身の写真へ差し替えてください。',
          },
        }
      : b,
  );
  return { site, intake };
}
const KEY = 'laruhp.creation-choice';
export function storeComposition(choice: Composition): string | null {
  try {
    const id = crypto.randomUUID();
    sessionStorage.setItem(KEY, JSON.stringify({ id, at: Date.now(), choice }));
    return id;
  } catch {
    return null;
  }
}
export function readComposition(
  id: string | null,
  now = Date.now(),
): Composition | null {
  if (!id) return null;
  try {
    const d = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (
      !d ||
      d.id !== id ||
      !Number.isFinite(d.at) ||
      d.at > now + 60000 ||
      now - d.at > 7200000
    )
      return null;
    return parseComposition(d.choice);
  } catch {
    return null;
  }
}
export function clearComposition() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}
