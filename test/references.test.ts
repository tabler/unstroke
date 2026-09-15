import { describe, expect, it } from 'vitest';
import { parseSvg } from '../lib/index.js';
import { parseCss, matchRules } from '../lib/parse/css.js';
describe('<use>', () => {
  it('renders referenced shapes with the use element style, offset and transform', () => {
    const svg = `<svg viewBox="0 0 40 40"><defs><path id="p" d="M0 0h10"/></defs>
      <use href="#p" x="2" y="3" stroke="#000" stroke-width="2"/>
      <use xlink:href="#p" transform="scale(2)" stroke="#f00"/>
      <use href="#missing" stroke="#000"/></svg>`;
    const parsed = parseSvg(svg);
    expect(parsed.shapes).toHaveLength(2);
    expect(parsed.shapes[0]!.transform).toEqual([1, 0, 0, 1, 2, 3]);
    expect(parsed.shapes[0]!.style.stroke).toBe('#000');
    expect(parsed.shapes[1]!.transform).toEqual([2, 0, 0, 2, 0, 0]);
    expect(parsed.shapes[1]!.style.stroke).toBe('#f00');
  });

  it('follows use into groups and symbols and survives cycles', () => {
    const svg = `<svg viewBox="0 0 40 40" stroke="#000"><symbol id="s"><g><path d="M0 0h5"/><path d="M0 2h5"/></g></symbol><use href="#s"/><g id="loop"><use href="#loop"/></g></svg>`;
    expect(parseSvg(svg).shapes).toHaveLength(2);
  });
});

describe('stylesheet', () => {
  it('applies class, id and tag rules with specificity, below inline style', () => {
    const rules = parseCss(`
      /* comment */ path { stroke: #111; stroke-width: 1 }
      .a, .b { stroke: #222 }
      path.a { stroke-width: 3 !important; }
      #x { stroke: #333 }
      g > path { stroke: #999 }
      @media print { path { stroke: #888 } }
    `);
    expect(matchRules(rules, 'path', { class: 'a' })).toEqual({ stroke: '#222', 'stroke-width': '3' });
    expect(matchRules(rules, 'path', { class: 'a', id: 'x' })).toEqual({ stroke: '#333', 'stroke-width': '3' });
    expect(matchRules(rules, 'rect', { class: 'b' })).toEqual({ stroke: '#222' });
    const svg = `<svg viewBox="0 0 10 10"><style>.l{stroke:#00f;stroke-width:2;fill:none}</style><path class="l" style="stroke-width:4" d="M0 5h10"/><path class="l" display="none" d="M0 0h10"/></svg>`;
    const parsed = parseSvg(svg);
    expect(parsed.shapes).toHaveLength(1);
    expect(parsed.shapes[0]!.style).toMatchObject({ stroke: '#00f', strokeWidth: 4, fill: 'none' });
  });
});
