# go-decimal-numdigits

Source: https://github.com/shopspring/decimal/pull/425

## Prompt

> `Decimal.NumDigits` returns an invalid value for some numbers.
> 
> ```go
> for _, s := range []string{
> 	"100000000000000E20",
> 	"1000000000000000E20",
> 	"10000000000000000E20",
> } {
> 	d, err := decimal.NewFromString(s)
> 	if err != nil {
> 		log.Fatal(err)
> 	}
> 	c := d.Coefficient().Text(10)
> 	fmt.Printf("%s: %s %d %d\n", s, d, len(c), d.NumDigits())
> }
> ```
> 
> Output:
> 
> ```
> 100000000000000E20: 10000000000000000000000000000000000 15 15
> 1000000000000000E20: 100000000000000000000000000000000000 16 15
> 10000000000000000E20: 1000000000000000000000000000000000000 17 17
> ```
> 
> For the second number, `len(d.Coefficient().Text(10))` is 16 but `d.NumDigits()` says 15. The documentation doesn't say the result is an estimate, so I'd expect it to return the exact number of digits of the coefficient.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [decimal.go](../../tasks/go-decimal-numdigits/upstream/decimal.go), [decimal_test.go](../../tasks/go-decimal-numdigits/upstream/decimal_test.go)

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..608a12e 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1256,13 +1256,26 @@ func (d Decimal) NumDigits() int {
 	v := d.getValue()
 	if v.IsInt64() {
 		i64 := v.Int64()
-		// restrict fast path to integers with exact conversion to float64
-		if i64 <= (1<<53) && i64 >= -(1<<53) {
-			if i64 == 0 {
-				return 1
-			}
-			return int(math.Log10(math.Abs(float64(i64)))) + 1
+		if i64 == 0 {
+			return 1
+		}
+		// Count digits via the underlying int64 instead of math.Log10,
+		// which rounds an exact 1eN like 1e15 down to 14.999... and would
+		// then under-report by one (see #420). Negation is safe because
+		// math.MinInt64 has IsInt64() true but its absolute value also
+		// needs counting; treat it explicitly.
+		if i64 == math.MinInt64 {
+			return 19
+		}
+		if i64 < 0 {
+			i64 = -i64
+		}
+		n := 0
+		for i64 > 0 {
+			n++
+			i64 /= 10
 		}
+		return n
 	}
 
 	estimatedNumDigits := int(float64(v.BitLen()) / math.Log2(10))
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +10/-7 | 29 | 6,146 | $0.194 |
| claude | muffle | pass | +27/-13 | 6 | 3,130 | $0.123 |
| claude | hush | pass | +17/-7 | 12 | 1,413 | $0.073 |
| claude | sloth | pass | +5/-1 | 5 | 2,163 | $0.076 |
| claude | all | pass | +10/-7 | 6 | 1,642 | $0.078 |
| codex | base | pass | +5/-6 | 38 | 1,374 | - |
| codex | muffle | pass | +5/-6 | 24 | 1,522 | - |
| codex | hush | pass | +5/-6 | 35 | 1,351 | - |
| codex | sloth | pass | +5/-6 | 18 | 1,503 | - |
| codex | all | pass | +5/-6 | 13 | 972 | - |

### claude, base: pass

Files: [decimal.go](../base/claude/go-decimal-numdigits-1/files/decimal.go), [decimal_test.go](../base/claude/go-decimal-numdigits-1/files/decimal_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..2ceb8b5 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1254,15 +1254,18 @@ func (d Decimal) Ln(precision int32) (Decimal, error) {
 // NumDigits returns the number of digits of the decimal coefficient (d.Value)
 func (d Decimal) NumDigits() int {
 	v := d.getValue()
-	if v.IsInt64() {
+	if v.BitLen() <= 63 {
+		// exact integer arithmetic; math.Log10 can be off for exact powers of 10
 		i64 := v.Int64()
-		// restrict fast path to integers with exact conversion to float64
-		if i64 <= (1<<53) && i64 >= -(1<<53) {
-			if i64 == 0 {
-				return 1
-			}
-			return int(math.Log10(math.Abs(float64(i64)))) + 1
+		if i64 < 0 {
+			i64 = -i64
+		}
+		n := 1
+		for i64 >= 10 {
+			i64 /= 10
+			n++
 		}
+		return n
 	}
 
 	estimatedNumDigits := int(float64(v.BitLen()) / math.Log2(10))
diff --git a/decimal_test.go b/decimal_test.go
index 25d95bc..83fb613 100644
--- a/decimal_test.go
+++ b/decimal_test.go
@@ -3962,3 +3962,32 @@ func ExampleNewFromFloat() {
 	//0.123123123123123
 	//-10000000000000
 }
+
+func TestDecimal_NumDigitsPowersOfTen(t *testing.T) {
+	for _, s := range []string{
+		"100000000000000E20", "1000000000000000E20", "10000000000000000E20",
+		"9007199254740993", "9223372036854775807", "9223372036854775808",
+		"-1000000000000000E20", "0",
+	} {
+		d, err := NewFromString(s)
+		if err != nil {
+			t.Fatal(err)
+		}
+		want := len(new(big.Int).Abs(d.Coefficient()).Text(10))
+		if got := d.NumDigits(); got != want {
+			t.Errorf("%s: NumDigits() = %d, want %d", s, got, want)
+		}
+	}
+	for i := 0; i < 80; i++ {
+		p := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(i)), nil)
+		for _, v := range []*big.Int{p, new(big.Int).Sub(p, big.NewInt(1)), new(big.Int).Neg(p)} {
+			if v.Sign() == 0 {
+				continue
+			}
+			d := NewFromBigInt(v, 0)
+			if got, want := d.NumDigits(), len(new(big.Int).Abs(v).Text(10)); got != want {
+				t.Errorf("%s: NumDigits() = %d, want %d", v, got, want)
+			}
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

`NumDigits` now returns the exact digit count for your three examples, and the full test suite passes. I didn't confirm that the new test fails on the old code. My attempt to check that stashed the test along with the fix, so the check proved nothing.

The old code counted digits for coefficients up to 2^53 with `math.Log10`. For an exact power of ten like 10^15, `Log10` can come out just under 15, so the count came back one too low. That is why `1000000000000000E20` gave 15 instead of 16.

In `decimal.go`, any coefficient that fits in 63 bits is now counted by repeated integer division, with no floating point. That also covers negative values. Larger coefficients still use the existing bit-length estimate, which the code already corrects by comparing against a power of ten.

I added `TestDecimal_NumDigitsPowersOfTen` to `decimal_test.go`. It covers your three inputs, values around the 2^53 and int64 boundaries, a negative case and zero. It also checks 10^i, 10^i − 1 and −10^i for i from 0 to 79 against `len(Coefficient().Text(10))`.

I haven't committed anything.

That notification is about my earlier `go test ./...` run, which was stopped at its background time limit. It doesn't change anything.

That run was a throwaway attempt, and I deleted its scratch test file `nd_test.go`. I later ran the full suite with `timeout 100 go test .`, and it passed in 4.2s. The fix in `decimal.go` and the new test in `decimal_test.go` are in place and uncommitted. I don't need to restart the stopped run.

</details>

### claude, muffle: pass

Files: [decimal.go](../muffle/claude/go-decimal-numdigits-1/files/decimal.go), [decimal_test.go](../muffle/claude/go-decimal-numdigits-1/files/decimal_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..f25b3ca 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1254,25 +1254,39 @@ func (d Decimal) Ln(precision int32) (Decimal, error) {
 // NumDigits returns the number of digits of the decimal coefficient (d.Value)
 func (d Decimal) NumDigits() int {
 	v := d.getValue()
-	if v.IsInt64() {
-		i64 := v.Int64()
-		// restrict fast path to integers with exact conversion to float64
-		if i64 <= (1<<53) && i64 >= -(1<<53) {
-			if i64 == 0 {
-				return 1
+	if v.IsUint64() || v.IsInt64() {
+		// exact integer comparison, float64 log10 is not exact for powers of 10
+		u := v.Uint64()
+		if v.Sign() < 0 {
+			u = -uint64(v.Int64())
+		}
+		n := 1
+		for p := uint64(10); u >= p; p *= 10 {
+			n++
+			if p > math.MaxUint64/10 {
+				break
 			}
-			return int(math.Log10(math.Abs(float64(i64)))) + 1
 		}
+		return n
 	}
 
 	estimatedNumDigits := int(float64(v.BitLen()) / math.Log2(10))
+	if estimatedNumDigits < 1 {
+		estimatedNumDigits = 1
+	}
 
-	// estimatedNumDigits (lg10) may be off by 1, need to verify
-	digitsBigInt := big.NewInt(int64(estimatedNumDigits))
-	errorCorrectionUnit := digitsBigInt.Exp(tenInt, digitsBigInt, nil)
-
-	if v.CmpAbs(errorCorrectionUnit) >= 0 {
-		return estimatedNumDigits + 1
+	// the estimate may be off by 1 in either direction, need to verify
+	pow := new(big.Int).Exp(tenInt, big.NewInt(int64(estimatedNumDigits)), nil)
+	for v.CmpAbs(pow) >= 0 {
+		estimatedNumDigits++
+		pow.Mul(pow, tenInt)
+	}
+	for estimatedNumDigits > 1 {
+		pow.Quo(pow, tenInt)
+		if v.CmpAbs(pow) >= 0 {
+			break
+		}
+		estimatedNumDigits--
 	}
 
 	return estimatedNumDigits
diff --git a/decimal_test.go b/decimal_test.go
index 25d95bc..012ff83 100644
--- a/decimal_test.go
+++ b/decimal_test.go
@@ -3156,6 +3156,12 @@ func TestDecimal_NumDigits(t *testing.T) {
 		{"-5.26", 3},
 		{"-5.2663117716", 11},
 		{"-26.1", 3},
+		{"100000000000000E20", 15},
+		{"1000000000000000E20", 16},
+		{"10000000000000000E20", 17},
+		{"-1000000000000000E20", 16},
+		{"9223372036854775808", 19},
+		{"18446744073709551616", 20},
 		{"", 1},
 	} {
 		d, _ := NewFromString(testCase.Dec)
```

</details>

<details><summary>reply</summary>

Fix is in and passes. I'm adding the cases from your report to the existing test table.

`Decimal.NumDigits` now returns the exact digit count of the coefficient. All tests pass, including the three numbers from your report.

**Cause:** the fast path for small coefficients computed `int(math.Log10(x)) + 1` in floating point. On this platform `math.Log10(1e15)` returns `14.999999999999998` instead of `15`, so 10^15 came out as 15 digits instead of 16. Exact powers of ten can hit this.

**Changes in `decimal.go`:**
- **Small coefficients:** any value that fits in 64 bits is now counted with exact integer comparison against powers of ten. There's no float arithmetic, and it also covers values above 2^53 that used to fall through to the big-integer path.
- **Large coefficients:** the bit-length estimate could only be corrected upward, so an overestimate would have gone unnoticed. It now checks and corrects in both directions.

**Tests in `decimal_test.go`:** I added your three inputs, a negative one, and values around the 64-bit boundary to `TestDecimal_NumDigits`. I also ran a temporary check, since deleted, over 10^e−1, 10^e and 10^e+1 for e up to 399, positive and negative, against `len(String())`. All matched.

I didn't commit anything.

</details>

### claude, hush: pass

Files: [decimal.go](../hush/claude/go-decimal-numdigits-1/files/decimal.go), [decimal_test.go](../hush/claude/go-decimal-numdigits-1/files/decimal_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..f94897f 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1254,15 +1254,25 @@ func (d Decimal) Ln(precision int32) (Decimal, error) {
 // NumDigits returns the number of digits of the decimal coefficient (d.Value)
 func (d Decimal) NumDigits() int {
 	v := d.getValue()
-	if v.IsInt64() {
-		i64 := v.Int64()
-		// restrict fast path to integers with exact conversion to float64
-		if i64 <= (1<<53) && i64 >= -(1<<53) {
-			if i64 == 0 {
-				return 1
+	if v.IsUint64() || v.IsInt64() {
+		// math.Log10 is inexact for exact powers of 10, count digits with integers
+		var u uint64
+		if v.IsInt64() {
+			i64 := v.Int64()
+			if i64 < 0 {
+				u = uint64(-i64)
+			} else {
+				u = uint64(i64)
 			}
-			return int(math.Log10(math.Abs(float64(i64)))) + 1
+		} else {
+			u = v.Uint64()
+		}
+		n := 1
+		for u >= 10 {
+			u /= 10
+			n++
 		}
+		return n
 	}
 
 	estimatedNumDigits := int(float64(v.BitLen()) / math.Log2(10))
diff --git a/decimal_test.go b/decimal_test.go
index 25d95bc..d50c082 100644
--- a/decimal_test.go
+++ b/decimal_test.go
@@ -3962,3 +3962,15 @@ func ExampleNewFromFloat() {
 	//0.123123123123123
 	//-10000000000000
 }
+
+func TestDecimal_NumDigitsPowersOfTen(t *testing.T) {
+	for i := 0; i < 60; i++ {
+		v := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(i)), nil)
+		for _, c := range []*big.Int{v, new(big.Int).Sub(v, big.NewInt(1)), new(big.Int).Neg(v)} {
+			d := NewFromBigInt(c, 20)
+			if want := len(new(big.Int).Abs(c).Text(10)); d.NumDigits() != want {
+				t.Errorf("%s: expected %d digits, got %d", c, want, d.NumDigits())
+			}
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

Done. Cause: `math.Log10` inexact on 10^15, fast path in `NumDigits` gave 15. Replaced with integer digit count (`decimal.go`), added `TestDecimal_NumDigitsPowersOfTen`; all tests pass.

</details>

### claude, sloth: pass

Files: [decimal.go](../sloth/claude/go-decimal-numdigits-1/files/decimal.go), [decimal_test.go](../sloth/claude/go-decimal-numdigits-1/files/decimal_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..50d721d 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1261,7 +1261,11 @@ func (d Decimal) NumDigits() int {
 			if i64 == 0 {
 				return 1
 			}
-			return int(math.Log10(math.Abs(float64(i64)))) + 1
+			n := 0
+			for ; i64 != 0; i64 /= 10 {
+				n++
+			}
+			return n
 		}
 	}
 
diff --git a/decimal_test.go b/decimal_test.go
index 25d95bc..6d4a09f 100644
--- a/decimal_test.go
+++ b/decimal_test.go
@@ -3157,6 +3157,11 @@ func TestDecimal_NumDigits(t *testing.T) {
 		{"-5.2663117716", 11},
 		{"-26.1", 3},
 		{"", 1},
+		{"100000000000000E20", 15},
+		{"1000000000000000E20", 16},
+		{"10000000000000000E20", 17},
+		{"999999999999999", 15},
+		{"-1000000000000000", 16},
 	} {
 		d, _ := NewFromString(testCase.Dec)
```

</details>

<details><summary>reply</summary>

Fixed in `decimal.go`: `NumDigits` now returns the exact digit count of the coefficient, so `1000000000000000E20` gives 16. The tests pass.

The bug was in the fast path for coefficients below 2^53. It used `math.Log10`, which isn't exact in Go, so for 10^15 it came out just under 15 and the count was one too low. I replaced it with a plain integer loop that divides by 10 and counts. The big-integer path for larger coefficients is correct, so I left it as it was.

I added your three cases to `TestDecimal_NumDigits`, plus `999999999999999` (15 digits) and `-1000000000000000` (16 digits). I didn't run the benchmarks, so I haven't measured the speed of the loop against the old float calculation.

`gofmt -l` flags `decimal_test.go`, but it already did before my change, so I left the formatting alone.

</details>

### claude, all: pass

Files: [decimal.go](../all/claude/go-decimal-numdigits-1/files/decimal.go), [decimal_test.go](../all/claude/go-decimal-numdigits-1/files/decimal_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..3551c7d 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1255,14 +1255,17 @@ func (d Decimal) Ln(precision int32) (Decimal, error) {
 func (d Decimal) NumDigits() int {
 	v := d.getValue()
 	if v.IsInt64() {
-		i64 := v.Int64()
-		// restrict fast path to integers with exact conversion to float64
-		if i64 <= (1<<53) && i64 >= -(1<<53) {
-			if i64 == 0 {
-				return 1
-			}
-			return int(math.Log10(math.Abs(float64(i64)))) + 1
+		// math.Log10 is inexact near powers of ten, so count with integer division
+		u := uint64(v.Int64())
+		if v.Sign() < 0 {
+			u = -u
+		}
+		n := 1
+		for u >= 10 {
+			u /= 10
+			n++
 		}
+		return n
 	}
 
 	estimatedNumDigits := int(float64(v.BitLen()) / math.Log2(10))
diff --git a/decimal_test.go b/decimal_test.go
index 25d95bc..51273b2 100644
--- a/decimal_test.go
+++ b/decimal_test.go
@@ -3157,6 +3157,12 @@ func TestDecimal_NumDigits(t *testing.T) {
 		{"-5.2663117716", 11},
 		{"-26.1", 3},
 		{"", 1},
+		{"100000000000000E20", 15},
+		{"1000000000000000E20", 16},
+		{"10000000000000000E20", 17},
+		{"-1000000000000000E20", 16},
+		{"9223372036854775807", 19},
+		{"-9223372036854775808", 19},
 	} {
 		d, _ := NewFromString(testCase.Dec)
```

</details>

<details><summary>reply</summary>

Done. In `NumDigits`, the `math.Log10` fast path was inexact near powers of ten. I replaced it with an exact integer-division loop in `decimal.go`. I added your three cases and some int64 edge cases to `TestDecimal_NumDigits`, and the build and tests pass.

The big-int path is unchanged. It checks its own estimate, and I didn't test it beyond your examples.

</details>

### codex, base: pass

Files: [decimal.go](../base/codex/go-decimal-numdigits-1/files/decimal.go), [decimal_test.go](../base/codex/go-decimal-numdigits-1/files/decimal_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..17e5067 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1256,13 +1256,12 @@ func (d Decimal) NumDigits() int {
 	v := d.getValue()
 	if v.IsInt64() {
 		i64 := v.Int64()
-		// restrict fast path to integers with exact conversion to float64
-		if i64 <= (1<<53) && i64 >= -(1<<53) {
-			if i64 == 0 {
-				return 1
-			}
-			return int(math.Log10(math.Abs(float64(i64)))) + 1
+		digits := 1
+		for i64 <= -10 || i64 >= 10 {
+			i64 /= 10
+			digits++
 		}
+		return digits
 	}
 
 	estimatedNumDigits := int(float64(v.BitLen()) / math.Log2(10))
diff --git a/decimal_test.go b/decimal_test.go
index 25d95bc..c5ae8a2 100644
--- a/decimal_test.go
+++ b/decimal_test.go
@@ -603,17 +603,17 @@ func TestNewFromBigRat(t *testing.T) {
 	}
 
 	tests := map[Inp]string{
-		Inp{big.NewRat(0, 1), 16}:                                                     "0",
-		Inp{big.NewRat(4, 5), 16}:                                                     "0.8",
-		Inp{big.NewRat(10, 2), 16}:                                                    "5",
-		Inp{big.NewRat(1023427554493, 43432632), 16}:                                  "23563.5628642767953828", // rounded
-		Inp{big.NewRat(1, 434324545566634), 16}:                                       "0.0000000000000023",
-		Inp{big.NewRat(1, 3), 16}:                                                     "0.3333333333333333",
-		Inp{big.NewRat(2, 3), 2}:                                                      "0.67",               // rounded
-		Inp{big.NewRat(2, 3), 16}:                                                     "0.6666666666666667", // rounded
-		Inp{big.NewRat(10000, 3), 16}:                                                 "3333.3333333333333333",
-		Inp{mustParseRat("30702832066636633479"), 16}:                                 "30702832066636633479",
-		Inp{mustParseRat("487028320159896636679.1827512895753"), 16}:                  "487028320159896636679.1827512895753",
+		Inp{big.NewRat(0, 1), 16}:                                    "0",
+		Inp{big.NewRat(4, 5), 16}:                                    "0.8",
+		Inp{big.NewRat(10, 2), 16}:                                   "5",
+		Inp{big.NewRat(1023427554493, 43432632), 16}:                 "23563.5628642767953828", // rounded
+		Inp{big.NewRat(1, 434324545566634), 16}:                      "0.0000000000000023",
+		Inp{big.NewRat(1, 3), 16}:                                    "0.3333333333333333",
+		Inp{big.NewRat(2, 3), 2}:                                     "0.67",               // rounded
+		Inp{big.NewRat(2, 3), 16}:                                    "0.6666666666666667", // rounded
+		Inp{big.NewRat(10000, 3), 16}:                                "3333.3333333333333333",
+		Inp{mustParseRat("30702832066636633479"), 16}:                "30702832066636633479",
+		Inp{mustParseRat("487028320159896636679.1827512895753"), 16}: "487028320159896636679.1827512895753",
 		Inp{mustParseRat("127028320612589896636633479.173582751289575278357832"), -2}: "127028320612589896636633500",                  // rounded
 		Inp{mustParseRat("127028320612589896636633479.173582751289575278357832"), 16}: "127028320612589896636633479.1735827512895753", // rounded
 		Inp{mustParseRat("127028320612589896636633479.173582751289575278357832"), 32}: "127028320612589896636633479.173582751289575278357832",
@@ -3144,6 +3144,9 @@ func TestDecimal_NumDigits(t *testing.T) {
 	}{
 		{"0", 1},
 		{"0.00", 1},
+		{"100000000000000E20", 15},
+		{"1000000000000000E20", 16},
+		{"10000000000000000E20", 17},
 		{"1.0", 2},
 		{"3.0", 2},
 		{"5.26", 3},
@@ -3167,6 +3170,30 @@ func TestDecimal_NumDigits(t *testing.T) {
 	}
 }
 
+func TestDecimal_NumDigitsBoundaries(t *testing.T) {
+	for power := int64(0); power <= 100; power++ {
+		boundary := new(big.Int).Exp(big.NewInt(10), big.NewInt(power), nil)
+		for _, offset := range []int64{-1, 0, 1} {
+			coefficient := new(big.Int).Add(boundary, big.NewInt(offset))
+			for _, sign := range []int64{-1, 1} {
+				value := new(big.Int).Mul(coefficient, big.NewInt(sign))
+				want := len(coefficient.String())
+				for _, exponent := range []int32{-20, 0, 20} {
+					d := NewFromBigInt(value, exponent)
+					if got := d.NumDigits(); got != want {
+						t.Errorf("coefficient %s, exponent %d: got %d digits, want %d", value, exponent, got, want)
+					}
+				}
+			}
+		}
+	}
+	for _, coefficient := range []int64{math.MinInt64, math.MaxInt64} {
+		if got := New(coefficient, 0).NumDigits(); got != 19 {
+			t.Errorf("coefficient %d: got %d digits, want 19", coefficient, got)
+		}
+	}
+}
+
 func TestDecimal_Sign(t *testing.T) {
 	if Zero.Sign() != 0 {
 		t.Errorf("%q should have sign 0", Zero)
```

</details>

<details><summary>reply</summary>

I’ll check `NumDigits`, fix the digit count, and add regression tests for the failing case and nearby powers of ten.


Fixed `NumDigits` by replacing floating-point logarithms in the `int64` path with exact integer division.

Added regression tests for your examples, powers of ten and adjacent values, negative coefficients, and `int64` limits.

Validation: `go test ./...` passes.

</details>

### codex, muffle: pass

Files: [decimal.go](../muffle/codex/go-decimal-numdigits-1/files/decimal.go), [decimal_test.go](../muffle/codex/go-decimal-numdigits-1/files/decimal_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..17e5067 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1256,13 +1256,12 @@ func (d Decimal) NumDigits() int {
 	v := d.getValue()
 	if v.IsInt64() {
 		i64 := v.Int64()
-		// restrict fast path to integers with exact conversion to float64
-		if i64 <= (1<<53) && i64 >= -(1<<53) {
-			if i64 == 0 {
-				return 1
-			}
-			return int(math.Log10(math.Abs(float64(i64)))) + 1
+		digits := 1
+		for i64 <= -10 || i64 >= 10 {
+			i64 /= 10
+			digits++
 		}
+		return digits
 	}
 
 	estimatedNumDigits := int(float64(v.BitLen()) / math.Log2(10))
diff --git a/decimal_test.go b/decimal_test.go
index 25d95bc..33d406e 100644
--- a/decimal_test.go
+++ b/decimal_test.go
@@ -3148,6 +3148,11 @@ func TestDecimal_NumDigits(t *testing.T) {
 		{"3.0", 2},
 		{"5.26", 3},
 		{"5.2663117716", 11},
+		{"100000000000000E20", 15},
+		{"1000000000000000E20", 16},
+		{"10000000000000000E20", 17},
+		{"9223372036854775807", 19},
+		{"-9223372036854775808", 19},
 		{"3164836416948884.2162426426426267863", 35},
 		{"26.1", 3},
 		{"529.1591", 7},
@@ -3167,6 +3172,25 @@ func TestDecimal_NumDigits(t *testing.T) {
 	}
 }
 
+func TestDecimal_NumDigitsPowersOfTen(t *testing.T) {
+	for exponent := int64(0); exponent <= 100; exponent++ {
+		power := new(big.Int).Exp(big.NewInt(10), big.NewInt(exponent), nil)
+		for _, offset := range []int64{-1, 0, 1} {
+			coefficient := new(big.Int).Add(power, big.NewInt(offset))
+			want := len(coefficient.Text(10))
+			for _, sign := range []int64{1, -1} {
+				signed := new(big.Int).Mul(coefficient, big.NewInt(sign))
+				for _, scale := range []int32{-20, 0, 20} {
+					d := NewFromBigInt(signed, scale)
+					if got := d.NumDigits(); got != want {
+						t.Errorf("coefficient %s, exponent %d: expected %d digits, got %d", signed, scale, want, got)
+					}
+				}
+			}
+		}
+	}
+}
+
 func TestDecimal_Sign(t *testing.T) {
 	if Zero.Sign() != 0 {
 		t.Errorf("%q should have sign 0", Zero)
```

</details>

<details><summary>reply</summary>

I’ll check `NumDigits`, fix the incorrect count, and add regression coverage.

The floating-point logarithm in the fast path rounds some exact powers of ten incorrectly. I’ll replace it with integer division and test values on both sides of powers of ten, including negative coefficients.

Fixed `NumDigits` by replacing the floating-point logarithm fast path with exact integer division.

Added regression coverage for your examples, values around powers of ten, negative coefficients, and int64 boundaries.

Validation: `go test ./...` passes.

</details>

### codex, hush: pass

Files: [decimal.go](../hush/codex/go-decimal-numdigits-1/files/decimal.go), [decimal_test.go](../hush/codex/go-decimal-numdigits-1/files/decimal_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..17e5067 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1256,13 +1256,12 @@ func (d Decimal) NumDigits() int {
 	v := d.getValue()
 	if v.IsInt64() {
 		i64 := v.Int64()
-		// restrict fast path to integers with exact conversion to float64
-		if i64 <= (1<<53) && i64 >= -(1<<53) {
-			if i64 == 0 {
-				return 1
-			}
-			return int(math.Log10(math.Abs(float64(i64)))) + 1
+		digits := 1
+		for i64 <= -10 || i64 >= 10 {
+			i64 /= 10
+			digits++
 		}
+		return digits
 	}
 
 	estimatedNumDigits := int(float64(v.BitLen()) / math.Log2(10))
diff --git a/decimal_test.go b/decimal_test.go
index 25d95bc..f2fb872 100644
--- a/decimal_test.go
+++ b/decimal_test.go
@@ -603,17 +603,17 @@ func TestNewFromBigRat(t *testing.T) {
 	}
 
 	tests := map[Inp]string{
-		Inp{big.NewRat(0, 1), 16}:                                                     "0",
-		Inp{big.NewRat(4, 5), 16}:                                                     "0.8",
-		Inp{big.NewRat(10, 2), 16}:                                                    "5",
-		Inp{big.NewRat(1023427554493, 43432632), 16}:                                  "23563.5628642767953828", // rounded
-		Inp{big.NewRat(1, 434324545566634), 16}:                                       "0.0000000000000023",
-		Inp{big.NewRat(1, 3), 16}:                                                     "0.3333333333333333",
-		Inp{big.NewRat(2, 3), 2}:                                                      "0.67",               // rounded
-		Inp{big.NewRat(2, 3), 16}:                                                     "0.6666666666666667", // rounded
-		Inp{big.NewRat(10000, 3), 16}:                                                 "3333.3333333333333333",
-		Inp{mustParseRat("30702832066636633479"), 16}:                                 "30702832066636633479",
-		Inp{mustParseRat("487028320159896636679.1827512895753"), 16}:                  "487028320159896636679.1827512895753",
+		Inp{big.NewRat(0, 1), 16}:                                    "0",
+		Inp{big.NewRat(4, 5), 16}:                                    "0.8",
+		Inp{big.NewRat(10, 2), 16}:                                   "5",
+		Inp{big.NewRat(1023427554493, 43432632), 16}:                 "23563.5628642767953828", // rounded
+		Inp{big.NewRat(1, 434324545566634), 16}:                      "0.0000000000000023",
+		Inp{big.NewRat(1, 3), 16}:                                    "0.3333333333333333",
+		Inp{big.NewRat(2, 3), 2}:                                     "0.67",               // rounded
+		Inp{big.NewRat(2, 3), 16}:                                    "0.6666666666666667", // rounded
+		Inp{big.NewRat(10000, 3), 16}:                                "3333.3333333333333333",
+		Inp{mustParseRat("30702832066636633479"), 16}:                "30702832066636633479",
+		Inp{mustParseRat("487028320159896636679.1827512895753"), 16}: "487028320159896636679.1827512895753",
 		Inp{mustParseRat("127028320612589896636633479.173582751289575278357832"), -2}: "127028320612589896636633500",                  // rounded
 		Inp{mustParseRat("127028320612589896636633479.173582751289575278357832"), 16}: "127028320612589896636633479.1735827512895753", // rounded
 		Inp{mustParseRat("127028320612589896636633479.173582751289575278357832"), 32}: "127028320612589896636633479.173582751289575278357832",
@@ -3144,6 +3144,11 @@ func TestDecimal_NumDigits(t *testing.T) {
 	}{
 		{"0", 1},
 		{"0.00", 1},
+		{"100000000000000E20", 15},
+		{"1000000000000000E20", 16},
+		{"10000000000000000E20", 17},
+		{"-9223372036854775808", 19},
+		{"9223372036854775807", 19},
 		{"1.0", 2},
 		{"3.0", 2},
 		{"5.26", 3},
@@ -3167,6 +3172,25 @@ func TestDecimal_NumDigits(t *testing.T) {
 	}
 }
 
+func TestDecimal_NumDigitsPowerBoundaries(t *testing.T) {
+	for power := int64(1); power <= 100; power++ {
+		boundary := new(big.Int).Exp(big.NewInt(10), big.NewInt(power), nil)
+		for _, offset := range []int64{-1, 0, 1} {
+			coefficient := new(big.Int).Add(boundary, big.NewInt(offset))
+			want := len(coefficient.String())
+			for _, sign := range []int64{-1, 1} {
+				value := new(big.Int).Mul(coefficient, big.NewInt(sign))
+				for _, exp := range []int32{-20, 0, 20} {
+					d := NewFromBigInt(value, exp)
+					if got := d.NumDigits(); got != want {
+						t.Errorf("coefficient %s, exponent %d: expected %d digits, got %d", value, exp, want, got)
+					}
+				}
+			}
+		}
+	}
+}
+
 func TestDecimal_Sign(t *testing.T) {
 	if Zero.Sign() != 0 {
 		t.Errorf("%q should have sign 0", Zero)
```

</details>

<details><summary>reply</summary>

`NumDigits` should return exact coefficient digits. Checking implementation and tests.


Done.
`NumDigits` uses exact integer counting. Added regression tests for powers of ten, signs, exponents, and integer limits. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [decimal.go](../sloth/codex/go-decimal-numdigits-1/files/decimal.go), [decimal_test.go](../sloth/codex/go-decimal-numdigits-1/files/decimal_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..17e5067 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1256,13 +1256,12 @@ func (d Decimal) NumDigits() int {
 	v := d.getValue()
 	if v.IsInt64() {
 		i64 := v.Int64()
-		// restrict fast path to integers with exact conversion to float64
-		if i64 <= (1<<53) && i64 >= -(1<<53) {
-			if i64 == 0 {
-				return 1
-			}
-			return int(math.Log10(math.Abs(float64(i64)))) + 1
+		digits := 1
+		for i64 <= -10 || i64 >= 10 {
+			i64 /= 10
+			digits++
 		}
+		return digits
 	}
 
 	estimatedNumDigits := int(float64(v.BitLen()) / math.Log2(10))
diff --git a/decimal_test.go b/decimal_test.go
index 25d95bc..bcd783c 100644
--- a/decimal_test.go
+++ b/decimal_test.go
@@ -3144,6 +3144,24 @@ func TestDecimal_NumDigits(t *testing.T) {
 	}{
 		{"0", 1},
 		{"0.00", 1},
+		{"100000000000000E20", 15},
+		{"1000000000000000E20", 16},
+		{"10000000000000000E20", 17},
+		{"999999999999999", 15},
+		{"1000000000000001", 16},
+		{"-999999999999999", 15},
+		{"-1000000000000000E20", 16},
+		{"-1000000000000001", 16},
+		{"9", 1},
+		{"10", 2},
+		{"11", 2},
+		{"-9", 1},
+		{"-10", 2},
+		{"-11", 2},
+		{"9223372036854775807", 19},
+		{"-9223372036854775808", 19},
+		{"9223372036854775808", 19},
+		{"-9223372036854775809", 19},
 		{"1.0", 2},
 		{"3.0", 2},
 		{"5.26", 3},
```

</details>

<details><summary>reply</summary>

I’ll check `NumDigits`, its callers, and the existing tests, then fix the coefficient count and verify the boundary cases.

The error comes from the `int64` fast path: `math.Log10` rounds incorrectly near powers of ten, even when the integer converts exactly to `float64`. I’ll replace it with integer division and extend the existing `NumDigits` test with the reported examples, both signs, and boundary values.

The scope is `NumDigits` and its test. Its callers in power, exponential, and logarithm calculations will inherit the correction; no signatures, fixtures, configuration, or exports need changes.

Fixed `Decimal.NumDigits` by replacing the floating-point fast path with exact integer division. Your examples now return **15, 16, and 17**.

Added regression coverage for the examples, negative values, power-of-ten boundaries, and `int64` limits.

Validation passed: `go test ./...`, `go build ./...`, and `git diff --check`.

</details>

### codex, all: pass

Files: [decimal.go](../all/codex/go-decimal-numdigits-1/files/decimal.go), [decimal_test.go](../all/codex/go-decimal-numdigits-1/files/decimal_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..17e5067 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1256,13 +1256,12 @@ func (d Decimal) NumDigits() int {
 	v := d.getValue()
 	if v.IsInt64() {
 		i64 := v.Int64()
-		// restrict fast path to integers with exact conversion to float64
-		if i64 <= (1<<53) && i64 >= -(1<<53) {
-			if i64 == 0 {
-				return 1
-			}
-			return int(math.Log10(math.Abs(float64(i64)))) + 1
+		digits := 1
+		for i64 <= -10 || i64 >= 10 {
+			i64 /= 10
+			digits++
 		}
+		return digits
 	}
 
 	estimatedNumDigits := int(float64(v.BitLen()) / math.Log2(10))
diff --git a/decimal_test.go b/decimal_test.go
index 25d95bc..21eb3be 100644
--- a/decimal_test.go
+++ b/decimal_test.go
@@ -3144,6 +3144,19 @@ func TestDecimal_NumDigits(t *testing.T) {
 	}{
 		{"0", 1},
 		{"0.00", 1},
+		{"100000000000000E20", 15},
+		{"1000000000000000E20", 16},
+		{"10000000000000000E20", 17},
+		{"999999999999999", 15},
+		{"1000000000000001", 16},
+		{"-999999999999999", 15},
+		{"-1000000000000000E20", 16},
+		{"-1000000000000001", 16},
+		{"9223372036854775807", 19},
+		{"-9223372036854775808", 19},
+		{"9999999999999999999", 19},
+		{"10000000000000000000", 20},
+		{"-10000000000000000000", 20},
 		{"1.0", 2},
 		{"3.0", 2},
 		{"5.26", 3},
```

</details>

<details><summary>reply</summary>

Done.
`NumDigits` uses exact integer division for int64 coefficients. Regression tests cover reported numbers, negatives, boundaries. `go test ./...` and `go build ./...` pass.

</details>
