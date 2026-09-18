import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import IconGrid from './IconGrid.vue';
import IconPage from './IconPage.vue';
import HomeShowcase from './HomeShowcase.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('IconGrid', IconGrid);
    app.component('IconPage', IconPage);
    app.component('HomeShowcase', HomeShowcase);

    // Analytics: browser only, and only when a key is configured (so local dev and forks stay silent).
    const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
    if (!import.meta.env.SSR && key) {
      void import('posthog-js').then(({ default: posthog }) => {
        posthog.init(key, {
          // production goes through the same-origin reverse proxy (the `/t` rewrites in vercel.json), which only exists on Vercel
          api_host: import.meta.env.DEV
            ? ((import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com')
            : '/t',
          ui_host: 'https://eu.posthog.com',
          // the `defaults` snapshot also turns on pageviews for client-side route changes
          defaults: '2025-05-24',
          person_profiles: 'identified_only',
        });
      });
    }
  },
} satisfies Theme;
