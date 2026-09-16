---
title: What is supported
description: The SVG elements, stroke styles, transforms, fill rules and CSS features unstroke understands, and the ones it doesn't handle yet.
---

# What is supported

- `path` (all commands, relative and absolute, arcs), `line`, `polyline`,
  `polygon`, `rect` (with corner radius), `circle`, `ellipse`
- `stroke-linecap`: butt, round, square (including dots for zero-length subpaths)
- `stroke-linejoin`: miter (with `stroke-miterlimit`), round, bevel
- inherited presentation attributes and inline `style`, `display:none`,
  `visibility:hidden`, `defs` and other non-rendered containers
- `transform` on any element, including non-uniform scale (the stroke width is
  scaled by the geometric mean of the matrix)
- filled shapes with `nonzero` and `evenodd` fill rules
- `<use>` (also into `<symbol>` and `<defs>`), and `<style>` sheets with simple
  selectors (`tag`, `.class`, `#id`, `tag.class`, comma lists)
- nested `<svg>` viewports and `<symbol>` viewBoxes, with `x`, `y`, `width`,
  `height` (percentages too) and `preserveAspectRatio`

::: warning Not supported yet
`text`, `image`, dashes, markers, clip paths, masks, filters,
`vector-effect`, opacity, CSS combinators. Colours aren't kept
either: everything ends up as one `currentColor` path.
:::

None of these fail silently. When the input uses one of them, the conversion
still runs and reports a [warning](/reference/options#warnings) through
`onWarning`, or throws if you pass `strict: true`. On the command line that's
a line on stderr, or a failed file with `--strict`.
