ParseInt returns the clamped value on range error; force 0.

Done. Added `ParseComma` and `ParseCommaf` to `comma.go`, with tests in `parsecomma_test.go`. Tests pass.

Both reject misplaced commas, so `"1,23"` errors. `ParseCommaf` also takes `NaN`, `+Inf` and `-Inf`, since `Commaf` can output them. Nothing is committed.
