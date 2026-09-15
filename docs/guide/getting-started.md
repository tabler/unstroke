# Getting started

`unstroke` converts stroked SVG into filled outlines. Every stroke becomes a
filled shape, overlapping shapes are merged with a boolean union, and the whole
icon comes out as a single `<path>` with no self-overlaps. That is what icon
fonts, PDF exporters, laser cutters and design tools that cannot render strokes
need.

## Install

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

Node 18 or newer is required. `svgo` (v4) is an optional peer dependency, used
only by the [`unstroke/optimize`](/guide/optimize) entry point and the
`--optimize` CLI flag.

## Convert a folder

```bash
npx unstroke icons/ -o outlined/
```

The directory tree is mirrored into `outlined/`. See the
[command line guide](/guide/cli) for every flag.

## Convert from code

```ts
import { outlineSvg } from 'unstroke';

const filled = outlineSvg(svgSource);
```

`outlineSvg` returns a new SVG string with the original root attributes, a
`fill` attribute and a single path. See the [API guide](/guide/api).

## Why another one?

Most existing converters offset each path segment separately and let the
renderer's nonzero fill rule hide the overlaps. The output *looks* right but is
made of dozens of overlapping subpaths: the file is bigger than it needs to be,
font engines choke on it, and any edit in a vector editor shows the mess.
`unstroke` computes the true union, so the output is exactly the visible outline
and nothing else. The [alternatives page](/reference/alternatives) has numbers.
