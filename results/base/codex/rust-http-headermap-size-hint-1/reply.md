I’ll inspect the iterator’s state tracking, fix the lower bound, and add a regression test.

The iterator still points at the current header after yielding its last value, but `size_hint` keeps counting that header. The same issue affects `iter_mut`, and therefore `values` and `values_mut`. I’ll fix both calculations and test them through exhaustion.

Fixed `size_hint` to exclude the current header once its values are exhausted. This corrects `iter`, `iter_mut`, `values`, and `values_mut`.

Added regression coverage for empty maps, single values, multiple headers, and repeated values, checking bounds through exhaustion.

Validation passed: `cargo test`, `cargo fmt --check`, and `git diff --check`.
