/** Map imported facts to fields consumed by the public exporter. */
export function migrationBlockData(type: string, data: Record<string, unknown>, facts: Record<string, unknown>): Record<string, unknown> {
  const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
  if (type === 'hero') return { ...data,
    ...(text(facts.catchphrase) ? { heading: text(facts.catchphrase) } : {}),
    ...(text(facts.description) ? { subheading: text(facts.description) } : {}),
  };
  if (type === 'contact') return { ...data,
    ...Object.fromEntries(['phone', 'address', 'email'].flatMap(key => text(facts[key]) ? [[key, text(facts[key])]] : [])),
  };
  if (type === 'services' && Array.isArray(facts.services)) {
    const items = facts.services.flatMap(row => {
      if (!row || typeof row !== 'object' || !text(row.name)) return [];
      return [{ icon: '', title: text(row.name), description: text(row.description), price: text(row.price) }];
    });
    if (items.length) return { ...data, items };
  }
  if (type === 'hours' && Array.isArray(facts.hours)) {
    // Preserve the source wording; do not infer opening hours or closed days.
    const schedule = facts.hours.filter(row => text(row)).map(row => ({ day: '営業時間', hours: text(row), closed: false }));
    if (schedule.length) return { ...data, schedule };
  }
  return data;
}
