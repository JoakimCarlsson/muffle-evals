package mapset

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"math"
	"sync"
	"testing"
)

func checkSQLSet[T comparable](t *testing.T, newSet func(...T) Set[T], old, first, second T, array string) {
	t.Helper()
	s := newSet(old)
	scanner := s.(sql.Scanner)
	valuer := s.(driver.Valuer)
	for _, src := range []any{array, []byte(array)} {
		s.Add(old)
		if err := scanner.Scan(src); err != nil {
			t.Fatal(err)
		}
		if s.Cardinality() != 2 || !s.Contains(first, second) {
			t.Fatalf("Scan did not replace contents: %v", s)
		}
		value, err := valuer.Value()
		if err != nil {
			t.Fatal(err)
		}
		data, ok := value.([]byte)
		if !ok {
			t.Fatalf("Value returned %T, want []byte", value)
		}
		var items []T
		if err := json.Unmarshal(data, &items); err != nil {
			t.Fatal(err)
		}
		if len(items) != 2 || !newSet(items...).Contains(first, second) {
			t.Fatalf("unexpected Value: %s", data)
		}
	}
	for _, src := range []any{42, true, []int{1}, "[", "{}", "true", `[1,"bad",`, []byte(nil), ""} {
		if err := scanner.Scan(src); err == nil {
			t.Fatalf("Scan(%#v) succeeded", src)
		}
		if s.Cardinality() != 2 || !s.Contains(first, second) {
			t.Fatalf("failed Scan changed contents: %v", s)
		}
	}
	for _, src := range []any{nil, "[]", []byte("[]")} {
		s.Add(old)
		if err := scanner.Scan(src); err != nil {
			t.Fatal(err)
		}
		if !s.IsEmpty() {
			t.Fatalf("Scan(%#v) did not clear contents", src)
		}
		value, err := valuer.Value()
		if err != nil || string(value.([]byte)) != "[]" {
			t.Fatalf("empty Value = %s, %v", value, err)
		}
		s.Add(first) // The cleared set remains writable.
	}
}

func TestSQLSet(t *testing.T) {
	t.Run("safe/int", func(t *testing.T) { checkSQLSet(t, NewSet[int], 9, 1, 2, "[1,2,2]") })
	t.Run("unsafe/int", func(t *testing.T) { checkSQLSet(t, NewThreadUnsafeSet[int], 9, 1, 2, "[1,2,2]") })
	t.Run("safe/string", func(t *testing.T) { checkSQLSet(t, NewSet[string], "old", "a", "b", `["a","b","b"]`) })
	t.Run("unsafe/string", func(t *testing.T) { checkSQLSet(t, NewThreadUnsafeSet[string], "old", "a", "b", `["a","b","b"]`) })
	for _, s := range []Set[float64]{NewSet(math.NaN()), NewThreadUnsafeSet(math.NaN())} {
		if _, err := s.(driver.Valuer).Value(); err == nil {
			t.Fatal("Value should return JSON encoding errors")
		}
	}
	for _, s := range []Set[int]{NewSet(9), NewThreadUnsafeSet(9)} {
		if err := s.(sql.Scanner).Scan(`[1,"bad"]`); err == nil || s.Cardinality() != 1 || !s.Contains(9) {
			t.Fatal("element decoding error must preserve contents")
		}
	}
}

func TestSQLSetConcurrent(t *testing.T) {
	s := NewSet(1)
	var wg sync.WaitGroup
	for range 4 {
		wg.Go(func() {
			for range 100 {
				if err := s.(sql.Scanner).Scan("[1,2]"); err != nil {
					t.Error(err)
				}
				if _, err := s.(driver.Valuer).Value(); err != nil {
					t.Error(err)
				}
				s.Add(3)
				s.Contains(1)
			}
		})
	}
	wg.Wait()
}
