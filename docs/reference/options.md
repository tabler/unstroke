---
title: Options
description: Every option accepted by outlineSvg, outlinePathData and the unstroke CLI, with defaults.
---

# Options

Every option accepted by `outlineSvg`, `outlinePathData` and the CLI.

| option         | default          | description                                                    |
| -------------- | ---------------- | -------------------------------------------------------------- |
| `strokeWidth`  | from the SVG     | override the width for every stroked element                   |
| `linecap`      | from the SVG     | override `stroke-linecap`                                      |
| `linejoin`     | from the SVG     | override `stroke-linejoin`                                     |
| `miterLimit`   | from the SVG     | override `stroke-miterlimit`                                   |
| `tolerance`    | viewBox / 2400   | max deviation of flattened curves, in user units               |
| `curves`       | `true`           | fit the result with cubic Béziers instead of emitting polygons |
| `fitTolerance` | 2 × `tolerance`  | max deviation of the fitted curves from the exact polygon      |
| `cornerAngle`  | `30`             | turn angle (degrees) above which a vertex stays a sharp corner |
| `fills`        | `true`           | also include shapes that already have a fill (`--no-fills`)     |
| `fill`         | `currentColor`   | fill written on the output path                                |
| `precision`    | `3`              | decimal places in the output                                   |
| `outerWinding` | `cw`             | winding of outer contours (`cw` on screen is what fonts expect)|
| `onWarning`    | none             | called for every unsupported feature that changes the result   |
| `strict`       | `false`          | throw instead of converting when the input has such a feature  |

The CLI has the same options in kebab-case: `--stroke-width`,
`--fit-tolerance`, `--no-curves`, `--no-fills` and so on. `onWarning` maps to
warnings on stderr and `strict` to `--strict`. `fills` used to be called
`includeFills`; the old name still works but is deprecated.

## Warnings

Some things in an SVG can't be reproduced by a single filled path, and the
converter would rather tell you than fail quietly. When the input uses one of
them, `onWarning` gets called with a `{ code, message, element }` object and
the conversion carries on without that feature. Nothing is reported for
input that only uses [supported features](/reference/supported), so a
handler that logs is safe to leave on in a build.

```ts
import { outlineSvg } from 'unstroke';

const filled = outlineSvg(svgSource, {
  onWarning: (w) => console.warn(`${w.code}: ${w.message}`),
});
```

| code | what it means |
| --- | --- |
| `unsupported-element` | a `<text>`, `<image>` or `<foreignObject>` was skipped |
| `dasharray` | `stroke-dasharray` is ignored, the stroke is outlined as a solid line |
| `markers` | `marker-start`, `marker-mid` or `marker-end` is ignored |
| `clip-path` | `clip-path` or `mask` is ignored, the whole shape is emitted |
| `filter` | `filter` is ignored |
| `vector-effect` | `vector-effect="non-scaling-stroke"` is ignored, the width scales with the transform |
| `opacity` | `opacity`, `stroke-opacity` or `fill-opacity` below 1 is ignored, the result is opaque |
| `paint` | more than one colour, or a gradient or pattern, is merged into one fill colour |

Each distinct warning is reported once per document. With `strict: true` the
same input throws an `UnsupportedSvgError` instead, and its `warnings` array
holds everything that was found. That's the mode I'd use in a build pipeline,
where a silently dashed line is worse than a failed build.
