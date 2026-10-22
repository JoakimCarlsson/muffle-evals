Look at the flow-collection handling at line 765+ and 880+.

Adding regression test to `tests/doc/parse.ts`.

Test bug: `doc.contents` undefined in this version; use `doc.toJS`-style check.

Helper shape mismatch; simplify the assertion.

Done. `src/parse/parser.ts` `blockMap` no longer pushes a spurious empty item when a flow collection starts after a blank or comment line. I added regression tests in `tests/doc/parse.ts`; they fail without the fix and pass with it. All 957 tests pass, but `json-test-suite.ts` and `yaml-test-suite.ts` can't load here (they error on their test-suite directories), so those suites didn't run.
