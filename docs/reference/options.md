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
| `includeFills` | `true`           | also include shapes that already have a fill                   |
| `fill`         | `currentColor`   | fill written on the output path                                |
| `precision`    | `3`              | decimal places in the output                                   |
| `outerWinding` | `cw`             | winding of outer contours (`cw` on screen is what fonts expect)|

The CLI exposes the same options in kebab-case (`--stroke-width`,
`--fit-tolerance`, `--no-curves`, …).
