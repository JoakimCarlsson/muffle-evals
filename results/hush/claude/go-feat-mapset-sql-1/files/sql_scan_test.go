package mapset

import (
	"database/sql"
	"database/sql/driver"
	"testing"
)

func TestSQLValuerScanner(t *testing.T) {
	for name, s := range map[string]Set[int]{"safe": NewSet(1, 2), "unsafe": NewThreadUnsafeSet(1, 2)} {
		v, err := s.(driver.Valuer).Value()
		if err != nil {
			t.Fatal(name, err)
		}
		if _, ok := v.([]byte); !ok {
			t.Fatalf("%s: got %T", name, v)
		}
		d := NewSet[int]()
		if name == "unsafe" {
			d = NewThreadUnsafeSet[int]()
		}
		sc := d.(sql.Scanner)
		if err := sc.Scan(v); err != nil || !d.Equal(s) {
			t.Fatal(name, err, d)
		}
		if err := sc.Scan("[5]"); err != nil || d.Cardinality() != 1 || !d.Contains(5) {
			t.Fatal(name, err, d)
		}
		if sc.Scan(42) == nil || sc.Scan("{bad") == nil || !d.Contains(5) || d.Cardinality() != 1 {
			t.Fatal(name, "error case", d)
		}
		if err := sc.Scan(nil); err != nil || d.Cardinality() != 0 {
			t.Fatal(name, err, d)
		}
		e, _ := d.(driver.Valuer).Value()
		if string(e.([]byte)) != "[]" {
			t.Fatal(name, string(e.([]byte)))
		}
	}
}
