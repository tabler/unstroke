import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from '../lib/cli.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { stdout: (s: string) => { out.push(s); }, stderr: (s: string) => { err.push(s); }, out, err };
}

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'unstroke-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('cli', () => {
  it('prints a single file to stdout', async () => {
    const o = io();
    expect(await run([join(FIXTURES, 'tabler/x.svg')], o)).toBe(0);
    expect(o.out.join('')).toMatch(/^<svg [^>]*fill="currentColor"><path d="M/);
    expect(o.err).toEqual([]);
  });

  it('converts a directory tree into --out', async () => {
    const o = io();
    expect(await run([FIXTURES, '-o', dir, '-q'], o)).toBe(0);
    expect(readdirSync(join(dir, 'tabler')).length).toBe(readdirSync(join(FIXTURES, 'tabler')).length);
    expect(readdirSync(join(dir, 'custom')).length).toBe(readdirSync(join(FIXTURES, 'custom')).length);
    expect(readFileSync(join(dir, 'tabler/x.svg'), 'utf8')).toContain('fill="currentColor"');
    expect(o.err).toEqual([]);
  });

  it('reports progress on stderr and passes options through', async () => {
    const o = io();
    expect(await run([join(FIXTURES, 'tabler/x.svg'), '-o', dir, '--stroke-width', '1', '--no-curves', '--precision', '1'], o)).toBe(0);
    const d = /d="([^"]*)"/.exec(readFileSync(join(dir, 'x.svg'), 'utf8'))![1]!;
    expect(d).not.toMatch(/C/);
    expect(d).not.toMatch(/\d\.\d\d/);
    expect(o.err.join('')).toMatch(/1 of 1 files converted/);
  });

  it('writes in place and with a suffix', async () => {
    const src = join(dir, 'a.svg');
    writeFileSync(src, '<svg viewBox="0 0 10 10"><path stroke="#000" d="M0 5h10"/></svg>');
    expect(await run([src, '--suffix=-outline', '-q'], io())).toBe(0);
    expect(existsSync(join(dir, 'a-outline.svg'))).toBe(true);
    expect(await run([src, '--write', '-q'], io())).toBe(0);
    expect(readFileSync(src, 'utf8')).toContain('<path d="M10 5.5H0V4.5H10Z"/>');
  });

  it('optimizes with svgo when asked', async () => {
    const o = io();
    expect(await run([join(FIXTURES, 'tabler/x.svg'), '--optimize'], o)).toBe(0);
    expect(o.out.join('')).toMatch(/d="m/i);
    expect(o.out.join('').length).toBeLessThan(readFileSync(join(FIXTURES, '..', '__output__/tabler/x.svg'), 'utf8').length);
  });

  it('fails cleanly on bad input and bad options', async () => {
    let o = io();
    expect(await run([], o)).toBe(2);
    expect(o.err.join('')).toMatch(/No input files/);
    o = io();
    expect(await run(['x.svg', '--linejoin', 'sharp'], o)).toBe(2);
    expect(o.err.join('')).toMatch(/--linejoin must be one of/);
    o = io();
    expect(await run(['x.svg', '-o', dir, '--write'], o)).toBe(2);
    const bad = join(dir, 'bad.svg');
    writeFileSync(bad, '<svg><path d="M0 0L"/></svg>');
    o = io();
    expect(await run([bad, '-o', dir, '-q'], o)).toBe(1);
    expect(o.err.join('')).toMatch(/bad\.svg: /);
  });

  it('shows help and version', async () => {
    let o = io();
    expect(await run(['--help'], o)).toBe(0);
    expect(o.out.join('')).toMatch(/^unstroke - /);
    o = io();
    expect(await run(['-v'], o)).toBe(0);
    expect(o.out.join('')).toMatch(/^\S+\n$/);
  });
});
