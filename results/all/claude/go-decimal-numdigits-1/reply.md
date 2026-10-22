Done. The cause was `math.Log10` returning slightly under 15 for 1e15 in the int64 fast path. I replaced it with an exact integer digit-count loop in `decimal.go`.

Your three cases and a few edge cases (0, negatives, min int64) matched in a temporary test, which I removed. The existing tests pass. I did not add a permanent regression test.
