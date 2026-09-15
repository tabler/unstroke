import { defineConfig } from 'vitepress';

const SITE = 'https://unstroke.vercel.app';
const DESCRIPTION = 'Convert stroked SVG into filled outlines with properly unioned paths.';

export default defineConfig({
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
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: `${SITE}/${path}` }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
    );
  },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Reference', link: '/reference/options', activeMatch: '/reference/' },
      { text: 'Demo', link: '/demo/', activeMatch: '/(demo|icon)/' },
      { text: 'Development', link: '/development/', activeMatch: '/development/' },
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
    footer: { message: 'Released under the MIT License.', copyright: 'Paweł Kuna' },
    outline: { level: [2, 3] },
  },
  vite: {
    server: { fs: { allow: ['..'] } },
    ssr: { external: ['clipper-lib', 'svgo'] },
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
