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

// parseCommaDigits validates a number formatted like the output of Comma
// or Commaf and returns it with the thousands separators removed. Commas
// are optional, but when present they must separate groups of exactly
// three digits. A fractional part is only accepted if frac is true.
func parseCommaDigits(s string, frac bool) (string, error) {
	err := &strconv.NumError{Func: "ParseComma", Num: s, Err: strconv.ErrSyntax}

	body := strings.TrimPrefix(s, "-")
	intPart, fracPart, hasFrac := strings.Cut(body, ".")
	if hasFrac && (!frac || fracPart == "") {
		return "", err
	}
	for i := 0; i < len(fracPart); i++ {
		if fracPart[i] < '0' || fracPart[i] > '9' {
			return "", err
		}
	}

	groups := strings.Split(intPart, ",")
	for i, g := range groups {
		if len(groups) > 1 && ((i == 0 && len(g) > 3) || (i > 0 && len(g) != 3)) {
			return "", err
		}
		if g == "" {
			return "", err
		}
		for j := 0; j < len(g); j++ {
			if g[j] < '0' || g[j] > '9' {
				return "", err
			}
		}
	}

	out := strings.Join(groups, "")
	if s[0] == '-' {
		out = "-" + out
	}
	if hasFrac {
		out += "." + fracPart
	}
	return out, nil
}

// ParseComma parses a string produced by Comma, or a plain base 10
// integer, back into an int64. It returns 0 and an error if s is not a
// valid number or does not fit in an int64.
//
// e.g. ParseComma("834,142") -> 834142
func ParseComma(s string) (int64, error) {
	clean, err := parseCommaDigits(s, false)
	if err != nil {
		return 0, err
	}
	v, err := strconv.ParseInt(clean, 10, 64)
	if err != nil {
		return 0, err
	}
	return v, nil
}

// ParseCommaf parses a string produced by Commaf, or a plain base 10
// number, back into a float64. "NaN", "+Inf" and "-Inf" are accepted as
// Commaf produces them. It returns 0 and an error if s is not a valid
// number or does not fit in a float64.
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
	clean, err := parseCommaDigits(s, true)
	if err != nil {
		return 0, err
	}
	v, err := strconv.ParseFloat(clean, 64)
	if err != nil {
		return 0, err
	}
	return v, nil
}
