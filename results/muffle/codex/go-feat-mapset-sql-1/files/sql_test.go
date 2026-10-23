package mapset

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"math"
	"testing"
)

func testSQLSet[T comparable](t *testing.T, newSet func(...T) Set[T], original T, values []T, encoded string) {
	t.Helper()
	s := newSet(original)
	scanner := s.(sql.Scanner)
	valuer := s.(driver.Valuer)
	for _, src := range []any{encoded, []byte(encoded)} {
		s.Add(original)
		if err := scanner.Scan(src); err != nil {
			t.Fatal(err)
		}
		if !s.Equal(newSet(values...)) {
			t.Fatalf("Scan(%v) produced %v", src, s)
		}
		value, err := valuer.Value()
		if err != nil {
			t.Fatal(err)
		}
		data, ok := value.([]byte)
		if !ok {
			t.Fatalf("Value returned %T, want []byte", value)
		}
		var decoded []T
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatal(err)
		}
		if !newSet(decoded...).Equal(s) {
			t.Fatalf("Value round trip produced %v", decoded)
		}
	}
	for _, src := range []any{42, true, struct{}{}, "", "[", "{}", "[true]", encoded + " trailing", []byte(nil)} {
		before := s.Clone()
		if err := scanner.Scan(src); err == nil {
			t.Errorf("Scan(%v) should fail", src)
		}
		if !s.Equal(before) {
			t.Fatalf("Scan(%v) changed the set on error", src)
		}
	}
	for _, src := range []any{nil, "[]", []byte("[]")} {
		s.Add(original)
		if err := scanner.Scan(src); err != nil || !s.IsEmpty() {
			t.Fatalf("Scan(%v): set=%v, error=%v", src, s, err)
		}
		value, err := valuer.Value()
		if err != nil || string(value.([]byte)) != "[]" {
			t.Fatalf("empty Value: %s, %v", value, err)
		}
	}
}

func TestSQLSet(t *testing.T) {
	t.Run("thread-safe/int", func(t *testing.T) {
		testSQLSet(t, NewSet[int], 99, []int{1, 2, 3}, `[1,2,2,3]`)
	})
	t.Run("thread-unsafe/int", func(t *testing.T) {
		testSQLSet(t, NewThreadUnsafeSet[int], 99, []int{1, 2, 3}, `[1,2,2,3]`)
	})
	t.Run("thread-safe/string", func(t *testing.T) {
		testSQLSet(t, NewSet[string], "old", []string{"a", "b"}, `["a","b","a"]`)
	})
	t.Run("thread-unsafe/string", func(t *testing.T) {
		testSQLSet(t, NewThreadUnsafeSet[string], "old", []string{"a", "b"}, `["a","b","a"]`)
	})
}

func TestSQLValueError(t *testing.T) {
	for _, s := range []Set[float64]{NewSet(math.Inf(1)), NewThreadUnsafeSet(math.Inf(1))} {
		if _, err := s.(driver.Valuer).Value(); err == nil {
			t.Error("Value should report JSON encoding errors")
		}
	}
}
