I added `genDynamicTypeImport(specifier, name?, options)` in `src/typescript.ts`. It's exported from the package index, so it sits alongside `genDynamicImport`. The tests and `tsc --noEmit` pass.

- **No name:** it returns `typeof import("pkg")`.
- **Valid identifier:** `"foo"` gives `typeof import("pkg").foo`.
- **Anything else:** `"foo-bar"` gives `typeof import("pkg")["foo-bar"]`.
- **Options:** `comment` and `attributes` go through `genDynamicImport`, so they render exactly as you described, for example `typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo` and `typeof import("pkg", { with: { type: "json" } }).foo`.

I used a separate identifier check instead of the one behind `genObjectKey`, because that one accepts a bare digit like `"1"`, which isn't valid after a dot. Names that start with a digit, such as `"1a"`, fall back to bracket form. The check is ASCII-only, so a name with non-ASCII letters also gets the bracket form, which is always valid.

I added tests for all the cases above in `test/typescript.test.ts` and a short entry in the README. I didn't commit anything.
