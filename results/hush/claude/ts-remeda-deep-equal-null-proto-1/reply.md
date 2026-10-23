Done. `isDeepEqual` now treats null-prototype objects as plain objects, in both argument orders and nested. Tests pass, including new ones for those cases; lint not run.

The fix is in `packages/remeda/src/isDeepEqual.ts`: the prototype check now maps a `null` prototype to `Object.prototype`. Class instances still don't equal null-prototype objects.
