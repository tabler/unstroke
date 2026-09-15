<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';
import type { IconEntry } from '../lib/icons';

const { params } = useData();
const icon = computed(() => params.value as unknown as IconEntry);
const subpaths = computed(() => (icon.value.outline.match(/M/g) ?? []).length);
const curves = computed(() => (icon.value.outline.match(/C/g) ?? []).length);
</script>

<template>
  <p><a href="/demo/">← all icons</a></p>
  <h1>{{ icon.name }} <span class="set">{{ icon.set }}</span></h1>
  <pre v-if="icon.error">{{ icon.error }}</pre>
  <template v-else>
    <div class="big">
      <figure><div class="checker" v-html="icon.source" /><figcaption>source (stroke)</figcaption></figure>
      <figure><div class="checker" v-html="icon.outline" /><figcaption>outline (fill)</figcaption></figure>
      <figure><div class="checker overlay" v-html="icon.outline + icon.reference" /><figcaption>overlay</figcaption></figure>
      <figure><div class="checker wire" v-html="icon.outline" /><figcaption>wireframe</figcaption></figure>
      <figure v-for="w in icon.weights" :key="w.width"><div class="checker" v-html="w.outline" /><figcaption>stroke-width {{ w.width }}</figcaption></figure>
    </div>
    <p class="muted">{{ subpaths }} subpaths · {{ curves }} curves · {{ icon.outline.length }} B · {{ icon.optimized.length }} B optimized · {{ icon.ms.toFixed(1) }} ms</p>
    <h2>Source</h2>
    <pre><code>{{ icon.source }}</code></pre>
    <h2>Outline</h2>
    <pre><code>{{ icon.outline }}</code></pre>
    <h2>Optimized (SVGO)</h2>
    <pre><code>{{ icon.optimized }}</code></pre>
  </template>
</template>

<style scoped>
h1 { font-size: 24px; margin: 0 0 16px; }
.set { font-size: 13px; font-weight: 400; color: var(--vp-c-text-3); margin-left: 8px; }
.big { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
figure { margin: 0; }
figure > div { aspect-ratio: 1; }
figcaption { text-align: center; color: var(--vp-c-text-3); font-size: 13px; margin-top: 6px; }
.overlay { position: relative; }
.overlay :deep(svg) { position: absolute; inset: 0; }
.overlay :deep(svg:last-child) { color: #dc2626; opacity: 0.7; }
.wire :deep(path) { fill: none; stroke: var(--vp-c-brand-1); stroke-width: 1px; vector-effect: non-scaling-stroke; }
.muted { color: var(--vp-c-text-2); font-size: 14px; }
pre { background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: 12px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; font-size: 12px; }
h2 { font-size: 14px; margin: 24px 0 8px; padding: 0; border: 0; }
</style>
