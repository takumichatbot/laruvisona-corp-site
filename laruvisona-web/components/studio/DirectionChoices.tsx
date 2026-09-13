'use client';
/* The uploaded photo is an arbitrary URL; keep native image rendering like ImageField. */
/* eslint-disable @next/next/no-img-element */
import { DIRECTIONS, type DirectionId } from '@/lib/studio-direction';
import './direction-choices.css';
export default function DirectionChoices({
  value,
  photo,
  onChange,
}: {
  value: string;
  photo?: string;
  onChange: (id: DirectionId) => void;
}) {
  return (
    <div className="dc-choices" role="group" aria-label="構成の違う3案">
      {DIRECTIONS.map((d, i) => (
        <button
          type="button"
          key={d.id}
          aria-pressed={value === d.id}
          onClick={() => onChange(d.id)}
        >
          <span className={`dc-sketch dc-${d.id}`} aria-hidden="true">
            <span className="dc-image">
              {photo && <img src={photo} alt="" loading="lazy" />}
            </span>
            <span className="dc-lines">
              <b />
              <b />
              <i />
            </span>
            <span className="dc-sections">
              <i />
              <i />
              <i />
            </span>
          </span>
          <span className="dc-number">0{i + 1}</span>
          <strong>{d.name}</strong>
          <small>{d.note}</small>
        </button>
      ))}
    </div>
  );
}
