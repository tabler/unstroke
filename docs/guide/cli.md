---
title: Command line
description: Convert whole folders of stroked SVG icons to filled outlines with the unstroke CLI, including in-place conversion, stroke width overrides and SVGO optimization.
---

# Command line

```bash
npx unstroke icons/ -o outlined/                 # a whole folder, tree mirrored
npx unstroke icon.svg > icon-outline.svg         # single file to stdout
npx unstroke icons/*.svg --write                 # in place
npx unstroke icons/ -o thin/ --stroke-width 1.5  # every weight from one source
npx unstroke icons/ -o out/ --optimize           # plus SVGO (needs the svgo package)
```

`unstroke --help` lists every flag. They mirror the
[API options](/reference/options) one to one: `--tolerance`, `--linecap`,
`--no-curves`, `--precision` and so on.

## Unsupported input

When a file uses something the outline can't reproduce, such as a dashed
stroke, a `<text>` element, markers, a clip path, partial opacity or several
colours, the CLI converts it anyway and prints a warning
on stderr:

```
icons/dashed.svg: warning: stroke-dasharray on <path> is ignored, the stroke is outlined as a solid line
12 of 12 files converted in 0.1s, 1 with warnings
```

In a build I'd rather have that fail, so there's `--strict`. It treats every
such file as an error, skips it and exits with code 1 once the rest is done:

```bash
npx unstroke icons/ -o outlined/ --strict
```

The [options reference](/reference/options#warnings) lists every warning and
what it means. `-q` hides the progress line but not the warnings.
