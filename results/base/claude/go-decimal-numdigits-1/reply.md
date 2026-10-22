`NumDigits` now returns the exact digit count for your three examples, and the full test suite passes. I didn't confirm that the new test fails on the old code. My attempt to check that stashed the test along with the fix, so the check proved nothing.

The old code counted digits for coefficients up to 2^53 with `math.Log10`. For an exact power of ten like 10^15, `Log10` can come out just under 15, so the count came back one too low. That is why `1000000000000000E20` gave 15 instead of 16.

In `decimal.go`, any coefficient that fits in 63 bits is now counted by repeated integer division, with no floating point. That also covers negative values. Larger coefficients still use the existing bit-length estimate, which the code already corrects by comparing against a power of ten.

I added `TestDecimal_NumDigitsPowersOfTen` to `decimal_test.go`. It covers your three inputs, values around the 2^53 and int64 boundaries, a negative case and zero. It also checks 10^i, 10^i − 1 and −10^i for i from 0 to 79 against `len(Coefficient().Text(10))`.

I haven't committed anything.

That notification is about my earlier `go test ./...` run, which was stopped at its background time limit. It doesn't change anything.

That run was a throwaway attempt, and I deleted its scratch test file `nd_test.go`. I later ran the full suite with `timeout 100 go test .`, and it passed in 4.2s. The fix in `decimal.go` and the new test in `decimal_test.go` are in place and uncommitted. I don't need to restart the stopped run.
