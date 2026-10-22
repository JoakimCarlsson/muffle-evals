Done. I added `genDynamicTypeImport` to `src/typescript.ts` and a README entry. It's exported through the existing `export *`.

I ran all five of your examples and each produced the expected string. `tsc` is clean and the 54 existing tests pass. I added no tests, since you didn't ask for any.

One difference from `genObjectKey`: a bare digit like `"1"` gets bracket access here, because `typeof import("pkg").1` isn't valid.
