package mapset

import (
	"database/sql"
	"database/sql/driver"
	"testing"
)

func TestSQLValuerScanner(t *testing.T) {
	for name, s := range map[string]Set[int]{"safe": NewSet(1, 2), "unsafe": NewThreadUnsafeSet(1, 2)} {
		v, ok := s.(driver.Valuer)
		sc, ok2 := s.(sql.Scanner)
		if !ok || !ok2 {
			t.Fatalf("%s: interfaces not implemented", name)
		}
		val, err := v.Value()
		if b, isB := val.([]byte); err != nil || !isB || len(b) != 5 {
			t.Fatalf("%s: Value = %v, %v", name, val, err)
		}
		if err := sc.Scan("[3,4,5]"); err != nil || s.Cardinality() != 3 || !s.Contains(3, 4, 5) {
			t.Fatalf("%s: scan string: %v %v", name, err, s)
		}
		if err := sc.Scan([]byte("[7]")); err != nil || s.Cardinality() != 1 || !s.Contains(7) {
			t.Fatalf("%s: scan bytes: %v %v", name, err, s)
		}
		if sc.Scan(42) == nil || sc.Scan("{bad") == nil || sc.Scan(`["x"]`) == nil || !s.Contains(7) || s.Cardinality() != 1 {
			t.Fatalf("%s: error cases changed set: %v", name, s)
		}
		if err := sc.Scan(nil); err != nil || s.Cardinality() != 0 {
			t.Fatalf("%s: scan nil: %v %v", name, err, s)
		}
		if val, _ := v.Value(); string(val.([]byte)) != "[]" {
			t.Fatalf("%s: empty Value = %s", name, val)
		}
	}
}
