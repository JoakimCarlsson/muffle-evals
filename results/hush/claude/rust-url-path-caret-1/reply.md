Remove redundant `^` in USERINFO and test.

Tests now pass that were expected-fail; update the expectations list.

Done. Added `^` to `PATH` set in `url/src/parser.rs`, dropped redundant `^` from `USERINFO`, and removed 3 now-passing entries from `tests/expected_failures.txt`. All tests pass.
