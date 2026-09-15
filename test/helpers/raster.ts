import { Resvg } from '@resvg/resvg-js';

/** Rasterize an SVG to RGBA pixels at the given width. */
export function rasterize(svg: string, width = 192): Uint8Array {
  return new Resvg(svg.replace(/currentColor/g, '#000'), { fitTo: { mode: 'width', value: width } }).render().pixels;
}

/** Fraction of pixels that are clearly present in one image and absent in the other. */
export function mismatch(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) throw new Error('images differ in size');
  let bad = 0;
  for (let i = 3; i < a.length; i += 4) if (Math.abs(a[i]! - b[i]!) > 128) bad++;
  return bad / (a.length / 4);
}
