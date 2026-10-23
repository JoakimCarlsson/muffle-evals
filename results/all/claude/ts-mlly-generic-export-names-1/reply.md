Done. `findExports` now skips generic call arguments (`new Map<string, X>()`, `foo<A, B>(...)`) and no longer miscounts `=>` in type annotations. `1<2, b = 3` still gives `["a", "b"]`. All 193 tests pass, including 4 new cases; `tsc` printed no errors. Nothing committed.

One limit: a generic call whose arguments continue on the next line is not handled. The scan only reads to the end of the line.
