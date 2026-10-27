I’ll inspect the lexer and LALR parser interfaces, implement scanning and standalone support, then test the requested behavior.

The interactive LALR parser can check valid endpoints without running the transformer. I’ll use that to find the longest match, then build its value from the selected tokens. This avoids copying transformer values and preserves source positions.

The new tests cover match recovery, keyword typing, slice positions, nullable rules, callbacks, transformer values that cannot be copied, and standalone output. I also caught that `ConfigurationError` inherits from `ValueError`; callback rejection handling now lets it propagate. The broader parser tests are running.

The project test runner passed: 1,283 tests, with 134 skipped. Scanning is now documented and included in that runner. I added static typing cases too, but couldn’t run them because `mypy` isn’t installed.

Implemented `Lark.scan()` and exported generic `ScanMatch`, including standalone support, callback handling, absolute slice positions, and token copy/pickle fixes. Added documentation and regression tests.

Validation: 1,283 tests passed, 134 skipped. Static typing checks couldn’t run because `mypy` isn’t installed.
