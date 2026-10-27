I’ll check the path encoding set, add the caret, and run the relevant tests.

The shared path encoding set was missing `^`. Adding it also fixes path setters and segment insertion, and should resolve three existing web-platform test failures. The regression test covers those APIs, plus query, fragment, and opaque-path behavior.

Fixed the path percent-encode set to include `^`, so parsing `http://localhost/a^b` now produces `http://localhost/a%5Eb`.

Added regression coverage for parsing, relative resolution, path setters, and segment insertion. Removed three now-passing web-platform tests from the expected-failures list.

Validation: `cargo test -p url`, formatting, and diff checks all pass.
