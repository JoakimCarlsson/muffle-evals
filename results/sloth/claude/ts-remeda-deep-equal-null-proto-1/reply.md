`isDeepEqual` now treats a null-prototype object like a plain object. The existing tests and the new one pass, and vitest's type check reports no errors. Prettier skipped the test file ("No files matching the pattern"), so I couldn't confirm it matches the repo's formatting. The standalone `tsc` run also failed because there's no tsconfig at that path.

The fix is in `packages/remeda/src/isDeepEqual.ts`. The prototype check now maps a `null` prototype to `Object.prototype` before comparing. Your `querystring.parse` and `Object.create(null)` examples both return `true`, in either argument order and when nested. Two null-prototype objects compare equal to each other as well.

Instances of different classes still compare as unequal. A null-prototype object also still doesn't equal an array or a class instance.

I added a test, "null-prototype objects equal plain objects", to `isDeepEqual.test.ts`. It covers both argument orders, nesting, a differing value, an array, and a class instance.
