import { defineConfig } from 'astro/config';

// The preview is built as a static site: every icon is converted at build
// time with the current state of ../lib. In `astro dev` pages still render on
// request, so edits to the library show up on reload.
export default defineConfig({
  output: 'static',
  server: { port: 4321 },
  vite: {
    server: { fs: { allow: ['..'] } },
    ssr: { external: ['clipper-lib', 'svgo'] },
  },
});
