package mapset

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

// Value returns the set as a JSON array for storage in a database column.
func (s *threadUnsafeSet[T]) Value() (driver.Value, error) {
	return s.MarshalJSON()
}

// Scan replaces the set with a JSON array from a database column.
// A SQL NULL clears the set. Errors leave the set unchanged.
func (s *threadUnsafeSet[T]) Scan(src any) error {
	replacement, err := scanSet[T](src)
	if err != nil {
		return err
	}
	*s = replacement
	return nil
}

// Value returns the set as a JSON array for storage in a database column.
func (t *threadSafeSet[T]) Value() (driver.Value, error) {
	return t.MarshalJSON()
}

// Scan replaces the set with a JSON array from a database column.
// A SQL NULL clears the set. Errors leave the set unchanged.
func (t *threadSafeSet[T]) Scan(src any) error {
	replacement, err := scanSet[T](src)
	if err != nil {
		return err
	}
	t.Lock()
	*t.uss = replacement
	t.Unlock()
	return nil
}

func scanSet[T comparable](src any) (threadUnsafeSet[T], error) {
	var data []byte
	switch value := src.(type) {
	case nil:
		return make(threadUnsafeSet[T]), nil
	case string:
		data = []byte(value)
	case []byte:
		data = value
	default:
		return nil, fmt.Errorf("mapset: cannot scan %T into a set", src)
	}

	var values []T
	if err := json.Unmarshal(data, &values); err != nil {
		return nil, err
	}
	replacement := make(threadUnsafeSet[T], len(values))
	replacement.append(values...)
	return replacement, nil
}
