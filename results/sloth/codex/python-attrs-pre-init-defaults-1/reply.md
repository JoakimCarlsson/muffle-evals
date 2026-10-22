I’ll check how attrs generates the pre-init call, fix the argument forwarding, and run the existing tests.

The generator reuses parameter declarations such as `val2=100` in the pre-init call, which passes the default again. I’ll strip defaults from the forwarded arguments, as the code already does for keyword-only arguments.

This shared fix covers both `__init__` and `__attrs_init__`. No callers, fixtures, config, exports, or documentation need changes; I’ll use the existing tests without adding new ones.

The fix is in place and the wheel builds successfully. The test run passed 1,336 tests; four packaging tests failed because attrs has no installed package metadata in this environment. I’ll install the built wheel and rerun the suite.

Fixed in [src/attr/_make.py](src/attr/_make.py:2325). The generated pre-init call now forwards argument values instead of reusing default expressions, including for factory-backed fields.

Wheel build succeeded. Existing tests: **1,340 passed, 5 skipped, 3 expected failures**.
