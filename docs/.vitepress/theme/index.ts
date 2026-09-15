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
  },
} satisfies Theme;
