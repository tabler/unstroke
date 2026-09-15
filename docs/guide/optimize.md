# Optimizing the output

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

On the command line the same pass is `--optimize`.
