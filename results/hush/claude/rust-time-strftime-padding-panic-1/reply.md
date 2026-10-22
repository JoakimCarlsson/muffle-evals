Compiles. Quick check of behavior.

Done. `"%_"`, `"%-"` and `"%0"` now return `Expected { what: "valid escape sequence", index: 2 }` instead of panicking. The fix is in `strftime.rs`. I checked it with a throwaway test, since deleted, but added no permanent regression test.
