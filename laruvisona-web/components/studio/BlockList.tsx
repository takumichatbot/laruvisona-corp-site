'use client';
import { useState } from 'react';
import {
  LayoutTemplate,
  Type,
  AlignLeft,
  Image,
  Images,
  List,
  Users,
  CircleHelp,
  Clock,
  CalendarDays,
  Mail,
  Columns2,
  Columns3,
  MapPin,
  MousePointer2,
  Layers3,
  MessageSquare,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import type { Block } from '@/types/laruHP';
import { blockLabel, blockSummary } from '@/lib/studio-schema';
const icons: Record<string, typeof Layers3> = {
  hero: LayoutTemplate,
  heading: Type,
  paragraph: AlignLeft,
  image: Image,
  gallery: Images,
  'price-table': List,
  team: Users,
  faq: CircleHelp,
  hours: Clock,
  booking: CalendarDays,
  contact: Mail,
  'two-col': Columns2,
  'three-col': Columns3,
  map: MapPin,
  cta: MousePointer2,
  tabs: ChevronDown,
  services: List,
  testimonials: MessageSquare,
};
export function BlockIcon({ type }: { type: string }) {
  const Icon = icons[type] || Layers3;
  return <Icon size={18} strokeWidth={1.65} aria-hidden="true" />;
}
export default function BlockList({
  blocks,
  selectedId,
  onSelect,
  onChange,
}: {
  blocks: Block[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (blocks: Block[]) => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const move = (i: number, delta: number) => {
    if (i + delta < 0 || i + delta >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    onChange(next);
  };
  return (
    <div className="se-block-list">
      {blocks.map((b, i) => (
        <div
          key={b.id}
          className="se-block-item"
          data-selected={selectedId === b.id}
        >
          <div className="se-block-row">
            <button
              type="button"
              role="button"
              className="se-block-select border-l-4"
              aria-pressed={selectedId === b.id}
              onClick={() => onSelect(b.id)}
            >
              <span className="se-block-symbol">
                <BlockIcon type={b.type} />
              </span>
              <span>
                <strong>{blockLabel(b)}</strong>
                <small>{blockSummary(b) || '内容を入れてみましょう'}</small>
              </span>
              <span className="se-block-number">
                {String(i + 1).padStart(2, '0')}
              </span>
            </button>
            <button
              type="button"
              className="se-block-more"
              aria-label={`${blockLabel(b)}の操作`}
              aria-expanded={menu === b.id}
              aria-controls={`block-actions-${b.id}`}
              onClick={() => setMenu(menu === b.id ? null : b.id)}
            >
              <MoreHorizontal size={19} />
            </button>
          </div>
          {menu === b.id && (
            <div
              className="se-block-actions"
              id={`block-actions-${b.id}`}
              role="group"
              aria-label={`${blockLabel(b)}の並べ替えと削除`}
            >
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={15} />
                上へ
              </button>
              <button
                type="button"
                disabled={i === blocks.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={15} />
                下へ
              </button>
              <button
                type="button"
                className="se-block-delete"
                onClick={() => {
                  if (confirm(`「${blockLabel(b)}」を消しますか`)) {
                    onChange(blocks.filter((x) => x.id !== b.id));
                    setMenu(null);
                  }
                }}
              >
                <Trash2 size={15} />
                削除
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
