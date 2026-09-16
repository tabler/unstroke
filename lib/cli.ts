import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { outlineSvg, type OutlineOptions, type SvgWarning } from './index.js';

const HELP = `unstroke - convert stroked SVG into filled outlines

Usage
  unstroke <file|dir>... [options]

Output
  -o, --out <dir>          write results into <dir> (mirrors the input tree for directories)
  -w, --write              overwrite the input files in place
  -s, --suffix <text>      append <text> to output file names, e.g. "-outline"
  --stdout                 print results to stdout (default for a single file without --out)

Stroke
  --stroke-width <n>       override stroke-width for every stroked element
  --linecap <butt|round|square>
  --linejoin <miter|round|bevel>
  --miter-limit <n>

Geometry
  --tolerance <n>          max flattening error in user units (default: viewBox / 2400)
  --fit-tolerance <n>      max curve-fit error (default: 2 x tolerance)
  --corner-angle <deg>     turn angle that counts as a sharp corner (default 30)
  --no-curves              emit polygons instead of fitting curves
  --precision <n>          decimal places (default 3)
  --no-fills               ignore shapes that are already filled
  --fill <color>           fill written on the output (default currentColor)

Other
  --optimize               run SVGO on the result (requires the svgo package)
  --strict                 fail on input that uses unsupported features (dashes, text,
                           markers, clip paths, nested viewports, opacity, several colours)
                           instead of converting it with a warning
  -q, --quiet              no progress output (warnings are still printed)
  -h, --help               show this help
  -v, --version            show the version
`;

interface Job {
  input: string;
  output: string | null; // null = stdout
}

