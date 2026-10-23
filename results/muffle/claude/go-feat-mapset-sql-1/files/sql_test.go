package mapset

import (
	"database/sql"
	"database/sql/driver"
	"testing"
)

func TestSQLValuerScanner(t *testing.T) {
	for name, mk := range map[string]func(...int) Set[int]{
		"safe":   NewSet[int],
		"unsafe": NewThreadUnsafeSet[int],
	} {
		t.Run(name, func(t *testing.T) {
			s := mk(1, 2, 3)
			v, err := any(s).(driver.Valuer).Value()
			if err != nil {
				t.Fatal(err)
			}
			if _, ok := v.([]byte); !ok {
				t.Fatalf("got %T", v)
			}
			d := mk(9)
			sc := any(d).(sql.Scanner)
			if err := sc.Scan(v); err != nil || !d.Equal(s) {
				t.Fatalf("scan []byte: %v %v", err, d)
			}
			if err := sc.Scan("[4,5]"); err != nil || !d.Equal(mk(4, 5)) {
				t.Fatalf("scan string: %v %v", err, d)
			}
			if sc.Scan(42) == nil || sc.Scan("{bad") == nil || !d.Equal(mk(4, 5)) {
				t.Fatalf("errors must leave set unchanged: %v", d)
			}
			if err := sc.Scan(nil); err != nil || d.Cardinality() != 0 {
				t.Fatalf("scan nil: %v %v", err, d)
			}
			v, _ = any(d).(driver.Valuer).Value()
			if string(v.([]byte)) != "[]" {
				t.Fatalf("empty: %s", v)
			}
		})
	}
}
