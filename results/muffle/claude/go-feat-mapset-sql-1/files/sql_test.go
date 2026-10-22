package mapset

import (
	"database/sql"
	"database/sql/driver"
	"testing"
)

func TestSQLValuerScanner(t *testing.T) {
	for name, mk := range map[string]func(...int) Set[int]{"safe": NewSet[int], "unsafe": NewThreadUnsafeSet[int]} {
		s := mk(1, 2, 3)
		v, err := s.(driver.Valuer).Value()
		if err != nil {
			t.Fatal(err)
		}
		if _, ok := v.([]byte); !ok {
			t.Fatalf("%s: want []byte, got %T", name, v)
		}
		if e, _ := mk().(driver.Valuer).Value(); string(e.([]byte)) != "[]" {
			t.Fatalf("%s: empty = %s", name, e)
		}
		sc := s.(sql.Scanner)
		for _, src := range []any{"[4,5]", []byte("[4,5]")} {
			if err := sc.Scan(src); err != nil || !s.Equal(mk(4, 5)) {
				t.Fatalf("%s: scan %v: %v %v", name, src, err, s)
			}
		}
		for _, bad := range []any{42, "{bad", `["a"]`} {
			if err := sc.Scan(bad); err == nil || !s.Equal(mk(4, 5)) {
				t.Fatalf("%s: bad %v: err=%v set=%v", name, bad, err, s)
			}
		}
		if err := sc.Scan(nil); err != nil || s.Cardinality() != 0 {
			t.Fatalf("%s: nil scan: %v %v", name, err, s)
		}
	}
}
