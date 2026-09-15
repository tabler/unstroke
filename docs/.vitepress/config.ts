import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'unstroke',
  description: 'Convert stroked SVG into filled outlines with properly unioned paths.',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Reference', link: '/reference/options', activeMatch: '/reference/' },
      { text: 'Demo', link: '/demo/', activeMatch: '/(demo|icon)/' },
    ],
    sidebar: {
      '/guide/': sidebar(),
      '/reference/': sidebar(),
    },
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
  ];
}
