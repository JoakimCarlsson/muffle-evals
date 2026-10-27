I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`. The utils tests pass, including new ones for your examples. The type-check printed nothing. I didn't run the rest of the repo's tests or lint.

- **Alias handling:** it normalizes the aliases with `normalizeAliases` and the path with `normalizeWindowsPath`, as `resolveAlias` does. It also normalizes each alias target.
- **Matching:** a target matches only on a `/` boundary or the whole path, so `/rootless/x` doesn't match `"~": "/root"`.
- **Trailing slash:** an alias ending in `/` drops the duplicate separator, so `/src/foo/bar` gives `~/foo/bar` and `/src` gives `~/`.
- **Result:** every match comes back sorted longest first, and no match returns `[]`.

The tests are in `test/utils.spec.ts` and cover all five of your examples. They also cover a Windows-style path and the separator boundary.

I used `prettier --write` on both files, so check the diff for formatting changes beyond the new code.

I haven't committed anything.
