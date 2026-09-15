import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { outlineSvg } from '../lib/index.js';
import { PNG } from 'pngjs';
const SIZE = 384;
const src = readFileSync(process.argv[2]!, 'utf8');
const out = outlineSvg(src);
const render = (svg: string) => new Resvg(svg.replace(/currentColor/g, '#000'), { fitTo: { mode: 'width', value: SIZE } }).render().pixels;
const a = render(src), b = render(out);
const png = new PNG({ width: SIZE * 3, height: SIZE });
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
  const i = (y * SIZE + x) * 4;
  const set = (col: number, r: number, g: number, bl: number, al: number) => { const o = (y * SIZE * 3 + col * SIZE + x) * 4; png.data[o] = r; png.data[o+1] = g; png.data[o+2] = bl; png.data[o+3] = al; };
  set(0, 0, 0, 0, a[i + 3]!);
  set(1, 0, 0, 0, b[i + 3]!);
  const d = a[i + 3]! - b[i + 3]!;
  set(2, d > 0 ? 255 : 0, 0, d < 0 ? 255 : 0, Math.abs(d) > 32 ? 255 : 20);
}
writeFileSync(process.argv[3] ?? 'preview/diff.png', PNG.sync.write(png));
