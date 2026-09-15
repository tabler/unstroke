# Lower-level API

The pipeline is exposed piece by piece for tools that need geometry rather
than markup:

```
parseSvg → shapes (segments + resolved style + transform)
parsePathData / transformSegments → normalized M / L / C / Z segments
flattenSegments → polylines
strokePolyline → polygons covering the stroke
unionRings / nonzeroRings / xorRings → merged multipolygon
multiPolygonToPathData → path data
```

`outlineSvgToMultiPolygon` returns the merged geometry as a GeoJSON-style
multipolygon (outer ring first, holes after).
