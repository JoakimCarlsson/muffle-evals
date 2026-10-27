Now add tests and update the README.

I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, next to `resolveAlias`. The utils tests pass (37 tests) and `tsc --noEmit` reports no errors.

It matches your spec:
- **Alias map:** it takes the map through `normalizeAliases` and normalizes Windows paths, as `resolveAlias` does.
- **Matching:** an alias target only matches when the whole path equals it or the next character is a `/`. For example, `/rootless/a` doesn't match `"@": "/root"`.
- **Trailing slash:** an alias ending in `/` behaves as in your examples, so `/src/foo/bar` gives `~/foo/bar` and `/src` gives `~/`.
- **Result:** it returns every aliased form, longest first, and `[]` when nothing matches.

If two aliases produce the same string, the result lists it once.

I added tests in `test/utils.spec.ts` covering all five of your examples, the separator boundary and a Windows-path case. I also added the new function to the import line in the README's `pathe/utils` snippet.

I didn't commit anything.

That notification is for the first command I ran, which hung because of a stray `cat >> /dev/null` I'd left in it waiting on stdin. It was stopped at its time limit, and I won't restart it.

Its edit to `src/utils.ts` had already been applied before it hung. I confirmed that with `git status` and a grep for `reverseResolveAlias`, and I ran the test and README edits separately afterward. The utils tests pass (37 tests) and `tsc --noEmit` reports no errors, so there's nothing left to redo.
