I’ll check how attrs generates the pre-init call, fix the argument forwarding, and add a regression test for defaults and factories.

The generated pre-init call reused the parameter declarations, so `val2=100` passed the default explicitly. It now forwards parameter names only. The regression tests pass for positional arguments, keyword arguments, and omitted defaults; the full suite is running.

Fixed `__attrs_pre_init__` to receive supplied argument values instead of defaults.

Added regression coverage for positional and keyword arguments, omitted defaults, and factories.

Validation: 1,343 tests passed, 5 skipped, 3 expected failures. Ruff was unavailable.
