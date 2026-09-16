<script setup lang="ts">
import { data } from '../data/home.data';
const d = data;
</script>

<template>
  <section class="showcase">
    <h2>One icon, before and after</h2>
    <p class="lead">
      This is <code>{{ d.name }}</code>, a 24 px icon from the test set. It goes in as {{ d.sourceShapes }} stroked shapes and
      comes out as one filled <code>&lt;path&gt;</code> of {{ d.outline.length }} bytes, or {{ d.optimized.length }}
      after SVGO. The conversion took {{ d.ms.toFixed(1) }} ms.
    </p>

    <div class="compare">
      <figure>
        <div class="checker" v-html="d.source" />
        <figcaption>source: strokes</figcaption>
        <pre><code>{{ d.sourceCode }}</code></pre>
      </figure>
      <div class="arrow" aria-hidden="true">→</div>
      <figure>
        <div class="checker" v-html="d.outline" />
        <figcaption>result: a single filled path</figcaption>
        <pre><code>{{ d.outlineCode }}</code></pre>
      </figure>
    </div>

    <h2>The problem, in one picture</h2>
    <p class="lead">
      A stroke gets covered with small polygons, one per segment, one per join and one per cap. Most
      converters stop right there and let the renderer's fill rule hide the overlaps. <code>unstroke</code>
      merges them into the actual outline before it writes anything out.
    </p>

    <div class="union">
      <figure>
        <div class="checker pieces" v-html="d.pieces" />
        <figcaption><strong>{{ d.pieceCount }} pieces</strong> before the union. Every darker patch is an overlap. This is what overlapping subpaths look like when you open the file in a vector editor.</figcaption>
      </figure>
      <figure>
        <div class="checker pieces" v-html="d.outline" />
        <figcaption><strong>{{ d.outlineSubpaths }} subpaths, {{ d.outlineCurves }} curves</strong> after the union and the curve fit. There are no overlaps left and nothing to clean up.</figcaption>
      </figure>
      <figure>
        <div class="checker overlay" v-html="d.outline + d.source" />
        <figcaption><strong>Overlay</strong> of the original stroke in blue over the result drawn in grey. A grey fringe on either side would mean a mismatch. There isn't one.</figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.showcase { margin: 48px 0 0; }
h2 { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; margin: 56px 0 8px; padding: 0; border: 0; }
.lead { color: var(--vp-c-text-2); font-size: 16px; line-height: 1.6; margin: 0 0 24px; max-width: 720px; }
.lead code { font-size: 0.9em; }

.compare { display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: start; }
.compare figure, .union figure { margin: 0; min-width: 0; }
.compare .checker, .union .checker { aspect-ratio: 1; width: 100%; max-width: 280px; margin: 0 auto; }
.arrow { align-self: center; font-size: 32px; color: var(--vp-c-text-3); padding: 0 8px; }
figcaption { text-align: center; color: var(--vp-c-text-3); font-size: 13px; margin: 8px 0 12px; }
pre { margin: 0; background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; }

.union { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.union figcaption { text-align: left; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.5; }
.union figcaption strong { color: var(--vp-c-text-1); }
.pieces :deep(path) { fill: var(--vp-c-brand-1); fill-opacity: 0.18; stroke: var(--vp-c-brand-1); stroke-width: 1px; vector-effect: non-scaling-stroke; }
.overlay { position: relative; }
.overlay :deep(svg) { position: absolute; inset: 0; }

@media (max-width: 767px) {
  .compare { grid-template-columns: 1fr; }
  .arrow { transform: rotate(90deg); justify-self: center; }
  .union { grid-template-columns: 1fr; }
}
</style>
