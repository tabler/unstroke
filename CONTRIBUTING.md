# Contributing

Thanks for taking the time. The short version:

- Found an icon that converts wrong? Open an issue and attach the SVG. Without
  the file there is usually nothing to look at. The [demo](https://unstroke.vercel.app/demo/)
  shows the outline as a wireframe and an overlay of the source, which is
  often enough to see what went wrong.
- Want to change the library? Drop the problematic SVG into
  `test/fixtures/custom/` (or the relevant set), run `pnpm test`, and the
  snapshot it produces is what gets reviewed in the pull request.
- Changes to how the library behaves need a changeset: `pnpm changeset`.
  Docs, demo and test-only changes don't.

The [development page](https://unstroke.vercel.app/development/) covers the
repository layout, the fixture tests with pixel comparison, the diff tools,
how the docs and demo are built, and how releases are cut.

Security issues go through the [security policy](SECURITY.md), not the issue
tracker.
