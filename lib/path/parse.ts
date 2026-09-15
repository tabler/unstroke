import { arcToCubics } from './arc.js';
import type { Segment } from './types.js';

const ARG_COUNT: Record<string, number> = {
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0,
};

interface RawCommand {
  cmd: string;
  args: number[];
}

const NUMBER_RE = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/y;
const FLAG_RE = /[01]/y;

/** Tokenize SVG path data into commands with their numeric arguments (implicit repeats expanded). */
export function tokenizePathData(d: string): RawCommand[] {
  const out: RawCommand[] = [];
  let i = 0;
  const n = d.length;

  const skipSeparators = (allowComma: boolean) => {
    while (i < n) {
      const c = d.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 12) i++;
      else if (allowComma && c === 44) i++;
      else break;
    }
  };

  let cmd = '';
  let implicit = false; // arguments continue the previous command without a new letter
  while (i < n) {
    skipSeparators(implicit); // a comma may separate one implicit repeat from the next
    if (i >= n) break;
    const ch = d[i]!;
    if (/[a-zA-Z]/.test(ch)) {
      cmd = ch;
      implicit = false;
      i++;
      if (!(cmd.toUpperCase() in ARG_COUNT)) throw new Error(`Invalid path command "${cmd}" at ${i - 1}`);
      if (cmd.toUpperCase() === 'Z') {
        out.push({ cmd, args: [] });
        continue;
      }
    } else if (!cmd) {
      throw new Error(`Path data must start with a command, got "${ch}" at ${i}`);
    } else if (cmd.toUpperCase() === 'Z') {
      throw new Error(`Unexpected number after closepath at ${i}`);
    }

    const count = ARG_COUNT[cmd.toUpperCase()]!;
    const args: number[] = [];
    for (let k = 0; k < count; k++) {
      skipSeparators(k > 0);
      const isArcFlag = cmd.toUpperCase() === 'A' && (k === 3 || k === 4);
      const re = isArcFlag ? FLAG_RE : NUMBER_RE;
      re.lastIndex = i;
      const m = re.exec(d);
      if (!m) throw new Error(`Expected number for "${cmd}" at ${i}`);
      args.push(parseFloat(m[0]));
      i = re.lastIndex;
    }
    out.push({ cmd, args });
    implicit = true;
    // Implicit lineto after moveto
    if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
  }
  return out;
}

/**
 * Parse path data into normalized absolute segments (M / L / C / Z).
 * Relative commands, H/V, S/T smooth curves, quadratics and arcs are all resolved.
 */
export function parsePathData(d: string): Segment[] {
  const raw = tokenizePathData(d);
  const out: Segment[] = [];
  let cx = 0; // current point
  let cy = 0;
  let sx = 0; // subpath start
  let sy = 0;
  let lastCtrlX = 0; // last control point for S / T reflection
  let lastCtrlY = 0;
  let lastType = '';

  for (const { cmd, args } of raw) {
    const rel = cmd === cmd.toLowerCase();
    const type = cmd.toUpperCase();
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;

    switch (type) {
      case 'M': {
        cx = sx = args[0]! + ox;
        cy = sy = args[1]! + oy;
        out.push({ type: 'M', x: cx, y: cy });
        break;
      }
      case 'L': {
        cx = args[0]! + ox;
        cy = args[1]! + oy;
        out.push({ type: 'L', x: cx, y: cy });
        break;
      }
      case 'H': {
        cx = args[0]! + ox;
        out.push({ type: 'L', x: cx, y: cy });
        break;
      }
      case 'V': {
        cy = args[0]! + oy;
        out.push({ type: 'L', x: cx, y: cy });
        break;
      }
      case 'C': {
        const seg: Segment = {
          type: 'C',
          x1: args[0]! + ox, y1: args[1]! + oy,
          x2: args[2]! + ox, y2: args[3]! + oy,
          x: args[4]! + ox, y: args[5]! + oy,
        };
        out.push(seg);
        lastCtrlX = seg.x2; lastCtrlY = seg.y2;
        cx = seg.x; cy = seg.y;
        break;
      }
      case 'S': {
        const x1 = lastType === 'C' || lastType === 'S' ? 2 * cx - lastCtrlX : cx;
        const y1 = lastType === 'C' || lastType === 'S' ? 2 * cy - lastCtrlY : cy;
        const seg: Segment = {
          type: 'C', x1, y1,
          x2: args[0]! + ox, y2: args[1]! + oy,
          x: args[2]! + ox, y: args[3]! + oy,
        };
        out.push(seg);
        lastCtrlX = seg.x2; lastCtrlY = seg.y2;
        cx = seg.x; cy = seg.y;
        break;
      }
      case 'Q':
      case 'T': {
        let qx: number, qy: number, x: number, y: number;
        if (type === 'Q') {
          qx = args[0]! + ox; qy = args[1]! + oy;
          x = args[2]! + ox; y = args[3]! + oy;
        } else {
          const reflect = lastType === 'Q' || lastType === 'T';
          qx = reflect ? 2 * cx - lastCtrlX : cx;
          qy = reflect ? 2 * cy - lastCtrlY : cy;
          x = args[0]! + ox; y = args[1]! + oy;
        }
        out.push({
          type: 'C',
          x1: cx + (2 / 3) * (qx - cx), y1: cy + (2 / 3) * (qy - cy),
          x2: x + (2 / 3) * (qx - x), y2: y + (2 / 3) * (qy - y),
          x, y,
        });
        lastCtrlX = qx; lastCtrlY = qy;
        cx = x; cy = y;
        break;
      }
      case 'A': {
        const x = args[5]! + ox;
        const y = args[6]! + oy;
        out.push(...arcToCubics(cx, cy, args[0]!, args[1]!, args[2]!, args[3] === 1, args[4] === 1, x, y));
        cx = x; cy = y;
        break;
      }
      case 'Z': {
        out.push({ type: 'Z' });
        cx = sx; cy = sy;
        break;
      }
    }
    lastType = type;
  }
  return out;
}
