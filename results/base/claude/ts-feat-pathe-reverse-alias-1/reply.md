I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`. The utils tests pass (37), including your five examples and a case with a Windows path. `tsc --noEmit` is clean.

It follows the rules you listed:
- **Alias map and path:** it runs the aliases through `normalizeAliases` and normalizes the path, and alias targets, as Windows paths first.
- **Matching:** a target matches only when it equals the whole path or ends at a `/`. So `/rootless/a.js` doesn't match `"~": "/root"`.
- **Trailing `/`:** aliases that end in `/` work like they do in `resolveAlias`. `/src/foo/bar` with `"~/": "/src"` gives `~/foo/bar`, and `/src` gives `~/`.
- **Results:** it removes duplicates, sorts longest first, and returns `[]` when nothing matches.

I also added tests in `test/utils.spec.ts` and put `reverseResolveAlias` in the README's `pathe/utils` import example. I didn't commit anything.
