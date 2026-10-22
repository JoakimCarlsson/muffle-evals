Tests pass. I'm now fixing the lint errors in my changes.

Two lint items remain in the test; fixing them.

`isDeepEqual` now treats a null-prototype object as a plain object, so both examples from your report return `true`. The `isDeepEqual` tests pass, along with the type tests and eslint. I did not run the rest of the suite.

The prototype check in `packages/remeda/src/isDeepEqual.ts` compared prototypes by reference, so `null` never matched `Object.prototype`. It now uses a small helper, `getComparablePrototype`, that maps a `null` prototype to `Object.prototype` before comparing. That covers both argument orders and nested values, and the comparison after the check is unchanged.

Class instances of different classes still compare unequal. A null-prototype object also still doesn't equal an array, a `Map` or a class instance.

I added tests in `isDeepEqual.test.ts` for these cases:
- Comparison against a plain object in both orders, and null-prototype against null-prototype.
- A null-prototype object nested inside an array inside an object.
- Different contents compare unequal.
- Class instances, arrays and `Map`s compare unequal.

I didn't commit anything.
