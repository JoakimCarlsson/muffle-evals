package mapset

import (
	"database/sql"
	"database/sql/driver"
	"testing"
)

func TestSQLValuerScanner(t *testing.T) {
	for name, mk := range map[string]func() Set[int]{
		"safe":   func() Set[int] { return NewSet(1, 2, 3) },
		"unsafe": func() Set[int] { return NewThreadUnsafeSet(1, 2, 3) },
	} {
		t.Run(name, func(t *testing.T) {
			s := mk()
			b, err := s.(driver.Valuer).Value()
			if err != nil {
				t.Fatal(err)
			}
			if _, ok := b.([]byte); !ok {
				t.Fatalf("got %T", b)
			}
			o := s.Clone()
			o.Clear()
			sc := o.(sql.Scanner)
			if err := sc.Scan(b); err != nil || !o.Equal(s) {
				t.Fatalf("scan bytes: %v %v", err, o)
			}
			if err := sc.Scan("[7]"); err != nil || !o.Equal(seven(s)) {
				t.Fatalf("scan string: %v %v", err, o)
			}
			if sc.Scan(42) == nil || sc.Scan("{bad") == nil || !o.Equal(seven(s)) {
				t.Fatalf("errors must leave set unchanged: %v", o)
			}
			if err := sc.Scan(nil); err != nil || o.Cardinality() != 0 {
				t.Fatalf("scan nil: %v %v", err, o)
			}
		})
	}
}

func seven(like Set[int]) Set[int] {
	s := like.Clone()
	s.Clear()
	s.Add(7)
	return s
}
