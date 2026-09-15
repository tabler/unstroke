---
title: API
description: The unstroke Node API. outlineSvg converts a whole SVG document, outlinePathData converts a single path data string, both with the same options.
---

# API

```ts
import { outlineSvg, outlinePathData } from 'unstroke';

const filled = outlineSvg(svgSource);                       // whole document
const thin = outlineSvg(svgSource, { strokeWidth: 1.5 });   // override the width
const d = outlinePathData('M3 13h4', { strokeWidth: 2, linecap: 'round' });
```

`outlineSvg` returns a new SVG string with the original root attributes
(`viewBox`, `width`, `class` and so on), a `fill` attribute and a single path.
The stroke-related attributes are dropped, since there is no stroke any more.

`outlinePathData` takes raw path data and returns the outlined path data as a
string. There's no document to read defaults from here, so you have to pass
`strokeWidth`, and the cap and join style if you want anything other than
butt and miter.

Both functions take the same [options object](/reference/options). If you
need the geometry rather than the markup, there's a
[lower-level API](/reference/lower-level) for that.
