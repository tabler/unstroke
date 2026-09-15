import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig([
  {
    entry: ['lib/index.ts', 'lib/optimize.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    external: ['svgo', 'clipper-lib'],
  },
  {
    entry: { cli: 'lib/cli-entry.ts' },
    format: ['esm'],
    target: 'es2022',
    external: ['svgo', 'clipper-lib'],
    define: { __VERSION__: JSON.stringify(version) },
  },
]);
