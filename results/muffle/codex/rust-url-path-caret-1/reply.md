I’ll check the path encoding set, add the missing caret, and run the relevant tests.

The fix makes three existing WHATWG tests pass that were marked as expected failures. I’ll remove those entries. The new regression test also covers parsing, relative URLs, path setters, and path segment insertion.

Fixed the path percent-encode set to include `^`, so `http://localhost/a^b` now becomes `http://localhost/a%5Eb`.

Added regression coverage and removed three expected-failure entries for WHATWG tests that now pass.

Validation: `cargo test -p url` and formatting checks passed.
