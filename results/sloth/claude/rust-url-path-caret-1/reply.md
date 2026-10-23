Those three WPT cases are now passing, so I'm removing them from the expected-failures list.

The `url` crate now percent-encodes `^` in paths, so `http://localhost/a^b` parses to `http://localhost/a%5Eb`. The full `cargo test` run passes.

- **Fix:** I added `^` to the `PATH` encode set in `url/src/parser.rs`. Path segments and `set_path` pick it up from there. The `USERINFO` set already encoded `^`.
- **Test:** I added `path_caret_is_percent_encoded` in `url/tests/unit.rs`. It covers a special scheme, a non-special scheme and `set_path`.
- **WPT expected failures:** three web-platform-test cases that failed because of the missing `^` now pass. I removed them from `url/tests/expected_failures.txt`, since the harness treats an unexpected success as a failure.
