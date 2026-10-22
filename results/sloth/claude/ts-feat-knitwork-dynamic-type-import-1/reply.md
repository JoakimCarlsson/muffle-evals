I added `genDynamicTypeImport(specifier, name?, options)` next to the other TypeScript helpers in `src/typescript.ts`, and it's exported from the package index. I also added a README entry for it.

A throwaway test (since deleted) confirmed all five of your examples produce exactly the strings you listed. `tsc --noEmit` is clean and the 54 existing tests pass. I didn't add a permanent test for the new helper, since you didn't ask for one.

- **Options:** `options` takes only `comment` and `attributes`. `wrapper` and `interopDefault` make no sense in a type, so they aren't accepted.
- **Identifier check:** It uses its own regex rather than the one behind `genObjectKey`. That regex accepts a lone digit like `"1"`, which would give the invalid `.1`, so `"1"` gets the bracket form instead.
- **Existing helper:** I left `genInlineTypeImport` as it is.
