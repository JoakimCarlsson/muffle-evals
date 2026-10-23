Remove now-redundant `.add(b'^')` in USERINFO (harmless; leave). Add test.

Done. Added `^` to `PATH` in `url/src/parser.rs:23`. Added `path_percent_encodes_caret` test and removed 3 now-passing entries from `tests/expected_failures.txt`. `cargo test` in `url/` passes.
