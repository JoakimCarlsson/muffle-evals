I added `genDynamicTypeImport(specifier, name?, options)` in `src/typescript.ts`, next to `genInlineTypeImport`. It's exported through the package index. The tests and `tsc --noEmit` pass.

It returns the forms you described:
- **No name:** `genDynamicTypeImport("pkg", undefined)` returns `typeof import("pkg")`.
- **Valid identifier:** `genDynamicTypeImport("pkg", "foo")` returns `typeof import("pkg").foo`.
- **Not a valid identifier:** `genDynamicTypeImport("pkg", "foo-bar")` returns `typeof import("pkg")["foo-bar"]`.
- **Options:** `comment` and `attributes` render inside the parentheses exactly as `genDynamicImport` renders them. I also pass through the deprecated `assert` option, since `genDynamicImport` still accepts it.

The valid-identifier check is a regex I wrote for this helper (`/^[$A-Z_a-z][\w$]*$/`). I didn't reuse the one in `src/utils.ts` because it rejects names like `foo$` and would bracket them unnecessarily. Reserved words such as `default` still get dot access, since they are valid property names.

I added tests for all five of your examples in `test/typescript.test.ts`, and a README entry with an example.
