import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { outlineSvg } from '../lib/index.js';
import { mismatch, rasterize } from './helpers/raster.js';

/**
 * End-to-end tests on real SVG files.
 *
 * Every file in test/fixtures/<group>/ is converted at several stroke widths.
 * Each result is stored in test/__output__/stroke-<width>/<group>/<name>.svg
 * so it can be opened and inspected, and compared on the next run (run
 * `pnpm vitest run -u` to accept changes). The original, with its stroke
 * width overridden the same way, is rasterized alongside the outline and
 * both must match pixel for pixel within a small tolerance, which catches
 * geometry bugs regardless of how the path data is serialized.
 */
const FIXTURES = join(import.meta.dirname, 'fixtures');
const OUTPUT = join(import.meta.dirname, '__output__');
const WIDTHS = [0.5, 1, 1.5, 2];
const MAX_MISMATCH = 0.0005; // 0.05% of pixels

/** The source with every stroke width (attribute or inline style) replaced. */
function withStrokeWidth(svg: string, width: number): string {
  return svg
    .replace(/stroke-width="[^"]*"/g, `stroke-width="${width}"`)
    .replace(/stroke-width\s*:\s*[^;"]+/g, `stroke-width:${width}`);
}

for (const group of readdirSync(FIXTURES)) {
  const files = readdirSync(join(FIXTURES, group)).filter((f) => f.endsWith('.svg'));
  for (const width of WIDTHS) {
    describe(`${group} at stroke-width ${width}`, () => {
      for (const file of files) {
        it(file, async () => {
          const src = readFileSync(join(FIXTURES, group, file), 'utf8');
          const out = outlineSvg(src, { strokeWidth: width });

          // Structural expectations: one filled path, nothing stroke-related left.
          expect(out.match(/<path/g)).toHaveLength(1);
          expect(out).not.toMatch(/stroke/);
          expect(out).toMatch(/fill="currentColor"/);

          // Visual equivalence with the original at the same width.
          const diff = mismatch(rasterize(withStrokeWidth(src, width)), rasterize(out));
          expect(diff, `pixel mismatch ${(diff * 100).toFixed(3)}%`).toBeLessThanOrEqual(MAX_MISMATCH);

          await expect(pretty(out)).toMatchFileSnapshot(join(OUTPUT, `stroke-${width}`, group, file));
        });
      }
    });
  }
}

/** One subpath per line so snapshot diffs stay readable. */
function pretty(svg: string): string {
  return svg
    .replace(/ M/g, '\n    M')
    .replace('><path d="', '>\n  <path d="\n    ')
    .replace('"/></svg>', '"\n  />\n</svg>\n');
}
