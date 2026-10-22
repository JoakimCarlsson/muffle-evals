Output is empty, so I'll re-run with a timeout and put the scratch test back.

`findExports` no longer reports generic type arguments as export names. All five cases from your report give the expected names, and `tsc` and `eslint` are clean. I checked the cases with a throwaway test and deleted it afterwards, so no new tests were added to the suite. The existing suite still passes (190 tests).

The fix is in `src/analyze.ts` and has two parts:
- **Truncated capture:** The export regex stopped its captured text at the last identifier after a comma. For `new Map<string, IAppMode>()` the capture ended at `IAppMode` and lost the closing `>(`. I added a lookahead group, `extraTail`, that carries the rest of the line, and `findExports` appends it before calling `_extractExtraNames`.
- **Generics in expressions:** `_extractExtraNames` only handled `<…>` inside type annotations. It now also skips a `<…>` that is followed by `(`, so `new Set<string>()` and `foo<Bar, Baz>(…)` are handled.

Comparisons like `1<2, b = 3` don't match that pattern, so they still give `["a", "b"]`. The annotation case with an arrow function type already worked once the capture was fixed.

Expression-level generics whose arguments contain parentheses, such as `new Map<string, (x: string) => void>()`, are still not recognised. Without the parentheses the skip pattern stays tight, which keeps comparisons safe. Type annotations with arrow types are fine.

I made no commit.

That notification is about my first test attempt. That run hung in vitest's default watch mode and was killed at its time limit. I had already re-run the check with `--no-watch`, which is the run I reported, and I don't need to restart the old one.

The fix and results in my last message stand. The scratch test file is deleted, and `git status` showed only `src/analyze.ts` modified. I made no commit.
