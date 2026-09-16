// @vitest-environment happy-dom
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { outlineSvg, outlinePathData } from '../lib/index.js';

const LIB = join(import.meta.dirname, '..', 'lib');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('browser', () => {
  it('the library source has no Node-only imports or globals (only the CLI does)', () => {
    const offenders = sourceFiles(LIB)
      .filter((f) => !/\/cli(-entry)?\.ts$/.test(f))
      .filter((f) => /from 'node:|require\(|\bprocess\.|\bBuffer\b|__dirname/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('converts inside a DOM environment and the output parses as SVG', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
    const svg = outlineSvg('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13h4"/></svg>');
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const path = doc.querySelector('path');
    expect(path?.getAttribute('d')).toMatch(/^M/);
    expect(doc.documentElement.getAttribute('fill')).toBe('currentColor');
    expect(outlinePathData('M3 13h4', { strokeWidth: 2, linecap: 'round' })).toMatch(/Z$/);
  });
});
