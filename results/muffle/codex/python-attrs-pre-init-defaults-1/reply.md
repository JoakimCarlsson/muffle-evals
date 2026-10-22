I’ll check how attrs generates the pre-init call, fix the argument forwarding, and add a regression test.

The generated pre-init call included default expressions such as `val2=100`, which overrode the supplied values. It now forwards the parameter values. All tests in `test_make.py` pass, including the new cases for positional arguments, keyword arguments, and omitted defaults.

Fixed the generated `__attrs_pre_init__` call to forward supplied argument values instead of default expressions.

Added regression tests for positional arguments, keyword arguments, and omitted defaults, including factory fields.

Validation: 674 tests passed across `test_make.py` and `test_functional.py`, with one skip and one expected failure.
