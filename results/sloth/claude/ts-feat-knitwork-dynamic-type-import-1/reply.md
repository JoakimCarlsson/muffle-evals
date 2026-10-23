`genDynamicTypeImport(specifier, name?, options)` is now exported from `src/esm.ts`, next to `genDynamicImport`. The full test suite passes (61 tests), and `tsc` and `eslint` report nothing. I haven't committed anything.

- **No name:** `genDynamicTypeImport("pkg")` gives `typeof import("pkg")`.
- **Valid identifier:** `genDynamicTypeImport("pkg", "foo")` gives `typeof import("pkg").foo`. `default` is also emitted as `.default`.
- **Not a valid identifier:** `genDynamicTypeImport("pkg", "foo-bar")` gives `typeof import("pkg")["foo-bar"]`. Names that start with a digit, like `1a`, are bracketed too.
- **Options:** it takes `comment` and `attributes` and renders them exactly as `genDynamicImport` does. Your two examples produce the expected output. The deprecated `assert` option is accepted as well.
- **Types:** `wrapper` and `interopDefault` are left out of the options type, since they make no sense for a type.

I wrote a separate identifier check instead of reusing `genObjectKey`. Its regex accepts a lone digit like `1`, which would give the invalid `.1`.

I added tests for the cases above in `test/esm.test.ts` and an entry in the README.
