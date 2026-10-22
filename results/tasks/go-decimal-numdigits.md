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
| claude | muffle | pass | +13/-6 | 20 | 6,155 | $0.163 |
| claude | hush | pass | +12/-6 | 26 | 1,524 | $0.051 |
| claude | sloth | pass | +3/-6 | 0 | 3,352 | $0.087 |
| claude | all | pass | +8/-7 | 0 | 1,173 | $0.055 |
| codex | base | pass | +5/-6 | 38 | 1,374 | - |
| codex | muffle | pass | +5/-6 | 39 | 1,403 | - |
| codex | hush | pass | +5/-6 | 24 | 1,402 | - |
| codex | sloth | pass | +5/-6 | 0 | 853 | - |
| codex | all | pass | +5/-6 | 0 | 1,012 | - |

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
index 880d569..729e24b 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1256,13 +1256,20 @@ func (d Decimal) NumDigits() int {
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
+		// exact integer comparison; math.Log10 is inexact near powers of ten
+		u := uint64(i64)
+		if i64 < 0 {
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
index 25d95bc..8534435 100644
--- a/decimal_test.go
+++ b/decimal_test.go
@@ -3962,3 +3962,23 @@ func ExampleNewFromFloat() {
 	//0.123123123123123
 	//-10000000000000
 }
+
+func TestDecimal_NumDigitsPowersOfTen(t *testing.T) {
+	p := big.NewInt(1)
+	for i := 1; i <= 400; i++ {
+		for _, delta := range []int64{-1, 0, 1} {
+			v := new(big.Int).Add(p, big.NewInt(delta))
+			if v.Sign() <= 0 {
+				continue
+			}
+			want := len(v.String())
+			if got := NewFromBigInt(v, 0).NumDigits(); got != want {
+				t.Errorf("NumDigits(%s): got %d, want %d", v, got, want)
+			}
+			if got := NewFromBigInt(new(big.Int).Neg(v), 0).NumDigits(); got != want {
+				t.Errorf("NumDigits(-%s): got %d, want %d", v, got, want)
+			}
+		}
+		p.Mul(p, big.NewInt(10))
+	}
+}
```

</details>

<details><summary>reply</summary>

Reproduced: the float `Log10` fast path is inexact at 10^15. I'm replacing it with an exact integer check.

I fixed `NumDigits`, and it now returns the exact digit count of the coefficient. The full test suite passes.

**Cause:** the fast path for small coefficients used `math.Log10(float64(i64))`. That is slightly inexact near powers of ten. For 10^15, `Log10` returns a value just under 15, so the result was 15 instead of 16. Your second example, `1000000000000000E20`, has exactly that coefficient. The other two examples avoid it because 10^14 and 10^16 happen to come out exact or take the big-integer path.

**Fix:** in `decimal.go`, the float calculation is replaced with exact integer division, counting digits of the absolute value. The big-integer path for larger coefficients is unchanged.

I also added a regression test, `TestDecimal_NumDigitsPowersOfTen`, in `decimal_test.go`. It checks 10^n−1, 10^n and 10^n+1, positive and negative, for n up to 400, against `len(v.String())`. Before the fix it failed at 10^15 and 10^15+1.

I haven't committed anything.

That notification is for my first scratch-test command. It hung because the `cat > file` at the start had no input, and it was stopped at its time limit. It doesn't affect the fix. I reran the test properly, and the scratch file is already deleted.

I removed the stray `nd_test.go` and `git status` shows only `decimal.go` modified. The regression test I added to `decimal_test.go` was appended after that check, so it isn't in that output. The `NumDigits` fix and the full test suite are as I reported before.

</details>

### claude, hush: pass

Files: [decimal.go](../hush/claude/go-decimal-numdigits-1/files/decimal.go), [decimal_test.go](../hush/claude/go-decimal-numdigits-1/files/decimal_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..65ecca9 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1256,13 +1256,19 @@ func (d Decimal) NumDigits() int {
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
+		u := uint64(i64)
+		if i64 < 0 {
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
index 25d95bc..5e58ed4 100644
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
@@ -3962,3 +3962,18 @@ func ExampleNewFromFloat() {
 	//0.123123123123123
 	//-10000000000000
 }
+
+func TestNumDigitsPowersOfTen(t *testing.T) {
+	for i := 0; i < 40; i++ {
+		d := New(1, int32(i)).Mul(New(1, 0))
+		want := len(d.Coefficient().Text(10))
+		if got := d.NumDigits(); got != want {
+			t.Errorf("10^%d: got %d, want %d", i, got, want)
+		}
+		d = RequireFromString("1" + strings.Repeat("0", i) + "E20")
+		want = len(d.Coefficient().Text(10))
+		if got := d.NumDigits(); got != want {
+			t.Errorf("1e%d E20: got %d, want %d", i, got, want)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

Done. `NumDigits` fast path used float `math.Log10`, which gave 14.999… for 10^15. It now counts digits with integer division in `decimal.go`. I added `TestNumDigitsPowersOfTen`, and `go test` passes.

`gofmt -w` also reformatted some existing lines in `decimal_test.go`, which was already unformatted before my change.

</details>

### claude, sloth: pass

Files: [decimal.go](../sloth/claude/go-decimal-numdigits-1/files/decimal.go)

<details><summary>diff</summary>

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..1d72c95 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1256,13 +1256,10 @@ func (d Decimal) NumDigits() int {
 	v := d.getValue()
 	if v.IsInt64() {
 		i64 := v.Int64()
-		// restrict fast path to integers with exact conversion to float64
-		if i64 <= (1<<53) && i64 >= -(1<<53) {
-			if i64 == 0 {
-				return 1
-			}
-			return int(math.Log10(math.Abs(float64(i64)))) + 1
+		if i64 < 0 {
+			i64 = -i64
 		}
+		return len(strconv.FormatUint(uint64(i64), 10))
 	}
 
 	estimatedNumDigits := int(float64(v.BitLen()) / math.Log2(10))
```

</details>

<details><summary>reply</summary>

I'm checking the fix. The last output was too terse to confirm anything.

I fixed `Decimal.NumDigits` in `decimal.go`, and your second example now returns 16. The existing tests pass, and I added no new test since you didn't ask for one.

**Cause:** the fast path for small coefficients used `math.Log10`. `Log10` isn't exact, so for `10^15` it returned just under 15, and the digit count came out one too low. The big-integer path below it was already exact.

**Fix:** the small-coefficient path now counts digits by formatting the absolute value with `strconv.FormatUint`. This avoids any float arithmetic. It also handles `math.MinInt64`, which the old code's `-i64` handling would have mishandled.

I checked your three inputs, which now give 15, 16 and 17 and match `len(d.Coefficient().Text(10))`. Zero gives 1, and the sign isn't counted, so `-5` gives 1. The `-5` line in my scratch check printed 2 for the `len(...Text(10))` column because that text includes the minus sign, but `NumDigits` itself returned 1.

Formatting the number allocates a small string, so the small-coefficient path is a bit slower than the old float shortcut. I didn't benchmark it.

</details>

### claude, all: pass

Files: [decimal.go](../all/claude/go-decimal-numdigits-1/files/decimal.go)

<details><summary>diff</summary>

```diff
diff --git a/decimal.go b/decimal.go
index 880d569..6863305 100644
--- a/decimal.go
+++ b/decimal.go
@@ -1255,14 +1255,15 @@ func (d Decimal) Ln(precision int32) (Decimal, error) {
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
+		u := uint64(v.Int64())
+		if v.Sign() < 0 {
+			u = -u
+		}
+		n := 1
+		for ; u >= 10; u /= 10 {
+			n++
 		}
+		return n
 	}
 
 	estimatedNumDigits := int(float64(v.BitLen()) / math.Log2(10))
```

</details>

<details><summary>reply</summary>

Done. The cause was `math.Log10` returning slightly under 15 for 1e15 in the int64 fast path. I replaced it with an exact integer digit-count loop in `decimal.go`.

Your three cases and a few edge cases (0, negatives, min int64) matched in a temporary test, which I removed. The existing tests pass. I did not add a permanent regression test.

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
index 25d95bc..a63a949 100644
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
@@ -3167,6 +3170,31 @@ func TestDecimal_NumDigits(t *testing.T) {
 	}
 }
 
+func TestDecimal_NumDigitsBoundaries(t *testing.T) {
+	// Check both sides of powers of ten, including the int64 fast path
+	// and coefficients that require arbitrary precision.
+	for exponent := int64(0); exponent <= 100; exponent++ {
+		power := new(big.Int).Exp(big.NewInt(10), big.NewInt(exponent), nil)
+		for _, offset := range []int64{-1, 0, 1} {
+			coefficient := new(big.Int).Add(power, big.NewInt(offset))
+			want := len(coefficient.String())
+			for _, sign := range []int64{1, -1} {
+				value := new(big.Int).Mul(coefficient, big.NewInt(sign))
+				d := NewFromBigInt(value, 20)
+				if got := d.NumDigits(); got != want {
+					t.Errorf("coefficient %s: expected %d digits, got %d", value, want, got)
+				}
+			}
+		}
+	}
+	for _, coefficient := range []int64{math.MinInt64, math.MaxInt64} {
+		d := New(coefficient, 0)
+		if got := d.NumDigits(); got != 19 {
+			t.Errorf("coefficient %d: expected 19 digits, got %d", coefficient, got)
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

I’ll check `NumDigits`, fix the digit count, and add regression coverage for the reported values.

The error comes from the floating-point logarithm in the fast path. I replaced it with integer division and added checks around powers of ten for both signs, including large coefficients and the `int64` limits. The test suite is running.

Fixed `Decimal.NumDigits` by replacing the floating-point fast path with exact integer division. Your second example now returns `16`.

Added regression tests for the reported examples, powers-of-ten boundaries, negative coefficients, and `int64` limits.

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
index 25d95bc..3701f1b 100644
--- a/decimal_test.go
+++ b/decimal_test.go
@@ -3144,6 +3144,11 @@ func TestDecimal_NumDigits(t *testing.T) {
 	}{
 		{"0", 1},
 		{"0.00", 1},
+		{"100000000000000E20", 15},
+		{"1000000000000000E20", 16},
+		{"10000000000000000E20", 17},
+		{"9223372036854775807", 19},
+		{"-9223372036854775808", 19},
 		{"1.0", 2},
 		{"3.0", 2},
 		{"5.26", 3},
@@ -3167,6 +3172,25 @@ func TestDecimal_NumDigits(t *testing.T) {
 	}
 }
 
+func TestDecimal_NumDigitsPowerBoundaries(t *testing.T) {
+	for exponent := int64(0); exponent <= 100; exponent++ {
+		power := new(big.Int).Exp(big.NewInt(10), big.NewInt(exponent), nil)
+		for _, offset := range []int64{-1, 0, 1} {
+			coefficient := new(big.Int).Add(power, big.NewInt(offset))
+			want := len(coefficient.Text(10))
+			for _, negative := range []bool{false, true} {
+				if negative {
+					coefficient.Neg(coefficient)
+				}
+				d := NewFromBigInt(coefficient, 20)
+				if got := d.NumDigits(); got != want {
+					t.Errorf("coefficient %s: expected %d digits, got %d", coefficient, want, got)
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

Fix coefficient digit count; inspect implementation and tests.


Done.
`NumDigits` uses exact integer counting. Added regression tests for reported inputs, signed power boundaries, and int64 limits. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [decimal.go](../sloth/codex/go-decimal-numdigits-1/files/decimal.go)

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
```

</details>

<details><summary>reply</summary>

I’ll check `NumDigits` and its callers, fix the coefficient digit count, then build and run the existing tests.

The error comes from the `int64` fast path: floating-point `Log10` can round incorrectly at powers of ten. I’ll replace it with integer division, which also handles negative coefficients exactly. The larger-coefficient path already checks its estimate against an exact power of ten.

Scope is limited to `NumDigits`. Its power, exponential, and logarithm callers need no changes, and neither do fixtures, configuration, or exports. I won’t add new tests or API options.

Fixed [`Decimal.NumDigits`]( /home/jdaddy/.cache/muffle-evals/runs/sloth/codex/go-decimal-numdigits-1/work/decimal.go:1255) by replacing floating-point logarithms with exact integer division for `int64` coefficients. This handles powers of ten, zero, and negative values correctly.

`go build ./...`, existing tests, and `git diff --check` pass.

</details>

### codex, all: pass

Files: [decimal.go](../all/codex/go-decimal-numdigits-1/files/decimal.go)

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
```

</details>

<details><summary>reply</summary>

`NumDigits` needs exact coefficient digit counts. Checking implementation and callers, then fixing and running existing tests.


Done.
`NumDigits` uses exact integer division. Build, existing tests, reported examples, power-of-ten boundaries, and signed integer limits passed.

</details>
