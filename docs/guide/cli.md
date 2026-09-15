# Command line

```bash
npx unstroke icons/ -o outlined/                 # a whole folder, tree mirrored
npx unstroke icon.svg > icon-outline.svg         # single file to stdout
npx unstroke icons/*.svg --write                 # in place
npx unstroke icons/ -o thin/ --stroke-width 1.5  # every weight from one source
npx unstroke icons/ -o out/ --optimize           # plus SVGO (needs the svgo package)
```

`unstroke --help` lists every option; they mirror the
[API options](/reference/options) (`--tolerance`, `--linecap`, `--no-curves`,
`--precision`, …).
