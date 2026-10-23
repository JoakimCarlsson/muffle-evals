package mapset

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

var (
	_ driver.Valuer = (*threadUnsafeSet[int])(nil)
	_ sql.Scanner   = (*threadUnsafeSet[int])(nil)
	_ driver.Valuer = (*threadSafeSet[int])(nil)
	_ sql.Scanner   = (*threadSafeSet[int])(nil)
)

// Value returns the set as a JSON array for storage in a database column.
func (s *threadUnsafeSet[T]) Value() (driver.Value, error) {
	return s.MarshalJSON()
}

// Scan replaces the set with a JSON array from a string or byte slice.
// A nil source clears the set. Errors leave the set unchanged.
func (s *threadUnsafeSet[T]) Scan(src any) error {
	var data []byte
	switch v := src.(type) {
	case nil:
		s.Clear()
		return nil
	case string:
		data = []byte(v)
	case []byte:
		data = v
	default:
		return fmt.Errorf("mapset: cannot scan %T into a set", src)
	}

	var values []T
	if err := json.Unmarshal(data, &values); err != nil {
		return err
	}
	replacement := make(threadUnsafeSet[T], len(values))
	replacement.append(values...)
	*s = replacement
	return nil
}

// Value returns the set as a JSON array for storage in a database column.
func (t *threadSafeSet[T]) Value() (driver.Value, error) {
	return t.MarshalJSON()
}

// Scan replaces the set with a JSON array from a string or byte slice.
// A nil source clears the set. Errors leave the set unchanged.
func (t *threadSafeSet[T]) Scan(src any) error {
	t.Lock()
	defer t.Unlock()
	return t.uss.Scan(src)
}
