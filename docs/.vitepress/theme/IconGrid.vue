<script setup lang="ts">
import { computed } from 'vue';
import IconCard from './IconCard.vue';
import { data } from '../../demo/icons.data';

const groups = data;
const shown = computed(() => groups.reduce((s, g) => s + g.icons.length, 0));
const failed = computed(() => groups.reduce((s, g) => s + g.icons.filter((i) => i.error).length, 0));
const LABELS: Record<string, string> = {
  tabler: 'Sample icons',
  'fixtures-custom': 'Hand-made test cases',
  'fixtures-open-source': 'Other open source sets',
};
const setLabel = (set: string) => LABELS[set] ?? set;
const totalMs = computed(() => groups.reduce((s, g) => s + g.icons.reduce((t, i) => t + i.ms, 0), 0));
</script>

<template>
  <p class="intro">
    Every icon below is converted from the current library when the site is built. Each card shows the
    <strong>source</strong> as it was drawn, with strokes, then the <strong>outline</strong> that unstroke
    makes from it as a single filled path, and an <strong>overlay</strong> with the source in blue on top of
    the outline in grey. When the result is right you only see blue. Any grey fringe means a mismatch. The
    bottom row is the same icon outlined at stroke widths 0.5, 1 and 1.5, all from the one source file.
  </p>
  <p class="stats">
    <span><strong>{{ shown }}</strong> icons</span>
    <span><strong>{{ failed }}</strong> failed</span>
    <span><strong>{{ (totalMs / Math.max(1, shown)).toFixed(1) }} ms</strong> per icon</span>
  </p>
  <section v-for="g in groups" :key="g.set">
    <h2 :id="g.set">{{ setLabel(g.set) }} <span class="count">{{ g.icons.length }}</span></h2>
    <div class="grid">
      <IconCard v-for="icon in g.icons" :key="icon.name" :icon="icon" />
    </div>
  </section>
</template>

<style scoped>
.intro { color: var(--vp-c-text-2); font-size: 15px; line-height: 1.6; max-width: 760px; margin: 0 0 12px; }
.intro strong { color: var(--vp-c-text-1); font-weight: 600; }
.stats { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 0 0 8px; font-size: 14px; color: var(--vp-c-text-2); }
.stats strong { color: var(--vp-c-text-1); font-weight: 600; }
section { margin-bottom: 32px; }
h2 { font-size: 15px; margin: 24px 0 12px; padding: 0; border: 0; display: flex; gap: 10px; align-items: baseline; }
.count { font-weight: 400; font-size: 13px; color: var(--vp-c-text-3); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
</style>
