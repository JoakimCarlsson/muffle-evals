I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`. The vitest suite for `test/utils.spec.ts` passes, including your examples. I couldn't type-check, because `npx tsc --noEmit` only printed an npm notice and no result. I haven't committed anything.

- **Matching:** It normalizes the path with `normalizeWindowsPath` and the aliases with `normalizeAliases`, and it also normalizes each alias target. A target matches only if it equals the whole path or ends at a `/` boundary, so `/rootless/a.js` doesn't match `@: /root`.
- **Trailing `/`:** An alias ending in `/` joins the rest of the path without doubling the slash. `/src/foo/bar` gives `~/foo/bar` and `/src` gives `~/`.
- **Result:** Matches are sorted longest first, and no match gives `[]`.

I added tests for your five examples, the `/rootless` boundary case and a Windows path (`C:\src\foo` → `~win/foo`). I also added `reverseResolveAlias` to the import line in the README's "Extra utilities" section.
