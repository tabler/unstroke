<script setup lang="ts">
import { computed } from 'vue';
import IconCard from './IconCard.vue';
import { data } from '../../demo/icons.data';

const groups = data;
const shown = computed(() => groups.reduce((s, g) => s + g.icons.length, 0));
const failed = computed(() => groups.reduce((s, g) => s + g.icons.filter((i) => i.error).length, 0));
const totalMs = computed(() => groups.reduce((s, g) => s + g.icons.reduce((t, i) => t + i.ms, 0), 0));
</script>

<template>
  <p class="intro">
    source (stroke) · outline (fill) · overlay (source in red over outline, any red or dark fringe is a mismatch)
    · {{ shown }} icons · {{ failed }} failed · {{ (totalMs / Math.max(1, shown)).toFixed(1) }} ms avg
  </p>
  <section v-for="g in groups" :key="g.set">
    <h2 :id="g.set">{{ g.set }} <span class="count">{{ g.icons.length }}</span></h2>
    <div class="grid">
      <IconCard v-for="icon in g.icons" :key="icon.name" :icon="icon" />
    </div>
  </section>
</template>

<style scoped>
.intro { color: var(--vp-c-text-2); font-size: 14px; }
section { margin-bottom: 32px; }
h2 { font-size: 15px; margin: 24px 0 12px; padding: 0; border: 0; display: flex; gap: 10px; align-items: baseline; }
.count { font-weight: 400; font-size: 13px; color: var(--vp-c-text-3); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
</style>
