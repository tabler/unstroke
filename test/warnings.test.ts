import { describe, expect, it } from 'vitest';
import { outlineSvg, parseSvg, UnsupportedSvgError, type SvgWarning } from '../lib/index.js';
import { run } from '../lib/cli.js';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wrap = (body: string, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ${attrs}>${body}</svg>`;

function warningsOf(svg: string): SvgWarning[] {
  const out: SvgWarning[] = [];
  outlineSvg(svg, { onWarning: (w) => out.push(w) });
  return out;
}

const codes = (svg: string) => warningsOf(svg).map((w) => w.code);

describe('warnings', () => {
  it('is silent for supported input', () => {
    expect(codes(wrap('<path d="M2 12h20"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>'))).toEqual([]);
  });

  it('reports skipped text, image and foreignObject', () => {
    const w = warningsOf(wrap('<path d="M2 12h20"/><text x="2" y="20">Hi</text><image href="a.png"/><foreignObject/>'));
    expect(w.map((x) => [x.code, x.element])).toEqual([
      ['unsupported-element', 'text'],
      ['unsupported-element', 'image'],
      ['unsupported-element', 'foreignObject'],
    ]);
    expect(w[0]!.message).toMatch(/<text> is not supported/);
  });

  it('does not report hidden or defs-only unsupported elements', () => {
    expect(codes(wrap('<path d="M2 12h20"/><text display="none">Hi</text><defs><text>x</text></defs>'))).toEqual([]);
  });

  it('reports stroke-dasharray only on stroked shapes with a real pattern', () => {
    expect(codes(wrap('<path d="M2 12h20" stroke-dasharray="4 2"/>'))).toEqual(['dasharray']);
    expect(codes(wrap('<path d="M2 12h20" stroke-dasharray="none"/>'))).toEqual([]);
    expect(codes(wrap('<path d="M2 12h20" stroke-dasharray="0"/>'))).toEqual([]);
    expect(codes(wrap('<path d="M2 12h20" stroke="none" fill="currentColor" stroke-dasharray="4 2"/>'))).toEqual([]);
  });

  it('reports markers, clip paths, masks and filters', () => {
    expect(codes(wrap('<path d="M2 12h20" marker-end="url(#m)"/>'))).toEqual(['markers']);
    expect(codes(wrap('<path d="M2 12h20" clip-path="url(#c)"/>'))).toEqual(['clip-path']);
    expect(codes(wrap('<g mask="url(#m)"><path d="M2 12h20"/></g>'))).toEqual(['clip-path']);
    expect(codes(wrap('<path d="M2 12h20" style="filter: url(#f)"/>'))).toEqual(['filter']);
  });

  it('reports a nested svg with its own viewport', () => {
    expect(codes(wrap('<svg x="4" y="4" width="16" height="16" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>'))).toEqual(['nested-svg']);
    expect(codes(wrap('<svg><path d="M2 12h20"/></svg>'))).toEqual([]);
  });

  it('reports non-scaling-stroke and partial opacity', () => {
    expect(codes(wrap('<path d="M2 12h20" vector-effect="non-scaling-stroke"/>'))).toEqual(['vector-effect']);
    expect(codes(wrap('<path d="M2 12h20" stroke-opacity=".3"/>'))).toEqual(['opacity']);
    expect(codes(wrap('<g opacity="0.5"><path d="M2 12h20"/></g>'))).toEqual(['opacity']);
    expect(codes(wrap('<path d="M2 12h20" opacity="1"/>'))).toEqual([]);
  });

  it('reports several colours and paint servers once per document', () => {
    const w = warningsOf(wrap('<path d="M2 12h20"/><path d="M2 6h20" stroke="#f00"/><path d="M2 18h20" stroke="#f00"/>'));
    expect(w.map((x) => x.code)).toEqual(['paint']);
    expect(w[0]!.message).toMatch(/2 different colours/);
    expect(codes(wrap('<path d="M2 12h20" stroke="url(#g)"/>'))).toEqual(['paint']);
    // the same colour used for a fill and a stroke is one paint
    expect(codes(wrap('<path d="M2 12h20"/><rect x="2" y="2" width="4" height="4" fill="currentColor" stroke="none"/>'))).toEqual([]);
  });

  it('deduplicates identical warnings and exposes them on parseSvg', () => {
    const parsed = parseSvg(wrap('<path d="M2 12h20" stroke-dasharray="1"/><path d="M2 6h20" stroke-dasharray="1"/>'));
    expect(parsed.warnings.map((w) => w.code)).toEqual(['dasharray']);
  });

  it('throws in strict mode, after calling onWarning', () => {
    const seen: string[] = [];
    let err: unknown;
    try {
      outlineSvg(wrap('<text>x</text>'), { strict: true, onWarning: (w) => seen.push(w.code) });
    } catch (e) { err = e; }
    expect(err).toBeInstanceOf(UnsupportedSvgError);
    expect((err as UnsupportedSvgError).warnings).toHaveLength(1);
    expect((err as Error).message).toMatch(/<text> is not supported/);
    expect(seen).toEqual(['unsupported-element']);
    expect(outlineSvg(wrap('<path d="M2 12h20"/>'), { strict: true })).toContain('<path d="M22 13H2V11H22Z"/>');
  });
});

describe('cli warnings', () => {
  const io = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { stdout: (s: string) => { out.push(s); }, stderr: (s: string) => { err.push(s); }, out, err };
  };

  it('prints warnings on stderr, still converts, and counts them in the summary', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'unstroke-warn-'));
    try {
      writeFileSync(join(dir, 'dash.svg'), wrap('<path d="M2 12h20" stroke-dasharray="4 2"/>'));
      writeFileSync(join(dir, 'ok.svg'), wrap('<path d="M2 12h20"/>'));
      const o = io();
      expect(await run([dir, '-o', join(dir, 'out')], o)).toBe(0);
      const err = o.err.join('');
      expect(err).toMatch(/dash\.svg: warning: stroke-dasharray on <path> is ignored/);
      expect(err).not.toMatch(/ok\.svg: warning/);
      expect(err).toMatch(/2 of 2 files converted in [\d.]+s, 1 with warnings/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('--strict fails the file and exits 1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'unstroke-strict-'));
    try {
      writeFileSync(join(dir, 'dash.svg'), wrap('<path d="M2 12h20" stroke-dasharray="4 2"/>'));
      writeFileSync(join(dir, 'ok.svg'), wrap('<path d="M2 12h20"/>'));
      const o = io();
      expect(await run([dir, '-o', join(dir, 'out'), '--strict'], o)).toBe(1);
      const err = o.err.join('');
      expect(err).toMatch(/dash\.svg: stroke-dasharray on <path> is ignored/);
      expect(err).not.toMatch(/warning:/);
      expect(err).toMatch(/1 of 2 files converted in [\d.]+s, 1 failed/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
