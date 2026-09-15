---
layout: home
title: unstroke
titleTemplate: Convert stroked SVG to filled outlines
description: unstroke turns stroked SVG icons into filled outlines. Every stroke becomes a filled shape, overlaps are merged with a real boolean union, and each icon comes out as one clean path for icon fonts, PDF export, laser cutting and design tools.

hero:
  name: unstroke
  text: Stroked SVG in, filled outlines out.
  tagline: Every stroke becomes a filled shape, the overlaps are merged with a real boolean union, and the whole icon comes out as one path with nothing overlapping itself.
  image:
    light: /hero.png
    dark: /hero-dark.png
    alt: A stroked drop icon converted into a filled outline
  actions:
    - theme: brand
      text: Getting started
      link: /guide/getting-started
    - theme: alt
      text: Live demo
      link: /demo/
    - theme: alt
      text: GitHub
      link: https://github.com/tabler/unstroke

features:
  - title: A real union
    details: The output is the visible outline and nothing else. One <code>&lt;path&gt;</code>, no overlapping subpaths, so font engines and vector editors have nothing to trip over.
  - title: It doesn't break
    details: Polygons on an integer grid instead of booleans on curves. Zero wrong results on the whole Tabler set, where Skia and Paper.js quietly damage some icons.
  - title: Small files
    details: The rings are refitted with cubic Béziers, so the files come out 50–60% smaller than what Skia or Paper.js produce, and they're still pixel-accurate.
  - title: CLI and API
    details: Run <code>npx unstroke</code> over a folder, or call <code>outlineSvg</code> and <code>outlinePathData</code> from Node with every option under your control.
---

<HomeShowcase />

## Get started

::: code-group
```bash [npm]
npm install unstroke
```
```bash [pnpm]
pnpm add unstroke
```
```bash [yarn]
yarn add unstroke
```
:::

You can convert a folder from the command line or a string from code. Both
take the same [options](/reference/options).

::: code-group
```bash [CLI]
npx unstroke icons/ -o outlined/                 # a whole folder, tree mirrored
npx unstroke icons/ -o thin/ --stroke-width 1.5  # every weight from one source
npx unstroke icons/ -o out/ --optimize           # plus SVGO
```
```ts [API]
import { outlineSvg, outlinePathData } from 'unstroke';

const filled = outlineSvg(svgSource);                       // whole document
const thin = outlineSvg(svgSource, { strokeWidth: 1.5 });   // override the width
const d = outlinePathData('M3 13h4', { strokeWidth: 2, linecap: 'round' });
```
:::

The [getting started guide](/guide/getting-started) walks through both.

## How it compares

We ran 203 Tabler icons through every stroke-to-outline engine we could
script, passed each result through the same SVGO step, and rasterized it
against the original.

| engine | avg bytes | mean pixel mismatch | wrong / failed |
| --- | ---: | ---: | ---: |
| **unstroke** | **1061** | **0.000%** | **0** |
| Skia PathOps (CanvasKit) | 1721 | 0.000% | 0 |
| Paper.js booleans | 1610 | 0.000% | 0 |
| FontForge | 589 | 0.244% | 17 |

FontForge wins on size only because it's imprecise. Skia and Paper.js are
accurate on this sample, but they keep every fragment their intersections
produce. On the full set of 5130 icons, both curve-based engines silently
break icons that `unstroke` handles. The [full comparison](/reference/alternatives)
and the [reasoning behind polygons](/reference/how-it-works#why-polygons-and-not-boolean-operations-on-curves)
go into the details.

## What people use it for

Icon fonts, first of all. Glyphs have no concept of a stroke, and font engines
either reject overlapping contours or render them wrong. `unstroke` gives you
one clean set of contours per icon.

PDF export, plotters and laser cutters. These treat every path as a fill, or
they need the actual outline to cut along.

Design tools that don't support strokes. Some import paths but ignore
`stroke-width`, and some render strokes differently than a browser does.

And one source for several weights. You keep the icons as strokes and generate
the 1 px, 1.5 px and 2 px variants at build time with `--stroke-width`.

## Sponsors

unstroke is part of the [Tabler](https://tabler.io) family and, like the
rest of it, is free to use. Its development is funded by sponsors. If it
saves you time, consider [becoming a sponsor on GitHub](https://github.com/sponsors/codecalm)
or [donating on PayPal](https://paypal.me/codecalm).

<a class="sponsors" href="https://github.com/sponsors/codecalm" target="_blank" rel="noopener">
  <img src="https://raw.githubusercontent.com/tabler/sponsors/main/sponsors.svg" alt="Tabler sponsors" loading="lazy">
</a>
