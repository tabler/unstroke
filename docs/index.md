---
layout: home
title: unstroke
titleTemplate: Stroked SVG in, filled outlines out

hero:
  name: unstroke
  text: Stroked SVG in, filled outlines out.
  tagline: Every stroke becomes a filled shape, overlaps are merged with a true boolean union, and the whole icon comes out as a single path with no self-overlaps.
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
  - title: True union
    details: The output is exactly the visible outline. One <code>&lt;path&gt;</code>, no overlapping subpaths, nothing for font engines or vector editors to choke on.
  - title: Never fails
    details: Polygons on an integer grid instead of curve booleans. Zero wrong outputs on the whole Tabler set, where Skia and Paper.js silently break icons.
  - title: Small files
    details: Rings are refitted with cubic Béziers, so files are 50–60% smaller than Skia or Paper.js output and still pixel-accurate.
  - title: CLI and API
    details: Batch a folder with <code>npx unstroke</code>, or call <code>outlineSvg</code> and <code>outlinePathData</code> from Node with full control over every option.
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

Convert a folder from the command line, or a string from code. Both take the
same [options](/reference/options).

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

## Measured against the alternatives

203 Tabler icons through every stroke-to-outline engine that could be scripted,
the same SVGO pass on every result, then rasterized against the original.

| engine | avg bytes | mean pixel mismatch | wrong / failed |
| --- | ---: | ---: | ---: |
| **unstroke** | **1061** | **0.000%** | **0** |
| Skia PathOps (CanvasKit) | 1721 | 0.000% | 0 |
| Paper.js booleans | 1610 | 0.000% | 0 |
| FontForge | 589 | 0.244% | 17 |

FontForge is smaller only because it is imprecise. Skia and Paper.js are
accurate on this sample but keep every fragment their intersections produce.
On the full set of 5130 icons both curve-based engines silently break icons
that `unstroke` gets right; the [full comparison](/reference/alternatives)
and the [reasoning behind polygons](/reference/how-it-works#why-polygons-and-not-boolean-operations-on-curves)
have the details.

## What it is for

- **Icon fonts.** Glyphs have no stroke, and font engines reject or mangle
  overlapping contours. The output is one clean contour set per icon.
- **PDF, print and CNC.** Exporters, plotters and laser cutters that treat every
  path as a fill, or that need the exact outline to cut along.
- **Design tools without stroke support.** Anything that imports paths but
  ignores `stroke-width`, or that renders strokes differently than a browser.
- **One source, many weights.** Keep icons as strokes, generate the 1 px,
  1.5 px and 2 px variants at build time with `--stroke-width`.
