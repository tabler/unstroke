---
title: Alternatives and output size
description: unstroke measured against Skia PathOps, Paper.js, FontForge, svg-outline-stroke and the Tabler webfont pipeline on 203 icons, by file size, curve count and pixel accuracy.
---

# Alternatives and output size

We took the same 203 Tabler icons (every 25th outline icon without filled
paths) and ran them through every stroke-to-outline engine that could be
scripted. Each result went through the same SVGO pass with 3 decimal places
and was rasterized against the original:

| engine | avg bytes after SVGO | avg curves | mean pixel mismatch | wrong / failed |
| --- | ---: | ---: | ---: | ---: |
| unstroke | 1061 | 21.9 | 0.000% | 0 |
| unstroke, `tolerance: 0.02` | 951 | 20.0 | 0.000% | 0 |
| Tabler webfont pipeline (svg-path-outline + Paper reorient) | 1344 | 21.8 | 0.058% | 11 |
| Skia PathOps (CanvasKit) | 1721 | 34.0 | 0.000% | 0 |
| Paper.js booleans | 1610 | 17.7 | 0.000% | 0 |
| svg-outline-stroke (rasterize + potrace) | 685 | 16.0 | 3.960% | 202 |
| FontForge (expand stroke + remove overlap) | 589 | 13.1 | 0.244% | 17 |

FontForge produces the smallest files, but only because it's imprecise. Every
icon is slightly off and some are broken (the bowl in `soup` is filled in).
The current Tabler pipeline visibly deforms large arcs (`magnetic`,
`database-share`) and leaves every subpath overlapping. Skia and Paper.js are
accurate on this sample, but they keep every fragment their intersections
produce, so their files are 50–60% larger.

`unstroke` gives the smallest output that is also pixel-accurate. Raising
`tolerance` trades accuracy for size in a controlled way; 0.05 is already
visible.

One note on `svg-outline-stroke` from npm: it doesn't outline at all. It
rasterizes the SVG at its native size with sharp and traces the bitmap with
potrace, so a 24 px icon comes back as a trace of a 24 by 24 pixel image, and
every icon is visibly distorted. We didn't measure Inkscape's
`object-stroke-to-path`.
