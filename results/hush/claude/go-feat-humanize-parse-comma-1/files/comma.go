package humanize

import (
	"bytes"
	"math"
	"math/big"
	"strconv"
	"strings"
)

// Comma produces a string form of the given number in base 10 with
// commas after every three orders of magnitude.
//
// e.g. Comma(834142) -> 834,142
func Comma(v int64) string {
	// Shortcut for [0, 7]
	if v&^0b111 == 0 {
		return string([]byte{byte(v) + 48})
	}

	// Min int64 can't be negated to a usable value, so it has to be special cased.
	if v == math.MinInt64 {
		return "-9,223,372,036,854,775,808"
	}
	// Counting the number of digits.
	var count byte = 0
	for n := v; n != 0; n = n / 10 {
		count++
	}

	count += (count - 1) / 3
	if v < 0 {
		v = 0 - v
		count++
	}
	output := make([]byte, count)
	j := len(output) - 1

	var counter byte = 0
	for v > 9 {
		output[j] = byte(v%10) + 48
		v = v / 10
		j--
		if counter == 2 {
			counter = 0
			output[j] = ','
			j--
		} else {
			counter++
		}
	}

	output[j] = byte(v) + 48
	if j == 1 {
		output[0] = '-'
	}
	return string(output)
}

// Commaf produces a string form of the given number in base 10 with
// commas after every three orders of magnitude.
//
// e.g. Commaf(834142.32) -> 834,142.32
func Commaf(v float64) string {
	if math.IsNaN(v) {
		return "NaN"
	}
	if math.IsInf(v, 1) {
		return "+Inf"
	}
	if math.IsInf(v, -1) {
		return "-Inf"
	}

	buf := &bytes.Buffer{}
	if v < 0 {
		buf.Write([]byte{'-'})
		v = 0 - v
	}

	comma := []byte{','}

	parts := strings.Split(strconv.FormatFloat(v, 'f', -1, 64), ".")
	pos := 0
	if len(parts[0])%3 != 0 {
		pos += len(parts[0]) % 3
		buf.WriteString(parts[0][:pos])
		buf.Write(comma)
	}
	for ; pos < len(parts[0]); pos += 3 {
		buf.WriteString(parts[0][pos : pos+3])
		buf.Write(comma)
	}
	buf.Truncate(buf.Len() - 1)

	if len(parts) > 1 {
		buf.Write([]byte{'.'})
		buf.WriteString(parts[1])
	}
	return buf.String()
}

// CommafWithDigits works like the Commaf but limits the resulting
// string to the given number of decimal places.
//
// e.g. CommafWithDigits(834142.32, 1) -> 834,142.3
func CommafWithDigits(f float64, decimals int) string {
	return stripTrailingDigits(Commaf(f), decimals)
}

// BigComma produces a string form of the given big.Int in base 10
// with commas after every three orders of magnitude.
func BigComma(bin *big.Int) string {
	b := new(big.Int).Set(bin)
	sign := ""
	if b.Sign() < 0 {
		sign = "-"
		b.Abs(b)
	}

	athousand := big.NewInt(1000)
	c := (&big.Int{}).Set(b)
	_, m := oom(c, athousand)
	parts := make([]string, m+1)
	j := len(parts) - 1

	mod := &big.Int{}
	for b.Cmp(athousand) >= 0 {
		b.DivMod(b, athousand, mod)
		parts[j] = strconv.FormatInt(mod.Int64(), 10)
		switch len(parts[j]) {
		case 2:
			parts[j] = "0" + parts[j]
		case 1:
			parts[j] = "00" + parts[j]
		}
		j--
	}
	parts[j] = strconv.Itoa(int(b.Int64()))
	return sign + strings.Join(parts[j:], ",")
}

// stripCommas validates the integer part of s as produced by Comma
// (optional leading '-', then either plain digits or digit groups
// separated by commas) and returns s without commas. The returned
// index is the position of the first non-integer byte in the result.
func stripCommas(s string) (string, int, bool) {
	start := 0
	if strings.HasPrefix(s, "-") {
		start = 1
	}
	end := start
	for end < len(s) && (s[end] == ',' || (s[end] >= '0' && s[end] <= '9')) {
		end++
	}
	intPart := s[start:end]
	if intPart == "" {
		return "", 0, false
	}
	if strings.Contains(intPart, ",") {
		groups := strings.Split(intPart, ",")
		if len(groups[0]) < 1 || len(groups[0]) > 3 {
			return "", 0, false
		}
		for _, g := range groups[1:] {
			if len(g) != 3 {
				return "", 0, false
			}
		}
		intPart = strings.Join(groups, "")
	}
	out := s[:start] + intPart
	return out + s[end:], len(out), true
}

// ParseComma parses a string produced by Comma back into an int64.
// Plain numbers without commas are accepted too. It returns 0 and an
// error if s is not a valid integer or does not fit in an int64.
//
// e.g. ParseComma("834,142") -> 834142
func ParseComma(s string) (int64, error) {
	clean, n, ok := stripCommas(s)
	if !ok || n != len(clean) {
		return 0, &strconv.NumError{Func: "ParseComma", Num: s, Err: strconv.ErrSyntax}
	}
	v, err := strconv.ParseInt(clean, 10, 64)
	if err != nil {
		return 0, &strconv.NumError{Func: "ParseComma", Num: s, Err: err.(*strconv.NumError).Err}
	}
	return v, nil
}

// ParseCommaf parses a string produced by Commaf back into a float64.
// Plain numbers without commas are accepted too. It returns 0 and an
// error if s is not a valid number.
//
// e.g. ParseCommaf("834,142.32") -> 834142.32
func ParseCommaf(s string) (float64, error) {
	switch s {
	case "NaN":
		return math.NaN(), nil
	case "+Inf":
		return math.Inf(1), nil
	case "-Inf":
		return math.Inf(-1), nil
	}
	syntax := &strconv.NumError{Func: "ParseCommaf", Num: s, Err: strconv.ErrSyntax}
	clean, n, ok := stripCommas(s)
	if !ok {
		return 0, syntax
	}
	if rest := clean[n:]; rest != "" {
		if rest[0] != '.' || len(rest) < 2 {
			return 0, syntax
		}
		for i := 1; i < len(rest); i++ {
			if rest[i] < '0' || rest[i] > '9' {
				return 0, syntax
			}
		}
	}
	v, err := strconv.ParseFloat(clean, 64)
	if err != nil {
		return 0, &strconv.NumError{Func: "ParseCommaf", Num: s, Err: err.(*strconv.NumError).Err}
	}
	return v, nil
}
