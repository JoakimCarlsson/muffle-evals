I’ll check how the iterator tracks its position, fix the lower bound, and add a regression test.

The lower bound still counts the current header after its last value has been yielded. The same issue affects `iter_mut`, and therefore `values` and `values_mut`. I’ll fix both underlying iterators and test all four with empty maps, single values, and repeated header values.

Fixed the lower bound to exclude the current header once its values are exhausted. This fixes `iter`, `iter_mut`, `values`, and `values_mut`.

Added regression coverage for empty maps, single values, repeated values, and exhausted iterators.

Validation: all 415 tests passed; formatting and diff checks passed.
