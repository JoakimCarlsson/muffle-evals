The first call failed on the tool name, so I'll rerun the edit.

Switch to `test`, fix lint issues.

Move the helper to the outer scope.

`isDeepEqual` now treats a null-prototype object like a plain object, so both of your examples return `true`. The `isDeepEqual` tests, `tsc` and `eslint` all pass.

**Cause:** the prototype check compared `Object.getPrototypeOf` results directly. `null` never equals `Object.prototype`, so the comparison returned `false` straight away.

**Fix:** in `packages/remeda/src/isDeepEqual.ts`, a small `getPrototype` helper maps a `null` prototype to `Object.prototype` before the comparison.

- **Argument order and nesting:** it works in either argument order and when the objects are nested, because the comparison is recursive.
- **Class instances:** instances of different classes are still unequal, as are a null-prototype object and an array or `Map`.

**Tests:** I added tests in `isDeepEqual.test.ts` covering both orders, nesting, differing contents, and the class, array and `Map` cases.

I haven't committed anything.
