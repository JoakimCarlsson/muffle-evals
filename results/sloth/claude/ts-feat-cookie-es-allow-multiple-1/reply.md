Export the new type too (the tsc error is a pre-existing config deprecation).

`parse()` now takes `allowMultiple: true`, and a repeated name maps to an array of all its values in order. The tests pass, including a new one for your examples. The type-check only reports an existing `esModuleInterop` deprecation error in `tsconfig.json`, so I haven't type-checked the new overloads with `tsc`.

- **Behaviour:** Names that appear once stay plain strings. Values are decoded exactly as before, so `foo=%1;foo=boo` gives `["%1", "boo"]`. Without the option, the first value still wins.
- **Types:** `parse` has an overload, so passing `allowMultiple: true` returns the new `CookiesMultiple` type (values can be `string | string[]`). Calls without it keep returning `Cookies`, so existing callers' types don't change. `CookiesMultiple` is exported from the package.
- **Files changed:** `src/cookie/parse.ts`, `src/cookie/types.ts` and `src/index.ts`, plus the test in `test/cookie-parse.test.ts`.

I didn't commit anything.
