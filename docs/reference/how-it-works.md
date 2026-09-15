---
title: How it works
description: How unstroke turns a stroked SVG into one filled path in six steps, and why it unions polygons on an integer grid instead of running boolean operations on curves.
---

# How it works

First, the SVG is parsed and every rendered shape is normalized to absolute
move, line, cubic and close segments. Arcs and quadratics become cubics, which
means transforms can be applied exactly.

Then the curves are flattened to polylines, with a guaranteed maximum error.

Next, every polyline is covered with small polygons: one rectangle per
segment, one join shape per vertex, one cap per open end. There are no special
cases for self-intersections or for curves tighter than the stroke width. The
pieces simply overlap.

After that, all of those polygons are merged with a boolean union. This is
Clipper, working in integer arithmetic, so it doesn't fail on degenerate input.
The pieces are built to overlap by area rather than merely touch. Otherwise a
vertex that rounds onto the wrong side of a neighbouring edge would leave a
hairline gap.

Then every ring of the result is fitted with lines and cubic Béziers. Sharp
corners are detected by turn angle, straight runs become `L`, `H` or `V`, and
curved runs go through Schneider's algorithm: a least-squares cubic, Newton
reparameterization, then a split at the point of largest error until the fit
is within tolerance. Tangents are estimated over a window rather than from the
nearest edge, because union output mixes tiny edges with long ones. The error
is checked along the edges too, so a curve can't bulge unnoticed between two
distant vertices of a straight edge.

Finally, the result is serialized as compact absolute path data.

## Why polygons and not boolean operations on curves?

Tools like Figma or Illustrator offset curves directly and run their boolean
operations on curves. That skips the intermediate polygon. The trouble is that
curve-curve intersection is numerically fragile, and every implementation
carries a long tail of degenerate cases. We tried the alternatives on the full
Tabler outline set, 5130 icons (49 of them have filled paths that the
experiments skipped):

| engine | approach | wrong output | time / icon | after SVGO |
| --- | --- | --- | --- | --- |
| Clipper 1 (this library) | polygons, integer grid | 0 | 1.0 ms | 5.3 MB |
| Clipper2 (WASM) | polygons, integer grid | 0 | 0.8 ms | 5.3 MB |
| Skia PathOps (CanvasKit) | curves | 25 (7 refused, 18 silently wrong) | 0.4 ms | 8.2 MB |
| Paper.js | curves | 7 (silently wrong) | 7.5 ms | 8.7 MB |

Skia is the boolean engine behind Chrome, Flutter and Figma, and it still
mangles `swipe`, `coins` or `whisk` (a filled-in hole here, a missing wall
there) and refuses `asterisk` or `feather` outright. Paper.js needed two
workarounds for degenerate input before it produced anything at all, and then
failed on `brand-redux` and `home-infinity`. Both also emit far more curves,
because they keep every fragment the intersections produce, and Skia writes
arcs as strings of quadratics.

The failures are silent, which is the worst kind for a build pipeline.
Polygons with integer-grid clipping don't fail, and the curve fit on the way
out keeps the output small. The price is a bounded, configurable error of
roughly three times `tolerance`. Clipper2 would be a drop-in replacement if
union speed ever mattered; it costs a WASM binary and asynchronous
initialization.
