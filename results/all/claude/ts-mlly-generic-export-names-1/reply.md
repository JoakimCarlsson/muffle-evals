Fixing: regex truncates the captured text before `>()`, so I'm passing a longer lookahead to the scanner.

Done. `src/analyze.ts` now skips generic type args in `_extractExtraNames`, with lookahead past the regex cut. All 5 cases pass, existing tests pass, `tsc` is clean. I added no permanent tests.
