I’ll check `isDeepEqual` and its tests, then update the prototype comparison to support null-prototype objects while preserving class-instance checks.

The regression tests pass for both argument orders, nested values, and curried calls. The prototype exception is limited to `null` and `Object.prototype`. I also changed the key check to require own properties, so inherited names such as `toString` cannot produce a false match. I’m finishing lint and type checks.

Fixed `isDeepEqual` to compare null-prototype objects and plain objects by contents, in both argument orders and when nested. Different class prototypes remain distinct.

Added regression tests for querystring results, curried calls, unequal contents, and inherited property names.

Validation passed: 80 runtime/type tests, TypeScript check, lint, and formatting.
