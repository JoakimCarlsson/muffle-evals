Checking which WPT cases fail after the change.

Those are expected-failure entries now passing. Remove them from the list.

Done. Added `^` to `PATH` set in `url/src/parser.rs:23`, so `a^b` now gives `a%5Eb`. Removed 3 WPT cases from `tests/expected_failures.txt`, because they now pass. All tests pass.
