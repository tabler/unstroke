---
"unstroke": minor
---

Nested `<svg>` elements and `<symbol>` elements used through `<use>` now establish a viewport: their content is scaled from the `viewBox` into `x`, `y`, `width` and `height` (percentages resolve against the parent viewport) with `preserveAspectRatio`. Previously the inner coordinates were emitted unscaled.
