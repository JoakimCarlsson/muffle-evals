I’ll check the prototype comparison and existing tests, then update `isDeepEqual` to treat null-prototype objects like plain objects while preserving class-instance checks.

The fix passes the regression tests in both argument orders, including nested objects and `querystring.parse` results. I also changed the key check to require own properties: inherited names such as `toString` could otherwise cause asymmetric results. Class instances still require matching prototypes.

Fixed `isDeepEqual` to compare null-prototype and plain objects by contents, in both argument orders and when nested. Different class prototypes remain unequal.

Added regression coverage for `querystring.parse`, curried calls, nested collections, and inherited property names.

Validation passed: full runtime suite, 84 focused tests, TypeScript check, ESLint, and formatting.
