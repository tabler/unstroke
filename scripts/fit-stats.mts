import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { outlineSvg } from '../lib/index.js';
const SRC = 'test/fixtures/tabler';
for (const mult of [1, 1.5, 2, 3]) {
  let bytes = 0, curves = 0, lines = 0;
  for (const f of readdirSync(SRC)) {
    const out = outlineSvg(readFileSync(join(SRC, f), 'utf8'), { fitTolerance: 0.01 * mult });
    bytes += out.length; curves += (out.match(/C/g) ?? []).length; lines += (out.match(/[LHV]/g) ?? []).length;
  }
  const circle = outlineSvg(readFileSync(join(SRC, 'circle-number-3.svg'), 'utf8'), { fitTolerance: 0.01 * mult });
  console.log(`fit=${mult}x  bytes=${bytes} C=${curves} L=${lines}  circle-number-3: C=${(circle.match(/C/g) ?? []).length}`);
}
