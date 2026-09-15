import { readFileSync } from 'node:fs';
import { parseSvg, flattenSegments, strokePolyline, transformSegments, unionRings } from '../lib/index.js';
const svg = readFileSync(process.argv[2] ?? '/Users/chomik/htdocs/tabler-icons/icons/outline/abc.svg', 'utf8');
const parsed = parseSvg(svg);
let rings = 0, pts = 0;
let tFlat = 0, tStroke = 0, tUnion = 0;
for (const s of parsed.shapes) {
  let t = performance.now();
  const lines = flattenSegments(transformSegments(s.segments, s.transform), 0.01);
  tFlat += performance.now() - t; t = performance.now();
  const r = lines.flatMap((l) => strokePolyline(l, { width: 2, linecap: 'round', linejoin: 'round', miterLimit: 4 }, 0.01));
  tStroke += performance.now() - t; t = performance.now();
  rings += r.length; pts += r.reduce((a, b) => a + b.length, 0);
  unionRings(r);
  tUnion += performance.now() - t;
}
console.log({ shapes: parsed.shapes.length, rings, pts, tFlat: tFlat.toFixed(1), tStroke: tStroke.toFixed(1), tUnion: tUnion.toFixed(1) });
