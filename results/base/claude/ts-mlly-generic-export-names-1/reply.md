Adding a regression test for the fix, then I'll run the suite.

`findExports` no longer reports generic type arguments as export names. The full suite passes, including the new regression tests.

The fix is in `src/analyze.ts`, in two parts:
- **Capture regex:** the `extraNames` group in `EXPORT_DECAL_RE` stopped at the last comma-separated identifier and dropped the closing `>()`. That left the parser nothing to tell it a `<` opened generics. It now captures the rest of the line.
- **Generic calls:** `_extractExtraNames` now skips `<...>` after an identifier when the matching `>` is followed by `(`, as in `new Map<string, X>()` or `foo<A, B>(x)`. A comparison like `1<2, b = 3` has no such `>`, so it's still treated as a comparison.
- **Arrow types:** a `=>` inside a type annotation was being counted as the end of a generic. That broke `Map<string, (x: string) => void>`, and it's fixed.

All five examples from your report now give the expected names. The tests are in a new `findExports generics` block in `test/exports.test.ts`.

Something like `a<b, c>(d)` is ambiguous between a comparison and a generic call. It's treated as a generic call, which is how TypeScript reads it.

I haven't committed anything.
