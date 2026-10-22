I’ll check the prototype comparison, update it to handle null-prototype objects, and add regression tests for both argument orders and nested values.

The regression tests reproduced the failure. The fix allows null and plain-object prototypes to compare by contents while preserving prototype checks for classes and built-ins. I also found an inherited-property edge case that could make results differ by argument order, so the comparison now checks for own properties.

Fixed `isDeepEqual` to compare null-prototype objects with plain objects by contents, in both argument orders and when nested. Different class and built-in prototypes remain distinct.

Added regression coverage for `querystring.parse`, curried calls, unequal contents, and inherited-property edge cases.

Validation: all 81 tests in `isDeepEqual.test.ts` pass; ESLint and TypeScript checks pass.
