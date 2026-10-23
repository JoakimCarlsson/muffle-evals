Tracing the CST: the blank line becomes its own item. Reading the flow-collection start handler next.

Adding a regression test, then running the suite.

Done. In `src/parse/parser.ts` `blockMap`, a flow collection key no longer gets a second item after a blank or comment line. I added a regression test in `tests/doc/parse.ts` that covers both cases.

All 956 tests pass. The `json-test-suite` and `yaml-test-suite` files fail to load because their submodule directories are missing here, so they didn't run. I didn't run your Example 2.11 file directly.
