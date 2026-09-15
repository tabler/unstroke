import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { outlineSvg } from '../src/index.js';
import { optimizeSvg } from '../src/optimize.js';
import { mismatch, rasterize } from './helpers/raster.js';

const DIR = join(import.meta.dirname, 'fixtures', 'tabler');

describe('optimizeSvg', () => {
  it('keeps viewBox and fill, shrinks the file, renders the same', () => {
    let before = 0;
    let after = 0;
    for (const file of readdirSync(DIR)) {
      const src = readFileSync(join(DIR, file), 'utf8');
      const out = outlineSvg(src);
      const opt = optimizeSvg(out);
      expect(opt).toContain('viewBox="0 0 24 24"');
      expect(opt).toContain('fill="currentColor"');
      expect(mismatch(rasterize(src), rasterize(opt))).toBeLessThanOrEqual(0.0005);
      before += out.length;
      after += opt.length;
    }
    expect(after).toBeLessThan(before * 0.85);
  });

  it('honours precision', () => {
    const svg = outlineSvg('<svg viewBox="0 0 24 24"><path stroke="#000" stroke-linecap="round" d="M3 12h18"/></svg>');
    expect(optimizeSvg(svg, { precision: 1 }).length).toBeLessThan(optimizeSvg(svg, { precision: 3 }).length);
  });
});
