`parse()` now takes `allowMultiple`. All 98 tests pass, including a new one for the option. `tsc --noEmit` reports one error, a TS5107 deprecation warning about `esModuleInterop` in `tsconfig.json`. I didn't touch that file, so it was already there.

- **With `allowMultiple: true`:** a name that appears more than once maps to an array of all its values in order, and a name that appears once stays a plain string. Your two examples and `foo=%1;foo=boo` give `["%1", "boo"]`. Values are decoded the same way as before, including with a custom `decode`.
- **Without the option:** nothing changes, and the first value still wins.
- **Types:** `parse(str, { allowMultiple: true })` returns a new `MultiCookies` type, where each value can be a `string` or `string[]`. Any other call still returns `Cookies`. I exported `MultiCookies` from `src/index.ts`.
- **Where:** the changes are in `src/cookie/parse.ts` and `src/cookie/types.ts`, with the test in `test/cookie-parse.test.ts`.

I didn't commit anything.
