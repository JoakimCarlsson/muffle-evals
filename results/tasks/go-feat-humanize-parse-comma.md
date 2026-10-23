# go-feat-humanize-parse-comma

Source: https://github.com/dustin/go-humanize/pull/146

## Prompt

> Add a way to parse the output of `Comma` and `Commaf` back into numbers.
> 
> I display numbers with `humanize.Comma` and `humanize.Commaf`, and users sometimes paste those strings back into a form, like `"123,456,789"` or `"-834,142.32"`. There is no function to turn them back into numbers, so I end up hand-rolling it everywhere.
> 
> I would like two functions in the `humanize` package:
> 
> ```go
> func ParseComma(s string) (int64, error)
> func ParseCommaf(s string) (float64, error)
> ```
> 
> - `ParseComma(Comma(n))` should give back `n` for any `int64`, including `math.MinInt64` and `math.MaxInt64`.
> - `ParseCommaf(Commaf(f))` should give back `f`.
> - Negative numbers and plain numbers without commas (`"10"`, `"10.11"`) work too.
> - Input that is not a number (`""`, `"abc"`, `"123a456"`, `"1.2.3"`, or `"1.5"` for `ParseComma`) returns an error and `0`.
> 
> Please add this.

## Upstream change (tests left out)

Files: [comma.go](../../tasks/go-feat-humanize-parse-comma/upstream/comma.go), [comma_test.go](../../tasks/go-feat-humanize-parse-comma/upstream/comma_test.go)

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..813353f 100644
--- a/comma.go
+++ b/comma.go
@@ -139,3 +139,19 @@ func BigComma(bin *big.Int) string {
 	parts[j] = strconv.Itoa(int(b.Int64()))
 	return sign + strings.Join(parts[j:], ",")
 }
+
+// ParseComma parses a string produced by Comma.
+// It strips commas and returns the int64 value, or an error if the
+// string cannot be parsed.
+func ParseComma(s string) (int64, error) {
+	s = strings.ReplaceAll(s, ",", "")
+	return strconv.ParseInt(s, 10, 64)
+}
+
+// ParseCommaf parses a string produced by Commaf.
+// It strips commas and returns the float64 value, or an error if the
+// string cannot be parsed.
+func ParseCommaf(s string) (float64, error) {
+	s = strings.ReplaceAll(s, ",", "")
+	return strconv.ParseFloat(s, 64)
+}
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +90/-0 | 34 | 3,153 | $0.094 |
| claude | muffle | pass | +86/-0 | 47 | 3,351 | $0.088 |
| claude | hush | pass | +77/-0 | 37 | 2,779 | $0.073 |
| claude | sloth | pass | +24/-0 | 26 | 2,273 | $0.072 |
| claude | all | pass | +53/-0 | 29 | 3,067 | $0.098 |
| codex | base | pass | +21/-0 | 38 | 1,510 | - |
| codex | muffle | pass | +21/-0 | 63 | 1,786 | - |
| codex | hush | pass | +21/-0 | 39 | 1,283 | - |
| codex | sloth | pass | +20/-0 | 30 | 1,376 | - |
| codex | all | pass | +20/-0 | 42 | 1,529 | - |

### claude, base: pass

Files: [comma.go](../base/claude/go-feat-humanize-parse-comma-1/files/comma.go), [comma_test.go](../base/claude/go-feat-humanize-parse-comma-1/files/comma_test.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..2498a1b 100644
--- a/comma.go
+++ b/comma.go
@@ -139,3 +139,93 @@ func BigComma(bin *big.Int) string {
 	parts[j] = strconv.Itoa(int(b.Int64()))
 	return sign + strings.Join(parts[j:], ",")
 }
+
+// stripCommas validates s as an optionally negative decimal number whose
+// integer part may use commas as thousands separators, and returns it with
+// the commas removed. If hasFrac is false, a fractional part is rejected.
+func stripCommas(s string, hasFrac bool) (string, bool) {
+	body := strings.TrimPrefix(s, "-")
+	intPart, frac, found := strings.Cut(body, ".")
+	if found && !hasFrac {
+		return "", false
+	}
+	if found && frac == "" {
+		return "", false
+	}
+	for i := 0; i < len(frac); i++ {
+		if frac[i] < '0' || frac[i] > '9' {
+			return "", false
+		}
+	}
+
+	groups := strings.Split(intPart, ",")
+	for i, g := range groups {
+		// Only the first group may be shorter than three digits.
+		if len(g) == 0 || len(g) > 3 && len(groups) > 1 || len(g) < 3 && i > 0 {
+			return "", false
+		}
+		for j := 0; j < len(g); j++ {
+			if g[j] < '0' || g[j] > '9' {
+				return "", false
+			}
+		}
+	}
+
+	out := strings.Join(groups, "")
+	if found {
+		out += "." + frac
+	}
+	if len(body) != len(s) {
+		out = "-" + out
+	}
+	return out, true
+}
+
+// ParseComma parses a string produced by Comma back into an int64.
+// Plain numbers without commas are accepted too. It returns an error
+// and 0 if s is not a valid integer or does not fit in an int64.
+//
+// e.g. ParseComma("834,142") -> 834142
+func ParseComma(s string) (int64, error) {
+	clean, ok := stripCommas(s, false)
+	if !ok {
+		return 0, &strconv.NumError{Func: "ParseComma", Num: s, Err: strconv.ErrSyntax}
+	}
+	n, err := strconv.ParseInt(clean, 10, 64)
+	if err != nil {
+		if ne, ok := err.(*strconv.NumError); ok {
+			ne.Func, ne.Num = "ParseComma", s
+		}
+		return 0, err
+	}
+	return n, nil
+}
+
+// ParseCommaf parses a string produced by Commaf back into a float64.
+// Plain numbers without commas are accepted too, as are the "NaN", "+Inf"
+// and "-Inf" strings Commaf produces. It returns an error and 0 if s is
+// not a valid number.
+//
+// e.g. ParseCommaf("834,142.32") -> 834142.32
+func ParseCommaf(s string) (float64, error) {
+	switch s {
+	case "NaN":
+		return math.NaN(), nil
+	case "+Inf":
+		return math.Inf(1), nil
+	case "-Inf":
+		return math.Inf(-1), nil
+	}
+	clean, ok := stripCommas(s, true)
+	if !ok {
+		return 0, &strconv.NumError{Func: "ParseCommaf", Num: s, Err: strconv.ErrSyntax}
+	}
+	f, err := strconv.ParseFloat(clean, 64)
+	if err != nil {
+		if ne, ok := err.(*strconv.NumError); ok {
+			ne.Func, ne.Num = "ParseCommaf", s
+		}
+		return 0, err
+	}
+	return f, nil
+}
diff --git a/comma_test.go b/comma_test.go
index 7c629eb..b9d99c3 100644
--- a/comma_test.go
+++ b/comma_test.go
@@ -157,3 +157,37 @@ func TestHumanizeBigIntMutation(t *testing.T) {
 		t.Fail()
 	}
 }
