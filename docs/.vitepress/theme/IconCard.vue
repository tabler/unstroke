<script setup lang="ts">
import type { IconEntry } from '../lib/icons';
defineProps<{ icon: IconEntry }>();

const kb = (bytes: number) => bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} kB`;
const saved = (from: number, to: number) => from > 0 ? Math.round((1 - to / from) * 100) : 0;
</script>

<template>
  <a class="card" :href="`/icon/${icon.set}/${icon.name}`">
    <span class="name">{{ icon.name }}</span>
    <pre v-if="icon.error" class="error">{{ icon.error }}</pre>
    <div v-else class="row">
      <div class="checker" title="source (stroke)" v-html="icon.reference" />
      <div class="checker" title="outline (fill)" v-html="icon.outline" />
      <div class="checker overlay" title="overlay: source in blue over the outline in grey" v-html="icon.outline + icon.reference" />
      <div v-for="w in icon.weights" :key="w.width" class="checker weight" :title="`outline at stroke-width ${w.width}`">
        <div v-html="w.outline" />
        <span>{{ w.width }}</span>
      </div>
    </div>
    <div v-if="!icon.error" class="meta">
      <span :title="`${icon.outline.length} bytes as written, ${icon.optimized.length} after SVGO`">
        {{ kb(icon.outline.length) }} → {{ kb(icon.optimized.length) }} with SVGO
        <em v-if="saved(icon.outline.length, icon.optimized.length) > 0">−{{ saved(icon.outline.length, icon.optimized.length) }}%</em>
      </span>
      <span :title="'Conversion time on the build machine'">{{ icon.ms < 1 ? '<1' : icon.ms.toFixed(1) }} ms</span>
    </div>
  </a>
</template>

<style scoped>
.card { display: block; color: var(--vp-c-text-1); text-decoration: none; background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); border-radius: 10px; padding: 10px; transition: border-color .15s; }
.card:hover { border-color: var(--vp-c-brand-1); }
/* the theme colours links (and everything using currentColor inside) on hover; the icons must not change */
.vp-doc .card, .vp-doc .card:hover { color: var(--vp-c-text-1); text-decoration: none; }
.row > div:not(.overlay) :deep(svg) { color: var(--vp-c-text-1); }
.name { display: block; color: var(--vp-c-brand-1); font-weight: 600; font-size: 13px; margin-bottom: 8px; word-break: break-all; }
.row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.row > div { aspect-ratio: 1; min-width: 0; overflow: hidden; }
.overlay { position: relative; }
.overlay :deep(svg) { position: absolute; inset: 0; }
.weight { position: relative; }
.weight > div { width: 100%; height: 100%; }
.weight span { position: absolute; right: 4px; bottom: 2px; font-size: 11px; color: var(--vp-c-text-3); }
.meta { display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; font-size: 12px; color: var(--vp-c-text-3); }
.meta em { font-style: normal; color: var(--vp-c-green-1); margin-left: 4px; }
.error { color: #dc2626; white-space: pre-wrap; font-size: 12px; margin: 0; }
</style>
