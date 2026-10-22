Export the new type; the tsc error is a pre-existing config issue, so I'll check types with the flag silenced.

`parse()` now accepts `allowMultiple: true`. The test suite passes (100 tests), and `tsc` reports no errors in `src/` or in `test/cookie-parse.test.ts`. The type-check needed `--ignoreDeprecations 6.0`, because the repo's `tsconfig.json` has a deprecated `esModuleInterop=false` setting that stops plain `tsc` before it checks anything. `tsc` also reports errors in `test/split-cookies-string.test.ts`; I didn't touch that file.

- **Behaviour:** both of your examples give the results you listed, including `foo=%1;foo=boo` → `["%1", "boo"]`. Names that appear once stay plain strings. Without the option, the first value still wins.
- **Return type:** an overload makes `parse(str, { allowMultiple: true })` return a new `MultiCookies` type, `Record<string, string | string[] | undefined>`. Other calls still return `Cookies`. `MultiCookies` is exported from `src/index.ts`.
- **Undefined from `decode`:** a custom `decode` can return `undefined`. With the option on, those values are left out of the array rather than pushed in.
- **Tests:** I added tests for your two examples, the decoding case and the default first-wins behaviour.

The changes are in `src/cookie/parse.ts`, `src/cookie/types.ts`, `src/index.ts` and `test/cookie-parse.test.ts`. I haven't committed anything.
