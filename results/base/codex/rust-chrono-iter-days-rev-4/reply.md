I’ll check both iterators’ range handling, fix reverse iteration, and add regression tests for reversed windows and mixed front/back calls.

Both iterators use one cursor, so `next_back()` walks backward from the start instead of consuming the far end of the forward range. I’ll give each iterator a remaining count and include the final reachable date. The examples and boundary tests also need updating to reflect the corrected reverse behavior.

The regression tests pass for both iterators. Reverse iteration now consumes the same range as forward iteration, and `len()` stays accurate when calls alternate between ends. I also added constant-time backward skipping so `.take(7).rev()` doesn’t walk through millions of dates.

The updated iterator documentation examples pass. The full documentation suite has three failures involving deprecated calls in unrelated month-arithmetic examples.

Fixed `iter_days` and `iter_weeks` so both ends consume the same range and stop when they meet. Lengths now include the final reachable date, and `.take(7).rev()` works efficiently.

Added regression tests and updated documentation examples.

Validation: all 290 unit tests, both iterator doctests, and the no-default-features check pass. The full doctest suite has three unrelated deprecated-call failures in month-arithmetic examples.
