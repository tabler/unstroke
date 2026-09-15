# Development

```bash
git clone https://github.com/tabler/unstroke
cd unstroke
pnpm install
pnpm test
pnpm build
```

The library is plain TypeScript in `lib/`, bundled with tsup into ESM, CJS
and type declarations. Node 18 or newer; the CI matrix runs 20, 22 and 24.

| command | what it does |
| --- | --- |
| `pnpm test` | vitest, including the fixture snapshots and pixel comparisons |
| `pnpm test:watch` | the same in watch mode |
| `pnpm typecheck` | `tsc --noEmit` over `lib/`, `test/` and `scripts/` |
| `pnpm build` | `dist/` with `index`, `optimize` and the `cli` entry |
| `pnpm docs` | this site, with the demo, on `localhost:5173` |
| `pnpm pixel-diff <dir>` | rasterize every icon in a folder and report the worst mismatches |
| `pnpm diff-image <file>` | one icon side by side with a difference image |

## Repository layout

```
lib/          the library: parse → path → geometry → stroke → output
lib/cli.ts    the command line tool
test/         vitest suites, fixtures and committed snapshots
scripts/      pixel-diff and diff-image
docs/         this site (VitePress) and the demo icons in docs/icons/
```

## Tests on real files

`test/fixtures/` holds real SVGs in three groups:

- `tabler/`: the hardest Tabler icons (180° reversals, micro segments, tight
  arcs, spirals, fills mixed with strokes, and every icon that broke Skia,
  Paper.js or the previous Tabler pipeline).
- `open-source/`: icons from other sets with different conventions, such as
  stroke widths of 1.5, `<polyline>`, `<circle>` and `<rect>` elements, or
  stroke attributes on individual elements. Feather, Lucide, Heroicons and
  Iconoir; sources and licenses are listed in
  [`SOURCES.md`](https://github.com/tabler/unstroke/blob/main/test/fixtures/open-source/SOURCES.md).
- `custom/`: hand-written files covering basic shapes, transforms, caps,
  joins, fill rules, drawing direction, dots, self-intersections and
  degenerate input.

For each fixture the test suite:

1. converts it at stroke widths 0.5, 1, 1.5 and 2, writes each result to
   `test/__output__/stroke-<width>/<group>/<name>.svg` and compares it with
   the committed version,
2. rasterizes the original (with the same stroke width) and the outline and
   requires them to match within 0.05% of pixels.

Drop a new `.svg` into a fixtures folder to cover it; the output file is the
snapshot you review in a pull request.

::: tip Accepting snapshot changes
`pnpm vitest run -u` rewrites the files in `test/__output__/`. Review the diff
before committing: a changed snapshot is either an intended improvement or a
regression, and the pixel comparison only catches the large ones.
:::

## Investigating a mismatch

`pnpm pixel-diff <dir>` runs a whole folder and prints the icons with the
largest pixel mismatch, writing the full list to `test/.diff/pixel-diff.json`.
`pnpm diff-image <file>` renders one icon as original, outline and difference
image side by side into `test/.diff/diff.png`. Both use the same resvg
rasterizer as the test suite.

The [demo](/demo/) is often the quickest first look: every icon page shows
the outline as a wireframe and an overlay of the source over the result, and
it is rendered from the current `lib/` on every reload in `pnpm docs`.

## Docs and demo

The site is VitePress in `docs/`. Pages are markdown in `docs/guide/`,
`docs/reference/` and `docs/development/`; the sidebar lives in
`docs/.vitepress/config.ts`.

The demo is generated at build time: `docs/demo/icons.data.ts` converts every
icon from `docs/icons/` and `test/fixtures/` and the per-icon pages come from
the dynamic route in `docs/icon/`. To show another set in the demo, drop a
folder of SVGs into `docs/icons/`. The home page's before/after and the
stroke-pieces picture are computed the same way from one icon, chosen at the
top of `docs/.vitepress/data/home.data.ts`.

Vercel builds the site from this repository: every pull request gets a
preview deployment and every push to `main` updates
[unstroke.vercel.app](https://unstroke.vercel.app).

## Releasing

Versions and the changelog are managed with
[Changesets](https://github.com/changesets/changesets). A pull request that
changes the library's behaviour includes a changeset:

```bash
pnpm changeset
```

It asks for the bump type (patch, minor, major) and a one-line summary, and
writes a small markdown file into `.changeset/`. Commit it with the change.
Documentation, demo and test-only changes need no changeset.

On every push to `main` the release workflow collects pending changesets into
a "Version packages" pull request that bumps `package.json` and updates
`CHANGELOG.md`. Merging that pull request publishes the package to npm and
creates a GitHub release.

Publishing uses npm's [Trusted Publishing](https://docs.npmjs.com/trusted-publishers):
npm trusts the GitHub Actions identity of this repository's `release.yml`,
so there is no npm token to store or rotate, and every release carries a
provenance attestation linking it to the commit and workflow run. The
workflow type-checks, tests and builds in a job without publish permissions,
packs the tarball there, and only the publish job receives the OIDC token.
The package ships `dist/`, the README and the license; the `svgo` peer
dependency stays optional.
