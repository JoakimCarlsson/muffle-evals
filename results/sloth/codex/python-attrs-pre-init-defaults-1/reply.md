I’ll check how attrs generates the pre-init call, fix the argument forwarding, and add a regression test.

The pre-init call reuses parameter declarations such as `val2=100`, so Python treats the defaults as keyword arguments. The fix is in the shared initializer generator, which serves both `__init__` and `__attrs_init__`; the existing test file is the only other place that needs changing. No signatures, exports, fixtures, or configuration need changes.

I’ll test positional and keyword values, omitted defaults, factory fields, aliases, and keyword-only fields, preserving the existing behavior for omitted factory arguments.

Fixed the shared initializer generator so `__attrs_pre_init__` receives supplied values instead of default expressions.

Added regression coverage for positional and keyword arguments, omitted defaults, factories, aliases, and keyword-only fields.

Validation: 1,343 tests passed, 5 skipped, 3 expected failures. Wheel build succeeded.
