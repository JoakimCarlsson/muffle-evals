I’ll check the shared path encode set and its callers, make the smallest fix, then build and run the existing tests.

The shared `PATH` set covers parsing, relative URL resolution, path setters, and file-path conversion. Existing fixtures already expect `%5E`; three entries mark those cases as known failures. I’ll add the caret to `PATH` and remove those entries. No new APIs, dependencies, or tests are needed.

Fixed the shared path percent-encode set to include `^`, so `http://localhost/a^b` becomes `http://localhost/a%5Eb`.

Removed three known-failure entries for existing tests that now pass.

Validation: workspace build and tests passed; `git diff --check` passed.
