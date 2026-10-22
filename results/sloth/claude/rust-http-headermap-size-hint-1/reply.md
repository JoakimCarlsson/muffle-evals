I fixed `size_hint` for `HeaderMap::iter` and `iter_mut`. It now reports a lower bound of 0 once the iterator is exhausted. The existing tests pass, and so did a throwaway regression test I wrote and then removed.

The old lower bound was `entries.len() - entry`. That still counted the entry the iterator was on after its values had all been yielded, so it was 1 too high at the end. The new bound counts the entries after the current one, plus 1 only if the current entry still has a value to yield. Both `Iter` and `IterMut` had the same formula, so I changed both in `src/header/map.rs`. `Keys`, `Values` and `ValuesMut` wrap these two, so they are fixed as well.

The throwaway test used a map with a multi-value header, a second header and an empty map. At every step it checked that a lower bound of 1 or more never came with `next() == None`, and that the lower bound was 0 at the end. You asked only for the fix, so I didn't add a permanent test. I haven't committed anything.
