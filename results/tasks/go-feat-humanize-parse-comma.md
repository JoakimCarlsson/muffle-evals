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
| claude | muffle | pass | +82/-0 | 31 | 3,067 | $0.082 |
| claude | hush | pass | +86/-0 | 28 | 2,681 | $0.081 |
| claude | sloth | pass | +24/-0 | 0 | 1,873 | $0.069 |
| claude | all | pass | +30/-0 | 0 | 1,437 | $0.067 |
| codex | base | pass | +21/-0 | 38 | 1,510 | - |
| codex | muffle | pass | +21/-0 | 58 | 1,747 | - |
| codex | hush | pass | +21/-0 | 39 | 1,246 | - |
| codex | sloth | pass | +20/-0 | 0 | 721 | - |
| codex | all | pass | +20/-0 | 0 | 648 | - |

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
index 64ce8c9..4dfa460 100644
--- a/comma.go
+++ b/comma.go
@@ -139,3 +139,85 @@ func BigComma(bin *big.Int) string {
 	parts[j] = strconv.Itoa(int(b.Int64()))
 	return sign + strings.Join(parts[j:], ",")
 }
+
+// splitComma validates s as an optionally signed decimal number whose
+// integer part is either plain digits or digits grouped by commas in
+// threes, optionally followed by '.' and digits. It returns s with the
+// commas removed.
+func splitComma(s string) (string, bool) {
+	body := s
+	if body != "" && (body[0] == '-' || body[0] == '+') {
+		body = body[1:]
+	}
+	intPart, frac, hasFrac := strings.Cut(body, ".")
+	if hasFrac && !isDigits(frac) {
+		return "", false
+	}
+
+	groups := strings.Split(intPart, ",")
+	if len(groups) > 1 {
+		if len(groups[0]) > 3 {
+			return "", false
+		}
+		for _, g := range groups[1:] {
+			if len(g) != 3 {
+				return "", false
+			}
+		}
+	}
+	for _, g := range groups {
+		if !isDigits(g) {
+			return "", false
+		}
+	}
+	return s[:len(s)-len(body)] + strings.Join(groups, "") + s[len(s)-len(body)+len(intPart):], true
+}
+
+func isDigits(s string) bool {
+	if s == "" {
+		return false
+	}
+	for i := 0; i < len(s); i++ {
+		if s[i] < '0' || s[i] > '9' {
+			return false
+		}
+	}
+	return true
+}
+
+// ParseComma parses a string produced by Comma back into an int64.
+// Plain numbers without commas are accepted too. On error it returns 0.
+//
+// e.g. ParseComma("834,142") -> 834142
+func ParseComma(s string) (int64, error) {
+	clean, ok := splitComma(s)
+	if !ok || strings.Contains(clean, ".") {
+		return 0, &strconv.NumError{Func: "ParseComma", Num: s, Err: strconv.ErrSyntax}
+	}
+	n, err := strconv.ParseInt(clean, 10, 64)
+	if err != nil {
+		return 0, &strconv.NumError{Func: "ParseComma", Num: s, Err: err.(*strconv.NumError).Err}
+	}
+	return n, nil
+}
+
+// ParseCommaf parses a string produced by Commaf back into a float64.
+// Plain numbers without commas, and "NaN", "+Inf" and "-Inf", are
+// accepted too. On error it returns 0.
+//
+// e.g. ParseCommaf("834,142.32") -> 834142.32
+func ParseCommaf(s string) (float64, error) {
+	switch s {
+	case "NaN", "+Inf", "-Inf":
+		return strconv.ParseFloat(s, 64)
+	}
+	clean, ok := splitComma(s)
+	if !ok {
+		return 0, &strconv.NumError{Func: "ParseCommaf", Num: s, Err: strconv.ErrSyntax}
+	}
+	f, err := strconv.ParseFloat(clean, 64)
+	if err != nil {
+		return 0, &strconv.NumError{Func: "ParseCommaf", Num: s, Err: err.(*strconv.NumError).Err}
+	}
+	return f, nil
+}
diff --git a/comma_test.go b/comma_test.go
index 7c629eb..4c5a4a5 100644
--- a/comma_test.go
+++ b/comma_test.go
@@ -157,3 +157,34 @@ func TestHumanizeBigIntMutation(t *testing.T) {
 		t.Fail()
 	}
 }
