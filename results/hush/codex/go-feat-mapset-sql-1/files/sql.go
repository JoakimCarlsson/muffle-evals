package mapset

import (
	"database/sql"
	"database/sql/driver"
	"fmt"
)

var (
	_ driver.Valuer = (*threadUnsafeSet[int])(nil)
	_ sql.Scanner   = (*threadUnsafeSet[int])(nil)
	_ driver.Valuer = (*threadSafeSet[int])(nil)
	_ sql.Scanner   = (*threadSafeSet[int])(nil)
)

// Value returns the set as a JSON array of bytes.
func (s *threadUnsafeSet[T]) Value() (driver.Value, error) {
	return s.MarshalJSON()
}

// Scan replaces the set with a JSON array from a string or byte slice.
// SQL NULL clears the set. Errors leave the set unchanged.
func (s *threadUnsafeSet[T]) Scan(src any) error {
	replacement := newThreadUnsafeSet[T]()
	var data []byte
	switch v := src.(type) {
	case nil:
	case string:
		data = []byte(v)
	case []byte:
		data = v
	default:
		return fmt.Errorf("mapset: cannot scan %T into set", src)
	}
	if src != nil {
		if err := replacement.UnmarshalJSON(data); err != nil {
			return err
		}
	}
	*s = *replacement
	return nil
}

// Value returns the set as a JSON array of bytes.
func (t *threadSafeSet[T]) Value() (driver.Value, error) {
	t.RLock()
	defer t.RUnlock()
	return t.uss.Value()
}

// Scan replaces the set with a JSON array from a string or byte slice.
// SQL NULL clears the set. Errors leave the set unchanged.
func (t *threadSafeSet[T]) Scan(src any) error {
	t.Lock()
	defer t.Unlock()
	return t.uss.Scan(src)
}
