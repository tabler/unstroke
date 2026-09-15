import { describe, expect, it } from 'vitest';
import { outlinePathData, outlineSvg, outlineSvgToMultiPolygon, strokeSegments, parsePathData } from '../lib/index.js';
import { parseSvg } from '../lib/parse/svg.js';
import { signedArea } from '../lib/geometry/vec.js';

const area = (mp: ReturnType<typeof outlineSvgToMultiPolygon>) =>
  mp.reduce((sum, poly) => sum + poly.reduce((s, ring, i) => s + (i === 0 ? 1 : -1) * Math.abs(signedArea(ring)), 0), 0);

describe('outlinePathData', () => {
  it('turns a horizontal line with butt caps into a rectangle', () => {
    expect(outlinePathData('M0 0L10 0', { strokeWidth: 2 })).toBe('M10 1H0V-1H10Z');
  });

  it('square caps extend by half the width', () => {
    expect(outlinePathData('M0 0L10 0', { strokeWidth: 2, linecap: 'square' })).toBe('M-1-1H11V1H-1Z');
  });

  it('round caps add a half disc of the right area', () => {
    const mp = strokeSegments(parsePathData('M0 0L10 0'), { width: 2, linecap: 'round', linejoin: 'round', miterLimit: 4 }, 0.001);
    expect(area(mp)).toBeCloseTo(20 + Math.PI, 1);
  });

  it('miter join produces a sharp corner, bevel cuts it', () => {
    const style = { width: 2, linecap: 'butt' as const, miterLimit: 4 };
    const segs = parsePathData('M0 0L10 0L10 10');
    const miter = strokeSegments(segs, { ...style, linejoin: 'miter' }, 0.01);
    expect(area(miter)).toBeCloseTo(40, 6);
    const bevel = strokeSegments(segs, { ...style, linejoin: 'bevel' }, 0.01);
    expect(area(bevel)).toBeCloseTo(39.5, 6);
    const round = strokeSegments(segs, { ...style, linejoin: 'round' }, 0.0001);
    expect(area(round)).toBeCloseTo(39 + Math.PI / 4, 2);
  });

  it('respects the miter limit', () => {
    // 10 degree turn -> miter ratio ~11.5, above the default limit of 4 -> bevel
    const d = outlinePathData('M0 0L10 0L0 1.763', { strokeWidth: 2, linejoin: 'miter' });
    expect(d).not.toMatch(/L2\d/);
  });

  it('closed subpaths get joins rather than caps', () => {
    const mp = strokeSegments(parsePathData('M0 0L10 0L10 10L0 10Z'), { width: 2, linecap: 'butt', linejoin: 'miter', miterLimit: 4 }, 0.01);
    expect(mp).toHaveLength(1);
    expect(mp[0]).toHaveLength(2); // outer + hole
    expect(area(mp)).toBeCloseTo(12 * 12 - 8 * 8, 6);
  });

  it('unions overlapping strokes into one shape', () => {
    const mp = strokeSegments(parsePathData('M0 5L10 5M5 0L5 10'), { width: 2, linecap: 'butt', linejoin: 'miter', miterLimit: 4 }, 0.01);
    expect(mp).toHaveLength(1);
    expect(mp[0]).toHaveLength(1);
    expect(area(mp)).toBeCloseTo(20 + 20 - 4, 6);
  });

  it('draws a semicircle at a 180° reversal with round joins', () => {
    // h-2h2: the path folds back on itself, SVG renders a round cap-like bulge at the tip
    const mp = strokeSegments(parsePathData('M0 0h4h-4'), { width: 2, linecap: 'butt', linejoin: 'round', miterLimit: 4 }, 0.0001);
    expect(area(mp)).toBeCloseTo(8 + Math.PI / 2, 2);
  });

  it('renders a dot for zero-length subpaths with round caps', () => {
    const mp = strokeSegments(parsePathData('M5 5L5 5'), { width: 2, linecap: 'round', linejoin: 'round', miterLimit: 4 }, 0.001);
    expect(area(mp)).toBeCloseTo(Math.PI, 1);
    const none = strokeSegments(parsePathData('M5 5L5 5'), { width: 2, linecap: 'butt', linejoin: 'round', miterLimit: 4 }, 0.001);
    expect(none).toHaveLength(0);
  });
});

describe('outlineSvg', () => {
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M3 13h4"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`;

  it('produces a single filled path and keeps root attributes', () => {
    const out = outlineSvg(icon);
    expect(out).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="24" height="24" viewBox="0 0 24 24" class="icon" fill="currentColor"><path d="[^"]+"\/><\/svg>$/);
    expect(out).not.toContain('stroke');
    expect((out.match(/<path/g) ?? []).length).toBe(1);
  });

  it('skips the invisible blank square and honours strokeWidth override', () => {
    const thin = outlineSvgToMultiPolygon(icon, { strokeWidth: 1 });
    const thick = outlineSvgToMultiPolygon(icon, { strokeWidth: 2 });
    expect(area(thick)).toBeGreaterThan(area(thin) * 1.8);
    // line 4 long, width 2, round caps: 8 + pi ; ring r=3 width 2: pi*(4^2-2^2) = 12 pi
    expect(area(thick)).toBeCloseTo(8 + Math.PI + 12 * Math.PI, 0);
  });

  it('inherits style through groups and applies transforms', () => {
    const svg = `<svg viewBox="0 0 10 10"><g stroke="black" stroke-width="2" transform="translate(1 0)"><g transform="scale(2)"><path d="M0 1h2"/></g></g></svg>`;
    const parsed = parseSvg(svg);
    expect(parsed.shapes).toHaveLength(1);
    expect(parsed.shapes[0]!.style.strokeWidth).toBe(2);
    const mp = outlineSvgToMultiPolygon(svg);
    // path becomes M1 2 h4, width 4 (scaled)
    expect(area(mp)).toBeCloseTo(16, 6);
  });

  it('includes filled shapes using the fill rule', () => {
    const evenodd = `<svg viewBox="0 0 10 10"><path fill-rule="evenodd" d="M0 0h10v10H0zM2 2h6v6H2z"/></svg>`;
    expect(area(outlineSvgToMultiPolygon(evenodd))).toBeCloseTo(100 - 36, 6);
    const nonzero = `<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0zM2 2h6v6H2z"/></svg>`;
    expect(area(outlineSvgToMultiPolygon(nonzero))).toBeCloseTo(100, 6);
    const hole = `<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0zM2 2v6h6V2z"/></svg>`;
    expect(area(outlineSvgToMultiPolygon(hole))).toBeCloseTo(64, 6);
  });

  it('ignores hidden elements and defs', () => {
    const svg = `<svg viewBox="0 0 10 10" stroke="black"><defs><path d="M0 0h10"/></defs><path display="none" d="M0 5h10"/><path d="M0 2h10"/></svg>`;
    expect(parseSvg(svg).shapes).toHaveLength(1);
  });
});
