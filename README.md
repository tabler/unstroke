# unstroke

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
`unstroke` computes the true union, so the output is exactly the visible
outline and nothing else.

## Usage

```ts
import { outlineSvg, outlinePathData } from 'unstroke';

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
| `curves`       | `true`           | fit the result with cubic Béziers instead of emitting polygons |
| `fitTolerance` | 2 × `tolerance`  | max deviation of the fitted curves from the exact polygon      |
| `cornerAngle`  | `30`             | turn angle (degrees) above which a vertex stays a sharp corner |
| `includeFills` | `true`           | also include shapes that already have a fill                   |
| `fill`         | `currentColor`   | fill written on the output path                                |
| `precision`    | `3`              | decimal places in the output                                   |
| `outerWinding` | `cw`             | winding of outer contours (`cw` on screen is what fonts expect)|

### Optimizing the output

The path data is written as plain absolute commands. SVGO shrinks it by
another ~25% (relative coordinates, shorthand commands); a ready-made pass
lives in a separate entry point so the core library does not depend on SVGO.
Install `svgo` (v4) alongside and:

```ts
import { outlineSvg } from 'unstroke';
import { optimizeSvg } from 'unstroke/optimize';

const small = optimizeSvg(outlineSvg(svgSource), { precision: 3 });
```

`svgoConfig(options)` returns the configuration used, so you can feed it to
your own SVGO pipeline.

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
   so it never fails on degenerate input). Pieces are built to overlap by
   area rather than merely touch, because a vertex that rounds onto the wrong
   side of a neighbouring edge would otherwise leave a hairline gap.
5. Every ring of the result is fitted with lines and cubic Béziers: sharp
   corners are detected by turn angle, straight runs become `L`/`H`/`V`, and
   curved runs go through Schneider's algorithm (least-squares cubic, Newton
   reparameterization, split at the point of largest error until the fit is
   within tolerance). Tangents are estimated over a window rather than from
   the nearest edge, because union output mixes tiny and long edges. The
   error is checked along edges too, so a curve cannot bulge unnoticed between
   two distant vertices of a straight edge.
6. The result is serialized as compact absolute path data.

## Why polygons and not boolean operations on curves?

Tools like Figma or Illustrator offset curves directly and run their boolean
operations on curves. That avoids the intermediate polygon, but curve-curve
intersection is numerically fragile and every implementation carries a long
tail of degenerate cases. The `scripts/experiment-*.mts` scripts try the
alternatives on the full Tabler outline set (5130 icons, 49 of them with
filled paths that the experiments skip):

| engine | approach | wrong output | time / icon | after SVGO |
| --- | --- | --- | --- | --- |
| Clipper 1 (this library) | polygons, integer grid | 0 | 1.0 ms | 5.3 MB |
| Clipper2 (WASM) | polygons, integer grid | 0 | 0.8 ms | 5.3 MB |
| Skia PathOps (CanvasKit) | curves | 25 (7 refused, 18 silently wrong) | 0.4 ms | 8.2 MB |
| Paper.js | curves | 7 (silently wrong) | 7.5 ms | 8.7 MB |

Skia is the boolean engine behind Chrome, Flutter and Figma, and it still
mangles `swipe`, `coins` or `whisk` (a filled-in hole, a missing wall) and
refuses `asterisk` or `feather` outright. Paper.js needed two workarounds for
degenerate input before it produced anything, then failed on `brand-redux`
and `home-infinity`. Both also emit far more curves, because they keep every
fragment produced by the intersections and Skia writes arcs as strings of
quadratics.

The failures are silent, which is the worst kind for a build pipeline.
Polygons with integer-grid clipping never fail, and the curve fit on the way
out keeps the output small; the price is a bounded, configurable error of
about three times `tolerance`. Clipper2 is a drop-in candidate if union speed
ever matters; it costs a WASM binary and asynchronous initialization.

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

### Visual preview

`pnpm preview` starts an Astro dev server (http://localhost:4321) that shows
every fixture as source, outline and an overlay of both, with stroke width,
tolerance and curve fitting adjustable from the page. Pages run the converter
from `lib/` on every request, so edits show up on reload. To browse other
folders, list them in `preview/.env`:

```
ICON_DIRS=../tabler-icons/icons/outline:../tabler-icons/icons/filled
```

`scripts/pixel-diff.mts` rasterizes originals and outlines for a whole folder
and reports the worst mismatches; `scripts/diff-image.mts <file>` renders one
icon side by side with a difference image.

## License

MIT. Uses [clipper-lib](https://github.com/junmer/clipper-lib) (Boost Software License).
