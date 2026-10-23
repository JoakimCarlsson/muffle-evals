Fixing a lint error in my new test, then I'll re-run the checks.

I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`. ESLint, `tsc --noEmit` and the full test suite (366 tests) pass. I didn't commit anything.

- **Alias handling:** It normalizes the aliases with `normalizeAliases` and the path with `normalizeWindowsPath`, and it normalizes each alias target the same way.
- **Matching:** A target matches only when it equals the whole path or ends at a `/` boundary. So `/rootfoo/a` does not match `@: /root`.
- **Trailing-slash aliases:** For an alias like `~/`, `/src/foo/bar` gives `~/foo/bar` and `/src` gives `~/`.
- **Output:** Results are sorted longest first, and no match gives `[]`.

I added a `reverseResolveAlias` block to `test/utils.spec.ts`. It covers your five examples, the boundary case above and a Windows path (`C:\src\foo` → `~win/foo`).
