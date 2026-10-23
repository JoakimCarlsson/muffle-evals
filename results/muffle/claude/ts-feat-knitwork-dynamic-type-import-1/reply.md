Tests pass; I'm now running the type-check, since the earlier `tsc` call only printed an npx notice.

I added `genDynamicTypeImport(specifier, name?, options)` in `src/esm.ts`, right after `genDynamicImport`. It's exported from the package index. Vitest (61 tests), `tsc`, eslint and prettier all pass.

- **No name:** `genDynamicTypeImport("pkg", undefined)` returns `typeof import("pkg")`.
- **Valid identifier:** `"foo"` gives `typeof import("pkg").foo`. Reserved words like `default` also use dot access.
- **Anything else:** `"foo-bar"` gives `typeof import("pkg")["foo-bar"]`.
- **Options:** it accepts only `comment` and `attributes`, and renders them through `genDynamicImport`, so the output matches your examples.

The existing `VALID_IDENTIFIER_RE` in `utils.ts` accepts a lone digit, so `.5` would have come out as invalid TypeScript. I added a separate identifier check in `esm.ts` instead.

I added tests in `test/esm.test.ts` covering each of your examples, plus `default` and `1a`. I also added a README entry by hand and didn't run `automd`, so it may regenerate slightly differently. I haven't committed anything.