+
+func TestParseComma(t *testing.T) {
+	for _, n := range []int64{0, 7, 10, 999, 1000, -1000, 834142, 123456789, -834142, math.MinInt64, math.MaxInt64} {
+		got, err := ParseComma(Comma(n))
+		if err != nil || got != n {
+			t.Errorf("ParseComma(%q) = %d, %v; want %d", Comma(n), got, err, n)
+		}
+	}
+	for _, s := range []string{"", "-", "abc", "123a456", "1.5", "1.2.3", "1,23", "1234,567", "1,2345", ",123", "123,", "9,223,372,036,854,775,808"} {
+		if got, err := ParseComma(s); err == nil || got != 0 {
+			t.Errorf("ParseComma(%q) = %d, %v; want 0, error", s, got, err)
+		}
+	}
+}
+
+func TestParseCommaf(t *testing.T) {
+	for _, f := range []float64{0, 10.11, -834142.32, 123456789, 1e21, 1e-7, math.MaxFloat64, math.Inf(1), math.Inf(-1)} {
+		got, err := ParseCommaf(Commaf(f))
+		if err != nil || got != f {
+			t.Errorf("ParseCommaf(%q) = %v, %v; want %v", Commaf(f), got, err, f)
+		}
+	}
+	if got, err := ParseCommaf(Commaf(math.NaN())); err != nil || !math.IsNaN(got) {
+		t.Errorf("ParseCommaf(NaN) = %v, %v", got, err)
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1.", ".5", "1e5", "1,23.4", "1.2,345"} {
+		if got, err := ParseCommaf(s); err == nil || got != 0 {
+			t.Errorf("ParseCommaf(%q) = %v, %v; want 0, error", s, got, err)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

I added `ParseComma` and `ParseCommaf` to `comma.go`, with tests in `comma_test.go`. The tests pass.

- **Round trips:** `ParseComma(Comma(n))` gives back `n`, including `math.MinInt64` and `math.MaxInt64`. `ParseCommaf(Commaf(f))` gives back `f`, including `1e21`, `math.MaxFloat64` and `±Inf`. `NaN` parses back to NaN.
- **Accepted input:** negative numbers and plain numbers without commas (`"10"`, `"10.11"`) work. A leading `+` is also accepted.
- **Errors:** `""`, `"abc"`, `"123a456"`, `"1.2.3"` and `"1.5"` (for `ParseComma`) return `0` and an error. So does a value that overflows `int64`.

Both functions reject commas that `Comma` would never produce: `"1,23"`, `"1234,567"`, `",123"` and `"123,"` all return an error. They also reject `"1e5"`, `"1."` and `".5"`. A string like `"1234,567"` is more likely a typo than a number someone meant. If you'd rather accept any comma placement, I can loosen it.

Errors are `*strconv.NumError` values with `ParseComma` or `ParseCommaf` as the function name, so `errors.Is(err, strconv.ErrSyntax)` and `errors.Is(err, strconv.ErrRange)` work.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [comma.go](../hush/claude/go-feat-humanize-parse-comma-1/files/comma.go), [comma_test.go](../hush/claude/go-feat-humanize-parse-comma-1/files/comma_test.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..40326a1 100644
--- a/comma.go
+++ b/comma.go
@@ -139,3 +139,89 @@ func BigComma(bin *big.Int) string {
 	parts[j] = strconv.Itoa(int(b.Int64()))
 	return sign + strings.Join(parts[j:], ",")
 }
+
+// stripCommas validates the integer part of s as produced by Comma
+// (optional leading '-', then either plain digits or digit groups
+// separated by commas) and returns s without commas. The returned
+// index is the position of the first non-integer byte in the result.
+func stripCommas(s string) (string, int, bool) {
+	start := 0
+	if strings.HasPrefix(s, "-") {
+		start = 1
+	}
+	end := start
+	for end < len(s) && (s[end] == ',' || (s[end] >= '0' && s[end] <= '9')) {
+		end++
+	}
+	intPart := s[start:end]
+	if intPart == "" {
+		return "", 0, false
+	}
+	if strings.Contains(intPart, ",") {
+		groups := strings.Split(intPart, ",")
+		if len(groups[0]) < 1 || len(groups[0]) > 3 {
+			return "", 0, false
+		}
+		for _, g := range groups[1:] {
+			if len(g) != 3 {
+				return "", 0, false
+			}
+		}
+		intPart = strings.Join(groups, "")
+	}
+	out := s[:start] + intPart
+	return out + s[end:], len(out), true
+}
+
+// ParseComma parses a string produced by Comma back into an int64.
+// Plain numbers without commas are accepted too. It returns 0 and an
+// error if s is not a valid integer or does not fit in an int64.
+//
+// e.g. ParseComma("834,142") -> 834142
+func ParseComma(s string) (int64, error) {
+	clean, n, ok := stripCommas(s)
+	if !ok || n != len(clean) {
+		return 0, &strconv.NumError{Func: "ParseComma", Num: s, Err: strconv.ErrSyntax}
+	}
+	v, err := strconv.ParseInt(clean, 10, 64)
+	if err != nil {
+		return 0, &strconv.NumError{Func: "ParseComma", Num: s, Err: err.(*strconv.NumError).Err}
+	}
+	return v, nil
+}
+
+// ParseCommaf parses a string produced by Commaf back into a float64.
+// Plain numbers without commas are accepted too. It returns 0 and an
+// error if s is not a valid number.
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
+	syntax := &strconv.NumError{Func: "ParseCommaf", Num: s, Err: strconv.ErrSyntax}
+	clean, n, ok := stripCommas(s)
+	if !ok {
+		return 0, syntax
+	}
+	if rest := clean[n:]; rest != "" {
+		if rest[0] != '.' || len(rest) < 2 {
+			return 0, syntax
+		}
+		for i := 1; i < len(rest); i++ {
+			if rest[i] < '0' || rest[i] > '9' {
+				return 0, syntax
+			}
+		}
+	}
+	v, err := strconv.ParseFloat(clean, 64)
+	if err != nil {
+		return 0, &strconv.NumError{Func: "ParseCommaf", Num: s, Err: err.(*strconv.NumError).Err}
+	}
+	return v, nil
+}
diff --git a/comma_test.go b/comma_test.go
index 7c629eb..e5d633e 100644
--- a/comma_test.go
+++ b/comma_test.go
@@ -157,3 +157,31 @@ func TestHumanizeBigIntMutation(t *testing.T) {
 		t.Fail()
 	}
 }
+
+func TestParseComma(t *testing.T) {
+	for _, n := range []int64{0, 7, 10, -1, 999, 1000, -834142, 123456789, math.MinInt64, math.MaxInt64} {
+		got, err := ParseComma(Comma(n))
+		if err != nil || got != n {
+			t.Errorf("ParseComma(%q) = %d, %v; want %d", Comma(n), got, err, n)
+		}
+	}
+	for _, s := range []string{"", "-", "abc", "123a456", "1.2.3", "1.5", "1,23", "1234,567", ",123", "123,", "9223372036854775808", "+1"} {
+		if got, err := ParseComma(s); err == nil || got != 0 {
+			t.Errorf("ParseComma(%q) = %d, %v; want 0, error", s, got, err)
+		}
+	}
+}
+
+func TestParseCommaf(t *testing.T) {
+	for _, f := range []float64{0, 10, 10.11, -834142.32, 123456789.5, 1e21, math.Inf(1), math.Inf(-1)} {
+		got, err := ParseCommaf(Commaf(f))
+		if err != nil || got != f {
+			t.Errorf("ParseCommaf(%q) = %v, %v; want %v", Commaf(f), got, err, f)
+		}
+	}
+	for _, s := range []string{"", "-", "abc", "123a456", "1.2.3", "1.", ".5", "1,23.5", "1.5,000", "1e5"} {
+		if got, err := ParseCommaf(s); err == nil || got != 0 {
+			t.Errorf("ParseCommaf(%q) = %v, %v; want 0, error", s, got, err)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

Done. Added `ParseComma` and `ParseCommaf` to `comma.go`, with tests in `comma_test.go`. `go test .` passes.

Parsing is strict: bad comma grouping like `"1,23"` errors. `ParseCommaf` also accepts `NaN`, `+Inf` and `-Inf`.

</details>

### claude, sloth: pass

Files: [comma.go](../sloth/claude/go-feat-humanize-parse-comma-1/files/comma.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..539f47f 100644
--- a/comma.go
+++ b/comma.go
@@ -139,3 +139,27 @@ func BigComma(bin *big.Int) string {
 	parts[j] = strconv.Itoa(int(b.Int64()))
 	return sign + strings.Join(parts[j:], ",")
 }
+
+// ParseComma parses a string produced by Comma back into an int64.
+// It returns 0 and an error if s is not a valid number.
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
```

</details>

<details><summary>reply</summary>

I added `ParseComma` and `ParseCommaf` to `comma.go`. Both strip the commas and hand the rest to `strconv`. It builds and the existing tests pass. I didn't write new tests because you didn't ask for any, so the round-trip and error cases are untested.

- **Error cases:** `""`, `"abc"`, `"123a456"`, `"1.2.3"` and `"1.5"` (for `ParseComma`) all fail in `strconv`. Both functions return `0` with the error.
- **Range:** an out-of-range value also returns `0` and an error, instead of the clamped value `strconv` would give. `math.MinInt64` and `math.MaxInt64` fit, so they round-trip.
- **Non-finite floats:** `ParseCommaf` accepts `"NaN"`, `"+Inf"` and `"-Inf"`, so `ParseCommaf(Commaf(f))` works for those too.

Two things are more lenient than you might expect:

- **Comma placement:** it isn't checked, so `"1,2,3"` parses as `123`. Checking it would take a small extra validation step. I left it out because you didn't ask for it.
- **`strconv` formats:** `ParseCommaf` also accepts anything else `strconv.ParseFloat` does, such as `"1e5"` and hex floats.

</details>

### claude, all: pass

Files: [comma.go](../all/claude/go-feat-humanize-parse-comma-1/files/comma.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..f8259a4 100644
--- a/comma.go
+++ b/comma.go
@@ -139,3 +139,33 @@ func BigComma(bin *big.Int) string {
 	parts[j] = strconv.Itoa(int(b.Int64()))
 	return sign + strings.Join(parts[j:], ",")
 }
+
+// ParseComma parses a string produced by Comma back into an int64.
+// It returns 0 and an error if the string is not a valid integer.
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
+// Commas are only accepted before the decimal point. It returns 0 and
+// an error if the string is not a valid number.
+//
+// e.g. ParseCommaf("834,142.32") -> 834142.32
+func ParseCommaf(s string) (float64, error) {
+	whole, frac, hasFrac := strings.Cut(s, ".")
+	cleaned := strings.ReplaceAll(whole, ",", "")
+	if hasFrac {
+		cleaned += "." + frac
+	}
+	v, err := strconv.ParseFloat(cleaned, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
```

</details>

<details><summary>reply</summary>

Done. `ParseComma` and `ParseCommaf` added to `comma.go`. Build, existing tests and a throwaway check of your cases passed. I deleted the check, so no tests were added.

Both are lenient about comma placement: `ParseComma("1,2,3")` returns 123. `ParseCommaf` rejects commas after the decimal point.

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
index 64ce8c9..cec3078 100644
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
+// It returns zero and an error if s is invalid or out of range.
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
index 0000000..f306bc4
--- /dev/null
+++ b/parse_comma_test.go
@@ -0,0 +1,58 @@
+package humanize
+
+import (
+	"math"
+	"testing"
+)
+
+func TestParseComma(t *testing.T) {
+	for _, want := range []int64{0, 1, -1, 10, -10, 999, 1000, -1000, 123456789, math.MinInt64, math.MaxInt64} {
+		s := Comma(want)
+		got, err := ParseComma(s)
+		if err != nil || got != want {
+			t.Errorf("ParseComma(%q) = %d, %v; want %d, nil", s, got, err, want)
+		}
+	}
+	for _, s := range []string{"10", "-10", "+10"} {
+		want := int64(10)
+		if s == "-10" {
+			want = -10
+		}
+		if got, err := ParseComma(s); err != nil || got != want {
+			t.Errorf("ParseComma(%q) = %d, %v; want %d, nil", s, got, err, want)
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
+	for _, want := range []float64{0, math.Copysign(0, -1), 10, -10, 10.11, 834142.32, -834142.32, math.MaxFloat64, -math.MaxFloat64, math.SmallestNonzeroFloat64, -math.SmallestNonzeroFloat64, math.Inf(1), math.Inf(-1), math.NaN()} {
+		s := Commaf(want)
+		got, err := ParseCommaf(s)
+		if err != nil || math.Float64bits(got) != math.Float64bits(want) && !(math.IsNaN(got) && math.IsNaN(want)) {
+			t.Errorf("ParseCommaf(%q) = %g, %v; want %g, nil", s, got, err, want)
+		}
+	}
+	for _, tt := range []struct {
+		s    string
+		want float64
+	}{
+		{"10", 10},
+		{"10.11", 10.11},
+		{"-10.11", -10.11},
+		{"-834,142.32", -834142.32},
+	} {
+		if got, err := ParseCommaf(tt.s); err != nil || got != tt.want {
+			t.Errorf("ParseCommaf(%q) = %g, %v; want %g, nil", tt.s, got, err, tt.want)
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

I’ll check the comma formatters and test conventions, add the parsers, and verify round trips and invalid inputs.

Added `ParseComma` and `ParseCommaf`. Both ignore commas and return `0` with an error for invalid or out-of-range input.

Tests cover round trips, integer limits, float extremes, negative numbers, plain numbers, and invalid inputs.

`go test ./...` passes.

</details>

### codex, hush: pass

Files: [comma.go](../hush/codex/go-feat-humanize-parse-comma-1/files/comma.go), [parse_comma_test.go](../hush/codex/go-feat-humanize-parse-comma-1/files/parse_comma_test.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..bb7c2a0 100644
--- a/comma.go
+++ b/comma.go
@@ -8,6 +8,27 @@ import (
 	"strings"
 )
 
+// ParseComma parses a base-10 integer after removing commas.
+// It returns zero and an error if the number is invalid or out of range.
+func ParseComma(s string) (int64, error) {
+	v, err := strconv.ParseInt(strings.ReplaceAll(s, ",", ""), 10, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
+// ParseCommaf parses a floating-point number after removing commas.
+// It accepts the special values NaN, +Inf, and -Inf produced by Commaf.
+// It returns zero and an error if the number is invalid or out of range.
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
index 0000000..990f50f
--- /dev/null
+++ b/parse_comma_test.go
@@ -0,0 +1,39 @@
+package humanize
+
+import (
+	"math"
+	"testing"
+)
+
+func TestParseComma(t *testing.T) {
+	for _, want := range []int64{0, 10, -10, 1000, -1000, 123456789, math.MinInt64, math.MaxInt64} {
+		s := Comma(want)
+		got, err := ParseComma(s)
+		if err != nil || got != want {
+			t.Errorf("ParseComma(%q) = %d, %v; want %d, nil", s, got, err, want)
+		}
+	}
+	if got, err := ParseComma("10"); err != nil || got != 10 {
+		t.Errorf("ParseComma(10) = %d, %v; want 10, nil", got, err)
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1.5", "9,223,372,036,854,775,808", "-9,223,372,036,854,775,809"} {
+		if got, err := ParseComma(s); err == nil || got != 0 {
+			t.Errorf("ParseComma(%q) = %d, %v; want 0 and an error", s, got, err)
+		}
+	}
+}
+
+func TestParseCommaf(t *testing.T) {
+	for _, want := range []float64{0, math.Copysign(0, -1), 10, 10.11, -10.11, 834142.32, -834142.32, math.MaxFloat64, -math.MaxFloat64, math.SmallestNonzeroFloat64, -math.SmallestNonzeroFloat64, math.Inf(1), math.Inf(-1), math.NaN()} {
+		s := Commaf(want)
+		got, err := ParseCommaf(s)
+		if err != nil || (got != want && !(math.IsNaN(got) && math.IsNaN(want))) || math.Signbit(got) != math.Signbit(want) {
+			t.Errorf("ParseCommaf(%q) = %v, %v; want %v, nil", s, got, err, want)
+		}
+	}
+	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1e309", "-1e309"} {
+		if got, err := ParseCommaf(s); err == nil || got != 0 {
+			t.Errorf("ParseCommaf(%q) = %v, %v; want 0 and an error", s, got, err)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

Done.
Added `ParseComma` and `ParseCommaf`; errors return zero. Tests cover round trips, numeric limits, invalid input, overflow. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [comma.go](../sloth/codex/go-feat-humanize-parse-comma-1/files/comma.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..7e63e51 100644
--- a/comma.go
+++ b/comma.go
@@ -57,6 +57,26 @@ func Comma(v int64) string {
 	return string(output)
 }
 
+// ParseComma parses a base-10 integer, ignoring commas.
+// It returns zero and an error if the input is invalid or out of range for int64.
+func ParseComma(s string) (int64, error) {
+	v, err := strconv.ParseInt(strings.ReplaceAll(s, ",", ""), 10, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
+// ParseCommaf parses a floating-point number, ignoring commas.
+// It returns zero and an error if the input is invalid or out of range for float64.
+func ParseCommaf(s string) (float64, error) {
+	v, err := strconv.ParseFloat(strings.ReplaceAll(s, ",", ""), 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
 // Commaf produces a string form of the given number in base 10 with
 // commas after every three orders of magnitude.
 //
```

</details>

<details><summary>reply</summary>

I’ll check the comma formatters and package conventions, add the parsers, then build and run the existing tests.

Both functions can live in `comma.go` using the existing `strings` and `strconv` imports. No callers, fixtures, config, or export lists need changes. I’ll remove commas and parse the result, returning zero on any error, including overflow. This leaves the formatters unchanged and adds no dependencies or options.

Added `ParseComma` and `ParseCommaf` in `comma.go`. Both ignore commas, support plain and negative numbers, and return zero with an error for invalid or overflowing input.

Validation passed: `go build ./...`, `go test ./...`, and `git diff --check`.

</details>

### codex, all: pass

Files: [comma.go](../all/codex/go-feat-humanize-parse-comma-1/files/comma.go)

<details><summary>diff</summary>

```diff
diff --git a/comma.go b/comma.go
index 64ce8c9..97d62da 100644
--- a/comma.go
+++ b/comma.go
@@ -108,6 +108,26 @@ func CommafWithDigits(f float64, decimals int) string {
 	return stripTrailingDigits(Commaf(f), decimals)
 }
 
+// ParseComma parses a base-10 integer with optional commas.
+// It returns zero and an error if the input is invalid or out of range.
+func ParseComma(s string) (int64, error) {
+	v, err := strconv.ParseInt(strings.ReplaceAll(s, ",", ""), 10, 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
+// ParseCommaf parses a floating-point number with optional commas.
+// It returns zero and an error if the input is invalid or out of range.
+func ParseCommaf(s string) (float64, error) {
+	v, err := strconv.ParseFloat(strings.ReplaceAll(s, ",", ""), 64)
+	if err != nil {
+		return 0, err
+	}
+	return v, nil
+}
+
 // BigComma produces a string form of the given big.Int in base 10
 // with commas after every three orders of magnitude.
 func BigComma(bin *big.Int) string {
```

</details>

<details><summary>reply</summary>

Done.
Added `ParseComma` and `ParseCommaf`; strip commas, return zero on parse errors. `go build ./...` and existing tests pass.

</details>
