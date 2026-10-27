The fix works. Three WPT cases that were listed as expected failures now pass, so I'm removing them from the expected-failures list.

The `url` crate now percent-encodes `^` in paths, so `http://localhost/a^b` parses to `http://localhost/a%5Eb`. `cargo test -p url` passes. I didn't run tests for the other workspace crates.

- **Fix:** I added `^` to the `PATH` encode set in `url/src/parser.rs`. The userinfo and path-segment sets are built from `PATH`, so they inherit it. Userinfo already encoded `^`, so nothing changes there.
- **Test:** I added `test_path_percent_encodes_caret` to `url/tests/unit.rs`.
- **Expected failures:** Three WPT cases that were listed as known failures now pass: two `foo://host/…` and `wss://host/…` path cases, and one `set pathname` case. They made the suite report "unexpected success", so I removed them from `url/tests/expected_failures.txt`.

I didn't commit anything.