export interface CliIo {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

/** Run the CLI with the given arguments. Returns the process exit code. */
export async function run(argv: string[], io: CliIo = { stdout: (s) => process.stdout.write(s), stderr: (s) => process.stderr.write(s) }): Promise<number> {
  let parsed: ReturnType<typeof parseArgs<typeof SPEC>>;
  try {
    parsed = parseArgs({ ...SPEC, args: argv });
  } catch (e) {
    io.stderr(`${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  const { values, positionals } = parsed;

  if (values.help) {
    io.stdout(HELP);
    return 0;
  }
  if (values.version) {
    io.stdout(`${VERSION}\n`);
    return 0;
  }
  if (positionals.length === 0) {
    io.stderr(`No input files given.\n\n${HELP}`);
    return 2;
  }
  const outputModes = [values.out, values.write, values.stdout].filter(Boolean).length;
  if (outputModes > 1) {
    io.stderr('Use only one of --out, --write and --stdout.\n');
    return 2;
  }

  let options: OutlineOptions;
  try {
    options = optionsFromValues(values);
  } catch (e) {
    io.stderr(`${(e as Error).message}\n`);
    return 2;
  }

  let optimize: ((svg: string) => string) | null = null;
  if (values.optimize) {
    try {
      const mod = await import('./optimize.js');
      optimize = (svg) => mod.optimizeSvg(svg, { precision: options.precision });
    } catch {
      io.stderr('--optimize needs the "svgo" package: npm install svgo\n');
      return 2;
    }
  }

  const jobs = collectJobs(positionals, values);
  if (jobs.length === 0) {
    io.stderr('No .svg files found.\n');
    return 1;
  }

  let failed = 0;
  let warned = 0;
  const start = performance.now();
  for (const job of jobs) {
    const shown = relative(process.cwd(), job.input) || job.input;
    let jobWarned = false;
    const onWarning = (w: SvgWarning) => {
      if (!values.strict) io.stderr(`${shown}: warning: ${w.message}\n`);
      jobWarned = true;
    };
    try {
      let svg = outlineSvg(readFileSync(job.input, 'utf8'), { ...options, onWarning, strict: values.strict });
      if (jobWarned) warned++;
      if (optimize) svg = optimize(svg);
      if (job.output === null) {
        io.stdout(svg + '\n');
      } else {
        mkdirSync(dirname(job.output), { recursive: true });
        writeFileSync(job.output, svg + '\n');
      }
    } catch (e) {
      failed++;
      io.stderr(`${job.input}: ${(e as Error).message}\n`);
    }
  }
  if (!values.quiet && jobs.some((j) => j.output !== null)) {
    const ms = ((performance.now() - start) / 1000).toFixed(1);
    const notes = [failed ? `${failed} failed` : '', warned ? `${warned} with warnings` : ''].filter(Boolean);
    io.stderr(`${jobs.length - failed} of ${jobs.length} files converted in ${ms}s${notes.length ? `, ${notes.join(', ')}` : ''}\n`);
  }
  return failed ? 1 : 0;
}

const SPEC = {
  options: {
    out: { type: 'string', short: 'o' },
    write: { type: 'boolean', short: 'w' },
    suffix: { type: 'string', short: 's' },
    stdout: { type: 'boolean' },
    'stroke-width': { type: 'string' },
    linecap: { type: 'string' },
    linejoin: { type: 'string' },
    'miter-limit': { type: 'string' },
    tolerance: { type: 'string' },
    'fit-tolerance': { type: 'string' },
    'corner-angle': { type: 'string' },
    'no-curves': { type: 'boolean' },
    precision: { type: 'string' },
    'no-fills': { type: 'boolean' },
    fill: { type: 'string' },
    optimize: { type: 'boolean' },
    strict: { type: 'boolean' },
    quiet: { type: 'boolean', short: 'q' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
  allowPositionals: true,
  strict: true,
} as const;

type Values = ReturnType<typeof parseArgs<typeof SPEC>>['values'];

function num(values: Values, name: keyof Values): number | undefined {
  const v = values[name];
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${name} expects a number, got "${v}"`);
  return n;
}

function oneOf<T extends string>(values: Values, name: keyof Values, allowed: readonly T[]): T | undefined {
  const v = values[name];
  if (v === undefined) return undefined;
  if (!allowed.includes(v as T)) throw new Error(`--${name} must be one of ${allowed.join(', ')}`);
  return v as T;
}

function optionsFromValues(values: Values): OutlineOptions {
  return {
    strokeWidth: num(values, 'stroke-width'),
    linecap: oneOf(values, 'linecap', ['butt', 'round', 'square'] as const),
    linejoin: oneOf(values, 'linejoin', ['miter', 'round', 'bevel'] as const),
    miterLimit: num(values, 'miter-limit'),
    tolerance: num(values, 'tolerance'),
    fitTolerance: num(values, 'fit-tolerance'),
    cornerAngle: num(values, 'corner-angle'),
    precision: num(values, 'precision'),
    curves: !values['no-curves'],
    includeFills: !values['no-fills'],
    fill: values.fill,
  };
}

function listSvgFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSvgFiles(p));
    else if (entry.isFile() && extname(entry.name).toLowerCase() === '.svg') out.push(p);
  }
  return out.sort();
}

function collectJobs(inputs: string[], values: Values): Job[] {
  const jobs: Job[] = [];
  const suffix = values.suffix ?? '';
  const outDir = values.out ? resolve(values.out) : null;
  const single = inputs.length === 1 && !statSync(inputs[0]!).isDirectory();
  const toStdout = values.stdout || (single && !outDir && !values.write && !values.suffix);

  const target = (input: string, root: string | null): string | null => {
    if (toStdout) return null;
    const name = basename(input, extname(input)) + suffix + '.svg';
    if (outDir) return join(outDir, root ? relative(root, dirname(input)) : '', name);
    return join(dirname(input), name); // --write, or --suffix next to the source
  };

  for (const input of inputs) {
    const path = resolve(input);
    if (statSync(path).isDirectory()) {
      for (const file of listSvgFiles(path)) jobs.push({ input: file, output: target(file, path) });
    } else {
      jobs.push({ input: path, output: target(path, null) });
    }
  }
  return jobs;
}

declare const __VERSION__: string | undefined;
const VERSION = typeof __VERSION__ === 'string' ? __VERSION__ : 'dev';
