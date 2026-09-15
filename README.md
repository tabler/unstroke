# svg-outliner

Convert stroked SVG into filled outlines. Every stroke becomes a filled shape,
overlapping shapes are merged with a boolean union, and the whole icon comes
out as a single `<path>` with no self-overlaps. That is what icon fonts, PDF
exporters, laser cutters and design tools that cannot render strokes need.

```
<path d="M3 13h4" stroke-width="2" stroke-linecap="round"/>
        ↓
<path d="M7.966 13.259L7.866 13.5 …Z" fill="currentColor"/>
```

## Why another one?

Most existing converters offset each path segment separately and let the
renderer's nonzero fill rule hide the overlaps. The output *looks* right but
is made of dozens of overlapping subpaths: the file is bigger than it needs to
be, font engines choke on it, and any edit in a vector editor shows the mess.
`svg-outliner` computes the true union, so the output is exactly the visible
outline and nothing else.

## Usage

```ts
import { outlineSvg, outlinePathData } from 'svg-outliner';

const filled = outlineSvg(svgSource);                       // whole document
const thin = outlineSvg(svgSource, { strokeWidth: 1.5 });   // override the width
const d = outlinePathData('M3 13h4', { strokeWidth: 2, linecap: 'round' });
```

`outlineSvg` returns a new SVG string with the original root attributes
(`viewBox`, `width`, `class`, …), a `fill` attribute and a single path.
Stroke-related attributes are dropped.

### Options

| option         | default          | description                                                    |
| -------------- | ---------------- | -------------------------------------------------------------- |
| `strokeWidth`  | from the SVG     | override the width for every stroked element                   |
| `linecap`      | from the SVG     | override `stroke-linecap`                                      |
| `linejoin`     | from the SVG     | override `stroke-linejoin`                                     |
| `miterLimit`   | from the SVG     | override `stroke-miterlimit`                                   |
| `tolerance`    | viewBox / 2400   | max deviation of flattened curves, in user units               |
| `includeFills` | `true`           | also include shapes that already have a fill                   |
| `fill`         | `currentColor`   | fill written on the output path                                |
| `precision`    | `3`              | decimal places in the output                                   |
| `outerWinding` | `cw`             | winding of outer contours (`cw` on screen is what fonts expect)|

### Lower-level API

The pipeline is exposed piece by piece for tools that need geometry rather
than markup:

```
parseSvg → shapes (segments + resolved style + transform)
parsePathData / transformSegments → normalized M / L / C / Z segments
flattenSegments → polylines
strokePolyline → polygons covering the stroke
unionRings / nonzeroRings / xorRings → merged multipolygon
multiPolygonToPathData → path data
```

`outlineSvgToMultiPolygon` returns the merged geometry as a GeoJSON-style
multipolygon (outer ring first, holes after).

## What is supported

- `path` (all commands, relative and absolute, arcs), `line`, `polyline`,
  `polygon`, `rect` (with corner radius), `circle`, `ellipse`
- `stroke-linecap`: butt, round, square (including dots for zero-length subpaths)
- `stroke-linejoin`: miter (with `stroke-miterlimit`), round, bevel
- inherited presentation attributes and inline `style`, `display:none`,
  `visibility:hidden`, `defs` and other non-rendered containers
- `transform` on any element, including non-uniform scale (stroke width is
  scaled by the geometric mean of the matrix)
- filled shapes with `nonzero` and `evenodd` fill rules

Not supported yet: `use`, `text`, `image`, dashes, markers, clip paths, masks.

## How it works

1. The SVG is parsed and every rendered shape is normalized to absolute
   move / line / cubic / close segments. Arcs and quadratics become cubics, so
   transforms can be applied exactly.
2. Curves are flattened to polylines with a guaranteed maximum error.
3. Every polyline is covered by small polygons: one rectangle per segment,
   one join shape per vertex, one cap per open end. This has no special cases
   for self-intersections or curves tighter than the stroke width.
4. All polygons are merged with a boolean union (Clipper, integer arithmetic,
   so it never fails on degenerate input).
5. The result is serialized as path data.

## Development

```
pnpm install
pnpm test
pnpm build
```

### Tests on real files

`test/fixtures/` holds real SVGs: a sample of Tabler icons and hand-written
files covering basic shapes, transforms, caps, joins and fill rules. For each
one the test suite:

1. writes the converted SVG to `test/__output__/<group>/<name>.svg` and
   compares it with the committed version (`pnpm vitest run -u` accepts changes),
2. rasterizes the original and the outline and requires them to match within
   0.05% of pixels.

Drop a new `.svg` into a fixtures folder to cover it; the output file is the
snapshot you review in a pull request.

`scripts/preview.mts` renders a comparison page for a folder of icons and
`scripts/pixel-diff.mts` rasterizes originals and outlines and reports the
worst mismatches.

## License

MIT. Uses [clipper-lib](https://github.com/junmer/clipper-lib) (Boost Software License).
