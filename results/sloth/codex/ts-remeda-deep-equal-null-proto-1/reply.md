I’ll check the prototype comparison and existing tests, then make a focused fix that preserves class-instance comparisons.

The change belongs in the shared comparator, with regression coverage in its existing test file. Callers, exports, signatures, fixtures, and config need no changes. I’ll treat `null` and `Object.prototype` as equivalent in the prototype check, while keeping other prototype differences unequal. Tests will cover both argument orders, nesting, curried calls, unequal contents, and class and built-in boundaries.

The fix passes the full test suite, including type tests, and the build succeeds. Lint caught style issues in the new regression test; I’ve corrected them and am rerunning lint, the source type check, and the focused test.

Fixed `isDeepEqual` to treat null-prototype objects like plain objects, in both argument orders, nested comparisons, and curried calls. Different class prototypes remain unequal.

Added regression coverage for both examples and edge cases.

Validation passed: all 305 test files, type checks, build, and lint.
