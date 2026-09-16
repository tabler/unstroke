import { describe, expect, it } from 'vitest';
import { outlineSvgToMultiPolygon, parseSvg } from '../lib/index.js';

const wrap = (body: string, rootAttrs = 'viewBox="0 0 24 24"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${rootAttrs} fill="none" stroke="currentColor" stroke-width="2">${body}</svg>`;

/** Bounding box of every point of the merged geometry. */
function bounds(svg: string) {
  const mp = outlineSvgToMultiPolygon(svg);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of mp) for (const ring of poly) for (const [x, y] of ring) {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

const near = (a: number, b: number, eps = 0.05) => Math.abs(a - b) <= eps;

describe('nested viewports', () => {
  it('maps a nested svg viewBox into its x/y/width/height', () => {
    // A 100-unit circle of radius 40 with a 10-wide stroke, scaled into a 16 px box at (4, 4):
    // outer edge at radius 45 * 0.16 = 7.2 around (12, 12).
    const b = bounds(wrap('<svg x="4" y="4" width="16" height="16" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke-width="10"/></svg>'));
    expect(near(b.minX, 4.8)).toBe(true);
    expect(near(b.maxX, 19.2)).toBe(true);
    expect(near(b.minY, 4.8)).toBe(true);
    expect(near(b.maxY, 19.2)).toBe(true);
  });

  it('centres with xMidYMid meet and stretches with none', () => {
    // viewBox 100 x 50 into a 20 x 20 box: meet scales by 0.2 and centres vertically (offset 5).
    const meet = bounds(wrap('<svg x="2" y="2" width="20" height="20" viewBox="0 0 100 50"><rect x="0" y="0" width="100" height="50" stroke="none" fill="currentColor"/></svg>'));
    expect([meet.minX, meet.minY, meet.maxX, meet.maxY].map((v) => +v.toFixed(2))).toEqual([2, 7, 22, 17]);
    const none = bounds(wrap('<svg x="2" y="2" width="20" height="20" viewBox="0 0 100 50" preserveAspectRatio="none"><rect x="0" y="0" width="100" height="50" stroke="none" fill="currentColor"/></svg>'));
    expect([none.minX, none.minY, none.maxX, none.maxY].map((v) => +v.toFixed(2))).toEqual([2, 2, 22, 22]);
  });

  it('honours xMinYMin and slice', () => {
    const b = bounds(wrap('<svg x="0" y="0" width="20" height="10" viewBox="0 0 10 10" preserveAspectRatio="xMinYMin slice"><rect x="0" y="0" width="10" height="10" stroke="none" fill="currentColor"/></svg>'));
    expect([b.minX, b.minY, b.maxX, b.maxY].map((v) => +v.toFixed(2))).toEqual([0, 0, 20, 20]);
  });

  it('defaults a nested svg without width/height to the parent viewport', () => {
    const b = bounds(wrap('<svg viewBox="0 0 12 12"><rect x="0" y="0" width="12" height="12" stroke="none" fill="currentColor"/></svg>'));
    expect([b.minX, b.minY, b.maxX, b.maxY].map((v) => +v.toFixed(2))).toEqual([0, 0, 24, 24]);
  });

  it('resolves percentages against the parent viewport', () => {
    const b = bounds(wrap('<svg x="50%" y="0" width="50%" height="100%" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" stroke="none" fill="currentColor"/></svg>'));
    expect([b.minX, b.minY, b.maxX, b.maxY].map((v) => +v.toFixed(2))).toEqual([12, 6, 24, 18]);
  });

  it('scales a symbol viewBox into the width/height of the <use>', () => {
    const b = bounds(wrap('<defs><symbol id="s" viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" stroke="none" fill="currentColor"/></symbol></defs><use href="#s" x="2" y="4" width="10" height="10"/>'));
    expect([b.minX, b.minY, b.maxX, b.maxY].map((v) => +v.toFixed(2))).toEqual([2, 4, 12, 14]);
  });

  it('uses the SVG default viewport when the root has no viewBox or size', () => {
    const parsed = parseSvg('<svg xmlns="http://www.w3.org/2000/svg"><svg width="50%" height="50%" viewBox="0 0 1 1"><rect width="1" height="1"/></svg></svg>');
    expect(parsed.shapes).toHaveLength(1);
    const [a, , , d] = parsed.shapes[0]!.transform;
    expect(a).toBe(75); // min(150 / 1, 75 / 1)
    expect(d).toBe(75);
  });

  it('is not reported as a warning any more', () => {
    const parsed = parseSvg(wrap('<svg x="4" y="4" width="16" height="16" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>'));
    expect(parsed.warnings).toEqual([]);
  });
});
