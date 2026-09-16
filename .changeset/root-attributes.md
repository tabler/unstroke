---
"unstroke": patch
---

The output root keeps only attributes that still make sense for a filled path. Every `stroke-*`, `fill-*`, `marker-*` and `vector-effect` attribute of the input root is dropped (previously `stroke-dasharray` or `stroke-opacity` could survive and suggest they had been applied). `clip-path`, `mask`, `filter` and `opacity` on the root are kept, since they apply to the whole picture either way, and are not reported as warnings.
