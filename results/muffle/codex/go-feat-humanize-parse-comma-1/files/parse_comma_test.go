package humanize

import (
	"math"
	"testing"
)

func TestParseComma(t *testing.T) {
	for _, want := range []int64{0, 1, -1, 10, -10, 999, 1000, -1000, 123456789, math.MinInt64, math.MaxInt64} {
		s := Comma(want)
		got, err := ParseComma(s)
		if err != nil || got != want {
			t.Errorf("ParseComma(%q) = %d, %v; want %d, nil", s, got, err, want)
		}
	}
	for _, s := range []string{"10", "-10", "+10"} {
		want := int64(10)
		if s == "-10" {
			want = -10
		}
		if got, err := ParseComma(s); err != nil || got != want {
			t.Errorf("ParseComma(%q) = %d, %v; want %d, nil", s, got, err, want)
		}
	}
	for _, s := range []string{"", "abc", "123a456", "1.2.3", "1.5", ",", "9,223,372,036,854,775,808", "-9,223,372,036,854,775,809"} {
		if got, err := ParseComma(s); err == nil || got != 0 {
			t.Errorf("ParseComma(%q) = %d, %v; want 0 and an error", s, got, err)
		}
	}
}

func TestParseCommaf(t *testing.T) {
	for _, want := range []float64{0, math.Copysign(0, -1), 10, -10, 10.11, 834142.32, -834142.32, math.MaxFloat64, -math.MaxFloat64, math.SmallestNonzeroFloat64, -math.SmallestNonzeroFloat64, math.Inf(1), math.Inf(-1), math.NaN()} {
		s := Commaf(want)
		got, err := ParseCommaf(s)
		if err != nil || math.Float64bits(got) != math.Float64bits(want) && !(math.IsNaN(got) && math.IsNaN(want)) {
			t.Errorf("ParseCommaf(%q) = %g, %v; want %g, nil", s, got, err, want)
		}
	}
	for _, tt := range []struct {
		s    string
		want float64
	}{
		{"10", 10},
		{"10.11", 10.11},
		{"-10.11", -10.11},
		{"-834,142.32", -834142.32},
	} {
		if got, err := ParseCommaf(tt.s); err != nil || got != tt.want {
			t.Errorf("ParseCommaf(%q) = %g, %v; want %g, nil", tt.s, got, err, tt.want)
		}
	}
	for _, s := range []string{"", "abc", "123a456", "1.2.3", ",", "1e309", "-1e309"} {
		if got, err := ParseCommaf(s); err == nil || got != 0 {
			t.Errorf("ParseCommaf(%q) = %g, %v; want 0 and an error", s, got, err)
		}
	}
}
