---
title: Getting started
description: Install unstroke and convert your first stroked SVG icon to a filled outline, from the command line or from Node.
---

# Getting started

`unstroke` converts stroked SVG into filled outlines. Every stroke becomes a
filled shape, overlapping shapes are merged with a boolean union, and the whole
icon comes out as a single `<path>` that doesn't overlap itself. That's what
icon fonts, PDF exporters, laser cutters and design tools without stroke
support need.

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

You need Node 18 or newer. `svgo` (v4) is an optional peer dependency. It's
only used by the [`unstroke/optimize`](/guide/optimize) entry point and the
`--optimize` CLI flag, so you can skip it if you don't need either.

## Convert a folder

```bash
npx unstroke icons/ -o outlined/
```

The directory tree is mirrored into `outlined/`. The
[command line guide](/guide/cli) lists every flag.

## Convert from code

```ts
import { outlineSvg } from 'unstroke';

const filled = outlineSvg(svgSource);
```

`outlineSvg` returns a new SVG string. It keeps the original root attributes,
adds a `fill` attribute and contains a single path. The [API guide](/guide/api)
has the rest.

## Why another converter?

Most existing converters offset each path segment on its own and rely on the
renderer's nonzero fill rule to hide the overlaps. The result looks right on
screen. Underneath, though, it's dozens of overlapping subpaths. The file is
bigger than it needs to be, font engines choke on it, and the moment you open
it in a vector editor you can see the mess.

`unstroke` computes the actual union, so what you get is the visible outline
and nothing more. The [alternatives page](/reference/alternatives) has the
numbers.
