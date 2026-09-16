---
"unstroke": minor
---

Unsupported input no longer fails silently. `outlineSvg` and `outlineSvgToMultiPolygon` take an `onWarning` callback that reports dashed strokes, skipped `<text>` / `<image>` / `<foreignObject>` elements, markers, clip paths and masks, filters, nested `<svg>` viewports, `vector-effect="non-scaling-stroke"`, partial opacity and documents with several colours or gradient paints. `strict: true` throws an `UnsupportedSvgError` instead of converting. The CLI prints these warnings on stderr, counts them in the summary, and `--strict` turns them into failures with exit code 1. `parseSvg` returns the same warnings in a `warnings` array.
