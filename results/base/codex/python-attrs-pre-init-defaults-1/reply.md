I’ll check how attrs builds the pre-init call, fix the argument forwarding, and add a regression test for defaults and factories.

The pre-init call was reusing parameter declarations such as `val2=100`, which passed the default instead of the current value. It now forwards parameter names. The regression test covers positional and keyword calls, omitted defaults, factories, and aliases.

Fixed pre-init forwarding so defaulted positional parameters receive the values passed to `__init__`.

Added regression coverage for positional and keyword calls, factories, omitted defaults, and aliases.

Validation: 1,339 tests passed. Four packaging tests failed because the environment lacks installed attrs package metadata.
