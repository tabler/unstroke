import { defineConfig } from 'astro/config';

// Pages read the icon files and run the converter on every request, so the
// dev server always reflects the current state of ../lib.
export default defineConfig({
  output: 'server',
  server: { port: 4321 },
  vite: {
    server: { fs: { allow: ['..'] } },
    ssr: { external: ['clipper-lib', 'svgo'] },
  },
});
