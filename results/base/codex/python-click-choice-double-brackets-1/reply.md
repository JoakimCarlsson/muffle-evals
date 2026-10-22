I’ll check how argument metavars are formatted, fix the extra brackets, and add regression coverage for both types.

The fix removes the redundant brackets while preserving required argument formatting and deprecated argument markers. Regression coverage is in place for `Choice` and `DateTime`; the full test suite is running now.

Fixed optional `Choice` and `DateTime` arguments to show one pair of brackets, including `[foo|bar|baz]...`. Required argument formatting stays unchanged.

Added regression tests and a changelog entry. Full suite: 1,666 passed. Ruff checks couldn’t run because Ruff isn’t installed.
