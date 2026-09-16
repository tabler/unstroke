import { defineConfig } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';

const SITE = 'https://unstroke.vercel.app';
const DESCRIPTION = 'Convert stroked SVG icons into filled outlines. Every stroke becomes a filled shape, overlaps are merged with a real boolean union, and each icon comes out as one clean path.';

export default defineConfig({
  lang: 'en',
  title: 'unstroke',
  description: DESCRIPTION,
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: SITE },
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico', sizes: '32x32' }],
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#206bc4' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'unstroke' }],
    ['meta', { property: 'og:image', content: `${SITE}/og.png` }],
    ['meta', { property: 'og:image:width', content: '1280' }],
    ['meta', { property: 'og:image:height', content: '640' }],
    ['meta', { property: 'og:image:alt', content: 'unstroke: stroked SVG in, filled outlines out' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${SITE}/og.png` }],
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: 'unstroke',
      description: DESCRIPTION,
      url: SITE,
      codeRepository: 'https://github.com/tabler/unstroke',
      programmingLanguage: 'TypeScript',
      runtimePlatform: 'Node.js',
      license: 'https://opensource.org/licenses/MIT',
      author: { '@type': 'Person', name: 'Paweł Kuna', url: 'https://github.com/codecalm' },
      keywords: 'svg, stroke to path, outline stroke, icon font, boolean union, svg optimization',
    })],
  ],
  // Per-page og:title / og:description / og:url (the static `head` above covers the rest).
  transformPageData(pageData) {
    // Dynamic icon pages: title from the route params instead of the shared "Icon".
    const params = pageData.params as { set?: string; name?: string } | undefined;
    if (params?.name) pageData.title = `${params.name} (${params.set})`;
    const title = pageData.frontmatter.layout === 'home'
      ? 'unstroke'
      : `${pageData.title} | unstroke`;
    const description = pageData.description || pageData.frontmatter.description || DESCRIPTION;
    const path = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
    const url = `${SITE}/${path}`;
    const isGallery = params?.name != null || pageData.relativePath.startsWith('demo/');
    pageData.frontmatter.head ??= [];
    if (!isGallery) {
      // the llms plugin writes `dir/index.md` as `dir.md`; the home page has no twin, llms.txt stands in for it
      const md = pageData.relativePath === 'index.md'
        ? 'llms.txt'
        : pageData.relativePath.replace(/\/index\.md$/, '.md');
      pageData.frontmatter.head.push(['link', { rel: 'alternate', type: 'text/markdown', href: `${SITE}/${md}` }]);
    }
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
    );
    // 150 near-identical per-icon pages would only dilute the index; the demo page itself stays indexable.
    if (params?.name) pageData.frontmatter.head.push(['meta', { name: 'robots', content: 'noindex, follow' }]);
  },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Reference', link: '/reference/options', activeMatch: '/reference/' },
      { text: 'Demo', link: '/demo/', activeMatch: '/(demo|icon)/' },
      { text: 'Development', link: '/development/', activeMatch: '/development/' },
      { text: 'Sponsor', link: 'https://github.com/sponsors/codecalm' },
    ],
    sidebar: {
      '/guide/': sidebar(),
      '/reference/': sidebar(),
    '/development/': sidebar(),
    },
    logo: '/favicon.svg',
    socialLinks: [{ icon: 'github', link: 'https://github.com/tabler/unstroke' }],
    editLink: { pattern: 'https://github.com/tabler/unstroke/edit/main/docs/:path' },
    search: { provider: 'local' },
    footer: {
      message: 'Released under the MIT License. Part of <a href="https://tabler.io">Tabler</a>.',
      copyright: 'Made by <a href="https://github.com/codecalm">Paweł Kuna</a> and funded by <a href="https://github.com/sponsors/codecalm">sponsors</a>.',
    },
    outline: { level: [2, 3] },
  },
  vite: {
    server: { fs: { allow: ['..'] } },
    ssr: { external: ['clipper-lib', 'svgo'] },
    plugins: [
      // llms.txt, llms-full.txt and a .md twin of every docs page, for AI tools that read docs as text.
      llmstxt({
        domain: SITE,
        title: 'unstroke',
        description: DESCRIPTION,
        details: 'unstroke is a TypeScript library and CLI (npm: unstroke) that converts stroked SVG icons into filled outlines: every stroke becomes a filled shape, overlaps are merged with a boolean union on an integer grid, and the result is one path per icon, refitted with cubic Béziers. Use it for icon fonts, PDF export, laser cutting and design tools without stroke support.',
        // the demo and the per-icon pages are generated galleries, not documentation
        ignoreFiles: ['demo/**', 'icon/**'],
        // the site sidebar is the same tree registered under three path prefixes; list it once
        sidebar: sidebar(),
      }),
    ],
  },
});

function sidebar() {
  return [
    {
      text: 'Guide',
      items: [
        { text: 'Getting started', link: '/guide/getting-started' },
        { text: 'Command line', link: '/guide/cli' },
        { text: 'API', link: '/guide/api' },
        { text: 'Optimizing the output', link: '/guide/optimize' },
      ],
    },
    {
      text: 'Reference',
      items: [
        { text: 'Options', link: '/reference/options' },
        { text: 'Lower-level API', link: '/reference/lower-level' },
        { text: 'What is supported', link: '/reference/supported' },
        { text: 'How it works', link: '/reference/how-it-works' },
        { text: 'Alternatives and output size', link: '/reference/alternatives' },
      ],
    },
    {
      text: 'Development',
      items: [
        { text: 'Contributing', link: '/development/' },
      ],
    },
  ];
}
