The `url` crate now percent-encodes `^` in paths, so `http://localhost/a^b` parses to `http://localhost/a%5Eb`. The `url` crate's tests pass. I didn't add a new test or run the other workspace crates' tests.

- **Fix:** I added `^` to the `PATH` set in `url/src/parser.rs:23`. The userinfo and path-segment sets are built from `PATH`, so they pick it up too. Userinfo already encoded `^`.
- **Expected failures:** Three WPT cases that previously failed on the `^` difference now pass, so the test harness flagged them as unexpected successes. I removed them from `url/tests/expected_failures.txt`. They cover the `foo://host/…` and `wss://host/…` path cases and the `a:/` set-pathname case.

I haven't committed anything.
