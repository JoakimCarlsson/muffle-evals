package mapset

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"sync"
	"testing"
)

func testSQLSet[T comparable](t *testing.T, newSet func(...T) Set[T], old T, input string, want ...T) {
	t.Helper()
	s := newSet(old)
	scanner := s.(sql.Scanner)
	valuer := s.(driver.Valuer)
	for _, src := range []any{input, []byte(input)} {
		s.Add(old)
		if err := scanner.Scan(src); err != nil {
			t.Fatal(err)
		}
		if s.Cardinality() != len(want) || !s.Contains(want...) {
			t.Fatalf("Scan(%T) = %v, want %v", src, s, want)
		}
		value, err := valuer.Value()
		if err != nil {
			t.Fatal(err)
		}
		data, ok := value.([]byte)
		if !ok {
			t.Fatalf("Value returned %T, want []byte", value)
		}
		var got []T
		if err := json.Unmarshal(data, &got); err != nil {
			t.Fatal(err)
		}
		if len(got) != len(want) || !s.Contains(got...) {
			t.Fatalf("Value = %s, want %v", data, want)
		}
	}
	for _, src := range []any{42, true, struct{}{}, "[", []byte("[] trailing"), "{}", "true", "[1,\"wrong\"]", []byte(nil)} {
		if err := scanner.Scan(src); err == nil {
			t.Fatalf("Scan(%#v) succeeded", src)
		}
		if s.Cardinality() != len(want) || !s.Contains(want...) {
			t.Fatalf("failed Scan(%#v) changed set to %v", src, s)
		}
	}
	for _, src := range []any{nil, "[]", []byte("[]")} {
		s.Add(old)
		if err := scanner.Scan(src); err != nil {
			t.Fatal(err)
		}
		if !s.IsEmpty() {
			t.Fatalf("Scan(%#v) did not clear set: %v", src, s)
		}
		value, err := valuer.Value()
		if err != nil {
			t.Fatal(err)
		}
		if string(value.([]byte)) != "[]" {
			t.Fatalf("empty Value = %s", value)
		}
		s.Add(old)
		if !s.Contains(old) {
			t.Fatal("set unusable after clearing")
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
	for _, s := range []Set[complex128]{NewSet[complex128](1i), NewThreadUnsafeSet[complex128](1i)} {
		if _, err := s.(driver.Valuer).Value(); err == nil {
			t.Fatal("Value accepted unsupported JSON element")
		}
	}
}

func TestSQLThreadSafeConcurrent(t *testing.T) {
	s := NewSet[int](1, 2, 3)
	var wg sync.WaitGroup
	for worker := 0; worker < 4; worker++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 100; i++ {
				s.Add(i)
				if err := s.(sql.Scanner).Scan(`[1,2,3]`); err != nil {
					t.Error(err)
				}
				if _, err := s.(driver.Valuer).Value(); err != nil {
					t.Error(err)
				}
				s.Contains(i)
			}
		}()
	}
	wg.Wait()
}
