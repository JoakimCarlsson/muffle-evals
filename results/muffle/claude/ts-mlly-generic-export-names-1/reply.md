You've hit your session limit · resets 11:30am (Europe/Stockholm)

Fix works and tsc is clean; I'm now adding permanent regression tests and running lint.

`findExports` no longer reports generic type arguments as export names. All the cases from your report now give the expected names.

The full suite passes (191 tests), and eslint and `tsc --noEmit` are clean.

There were two causes, both in `src/analyze.ts`:
- **Truncated capture:** the regex capture of the declaration tail stopped at the last identifier after a comma. For `new Map<string, IAppMode>()` that left `IAppMode` as the last thing seen, with no `>()` after it. I now scan the rest of the line from the end of the first name, and the scan stops at a top-level `;`.
- **Generics in expressions:** the scanner only tracked `<` and `>` inside type annotations. It now also treats `<…>` as generic arguments when the matching `>` is followed by `(`, as in `new Set<string>()` or `foo<Bar, Baz>(…)`. `export const a = 1<2, b = 3` still counts as a comparison and gives `["a", "b"]`.
- **Arrow types:** the `>` in `=>` no longer closes an angle bracket. `export const a: Map<string, (x: string) => void> = new Map(), b = 1` gives `["a", "b"]`.

I added regression tests for all five cases in `test/exports.test.ts`. I didn't commit anything.

The generic-call rule can misread `a<b, c>(d)` written as a comparison chain. That's the same ambiguity TypeScript resolves as a generic call, so I left it.
