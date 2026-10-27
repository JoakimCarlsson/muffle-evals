I’ll check how attrs generates the pre-init call, fix the argument forwarding, and add a regression test for defaults and factories.

The generated pre-init call was reusing signature entries such as `value=100`, which passed the default instead of the caller’s value. It now forwards argument names. All 265 tests in `test_make.py` pass, including the new cases for positional and keyword arguments, defaults, factories, and aliases.

Fixed pre-init argument forwarding so explicit values for defaulted attributes and factory fields reach `__attrs_pre_init__`.

Added regression coverage for positional and keyword calls, omitted defaults, factories, and aliases.

Validation: 1,340 tests passed. Four packaging tests failed because this environment lacks installed `attrs` package metadata.
