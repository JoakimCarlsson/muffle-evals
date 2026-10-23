I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`. The tests in `test/utils.spec.ts` pass (36 of 36), and `tsc --noEmit` reports no errors.

It runs the aliases through `normalizeAliases` and normalizes Windows paths, as `resolveAlias` does. It then collects each aliased form, dropping duplicates, and sorts them longest first. It returns `[]` when nothing matches.

- **Separator boundary:** A target only matches the whole path or a prefix that ends on a path separator. `/rootfoo/a.js` does not match `"@": "/root"`.
- **Trailing `/` aliases:**
  - `{ "~/": "/src" }` turns `/src/foo/bar` into `~/foo/bar`.
  - It turns the bare `/src` into `~/`.
  - A Windows path like `C:\src\foo` works against the existing test aliases and gives `~win/foo`.

I added tests covering all five of your examples plus the separator-boundary and Windows cases. I also added `reverseResolveAlias` to the `pathe/utils` import line in the README. Nothing is committed.
