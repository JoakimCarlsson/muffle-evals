I’ll check the prototype comparison and its callers, then make the smallest fix that preserves class-instance distinctions.

The fix belongs in the shared recursive implementation, so it will cover both argument orders, nested values, curried calls, and `hasSubObject`. I’ll treat `null` and `Object.prototype` as equivalent during the prototype check; other prototypes will still have to match. No exports, fixtures, config, or caller changes are needed. I’ll keep this to the fix and run the existing tests without adding new ones.

Fixed `isDeepEqual` to treat null-prototype objects like plain objects, including both argument orders, curried calls, and nested values. Different class prototypes still compare unequal.

Validation passed: build, TypeScript check, all 305 existing test files, and manual checks using `querystring.parse`.
