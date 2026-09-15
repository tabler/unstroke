import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { outlineSvg } from '../src/index.js';

const SRC = process.argv[2] ?? '/Users/chomik/htdocs/tabler-icons/icons/outline';
const OLD = '/Users/chomik/htdocs/tabler-icons/packages/icons-webfont/icons-outlined/400';
const names = process.argv[3] ? process.argv[3].split(',') : pickSample(200);

const oldByName = new Map<string, string>();
if (existsSync(OLD)) {
  for (const f of readdirSync(OLD)) {
    const m = /^u[0-9A-F]+-(.+)\.svg$/.exec(f);
    if (m) oldByName.set(m[1]!, join(OLD, f));
  }
}

let html = `<!doctype html><meta charset="utf-8"><title>svg-outliner preview</title>
<style>
body{font:12px system-ui;background:#f5f5f5;margin:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
.card{background:#fff;border-radius:8px;padding:8px;box-shadow:0 1px 2px #0002}
.row{display:flex;gap:8px;align-items:center}
.row svg{width:96px;height:96px;background:
 repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px;border-radius:4px}
.name{font-weight:600;margin-bottom:4px;word-break:break-all}
.meta{color:#666}
.err{color:#c00;white-space:pre-wrap}
</style>
<h1>svg-outliner preview</h1><p>oryginał (stroke) · nowy outline · stary Tabler</p><div class="grid">`;

let total = 0, failed = 0, bytesNew = 0, bytesOld = 0, time = 0;
for (const name of names) {
  const src = readFileSync(join(SRC, `${name}.svg`), 'utf8');
  let out = '';
  let err = '';
  const t = performance.now();
  try {
    out = outlineSvg(src);
  } catch (e) {
    err = (e as Error).stack ?? String(e);
    failed++;
  }
  time += performance.now() - t;
  total++;
  const old = oldByName.get(name) ? readFileSync(oldByName.get(name)!, 'utf8').replace(/<!--.*?-->/g, '') : '';
  bytesNew += out.length;
  bytesOld += old.length;
  html += `<div class="card"><div class="name">${name}</div><div class="row">${src.replace(/<!--[\s\S]*?-->/, '')}${out}${old}</div>
  <div class="meta">${out.length} B vs ${old.length} B</div>${err ? `<div class="err">${err}</div>` : ''}</div>`;
}
html += '</div>';
writeFileSync('preview/index.html', html);
console.log(`${total} icons, ${failed} failed, ${(time / total).toFixed(1)}ms avg, new ${bytesNew} B vs old ${bytesOld} B`);

function pickSample(n: number): string[] {
  const all = readdirSync(SRC).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4));
  // deterministic spread across the alphabet
  const step = Math.max(1, Math.floor(all.length / n));
  return all.filter((_, i) => i % step === 0).slice(0, n);
}
