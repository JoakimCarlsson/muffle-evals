`findExports` no longer reports generic type arguments as export names. All 194 tests pass, and `tsc` and `eslint` report nothing. I haven't committed anything.

I changed `src/analyze.ts` in two ways:
- **Generic calls in initializers:** `_extractExtraNames` now skips `<…>` after an identifier when a call follows, as in `new Map<string, X>()` or `foo<Bar, Baz>(…)`. That covers `new Set<string>(), b = new Map<string, number>()`. A `<` after a digit, as in `1<2, b = 3`, is still a comparison, so that case gives `["a", "b"]`.
- **Arrow types in annotations:** the `>` in `=>` no longer closes a generic argument list. `export const a: Map<string, (x: string) => void> = new Map(), b = 1` gives `["a", "b"]`.

I added tests for all five examples (yours plus the two edge cases) to `test/exports.test.ts`.

**Known limit:** `EXPORT_DECAL_RE` can cut the captured text off before the closing `>(`. When it does, an unclosed `<` after an identifier is treated as generic. A comparison like `a<b, c = 1` with a variable on the left could therefore be misread. I didn't add a comment for this in the code.
