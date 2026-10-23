Fix lint.

Done. `isDeepEqual` now treats a null-prototype object as `Object.prototype`, so it equals plain objects in both orders and when nested. Class instances and arrays still don't match it. The fix is in `src/isDeepEqual.ts`, with new null-prototype tests in `src/isDeepEqual.test.ts`. The tests, `tsc` and eslint all pass.
