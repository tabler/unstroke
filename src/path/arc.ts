import type { Segment } from './types.js';

/**
 * Convert an SVG elliptical arc to cubic Bézier segments.
 * Implements the endpoint-to-center parameterization from the SVG spec (F.6.5).
 */
export function arcToCubics(
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  rotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x: number,
  y: number,
): Segment[] {
  if (x0 === x && y0 === y) return [];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0) return [{ type: 'L', x, y }];

  const phi = (rotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: compute (x1', y1')
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Correct out-of-range radii
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  // Step 2: compute (cx', cy')
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const num = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
  const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
  let coef = den === 0 ? 0 : Math.sqrt(Math.max(0, num / den));
  if (largeArc === sweep) coef = -coef;
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;

  // Step 3: compute (cx, cy)
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y) / 2;

  // Step 4: angles
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;
  const theta1 = Math.atan2(uy, ux);
  let dTheta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  else if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  // Split into segments of at most 90 degrees
  const n = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2) - 1e-9));
  const delta = dTheta / n;
  const t = ((4 / 3) * Math.tan(delta / 4));

  const out: Segment[] = [];
  let a = theta1;
  let px = x0;
  let py = y0;
  for (let i = 0; i < n; i++) {
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    const a2 = a + delta;
    const cosB = Math.cos(a2);
    const sinB = Math.sin(a2);

    // Endpoint of this sub-arc on the unit circle, then mapped to the ellipse
    const ex = cx + rx * cosPhi * cosB - ry * sinPhi * sinB;
    const ey = cy + rx * sinPhi * cosB + ry * cosPhi * sinB;

    // Derivatives (tangents) at start and end
    const d1x = -rx * cosPhi * sinA - ry * sinPhi * cosA;
    const d1y = -rx * sinPhi * sinA + ry * cosPhi * cosA;
    const d2x = -rx * cosPhi * sinB - ry * sinPhi * cosB;
    const d2y = -rx * sinPhi * sinB + ry * cosPhi * cosB;

    const isLast = i === n - 1;
    out.push({
      type: 'C',
      x1: px + t * d1x,
      y1: py + t * d1y,
      x2: (isLast ? x : ex) - t * d2x,
      y2: (isLast ? y : ey) - t * d2y,
      x: isLast ? x : ex,
      y: isLast ? y : ey,
    });
    px = ex;
    py = ey;
    a = a2;
  }
  return out;
}
