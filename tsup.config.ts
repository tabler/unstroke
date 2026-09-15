import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/optimize.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: ['svgo', 'clipper-lib'],
});
