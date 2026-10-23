package mapset

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"math"
	"testing"
)

func testSQLSet[T comparable](t *testing.T, constructor func(...T) Set[T], old T, values []T, data string) {
	t.Helper()
	s := constructor(old)
	scanner := s.(sql.Scanner)
	valuer := s.(driver.Valuer)
	for _, src := range []any{data, []byte(data)} {
		s.Add(old)
		if err := scanner.Scan(src); err != nil {
			t.Fatal(err)
		}
		if !s.Equal(constructor(values...)) {
			t.Fatalf("Scan(%q) = %v", src, s)
		}
		value, err := valuer.Value()
		if err != nil {
			t.Fatal(err)
		}
		b, ok := value.([]byte)
		if !ok {
			t.Fatalf("Value returned %T, want []byte", value)
		}
		var decoded []T
		if err := json.Unmarshal(b, &decoded); err != nil {
			t.Fatal(err)
		}
		if len(decoded) != s.Cardinality() || !s.Equal(constructor(decoded...)) {
			t.Fatalf("Value round trip = %v, want %v", decoded, s)
		}
	}
	before := s.Clone()
	for _, src := range []any{42, true, struct{}{}, "", []byte(nil), "[", "{}", "true", data + " trailing", `[1,"x"]`} {
		if err := scanner.Scan(src); err == nil {
			t.Fatalf("Scan(%q) succeeded", src)
		}
		if !s.Equal(before) {
			t.Fatalf("Scan(%q) changed set to %v", src, s)
		}
	}
	for _, src := range []any{nil, "[]", []byte("[]")} {
		s.Add(old)
		if err := scanner.Scan(src); err != nil {
			t.Fatal(err)
		}
		if !s.IsEmpty() {
			t.Fatalf("Scan(%q) did not clear set", src)
		}
		value, err := valuer.Value()
		if err != nil || string(value.([]byte)) != "[]" {
			t.Fatalf("empty Value = %s, %v", value, err)
		}
	}
}

func TestSQLSet(t *testing.T) {
	t.Run("safe/int", func(t *testing.T) {
		testSQLSet(t, NewSet[int], 99, []int{1, 2}, `[1,2,1]`)
	})
	t.Run("unsafe/int", func(t *testing.T) {
		testSQLSet(t, NewThreadUnsafeSet[int], 99, []int{1, 2}, `[1,2,1]`)
	})
	t.Run("safe/string", func(t *testing.T) {
		testSQLSet(t, NewSet[string], "old", []string{"a", "b"}, `["a","b","a"]`)
	})
	t.Run("unsafe/string", func(t *testing.T) {
		testSQLSet(t, NewThreadUnsafeSet[string], "old", []string{"a", "b"}, `["a","b","a"]`)
	})
}

func TestSQLValueError(t *testing.T) {
	for _, s := range []Set[float64]{NewSet(math.Inf(1)), NewThreadUnsafeSet(math.Inf(1))} {
		if _, err := s.(driver.Valuer).Value(); err == nil {
			t.Fatal("Value succeeded for infinity")
		}
	}
}
