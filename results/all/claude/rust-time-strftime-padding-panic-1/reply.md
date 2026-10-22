Unrelated feature gap; build lib only.

Done. `"%_"`, `"%-"` and `"%0"` now return `Expected { what: "valid escape sequence" }` at the missing component's index (byte 2 for these inputs). The change is in `strftime.rs`. The library builds. I didn't run the repro or the test suite: the test target fails to compile with these features (`rstest` attribute not found).
