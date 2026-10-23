Running the new test; target name was wrong, retrying with `--test tests`.

Done. `"%_"`, `"%-"`, `"%0"` now return `Expected { what: "valid escape sequence" }` at the missing component's index (2 for these) instead of panicking. The fix is in `strftime.rs`, and I added `strftime_missing_component_error` to the integration tests. The 46 strftime tests pass; I did not run the full suite.
