---
title: Lower-level API
description: The unstroke pipeline exposed piece by piece, from parsing SVG through flattening, stroking and union to path data, for tools that need geometry rather than markup.
---

# Lower-level API

The pipeline is exposed piece by piece, for tools that need the geometry
rather than the markup:

```
parseSvg → shapes (segments + resolved style + transform)
parsePathData / transformSegments → normalized M / L / C / Z segments
flattenSegments → polylines
strokePolyline → polygons covering the stroke
unionRings / nonzeroRings / xorRings → merged multipolygon
multiPolygonToPathData → path data
```

If you just want the merged geometry, `outlineSvgToMultiPolygon` returns it as
a GeoJSON-style multipolygon, with the outer ring first and the holes after it.
