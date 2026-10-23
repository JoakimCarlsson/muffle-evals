`parse()` now takes `allowMultiple`. With it on, a name that appears more than once maps to an array of its decoded values in order, and names that appear once stay plain strings. Both of your examples and the `foo=%1;foo=boo` case give the results you listed. I added tests for these, and all 100 tests pass.

Without the option, the first value still wins. `tsc --noEmit` reports one error, a deprecation warning about `esModuleInterop` in `tsconfig.json`. I didn't touch that file, and I haven't confirmed whether the error predates my change.

For the return type, `parse()` has an overload. Passing `{ allowMultiple: true }` returns the new `MultiCookies` type (`Record<string, string | string[] | undefined>`). Any other call still returns `Cookies`. I exported the new `MultiCookies` and `CookieParseMultipleOptions` types from `src/index.ts`.

`allowMultiple` is also accepted by `parseSetCookie()` because it shares the options type, but it has no effect there. I didn't update the README, since it doesn't mention the existing options for `parse()`.

The code changes are in `src/cookie/parse.ts` and `src/cookie/types.ts`, and the tests are in `test/cookie-parse.test.ts`. I haven't committed anything.
