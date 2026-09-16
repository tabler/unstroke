# unstroke

## 1.0.0

### Major Changes

- [`e397145`](https://github.com/tabler/unstroke/commit/e3971457939cc4a4e1023ea1e50d3368ee05bfaf) - The `includeFills` option is renamed to `fills`, matching the CLI's `--no-fills` and the other boolean option `curves` / `--no-curves`. `includeFills` is gone; pass `fills: false` where you passed `includeFills: false`. This and the Node 20 requirement are the only changes that need action when upgrading from 0.1.0.

- [`d530521`](https://github.com/tabler/unstroke/commit/d53052109eddb57449011eda0bc23de2cb4c30b8) - Node 20 or newer is required; `engines.node` was `>=18`. Node 18 reached end of life and was never in the test matrix. CI now runs on Node 24, with the test suite also run on Node 20 as the lowest supported version.

### Minor Changes

- [`d822dbc`](https://github.com/tabler/unstroke/commit/d822dbce456d8edb2171d3c16ab68b5a9722ceaa) - Nested `<svg>` elements and `<symbol>` elements used through `<use>` now establish a viewport: their content is scaled from the `viewBox` into `x`, `y`, `width` and `height` (percentages resolve against the parent viewport) with `preserveAspectRatio`. Previously the inner coordinates were emitted unscaled.

- [`f5e7744`](https://github.com/tabler/unstroke/commit/f5e7744d633c2e4dbd020fb235a0ebf3b4258586) - Unsupported input no longer fails silently. `outlineSvg` and `outlineSvgToMultiPolygon` take an `onWarning` callback that reports dashed strokes, skipped `<text>` / `<image>` / `<foreignObject>` elements, markers, clip paths and masks, filters, `vector-effect="non-scaling-stroke"`, partial opacity and documents with several colours or gradient paints. `strict: true` throws an `UnsupportedSvgError` instead of converting. The CLI prints these warnings on stderr, counts them in the summary, and `--strict` turns them into failures with exit code 1. `parseSvg` returns the same warnings in a `warnings` array.

### Patch Changes

- [`db1ec02`](https://github.com/tabler/unstroke/commit/db1ec02ae719a2bab7f7b06fd8b8909efd78f7a8) - Documented what semver covers: `outlineSvg`, `outlinePathData`, `outlineSvgToMultiPolygon`, their options, the warnings and the CLI are the stable API. The lower-level exports (`parseSvg`, `flattenSegments`, `strokePolyline`, `unionRings`, `fitRing` and friends) follow the engine and may change in a minor release, with a changelog entry.

- [`30c24bb`](https://github.com/tabler/unstroke/commit/30c24bb1b22a67cf6cef54a82d23a9d143932a2f) - Browser support is stated and tested: the library entry has no Node dependencies, and the test suite runs it in a DOM environment. Only the CLI and the `unstroke/optimize` SVGO pass need Node.

- [`d822dbc`](https://github.com/tabler/unstroke/commit/d822dbce456d8edb2171d3c16ab68b5a9722ceaa) - The output root keeps only attributes that still make sense for a filled path. Every `stroke-*`, `fill-*`, `marker-*` and `vector-effect` attribute of the input root is dropped (previously `stroke-dasharray` or `stroke-opacity` could survive and suggest they had been applied). `clip-path`, `mask`, `filter` and `opacity` on the root are kept, since they apply to the whole picture either way, and are not reported as warnings.

## 0.1.0

### Minor Changes

- [`fc1c4c1`](https://github.com/tabler/unstroke/commit/fc1c4c14ba917e93d66e62a796a7eb3b7673d6f8) - Initial release: `outlineSvg`, `outlinePathData`, the lower-level geometry API, the `unstroke/optimize` SVGO pass and the `unstroke` CLI.
