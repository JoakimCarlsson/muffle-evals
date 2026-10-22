I’ll trace how `findExports` splits declarations, check its callers and existing coverage, then make the smallest fix and run the build and tests.

The shared declaration scanner only tracks `<…>` inside type annotations. It also treats the `>` in an arrow type as a closing bracket. I’ll fix both there so `findExports` and its callers inherit the correction. No public API, fixture, or config changes are needed.

The declaration regex stops before the closing `>` in some cases, so the scanner also needs the trailing source to recognize a generic call. With that adjustment, all your examples and a nested generic call check pass. I’m rerunning the build and existing checks.

Fixed in `src/analyze.ts`: generic call arguments no longer become export names, comparisons still split declarations correctly, and arrow function types preserve generic nesting.

Verified all supplied examples plus nested generics. Build, type checking, lint, and all 189 existing tests pass.
