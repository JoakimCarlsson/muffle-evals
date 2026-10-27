I’ll inspect the lexer, LALR parser, and standalone generator, then add scanning and focused tests for the requested behavior.

The interactive LALR parser can check candidate prefixes without running transformer reductions or copying their values. I’ll retain the accepted tokens and build the longest match from them, keeping callback results attached to the tokens that produced them. Trying each candidate offset also prevents an ignored span from hiding a match inside it.

The focused tests pass for the matching examples, slice positions, parser options, callbacks, non-copyable transformer values, and standalone output. One subtlety surfaced: `ConfigurationError` inherits from `ValueError`, so scanning must explicitly propagate it instead of treating it as token rejection.

Implemented `Lark.scan()` and generic, value-comparable `ScanMatch`, including standalone support and preservation of token end positions through deepcopy and pickle.

Validation: compilation and 1,282 tests passed; 134 skipped. Static type checks weren’t run because mypy isn’t installed.

No additional scan options added.
