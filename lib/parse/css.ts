/**
 * Just enough CSS for SVG files that carry their presentation in a <style>
 * element (Illustrator, Inkscape and most Wikimedia Commons exports):
 * rules with simple compound selectors (`tag`, `.class`, `#id`, `tag.a.b`,
 * comma-separated lists) and plain `property: value` declarations.
 * Combinators, pseudo-classes, attribute selectors and at-rules are ignored.
 */
export interface CssRule {
  tag: string | null;
  id: string | null;
  classes: string[];
  /** (ids, classes, tags) */
  specificity: [number, number, number];
  order: number;
  declarations: Record<string, string>;
}

export function parseCss(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  let order = 0;
  while ((m = re.exec(text))) {
    const selectors = m[1]!.trim();
    if (selectors.startsWith('@')) continue;
    const declarations = parseDeclarations(m[2]!);
    for (const selector of selectors.split(',')) {
      const rule = parseSelector(selector.trim(), order++, declarations);
      if (rule) rules.push(rule);
    }
  }
  return rules;
}

export function parseDeclarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of block.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const name = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).replace(/!important\s*$/, '').trim();
    if (name) out[name] = value;
  }
  return out;
}

function parseSelector(selector: string, order: number, declarations: Record<string, string>): CssRule | null {
  if (!selector || /[\s>+~:[\]*]/.test(selector)) return null; // unsupported: combinators etc.
  const parts = selector.match(/^([a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)$/);
  if (!parts) return null;
  const tag = parts[1] ?? null;
  let id: string | null = null;
  const classes: string[] = [];
  for (const piece of parts[2]!.match(/[.#][\w-]+/g) ?? []) {
    if (piece[0] === '#') id = piece.slice(1);
    else classes.push(piece.slice(1));
  }
  return { tag, id, classes, specificity: [id ? 1 : 0, classes.length, tag ? 1 : 0], order, declarations };
}

/** Declarations that apply to an element, lowest precedence first. */
export function matchRules(rules: CssRule[], tag: string, attrs: Record<string, string>): Record<string, string> {
  const classes = new Set((attrs.class ?? '').split(/\s+/).filter(Boolean));
  const matched = rules.filter(
    (r) => (r.tag === null || r.tag === tag) && (r.id === null || r.id === attrs.id) && r.classes.every((c) => classes.has(c)),
  );
  matched.sort((a, b) => {
    for (let i = 0; i < 3; i++) if (a.specificity[i] !== b.specificity[i]) return a.specificity[i]! - b.specificity[i]!;
    return a.order - b.order;
  });
  const out: Record<string, string> = {};
  for (const r of matched) Object.assign(out, r.declarations);
  return out;
}
