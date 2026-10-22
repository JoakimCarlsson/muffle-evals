package mapset

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"math"
	"testing"
)

func testSQLSet[T comparable](t *testing.T, newSet func(...T) Set[T], initial T, input string, expected ...T) {
	t.Helper()
	s := newSet(initial)
	scanner, ok := s.(sql.Scanner)
	if !ok {
		t.Fatal("set does not implement sql.Scanner")
	}
	valuer, ok := s.(driver.Valuer)
	if !ok {
		t.Fatal("set does not implement driver.Valuer")
	}
	for _, src := range []any{input, []byte(input)} {
		s.Add(initial)
		if err := scanner.Scan(src); err != nil {
			t.Fatal(err)
		}
		if s.Cardinality() != len(expected) || !s.Contains(expected...) {
			t.Fatalf("unexpected contents: %v", s)
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
		if len(decoded) != len(expected) || !s.Contains(decoded...) {
			t.Fatalf("unexpected JSON: %s", data)
		}
	}
	for _, src := range []any{42, true, []string{}, "", "[", "{}", "true", "[1,", `[1,"wrong"]`, []byte(`{"x":1}`)} {
		before := s.Clone()
		if err := scanner.Scan(src); err == nil {
			t.Fatalf("Scan(%#v) succeeded", src)
		}
		if !s.Equal(before) {
			t.Fatalf("Scan(%#v) changed contents", src)
		}
	}
	for _, src := range []any{nil, "[]", []byte("[]")} {
		s.Add(initial)
		if err := scanner.Scan(src); err != nil {
			t.Fatal(err)
		}
		if !s.IsEmpty() {
			t.Fatalf("Scan(%#v) did not empty the set", src)
		}
		value, err := valuer.Value()
		if err != nil {
			t.Fatal(err)
		}
		if string(value.([]byte)) != "[]" {
			t.Fatalf("empty set encoded as %s", value)
		}
		s.Add(initial)
		if !s.Contains(initial) {
			t.Fatal("cannot add after clearing")
		}
	}
}

func TestSQLSet(t *testing.T) {
	t.Run("safe/int", func(t *testing.T) { testSQLSet(t, NewSet[int], 99, "[1,2,2,3]", 1, 2, 3) })
	t.Run("unsafe/int", func(t *testing.T) { testSQLSet(t, NewThreadUnsafeSet[int], 99, "[1,2,2,3]", 1, 2, 3) })
	t.Run("safe/string", func(t *testing.T) { testSQLSet(t, NewSet[string], "old", `["a","b","a"]`, "a", "b") })
	t.Run("unsafe/string", func(t *testing.T) { testSQLSet(t, NewThreadUnsafeSet[string], "old", `["a","b","a"]`, "a", "b") })
}

func TestSQLValueError(t *testing.T) {
	for _, s := range []Set[float64]{NewSet(math.Inf(1)), NewThreadUnsafeSet(math.Inf(1))} {
		if _, err := s.(driver.Valuer).Value(); err == nil {
			t.Fatal("Value should fail for infinity")
		}
	}
}
