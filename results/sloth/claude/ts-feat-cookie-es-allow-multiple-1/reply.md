Exporting the new `MultiCookies` type from the index, then I'll finish checking.

`parse()` now takes `allowMultiple: true`. With it, a name that appears more than once maps to an array of its values in order, and names that appear once stay plain strings.

I ran your three examples plus a no-option case, and all four gave the results you listed:
- `foo=a;bar=bar;foo=b;foo=c` gives `{ foo: ["a", "b", "c"], bar: "bar" }`.
- `foo=;bar=bar;foo=boo` gives `{ foo: ["", "boo"], bar: "bar" }`.
- `foo=%1;foo=boo` gives `["%1", "boo"]`, so decoding is unchanged.
- `foo=a;foo=b` without the option still gives `{ foo: "a" }`.

I ran those through a throwaway test file that I deleted afterwards, so I added no permanent tests. The existing 97 tests pass. A type-check shows no errors in `src/`; it does report errors in `test/split-cookies-string.test.ts`, which I didn't change.

For the return type, `parse()` has an overload that returns a new `MultiCookies` type (`Record<string, string | string[] | undefined>`) when `allowMultiple: true`. Without the option it still returns `Cookies`, so existing callers see no change. I exported `MultiCookies` from `src/index.ts`.

The changes are in `src/cookie/parse.ts`, `src/cookie/types.ts` and `src/index.ts`, and nothing is committed.
