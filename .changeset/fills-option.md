---
"unstroke": major
---

The `includeFills` option is renamed to `fills`, matching the CLI's `--no-fills` and the other boolean option `curves` / `--no-curves`. `includeFills` is gone; pass `fills: false` where you passed `includeFills: false`. This and the Node 20 requirement are the only changes that need action when upgrading from 0.1.0.
