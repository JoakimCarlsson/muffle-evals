Those three tests now pass, so I'll remove them from the expected-failures list.

The `url` crate now percent-encodes `^` in paths, so parsing `http://localhost/a^b` gives `http://localhost/a%5Eb`, matching WHATWG. The full test suite passes. I didn't commit anything.

- **Fix:** I added `^` to the `PATH` percent-encode set in `url/src/parser.rs`. The userinfo and path-segment sets are built from it.
- **Test list:** three WPT cases that exercise `^` in paths used to fail. They now pass, so I removed them from `url/tests/expected_failures.txt`, which the test run requires.

I didn't add a new test for `a^b`. The newly passing WPT cases already check this behaviour.
