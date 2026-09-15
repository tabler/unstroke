# Alternatives and output size

The same 203 Tabler icons (every 25th outline icon without filled paths) were
run through every stroke-to-outline engine that could be scripted, each result
was passed through the same SVGO pass with 3 decimal places and rasterized
against the original:

| engine | avg bytes after SVGO | avg curves | mean pixel mismatch | wrong / failed |
| --- | ---: | ---: | ---: | ---: |
| unstroke | 1061 | 21.9 | 0.000% | 0 |
| unstroke, `tolerance: 0.02` | 951 | 20.0 | 0.000% | 0 |
| Tabler webfont pipeline (svg-path-outline + Paper reorient) | 1344 | 21.8 | 0.058% | 11 |
| Skia PathOps (CanvasKit) | 1721 | 34.0 | 0.000% | 0 |
| Paper.js booleans | 1610 | 17.7 | 0.000% | 0 |
| svg-outline-stroke (rasterize + potrace) | 685 | 16.0 | 3.960% | 202 |
| FontForge (expand stroke + remove overlap) | 589 | 13.1 | 0.244% | 17 |

FontForge produces the smallest files, but only because it is imprecise:
every icon is slightly off and some are broken (a filled-in bowl in `soup`).
The current Tabler pipeline visibly deforms large arcs (`magnetic`,
`database-share`) and leaves every subpath overlapping. Skia and Paper.js are
accurate on this sample but keep every fragment their intersections produce,
so their files are 50–60% larger. `unstroke` is the smallest output that is
also pixel-accurate; raising `tolerance` trades accuracy for size in a
controlled way (0.05 is already visible).

`svg-outline-stroke` on npm does not outline at all: it rasterizes the SVG at
its native size with sharp and traces the bitmap with potrace, so a 24 px
icon comes back as a trace of a 24 x 24 pixel image. Every icon is visibly
distorted. Inkscape's `object-stroke-to-path` was not measured.