+
+func TestParseComma(t *testing.T) {
+	for _, n := range []int64{0, 7, 10, -10, 999, 1000, -1000, 834142, math.MinInt64, math.MaxInt64} {
+		got, err := ParseComma(Comma(n))
+		if err != nil || got != n {
+			t.Errorf("ParseComma(Comma(%d)) = %d, %v", n, got, err)
+		}
+	}
+	if got, err := ParseComma("10"); err != nil || got != 10 {
+		t.Errorf("ParseComma(10) = %d, %v", got, err)
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.5", "1.2.3", "-", ",", "1,2", "1,2345", ",123", "123,", "9,223,372,036,854,775,808", "--1"} {
+		if got, err := ParseComma(s); err == nil || got != 0 {
+			t.Errorf("ParseComma(%q) = %d, %v; want error", s, got, err)
+		}
+	}
+}
+
+func TestParseCommaf(t *testing.T) {
+	for _, f := range []float64{0, 10.11, -834142.32, 1e21, 123456789, math.MaxFloat64, math.SmallestNonzeroFloat64, math.Inf(1), math.Inf(-1)} {
+		got, err := ParseCommaf(Commaf(f))
+		if err != nil || got != f {
+			t.Errorf("ParseCommaf(Commaf(%v)) = %v, %v", f, got, err)
+		}
+	}
+	if got, err := ParseCommaf(Commaf(math.NaN())); err != nil || !math.IsNaN(got) {
+		t.Errorf("NaN round trip = %v, %v", got, err)
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1.", ".5", "1,23.4", "1.2,345", "-", "inf", "1e5"} {
+		if got, err := ParseCommaf(s); err == nil || got != 0 {
+			t.Errorf("ParseCommaf(%q) = %v, %v; want error", s, got, err)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

I added `ParseComma` and `ParseCommaf` to `comma.go`, and `go vet` and the package tests pass.

- **Round trips:** `ParseComma(Comma(n))` returns `n` for every `int64` I tried, including `math.MinInt64` and `math.MaxInt64`. `ParseCommaf(Commaf(f))` returns `f` for the floats I tried, including `MaxFloat64`, `SmallestNonzeroFloat64` and `1e21`.
- **Accepted input:** negative numbers and plain numbers without commas (`"10"`, `"10.11"`) parse as you asked. `ParseCommaf` also accepts the `"NaN"`, `"+Inf"` and `"-Inf"` strings that `Commaf` can produce.
- **Errors:** `""`, `"abc"`, `"123a456"`, `"1.2.3"` and `"1.5"` (for `ParseComma`) return an error and `0`. So does an integer that doesn't fit in an `int64`.
- **Strict comma placement:** I made the comma grouping strict. `"1,2"`, `"1,2345"`, `",123"` and `"123,"` are rejected, because accepting them would let malformed pastes through. Say so if you'd rather be lenient.
- **Other rejected forms:** `ParseCommaf` rejects `"1e5"`, `".5"`, `"1."` and `"inf"`, because `Commaf` never produces them.

I added `TestParseComma` and `TestParseCommaf` to `comma_test.go`. I didn't commit anything.

</details>

### claude, muffle: pass

Files: [comma.go](../muffle/claude/go-feat-humanize-parse-comma-1/files/comma.go), [comma_test.go](../muffle/claude/go-feat-humanize-parse-comma-1/files/comma_test.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..a72c1eb 100644
--- a/comma.go
+++ b/comma.go
@@ -139,3 +139,89 @@ func BigComma(bin *big.Int) string {
 	parts[j] = strconv.Itoa(int(b.Int64()))
 	return sign + strings.Join(parts[j:], ",")
 }
+
+// parseCommaDigits validates a number formatted like the output of Comma
+// or Commaf and returns it with the thousands separators removed. Commas
+// are optional, but when present they must separate groups of exactly
+// three digits. A fractional part is only accepted if frac is true.
+func parseCommaDigits(s string, frac bool) (string, error) {
+	err := &strconv.NumError{Func: "ParseComma", Num: s, Err: strconv.ErrSyntax}
+
+	body := strings.TrimPrefix(s, "-")
+	intPart, fracPart, hasFrac := strings.Cut(body, ".")
+	if hasFrac && (!frac || fracPart == "") {
+		return "", err
+	}
+	for i := 0; i < len(fracPart); i++ {
+		if fracPart[i] < '0' || fracPart[i] > '9' {
+			return "", err
+		}
+	}
+
+	groups := strings.Split(intPart, ",")
+	for i, g := range groups {
+		if len(groups) > 1 && ((i == 0 && len(g) > 3) || (i > 0 && len(g) != 3)) {
+			return "", err
+		}
+		if g == "" {
+			return "", err
+		}
+		for j := 0; j < len(g); j++ {
+			if g[j] < '0' || g[j] > '9' {
+				return "", err
+			}
+		}
+	}
+
+	out := strings.Join(groups, "")
+	if s[0] == '-' {
+		out = "-" + out
+	}
+	if hasFrac {
+		out += "." + fracPart
+	}
+	return out, nil
+}
+
+// ParseComma parses a string produced by Comma, or a plain base 10
+// integer, back into an int64. It returns 0 and an error if s is not a
+// valid number or does not fit in an int64.
+//
+// e.g. ParseComma("834,142") -> 834142
+func ParseComma(s string) (int64, error) {
+	clean, err := parseCommaDigits(s, false)
+	if err != nil {
+		return 0, err
+	}
+	v, err := strconv.ParseInt(clean, 10, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
+// ParseCommaf parses a string produced by Commaf, or a plain base 10
+// number, back into a float64. "NaN", "+Inf" and "-Inf" are accepted as
+// Commaf produces them. It returns 0 and an error if s is not a valid
+// number or does not fit in a float64.
+//
+// e.g. ParseCommaf("834,142.32") -> 834142.32
+func ParseCommaf(s string) (float64, error) {
+	switch s {
+	case "NaN":
+		return math.NaN(), nil
+	case "+Inf":
+		return math.Inf(1), nil
+	case "-Inf":
+		return math.Inf(-1), nil
+	}
+	clean, err := parseCommaDigits(s, true)
+	if err != nil {
+		return 0, err
+	}
+	v, err := strconv.ParseFloat(clean, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
diff --git a/comma_test.go b/comma_test.go
index 7c629eb..5b212c5 100644
--- a/comma_test.go
+++ b/comma_test.go
@@ -157,3 +157,50 @@ func TestHumanizeBigIntMutation(t *testing.T) {
 		t.Fail()
 	}
 }
+
+func TestParseComma(t *testing.T) {
+	good := map[string]int64{
+		"0": 0, "10": 10, "123,456,789": 123456789, "-834,142": -834142,
+		"1234567": 1234567, "-9,223,372,036,854,775,808": math.MinInt64,
+		"9,223,372,036,854,775,807": math.MaxInt64,
+	}
+	for in, want := range good {
+		if got, err := ParseComma(in); err != nil || got != want {
+			t.Errorf("ParseComma(%q) = %d, %v; want %d", in, got, err, want)
+		}
+	}
+	for _, in := range []string{"", "-", "abc", "123a456", "1.5", "1.2.3", "1,23", "1,2345", ",123", "123,", "1,,234", "+5", "9,223,372,036,854,775,808", " 1"} {
+		if got, err := ParseComma(in); err == nil || got != 0 {
+			t.Errorf("ParseComma(%q) = %d, %v; want 0, error", in, got, err)
+		}
+	}
+	for _, n := range []int64{math.MinInt64, math.MaxInt64, -1000, 999, 1000, 0, 7, 8} {
+		if got, err := ParseComma(Comma(n)); err != nil || got != n {
+			t.Errorf("round trip %d: got %d, %v", n, got, err)
+		}
+	}
+}
+
+func TestParseCommaf(t *testing.T) {
+	good := map[string]float64{
+		"10": 10, "10.11": 10.11, "-834,142.32": -834142.32, "123,456,789": 123456789, "0.5": 0.5,
+	}
+	for in, want := range good {
+		if got, err := ParseCommaf(in); err != nil || got != want {
+			t.Errorf("ParseCommaf(%q) = %v, %v; want %v", in, got, err, want)
+		}
+	}
+	for _, in := range []string{"", "abc", "123a456", "1.2.3", "1.", ".5", "1.2,3", "1,23.5", "-", "1e5"} {
+		if got, err := ParseCommaf(in); err == nil || got != 0 {
+			t.Errorf("ParseCommaf(%q) = %v, %v; want 0, error", in, got, err)
+		}
+	}
+	for _, f := range []float64{0, 1.5, -834142.32, 1e21, 5e-324, math.MaxFloat64, math.Inf(1), math.Inf(-1)} {
+		if got, err := ParseCommaf(Commaf(f)); err != nil || got != f {
+			t.Errorf("round trip %v: got %v, %v", f, got, err)
+		}
+	}
+	if got, err := ParseCommaf(Commaf(math.NaN())); err != nil || !math.IsNaN(got) {
+		t.Errorf("NaN round trip: got %v, %v", got, err)
+	}
+}
```

</details>

<details><summary>reply</summary>

I added `ParseComma` and `ParseCommaf` to `comma.go`, with tests in `comma_test.go`. `go vet` and `go test` pass.

- **Round trips:** `ParseComma(Comma(n))` gives back `n` for every `int64`, including `math.MinInt64` and `math.MaxInt64`. `ParseCommaf(Commaf(f))` gives back `f`, including very large and very small values.
- **`ParseCommaf` extras:** it also accepts `NaN`, `+Inf` and `-Inf`, since `Commaf` can produce them.
- **Accepted input:** negative numbers and plain numbers without commas (`"10"`, `"10.11"`, `"1234567"`) work.
- **Errors:** `""`, `"abc"`, `"123a456"`, `"1.2.3"` and `"1.5"` for `ParseComma` all return `0` and an error. Values that don't fit in an `int64` or `float64` do too.
- **Strict comma placement:** commas must sit between groups of exactly three digits, so `"1,23"` and `"123,"` are errors. Strings like `"1234,567"` are rejected rather than guessed at.
- **Other rejected formats:** a leading `+`, whitespace, and exponent notation such as `"1e5"` are also errors. Say so if you'd rather be more lenient with pasted input.

I made no commit.

</details>

### claude, hush: pass

Files: [comma.go](../hush/claude/go-feat-humanize-parse-comma-1/files/comma.go), [parsecomma_test.go](../hush/claude/go-feat-humanize-parse-comma-1/files/parsecomma_test.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..cb77107 100644
--- a/comma.go
+++ b/comma.go
@@ -2,6 +2,7 @@ package humanize
 
 import (
 	"bytes"
+	"errors"
 	"math"
 	"math/big"
 	"strconv"
@@ -139,3 +140,79 @@ func BigComma(bin *big.Int) string {
 	parts[j] = strconv.Itoa(int(b.Int64()))
 	return sign + strings.Join(parts[j:], ",")
 }
+
+var errBadComma = errors.New("humanize: invalid comma-formatted number")
+
+// uncomma validates s as the output of Comma or Commaf and returns it
+// with the commas removed. Commas are only allowed in the integer part,
+// in groups of three.
+func uncomma(s string) (string, bool) {
+	sign := ""
+	if s != "" && (s[0] == '-' || s[0] == '+') {
+		sign, s = s[:1], s[1:]
+	}
+	intPart, frac, hasFrac := strings.Cut(s, ".")
+	if hasFrac {
+		if frac == "" {
+			return "", false
+		}
+		for i := 0; i < len(frac); i++ {
+			if frac[i] < '0' || frac[i] > '9' {
+				return "", false
+			}
+		}
+	}
+	groups := strings.Split(intPart, ",")
+	for i, g := range groups {
+		if len(g) == 0 || (i == 0 && len(g) > 3 && len(groups) > 1) || (i > 0 && len(g) != 3) {
+			return "", false
+		}
+		for j := 0; j < len(g); j++ {
+			if g[j] < '0' || g[j] > '9' {
+				return "", false
+			}
+		}
+	}
+	out := sign + strings.Join(groups, "")
+	if hasFrac {
+		out += "." + frac
+	}
+	return out, true
+}
+
+// ParseComma parses a string produced by Comma back into an int64.
+// Plain numbers without commas are accepted too.
+//
+// e.g. ParseComma("834,142") -> 834142
+func ParseComma(s string) (int64, error) {
+	plain, ok := uncomma(s)
+	if !ok || strings.Contains(plain, ".") {
+		return 0, errBadComma
+	}
+	n, err := strconv.ParseInt(plain, 10, 64)
+	if err != nil {
+		return 0, err
+	}
+	return n, nil
+}
+
+// ParseCommaf parses a string produced by Commaf back into a float64.
+// Plain numbers without commas are accepted too, as are the "NaN",
+// "+Inf" and "-Inf" forms that Commaf produces.
+//
+// e.g. ParseCommaf("834,142.32") -> 834142.32
+func ParseCommaf(s string) (float64, error) {
+	switch s {
+	case "NaN", "+Inf", "-Inf":
+		return strconv.ParseFloat(s, 64)
+	}
+	plain, ok := uncomma(s)
+	if !ok {
+		return 0, errBadComma
+	}
+	f, err := strconv.ParseFloat(plain, 64)
+	if err != nil {
+		return 0, err
+	}
+	return f, nil
+}
diff --git a/parsecomma_test.go b/parsecomma_test.go
new file mode 100644
index 0000000..3b04d69
--- /dev/null
+++ b/parsecomma_test.go
@@ -0,0 +1,37 @@
+package humanize
+
+import (
+	"math"
+	"testing"
+)
+
+func TestParseComma(t *testing.T) {
+	for _, n := range []int64{0, 7, 10, -1, 999, 1000, -834142, 123456789, math.MinInt64, math.MaxInt64} {
+		got, err := ParseComma(Comma(n))
+		if err != nil || got != n {
+			t.Errorf("ParseComma(%q) = %d, %v; want %d", Comma(n), got, err, n)
+		}
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1.5", "1,23", "1234,567", ",123", "123,", "-", "9,223,372,036,854,775,808"} {
+		if got, err := ParseComma(s); err == nil || got != 0 {
+			t.Errorf("ParseComma(%q) = %d, %v; want 0, error", s, got, err)
+		}
+	}
+}
+
+func TestParseCommaf(t *testing.T) {
+	for _, f := range []float64{0, 10.11, -834142.32, 123456789.5, 1e21, math.MaxFloat64, math.SmallestNonzeroFloat64, math.Inf(1), math.Inf(-1)} {
+		got, err := ParseCommaf(Commaf(f))
+		if err != nil || got != f {
+			t.Errorf("ParseCommaf(%q) = %v, %v; want %v", Commaf(f), got, err, f)
+		}
+	}
+	if got, err := ParseCommaf("NaN"); err != nil || !math.IsNaN(got) {
+		t.Errorf("ParseCommaf(NaN) = %v, %v", got, err)
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1.", ".5", "0x1p4", "1e5", "1,23.4"} {
+		if got, err := ParseCommaf(s); err == nil || got != 0 {
+			t.Errorf("ParseCommaf(%q) = %v, %v; want 0, error", s, got, err)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

ParseInt returns the clamped value on range error; force 0.

Done. Added `ParseComma` and `ParseCommaf` to `comma.go`, with tests in `parsecomma_test.go`. Tests pass.

Both reject misplaced commas, so `"1,23"` errors. `ParseCommaf` also takes `NaN`, `+Inf` and `-Inf`, since `Commaf` can output them. Nothing is committed.

</details>

### claude, sloth: pass

Files: [comma.go](../sloth/claude/go-feat-humanize-parse-comma-1/files/comma.go), [comma_test.go](../sloth/claude/go-feat-humanize-parse-comma-1/files/comma_test.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..bfc611f 100644
--- a/comma.go
+++ b/comma.go
@@ -100,6 +100,30 @@ func Commaf(v float64) string {
 	return buf.String()
 }
 
+// ParseComma parses a string produced by Comma back into an int64.
+// It returns 0 and an error if s is not a valid integer.
+//
+// e.g. ParseComma("834,142") -> 834142
+func ParseComma(s string) (int64, error) {
+	v, err := strconv.ParseInt(strings.ReplaceAll(s, ",", ""), 10, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
+// ParseCommaf parses a string produced by Commaf back into a float64.
+// It returns 0 and an error if s is not a valid number.
+//
+// e.g. ParseCommaf("834,142.32") -> 834142.32
+func ParseCommaf(s string) (float64, error) {
+	v, err := strconv.ParseFloat(strings.ReplaceAll(s, ",", ""), 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
 // CommafWithDigits works like the Commaf but limits the resulting
 // string to the given number of decimal places.
 //
diff --git a/comma_test.go b/comma_test.go
index 7c629eb..59a21ee 100644
--- a/comma_test.go
+++ b/comma_test.go
@@ -77,6 +77,32 @@ func TestCommafs(t *testing.T) {
 	}.validate(t)
 }
 
+func TestParseComma(t *testing.T) {
+	for _, n := range []int64{0, 10, 1000, 123456789, -834142, math.MinInt64, math.MaxInt64} {
+		if got, err := ParseComma(Comma(n)); err != nil || got != n {
+			t.Errorf("ParseComma(Comma(%d)) = %d, %v", n, got, err)
+		}
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.5", "9,223,372,036,854,775,808"} {
+		if got, err := ParseComma(s); err == nil || got != 0 {
+			t.Errorf("ParseComma(%q) = %d, %v; want 0 and an error", s, got, err)
+		}
+	}
+}
+
+func TestParseCommaf(t *testing.T) {
+	for _, f := range []float64{0, 10, 10.11, 834142.32, -834142.32, math.MaxFloat64, math.SmallestNonzeroFloat64, math.Inf(1), math.Inf(-1)} {
+		if got, err := ParseCommaf(Commaf(f)); err != nil || got != f {
+			t.Errorf("ParseCommaf(Commaf(%v)) = %v, %v", f, got, err)
+		}
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3"} {
+		if got, err := ParseCommaf(s); err == nil || got != 0 {
+			t.Errorf("ParseCommaf(%q) = %v, %v; want 0 and an error", s, got, err)
+		}
+	}
+}
+
 func BenchmarkCommas(b *testing.B) {
 	for i := 0; i < b.N; i++ {
 		Comma(1234567890)
```

</details>

<details><summary>reply</summary>

I added `ParseComma` and `ParseCommaf` to `comma.go`, and `go test .` passes. Each one strips the commas and then calls `strconv.ParseInt` or `strconv.ParseFloat`. On any error they return `0` and the error.

I added `TestParseComma` and `TestParseCommaf` to `comma_test.go`:
- **Round trips:** `ParseComma(Comma(n))` returns `n` for `0`, `10`, `1000`, `123456789`, `-834142`, `math.MinInt64` and `math.MaxInt64`. `ParseCommaf(Commaf(f))` returns `f` for `0`, `10`, `10.11`, `834142.32`, `-834142.32`, the largest and smallest float64 values, and `±Inf`.
- **Errors:** `""`, `"abc"`, `"123a456"`, and `"1.2.3"` (for `ParseCommaf`) return `0` and an error. For `ParseComma`, `"1.5"` and `"9,223,372,036,854,775,808"` (one past `MaxInt64`) do the same.

- **Comma placement:** The parsers don't check where the commas are, so `"1,2,3"` parses as `123`. I left this out because you didn't ask for it. Checking would take a few more lines.
- **`NaN`:** `ParseCommaf("NaN")` returns `NaN`, which is what `Commaf` produces for it. I didn't add a round-trip test for it, since `NaN != NaN`.

</details>

### claude, all: pass

Files: [comma.go](../all/claude/go-feat-humanize-parse-comma-1/files/comma.go), [comma_test.go](../all/claude/go-feat-humanize-parse-comma-1/files/comma_test.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..e383edd 100644
--- a/comma.go
+++ b/comma.go
@@ -100,6 +100,59 @@ func Commaf(v float64) string {
 	return buf.String()
 }
 
+// uncomma removes the commas from s, reporting false unless they sit
+// between groups of three digits in the integer part.
+func uncomma(s string) (string, bool) {
+	if !strings.Contains(s, ",") {
+		return s, true
+	}
+	whole, frac, _ := strings.Cut(s, ".")
+	if strings.Contains(frac, ",") {
+		return "", false
+	}
+	whole = strings.TrimPrefix(strings.TrimPrefix(whole, "-"), "+")
+	for i, group := range strings.Split(whole, ",") {
+		if len(group) != 3 && (i > 0 || len(group) < 1 || len(group) > 3) {
+			return "", false
+		}
+	}
+	return strings.ReplaceAll(s, ",", ""), true
+}
+
+// ParseComma parses a string produced by Comma, or a plain base 10
+// integer, back into an int64. It returns 0 and an error if s is not
+// a valid number or does not fit in an int64.
+//
+// e.g. ParseComma("834,142") -> 834142
+func ParseComma(s string) (int64, error) {
+	plain, ok := uncomma(s)
+	if !ok {
+		return 0, &strconv.NumError{Func: "ParseComma", Num: s, Err: strconv.ErrSyntax}
+	}
+	v, err := strconv.ParseInt(plain, 10, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
+// ParseCommaf parses a string produced by Commaf, or a plain base 10
+// number, back into a float64. It returns 0 and an error if s is not
+// a valid number.
+//
+// e.g. ParseCommaf("834,142.32") -> 834142.32
+func ParseCommaf(s string) (float64, error) {
+	plain, ok := uncomma(s)
+	if !ok {
+		return 0, &strconv.NumError{Func: "ParseCommaf", Num: s, Err: strconv.ErrSyntax}
+	}
+	v, err := strconv.ParseFloat(plain, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
 // CommafWithDigits works like the Commaf but limits the resulting
 // string to the given number of decimal places.
 //
diff --git a/comma_test.go b/comma_test.go
index 7c629eb..27ce346 100644
--- a/comma_test.go
+++ b/comma_test.go
@@ -157,3 +157,32 @@ func TestHumanizeBigIntMutation(t *testing.T) {
 		t.Fail()
 	}
 }
+
+func TestParseComma(t *testing.T) {
+	for _, n := range []int64{0, 7, 10, 1000, -123456789, math.MinInt64, math.MaxInt64} {
+		if got, err := ParseComma(Comma(n)); err != nil || got != n {
+			t.Errorf("ParseComma(Comma(%d)) = %d, %v", n, got, err)
+		}
+	}
+	if got, err := ParseComma("1000"); err != nil || got != 1000 {
+		t.Errorf("ParseComma(1000) = %d, %v", got, err)
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.5", "1,23", "1234,567", ",123", "123,", "9,223,372,036,854,775,808"} {
+		if got, err := ParseComma(s); err == nil || got != 0 {
+			t.Errorf("ParseComma(%q) = %d, %v; want 0, error", s, got, err)
+		}
+	}
+}
+
+func TestParseCommaf(t *testing.T) {
+	for _, f := range []float64{0, 10.11, -834142.32, 1234567890.83584, math.MaxFloat64, math.Inf(1), math.Inf(-1)} {
+		if got, err := ParseCommaf(Commaf(f)); err != nil || got != f {
+			t.Errorf("ParseCommaf(Commaf(%v)) = %v, %v", f, got, err)
+		}
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1.2,345", "12,34.5"} {
+		if got, err := ParseCommaf(s); err == nil || got != 0 {
+			t.Errorf("ParseCommaf(%q) = %v, %v; want 0, error", s, got, err)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

Done. Added `ParseComma` and `ParseCommaf` to `comma.go`, with tests in `comma_test.go`. Build, vet and tests pass.

Both reject misplaced commas (`"1,23"`, `",123"`, `"1.2,345"`). `ParseCommaf` also round-trips `NaN`, `+Inf` and `-Inf`. README not updated.

</details>

### codex, base: pass

Files: [comma.go](../base/codex/go-feat-humanize-parse-comma-1/files/comma.go), [parse_comma_test.go](../base/codex/go-feat-humanize-parse-comma-1/files/parse_comma_test.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..eb73794 100644
--- a/comma.go
+++ b/comma.go
@@ -8,6 +8,27 @@ import (
 	"strings"
 )
 
+// ParseComma parses a base-10 integer, ignoring commas.
+// It returns 0 and an error if s is invalid or outside the int64 range.
+func ParseComma(s string) (int64, error) {
+	v, err := strconv.ParseInt(strings.ReplaceAll(s, ",", ""), 10, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
+// ParseCommaf parses a floating-point number, ignoring commas.
+// It accepts the NaN and infinity values produced by Commaf.
+// It returns 0 and an error if s is invalid or outside the float64 range.
+func ParseCommaf(s string) (float64, error) {
+	v, err := strconv.ParseFloat(strings.ReplaceAll(s, ",", ""), 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
 // Comma produces a string form of the given number in base 10 with
 // commas after every three orders of magnitude.
 //
diff --git a/parse_comma_test.go b/parse_comma_test.go
new file mode 100644
index 0000000..51f6bee
--- /dev/null
+++ b/parse_comma_test.go
@@ -0,0 +1,38 @@
+package humanize
+
+import (
+	"math"
+	"testing"
+)
+
+func TestParseComma(t *testing.T) {
+	for _, want := range []int64{0, 1, -1, 10, 1000, 123456789, -123456789, math.MinInt64, math.MaxInt64} {
+		s := Comma(want)
+		if got, err := ParseComma(s); err != nil || got != want {
+			t.Errorf("ParseComma(%q) = %d, %v; want %d, nil", s, got, err, want)
+		}
+	}
+	if got, err := ParseComma("10"); err != nil || got != 10 {
+		t.Errorf("ParseComma plain number = %d, %v; want 10, nil", got, err)
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1.5", "9,223,372,036,854,775,808", "-9,223,372,036,854,775,809"} {
+		if got, err := ParseComma(s); err == nil || got != 0 {
+			t.Errorf("ParseComma(%q) = %d, %v; want 0 and an error", s, got, err)
+		}
+	}
+}
+
+func TestParseCommaf(t *testing.T) {
+	for _, want := range []float64{0, math.Copysign(0, -1), 10, 10.11, 1000, 834142.32, -834142.32, math.MaxFloat64, -math.MaxFloat64, math.SmallestNonzeroFloat64, -math.SmallestNonzeroFloat64, math.Inf(1), math.Inf(-1), math.NaN()} {
+		s := Commaf(want)
+		got, err := ParseCommaf(s)
+		if err != nil || (math.IsNaN(want) && !math.IsNaN(got)) || (!math.IsNaN(want) && math.Float64bits(got) != math.Float64bits(want)) {
+			t.Errorf("ParseCommaf(%q) = %g, %v; want %g, nil", s, got, err, want)
+		}
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1e309", "-1e309"} {
+		if got, err := ParseCommaf(s); err == nil || got != 0 {
+			t.Errorf("ParseCommaf(%q) = %g, %v; want 0 and an error", s, got, err)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

I’ll check the existing comma formatters, add the parsers, and test round trips, numeric limits, and invalid input.

Added `ParseComma` and `ParseCommaf`. Both ignore commas and return `0` with an error for invalid or out-of-range input.

Tests cover numeric limits, negative values, plain numbers, float round trips, and invalid input. `go test ./...` passes.

</details>

### codex, muffle: pass

Files: [comma.go](../muffle/codex/go-feat-humanize-parse-comma-1/files/comma.go), [parse_comma_test.go](../muffle/codex/go-feat-humanize-parse-comma-1/files/parse_comma_test.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..75ede8a 100644
--- a/comma.go
+++ b/comma.go
@@ -8,6 +8,27 @@ import (
 	"strings"
 )
 
+// ParseComma parses a base-10 integer, ignoring commas.
+// It returns zero and an error if s is invalid or out of range for int64.
+func ParseComma(s string) (int64, error) {
+	v, err := strconv.ParseInt(strings.ReplaceAll(s, ",", ""), 10, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
+// ParseCommaf parses a floating-point number, ignoring commas.
+// It accepts the special values NaN, +Inf, and -Inf produced by Commaf.
+// It returns zero and an error if s is invalid or out of range for float64.
+func ParseCommaf(s string) (float64, error) {
+	v, err := strconv.ParseFloat(strings.ReplaceAll(s, ",", ""), 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
 // Comma produces a string form of the given number in base 10 with
 // commas after every three orders of magnitude.
 //
diff --git a/parse_comma_test.go b/parse_comma_test.go
new file mode 100644
index 0000000..722884a
--- /dev/null
+++ b/parse_comma_test.go
@@ -0,0 +1,63 @@
+package humanize
+
+import (
+	"math"
+	"testing"
+)
+
+func TestParseComma(t *testing.T) {
+	for _, want := range []int64{0, 1, -1, 10, -10, 999, 1000, -1000, 123456789, -123456789, math.MinInt64, math.MaxInt64} {
+		s := Comma(want)
+		if got, err := ParseComma(s); err != nil || got != want {
+			t.Errorf("ParseComma(%q) = %d, %v; want %d, nil", s, got, err, want)
+		}
+	}
+	for _, tt := range []struct {
+		s    string
+		want int64
+	}{
+		{"10", 10},
+		{"-10", -10},
+		{"+123,456", 123456},
+		{"9223372036854775807", math.MaxInt64},
+		{"-9223372036854775808", math.MinInt64},
+	} {
+		if got, err := ParseComma(tt.s); err != nil || got != tt.want {
+			t.Errorf("ParseComma(%q) = %d, %v; want %d, nil", tt.s, got, err, tt.want)
+		}
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1.5", ",", "1,234a", "9,223,372,036,854,775,808", "-9,223,372,036,854,775,809"} {
+		if got, err := ParseComma(s); err == nil || got != 0 {
+			t.Errorf("ParseComma(%q) = %d, %v; want 0 and an error", s, got, err)
+		}
+	}
+}
+
+func TestParseCommaf(t *testing.T) {
+	for _, want := range []float64{0, math.Copysign(0, -1), 10.11, -10.11, 1000, 834142.32, -834142.32, math.MaxFloat64, -math.MaxFloat64, math.SmallestNonzeroFloat64, -math.SmallestNonzeroFloat64, math.Inf(1), math.Inf(-1), math.NaN()} {
+		s := Commaf(want)
+		got, err := ParseCommaf(s)
+		equal := math.Float64bits(got) == math.Float64bits(want) || (math.IsNaN(got) && math.IsNaN(want))
+		if err != nil || !equal {
+			t.Errorf("ParseCommaf(%q) = %g, %v; want %g, nil", s, got, err, want)
+		}
+	}
+	for _, tt := range []struct {
+		s    string
+		want float64
+	}{
+		{"10", 10},
+		{"10.11", 10.11},
+		{"-834,142.32", -834142.32},
+		{"123,456,789", 123456789},
+	} {
+		if got, err := ParseCommaf(tt.s); err != nil || got != tt.want {
+			t.Errorf("ParseCommaf(%q) = %g, %v; want %g, nil", tt.s, got, err, tt.want)
+		}
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", ",", "1,234a", "1e309", "-1e309"} {
+		if got, err := ParseCommaf(s); err == nil || got != 0 {
+			t.Errorf("ParseCommaf(%q) = %g, %v; want 0 and an error", s, got, err)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

I’ll check how `Comma` and `Commaf` format numbers, then add parsers and tests for round trips, limits, and invalid input.

Added `humanize.ParseComma` and `humanize.ParseCommaf`. Both ignore commas and return `0` with an error for invalid or out-of-range input.

Tests cover round trips, integer limits, float extremes, negative numbers, and invalid inputs. `go test ./...` passes.

</details>

### codex, hush: pass

Files: [comma.go](../hush/codex/go-feat-humanize-parse-comma-1/files/comma.go), [parse_comma_test.go](../hush/codex/go-feat-humanize-parse-comma-1/files/parse_comma_test.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..452a097 100644
--- a/comma.go
+++ b/comma.go
@@ -8,6 +8,27 @@ import (
 	"strings"
 )
 
+// ParseComma parses a base-10 integer, ignoring commas.
+// It returns zero and an error if s is invalid or outside the int64 range.
+func ParseComma(s string) (int64, error) {
+	v, err := strconv.ParseInt(strings.ReplaceAll(s, ",", ""), 10, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
+// ParseCommaf parses a floating-point number, ignoring commas.
+// It accepts the special values NaN, +Inf, and -Inf produced by Commaf.
+// It returns zero and an error if s is invalid or overflows float64.
+func ParseCommaf(s string) (float64, error) {
+	v, err := strconv.ParseFloat(strings.ReplaceAll(s, ",", ""), 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
 // Comma produces a string form of the given number in base 10 with
 // commas after every three orders of magnitude.
 //
diff --git a/parse_comma_test.go b/parse_comma_test.go
new file mode 100644
index 0000000..00f1172
--- /dev/null
+++ b/parse_comma_test.go
@@ -0,0 +1,39 @@
+package humanize
+
+import (
+	"math"
+	"strconv"
+	"testing"
+)
+
+func TestParseComma(t *testing.T) {
+	for _, want := range []int64{0, 1, -1, 10, -10, 123456789, -123456789, math.MinInt64, math.MaxInt64} {
+		for _, s := range []string{Comma(want), strconv.FormatInt(want, 10)} {
+			got, err := ParseComma(s)
+			if err != nil || got != want {
+				t.Errorf("ParseComma(%q) = %d, %v; want %d, nil", s, got, err, want)
+			}
+		}
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1.5", ",", "9,223,372,036,854,775,808", "-9,223,372,036,854,775,809"} {
+		if got, err := ParseComma(s); err == nil || got != 0 {
+			t.Errorf("ParseComma(%q) = %d, %v; want 0 and an error", s, got, err)
+		}
+	}
+}
+
+func TestParseCommaf(t *testing.T) {
+	for _, want := range []float64{0, math.Copysign(0, -1), 10, 10.11, -10.11, 123456789, -834142.32, math.MaxFloat64, -math.MaxFloat64, math.SmallestNonzeroFloat64, -math.SmallestNonzeroFloat64, math.Inf(1), math.Inf(-1), math.NaN()} {
+		for _, s := range []string{Commaf(want), strconv.FormatFloat(want, 'f', -1, 64)} {
+			got, err := ParseCommaf(s)
+			if err != nil || (got != want && !(math.IsNaN(got) && math.IsNaN(want))) {
+				t.Errorf("ParseCommaf(%q) = %g, %v; want %g, nil", s, got, err, want)
+			}
+		}
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", ",", "1e309", "-1e309"} {
+		if got, err := ParseCommaf(s); err == nil || got != 0 {
+			t.Errorf("ParseCommaf(%q) = %g, %v; want 0 and an error", s, got, err)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

Done.
Added `ParseComma` and `ParseCommaf`; errors return zero. Tests cover round trips, limits, negatives, invalid input, overflow. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [comma.go](../sloth/codex/go-feat-humanize-parse-comma-1/files/comma.go), [comma_test.go](../sloth/codex/go-feat-humanize-parse-comma-1/files/comma_test.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..f6e53ea 100644
--- a/comma.go
+++ b/comma.go
@@ -8,6 +8,26 @@ import (
 	"strings"
 )
 
+// ParseComma parses a base-10 integer, ignoring commas.
+// It returns zero and an error if s cannot be parsed as an int64.
+func ParseComma(s string) (int64, error) {
+	v, err := strconv.ParseInt(strings.ReplaceAll(s, ",", ""), 10, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
+// ParseCommaf parses a floating-point number, ignoring commas.
+// It returns zero and an error if s cannot be parsed as a float64.
+func ParseCommaf(s string) (float64, error) {
+	v, err := strconv.ParseFloat(strings.ReplaceAll(s, ",", ""), 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
 // Comma produces a string form of the given number in base 10 with
 // commas after every three orders of magnitude.
 //
diff --git a/comma_test.go b/comma_test.go
index 7c629eb..0ce2e93 100644
--- a/comma_test.go
+++ b/comma_test.go
@@ -6,6 +6,36 @@ import (
 	"testing"
 )
 
+// TestParseComma checks integer round trips, plain inputs, and invalid inputs.
+func TestParseComma(t *testing.T) {
+	for _, want := range []int64{0, 10, -10, 123456789, -123456789, math.MinInt64, math.MaxInt64} {
+		got, err := ParseComma(Comma(want))
+		if err != nil || got != want {
+			t.Errorf("ParseComma(%q) = %d, %v; want %d, nil", Comma(want), got, err, want)
+		}
+	}
+	for _, s := range []string{"", ",", "abc", "123a456", "1.2.3", "1.5", "9,223,372,036,854,775,808", "-9,223,372,036,854,775,809"} {
+		if got, err := ParseComma(s); err == nil || got != 0 {
+			t.Errorf("ParseComma(%q) = %d, %v; want 0 and an error", s, got, err)
+		}
+	}
+}
+
+// TestParseCommaf checks float round trips, plain inputs, and invalid inputs.
+func TestParseCommaf(t *testing.T) {
+	for _, want := range []float64{0, math.Copysign(0, -1), 10, 10.11, -10.11, 123456789, -834142.32, math.MaxFloat64, -math.MaxFloat64, math.SmallestNonzeroFloat64, math.Inf(1), math.Inf(-1), math.NaN()} {
+		got, err := ParseCommaf(Commaf(want))
+		if err != nil || math.Float64bits(got) != math.Float64bits(want) && !(math.IsNaN(got) && math.IsNaN(want)) {
+			t.Errorf("ParseCommaf(%q) = %g, %v; want %g, nil", Commaf(want), got, err, want)
+		}
+	}
+	for _, s := range []string{"", ",", "abc", "123a456", "1.2.3", "1e309", "-1e309"} {
+		if got, err := ParseCommaf(s); err == nil || got != 0 {
+			t.Errorf("ParseCommaf(%q) = %g, %v; want 0 and an error", s, got, err)
+		}
+	}
+}
+
 func TestCommas(t *testing.T) {
 	testList{
 		{"0", Comma(0), "0"},
```

</details>

<details><summary>reply</summary>

I’ll check the existing formatters and tests, add the parsers in the same style, and run the build and test suite.

The change needs two exported functions in `comma.go` and tests in `comma_test.go`; no existing callers, fixtures, or configuration need changes. I’ll remove commas and use Go’s standard numeric parsers, returning zero on errors, including overflow. Comma placement validation and locale options are outside this request.

Added `ParseComma` and `ParseCommaf`. Both ignore commas and return zero with an error for invalid or overflowing input.

Tests cover round trips, integer limits, float extremes, negative and plain numbers, and invalid inputs.

`go build ./...` and `go test ./...` pass.

</details>

### codex, all: pass

Files: [comma.go](../all/codex/go-feat-humanize-parse-comma-1/files/comma.go), [comma_test.go](../all/codex/go-feat-humanize-parse-comma-1/files/comma_test.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..342bbbe 100644
--- a/comma.go
+++ b/comma.go
@@ -8,6 +8,26 @@ import (
 	"strings"
 )
 
+// ParseComma parses a base-10 integer, ignoring commas.
+// It returns zero and an error if s is invalid or outside the int64 range.
+func ParseComma(s string) (int64, error) {
+	v, err := strconv.ParseInt(strings.ReplaceAll(s, ",", ""), 10, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
+// ParseCommaf parses a floating-point number, ignoring commas.
+// It returns zero and an error if s is invalid or outside the float64 range.
+func ParseCommaf(s string) (float64, error) {
+	v, err := strconv.ParseFloat(strings.ReplaceAll(s, ",", ""), 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
 // Comma produces a string form of the given number in base 10 with
 // commas after every three orders of magnitude.
 //
diff --git a/comma_test.go b/comma_test.go
index 7c629eb..2e911e2 100644
--- a/comma_test.go
+++ b/comma_test.go
@@ -6,6 +6,48 @@ import (
 	"testing"
 )
 
+// TestParseComma checks integer round trips, plain input, and invalid input.
+func TestParseComma(t *testing.T) {
+	for _, want := range []int64{0, 10, -10, 123456789, -123456789, math.MinInt64, math.MaxInt64} {
+		got, err := ParseComma(Comma(want))
+		if err != nil || got != want {
+			t.Errorf("ParseComma(%q) = %d, %v; want %d, nil", Comma(want), got, err, want)
+		}
+	}
+	got, err := ParseComma("10")
+	if err != nil || got != 10 {
+		t.Errorf("ParseComma(10) = %d, %v; want 10, nil", got, err)
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1.5", ",", "9,223,372,036,854,775,808", "-9,223,372,036,854,775,809"} {
+		if got, err := ParseComma(s); err == nil || got != 0 {
+			t.Errorf("ParseComma(%q) = %d, %v; want 0, error", s, got, err)
+		}
+	}
+}
+
+// TestParseCommaf checks floating-point round trips, plain input, and invalid input.
+func TestParseCommaf(t *testing.T) {
+	for _, want := range []float64{0, math.Copysign(0, -1), 10, 10.11, -10.11, 123456789, -834142.32, math.MaxFloat64, -math.MaxFloat64, math.SmallestNonzeroFloat64, -math.SmallestNonzeroFloat64, math.Inf(1), math.Inf(-1), math.NaN()} {
+		got, err := ParseCommaf(Commaf(want))
+		if err != nil || (got != want && !(math.IsNaN(got) && math.IsNaN(want))) || math.Signbit(got) != math.Signbit(want) {
+			t.Errorf("ParseCommaf(%q) = %g, %v; want %g, nil", Commaf(want), got, err, want)
+		}
+	}
+	for _, tt := range []struct {
+		in   string
+		want float64
+	}{{"10", 10}, {"10.11", 10.11}, {"-834,142.32", -834142.32}} {
+		if got, err := ParseCommaf(tt.in); err != nil || got != tt.want {
+			t.Errorf("ParseCommaf(%q) = %g, %v; want %g, nil", tt.in, got, err, tt.want)
+		}
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", ",", "1e309", "-1e309"} {
+		if got, err := ParseCommaf(s); err == nil || got != 0 {
+			t.Errorf("ParseCommaf(%q) = %g, %v; want 0, error", s, got, err)
+		}
+	}
+}
+
 func TestCommas(t *testing.T) {
 	testList{
 		{"0", Comma(0), "0"},
```

</details>

<details><summary>reply</summary>

Done.
Added `ParseComma` and `ParseCommaf`, with round-trip, boundary, and invalid-input tests. `go build ./...` and `go test ./...` pass.

</details>
