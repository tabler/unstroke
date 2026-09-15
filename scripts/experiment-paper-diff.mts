import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { rasterize } from '../test/helpers/raster.js';
import { outlineWithPaper } from './experiment-paper.mts';
const SIZE = 192;
const src = readFileSync(process.argv[2]!, 'utf8');
const out = outlineWithPaper(src);
console.log(out);
const a = rasterize(src, SIZE), b = rasterize(out, SIZE);
const png = new PNG({ width: SIZE * 3, height: SIZE });
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
  const i = (y * SIZE + x) * 4;
  const set = (col: number, r: number, g: number, bl: number, al: number) => { const o = (y * SIZE * 3 + col * SIZE + x) * 4; png.data[o] = r; png.data[o+1] = g; png.data[o+2] = bl; png.data[o+3] = al; };
  set(0, 0, 0, 0, a[i + 3]!); set(1, 0, 0, 0, b[i + 3]!);
  const d = a[i + 3]! - b[i + 3]!;
  set(2, d > 0 ? 255 : 0, 0, d < 0 ? 255 : 0, Math.abs(d) > 32 ? 255 : 20);
}
writeFileSync('preview/paper-diff.png', PNG.sync.write(png));
