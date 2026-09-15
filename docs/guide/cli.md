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
