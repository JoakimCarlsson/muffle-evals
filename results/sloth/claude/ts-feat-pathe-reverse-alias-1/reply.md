I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`, and added it to the import line in the README.

It handles the alias map the way `resolveAlias` does:
- **Normalization:** it runs the map through `normalizeAliases` and normalizes Windows paths.
- **Matching:** a target only matches on a separator boundary or the whole path, so `/rootx/a` doesn't match `/root`.
- **Trailing slash:** it handles aliases ending in `/`. A path equal to the target returns the alias as written, so `~/` gives `~/` and `~` gives `~`.
- **Order:** results are sorted longest first, and no match returns `[]`.

I ran all five of your examples, plus the `/rootx/a` boundary case, in a throwaway spec, and they all pass. I deleted that spec afterwards, and I didn't add permanent tests since you didn't ask for any. The existing suite (362 tests), `eslint` and `tsc --noEmit` all pass.

I haven't committed anything.
