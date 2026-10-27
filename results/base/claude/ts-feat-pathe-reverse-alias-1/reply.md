I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`. The utils tests pass (36 tests) and `tsc --noEmit` is clean.

- **Matching:** it normalizes the aliases with `normalizeAliases` and the path and alias targets with `normalizeWindowsPath`, so `C:\src\foo` matches a `C:/src` target. An alias only matches on a separator boundary or the whole path, so `/rootfoo/a.js` doesn't match `"~": "/root"`.
- **Trailing `/` aliases:** these behave like `resolveAlias`, so `/src/foo/bar` gives `~/foo/bar` and `/src` gives `~/`.
- **Output:** results are deduplicated, sorted longest first, and `[]` when nothing matches.

I tried your examples as tests. Four of the five are covered as written. The `{ "~/": "/src" }` pair is tested against the existing test aliases instead, which include that entry.

I also added tests for the separator boundary and the Windows path, and added `reverseResolveAlias` to the import example in the README.

I didn't commit anything.
