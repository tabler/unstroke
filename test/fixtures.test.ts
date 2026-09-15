import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { outlineSvg } from '../src/index.js';
import { mismatch, rasterize } from './helpers/raster.js';

/**
 * End-to-end tests on real SVG files.
 *
 * For every file in test/fixtures/<group>/ the converted output is stored in
 * test/__output__/<group>/<name>.svg so it can be opened and inspected, and
 * compared on the next run (run `pnpm test -- -u` to accept changes). The
 * original and the outline are also rasterized and must match pixel for pixel
 * within a small tolerance, which catches geometry bugs regardless of how the
 * path data is serialized.
 */
const FIXTURES = join(import.meta.dirname, 'fixtures');
const OUTPUT = join(import.meta.dirname, '__output__');
const MAX_MISMATCH = 0.0005; // 0.05% of pixels

for (const group of readdirSync(FIXTURES)) {
  describe(group, () => {
    const files = readdirSync(join(FIXTURES, group)).filter((f) => f.endsWith('.svg'));
    for (const file of files) {
      it(file, async () => {
        const src = readFileSync(join(FIXTURES, group, file), 'utf8');
        const out = outlineSvg(src);

        // Structural expectations: one filled path, nothing stroke-related left.
        expect(out.match(/<path/g)).toHaveLength(1);
        expect(out).not.toMatch(/stroke/);
        expect(out).toMatch(/fill="currentColor"/);

        // Visual equivalence with the original.
        const diff = mismatch(rasterize(src), rasterize(out));
        expect(diff, `pixel mismatch ${(diff * 100).toFixed(3)}%`).toBeLessThanOrEqual(MAX_MISMATCH);

        await expect(pretty(out)).toMatchFileSnapshot(join(OUTPUT, group, file));
      });
    }
  });
}

/** One subpath per line so snapshot diffs stay readable. */
function pretty(svg: string): string {
  return svg
    .replace(/ M/g, '\n    M')
    .replace('><path d="', '>\n  <path d="\n    ')
    .replace('"/></svg>', '"\n  />\n</svg>\n');
}
