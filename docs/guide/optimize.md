---
title: Optimizing the output
description: Shrink unstroke output by about a quarter with the bundled SVGO pass, or plug the same configuration into your own SVGO pipeline.
---

# Optimizing the output

The path data is written as plain absolute commands. SVGO usually shrinks it
by another 25% or so, mostly by switching to relative coordinates and shorthand
commands. A ready-made pass lives in a separate entry point so the core
library doesn't depend on SVGO. Install `svgo` (v4) next to it and:

```ts
import { outlineSvg } from 'unstroke';
import { optimizeSvg } from 'unstroke/optimize';

const small = optimizeSvg(outlineSvg(svgSource), { precision: 3 });
```

If you already have an SVGO pipeline, `svgoConfig(options)` returns the
configuration this pass uses, so you can feed it in there instead.

On the command line the same pass is `--optimize`.
