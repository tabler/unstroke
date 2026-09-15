import { Resvg } from '@resvg/resvg-js';

/** Rasterize an SVG to RGBA pixels at the given width. */
export function rasterize(svg: string, width = 192): Uint8Array {
  return new Resvg(svg.replace(/currentColor/g, '#000'), { fitTo: { mode: 'width', value: width } }).render().pixels;
}

/**
 * Fraction of pixels that are clearly present (alpha >= 80%) in one image and
 * clearly absent (alpha <= 20%) in the other. Anti-aliased edge pixels are
 * ignored on purpose: a file that paints the same geometry several times
 * darkens its edges a little more with every pass, and a sub-pixel shift is
 * within the converter's tolerance anyway.
 */
export function mismatch(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) throw new Error('images differ in size');
  let bad = 0;
  for (let i = 3; i < a.length; i += 4) {
    const x = a[i]!;
    const y = b[i]!;
    if ((x >= 204 && y <= 51) || (y >= 204 && x <= 51)) bad++;
  }
  return bad / (a.length / 4);
}
