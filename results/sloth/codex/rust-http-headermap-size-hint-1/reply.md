I’ll check the shared iterator logic and existing tests, fix the lower bound, and run the build and test suite.

The lower bound counts the current header even after its last value has been yielded. The same bug affects `iter_mut`, and both value iterators delegate to these implementations. I’ll fix both and add one regression test covering empty maps, multiple headers, duplicate values, and exhaustion. No API, dependency, or configuration changes are needed.

Fixed the lower bound in `iter()` and `iter_mut()`, which also fixes `values()` and `values_mut()`. Exhausted iterators now report a lower bound of zero.

Added regression coverage for empty maps, single headers, multiple headers, duplicate values, and exhaustion.

Validation: all 415 tests passed; build and formatting checks passed.
