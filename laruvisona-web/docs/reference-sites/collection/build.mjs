// node --import ./tests/_resolve-ts.mjs docs/reference-sites/collection/build.mjs <out>
import fs from 'node:fs';
import path from 'node:path';
import {
  buildComposition,
  initialComposition,
  COMPOSITION_INDUSTRIES,
} from '../../../lib/studio-composition.ts';
import { exportToHTML } from '../../../lib/html-export.ts';
const out = path.resolve(
  process.argv[2] || '/tmp/laruhp-directions/references',
);
fs.mkdirSync(out, { recursive: true });
for (const industry of COMPOSITION_INDUSTRIES) {
  const choice = initialComposition(industry),
    { site } = buildComposition(choice);
  const html = exportToHTML(
    site.pages,
    site.pages[0].seo,
    { ...site.settings, animLevel: 'none' },
    site.name,
  );
  fs.writeFileSync(path.join(out, industry + '.html'), html);
  fs.writeFileSync(
    path.join(out, industry + '.json'),
    JSON.stringify({ choice, site }, null, 2),
  );
}
console.log(out);
