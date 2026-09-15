# How it works

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
tail of degenerate cases. The alternatives were tried on the full Tabler
outline set (5130 icons, 49 of them with filled paths that the experiments
skipped):

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

