# API

```ts
import { outlineSvg, outlinePathData } from 'unstroke';

const filled = outlineSvg(svgSource);                       // whole document
const thin = outlineSvg(svgSource, { strokeWidth: 1.5 });   // override the width
const d = outlinePathData('M3 13h4', { strokeWidth: 2, linecap: 'round' });
```

`outlineSvg` returns a new SVG string with the original root attributes
(`viewBox`, `width`, `class`, …), a `fill` attribute and a single path.
Stroke-related attributes are dropped.

`outlinePathData` takes raw path data and returns the outlined path data
string. Since there is no document to read defaults from, pass `strokeWidth`
and the cap and join style explicitly.

Both functions accept the same [options object](/reference/options). For
tools that need geometry rather than markup, see the
[lower-level API](/reference/lower-level).
