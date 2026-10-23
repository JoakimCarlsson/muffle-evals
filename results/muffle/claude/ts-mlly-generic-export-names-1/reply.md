`findExports` no longer reports generic type arguments as export names. All 189 tests pass, including new cases for each example you gave.

- **Cause:** the scanner in `_extractExtraNames` (`src/analyze.ts`) only tracked `<…>` inside type annotations, so `Map<string, IAppMode>` in an initializer was split at the comma. The regex capture it was fed also stopped before the closing `>`.
- **Fix:**
  - The scanner now gets the rest of the line instead of the truncated capture.
  - A new `_isGenericOpen` treats `<` as a generic opener when it follows an identifier and its matching `>` is followed by `(` or a template literal.
  - Real comparisons like `1<2` still split correctly.
  - The scanner also stops at a top-level `;`, and `=>` is no longer mistaken for a closing `>`.
- **Tests:** I added to `test/exports.test.ts` your five cases. These are the `APP_MODE_MAP` case, `foo<Bar, Baz>(…)`, the two-declarator `Set`/`Map` case, `1<2, b = 3`, and the arrow-function type annotation.

The generic check is a heuristic. A comparison that looks like a generic call, such as `a<b, c>(d)`, would be read as a generic.

I haven't committed anything.
