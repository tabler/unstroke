/**
 * Minimal XML parser, enough for SVG documents: elements, attributes,
 * comments, processing instructions, doctype and CDATA. Text nodes are kept
 * only as raw strings so <style> content could be inspected later.
 */
export interface XmlElement {
  type: 'element';
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

export interface XmlText {
  type: 'text';
  text: string;
}

export type XmlNode = XmlElement | XmlText;

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
};

export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

export function parseXml(input: string): XmlElement {
  const root: XmlElement = { type: 'element', tag: '#document', attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const lt = input.indexOf('<', i);
    if (lt === -1) {
      pushText(stack, input.slice(i));
      break;
    }
    if (lt > i) pushText(stack, input.slice(i, lt));

    if (input.startsWith('<!--', lt)) {
      const end = input.indexOf('-->', lt + 4);
      if (end === -1) throw new Error('Unterminated comment');
      i = end + 3;
      continue;
    }
    if (input.startsWith('<![CDATA[', lt)) {
      const end = input.indexOf(']]>', lt + 9);
      if (end === -1) throw new Error('Unterminated CDATA');
      pushText(stack, input.slice(lt + 9, end));
      i = end + 3;
      continue;
    }
    if (input.startsWith('<?', lt)) {
      const end = input.indexOf('?>', lt + 2);
      if (end === -1) throw new Error('Unterminated processing instruction');
      i = end + 2;
      continue;
    }
    if (input.startsWith('<!', lt)) {
      // DOCTYPE (possibly with an internal subset)
      let depth = 0;
      let j = lt;
      for (; j < n; j++) {
        const c = input[j];
        if (c === '[') depth++;
        else if (c === ']') depth--;
        else if (c === '>' && depth === 0) break;
      }
      i = j + 1;
      continue;
    }
    if (input.startsWith('</', lt)) {
      const end = input.indexOf('>', lt + 2);
      if (end === -1) throw new Error('Unterminated closing tag');
      const tag = input.slice(lt + 2, end).trim();
      const top = stack[stack.length - 1];
      if (!top || top.tag !== tag) throw new Error(`Unexpected closing tag </${tag}>`);
      stack.pop();
      i = end + 1;
      continue;
    }

    // Opening tag
    let j = lt + 1;
    while (j < n && !/[\s/>]/.test(input[j]!)) j++;
    const tag = input.slice(lt + 1, j);
    if (!tag) throw new Error(`Malformed tag at ${lt}`);
    const attrs: Record<string, string> = {};
    let selfClosing = false;
    for (;;) {
      while (j < n && /\s/.test(input[j]!)) j++;
      if (j >= n) throw new Error(`Unterminated tag <${tag}>`);
      const c = input[j]!;
      if (c === '>') { j++; break; }
      if (c === '/') {
        selfClosing = true;
        j = input.indexOf('>', j) + 1;
        if (j === 0) throw new Error(`Unterminated tag <${tag}>`);
        break;
      }
      let k = j;
      while (k < n && !/[\s=/>]/.test(input[k]!)) k++;
      const name = input.slice(j, k);
      j = k;
      while (j < n && /\s/.test(input[j]!)) j++;
      if (input[j] === '=') {
        j++;
        while (j < n && /\s/.test(input[j]!)) j++;
        const q = input[j]!;
        if (q === '"' || q === "'") {
          const end = input.indexOf(q, j + 1);
          if (end === -1) throw new Error(`Unterminated attribute value for ${name}`);
          attrs[name] = decodeEntities(input.slice(j + 1, end));
          j = end + 1;
        } else {
          let end = j;
          while (end < n && !/[\s>]/.test(input[end]!)) end++;
          attrs[name] = decodeEntities(input.slice(j, end));
          j = end;
        }
      } else {
        attrs[name] = '';
      }
    }
    const el: XmlElement = { type: 'element', tag, attrs, children: [] };
    stack[stack.length - 1]!.children.push(el);
    if (!selfClosing) stack.push(el);
    i = j;
  }

  if (stack.length !== 1) throw new Error(`Unclosed tag <${stack[stack.length - 1]!.tag}>`);
  return root;
}

function pushText(stack: XmlElement[], text: string) {
  if (text.trim() === '') return;
  stack[stack.length - 1]!.children.push({ type: 'text', text: decodeEntities(text) });
}
