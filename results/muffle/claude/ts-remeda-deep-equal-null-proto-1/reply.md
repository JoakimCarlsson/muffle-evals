Tests pass; I'm tidying lint warnings in my new tests.

`isDeepEqual` now treats a null-prototype object like a plain object, so both of your examples return `true`. This holds in either argument order and when the objects are nested. The `isDeepEqual` tests, the type check and eslint all pass, apart from one remaining eslint warning in my new test (below). I didn't run the rest of the suite.

The prototype check in `packages/remeda/src/isDeepEqual.ts` now treats a `null` prototype as `Object.prototype`. Instances of different classes still compare as unequal, and so does a null-prototype object against a class instance, an array or a `Map`.

I added tests in `isDeepEqual.test.ts` for:
- null-prototype against plain, in both orders
- null-prototype against null-prototype
- nested cases
- differing contents
- null-prototype against a class instance

One eslint warning remains in the new tests. The `Foo` class in the class-instance test has a property with no accessibility modifier, and I left it as is. I haven't committed anything.
