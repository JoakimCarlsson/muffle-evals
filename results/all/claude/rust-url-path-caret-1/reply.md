Backtick was already in FRAGMENT; revert that redundancy and add a test.

Unexpected successes are expected-failure entries that now pass; update that list.

I deleted a wrong line (second sed shifted). Restore it.

Done. `^` added to `PATH` in `url/src/parser.rs`; `a^b` now gives `a%5Eb`. Added a test, removed 3 now-passing entries from `expected_failures.txt`; all tests pass.
