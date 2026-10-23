package humanize

import (
	"math"
	"testing"
)

func TestParseComma(t *testing.T) {
	for _, n := range []int64{0, 7, 10, -1, 999, 1000, -834142, 123456789, math.MinInt64, math.MaxInt64} {
		got, err := ParseComma(Comma(n))
		if err != nil || got != n {
			t.Errorf("ParseComma(%q) = %d, %v; want %d", Comma(n), got, err, n)
		}
	}
	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1.5", "1,23", "1234,567", ",123", "123,", "-", "9,223,372,036,854,775,808"} {
		if got, err := ParseComma(s); err == nil || got != 0 {
			t.Errorf("ParseComma(%q) = %d, %v; want 0, error", s, got, err)
		}
	}
}

func TestParseCommaf(t *testing.T) {
	for _, f := range []float64{0, 10.11, -834142.32, 123456789.5, 1e21, math.MaxFloat64, math.SmallestNonzeroFloat64, math.Inf(1), math.Inf(-1)} {
		got, err := ParseCommaf(Commaf(f))
		if err != nil || got != f {
			t.Errorf("ParseCommaf(%q) = %v, %v; want %v", Commaf(f), got, err, f)
		}
	}
	if got, err := ParseCommaf("NaN"); err != nil || !math.IsNaN(got) {
		t.Errorf("ParseCommaf(NaN) = %v, %v", got, err)
	}
	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1.", ".5", "0x1p4", "1e5", "1,23.4"} {
		if got, err := ParseCommaf(s); err == nil || got != 0 {
			t.Errorf("ParseCommaf(%q) = %v, %v; want 0, error", s, got, err)
		}
	}
}
