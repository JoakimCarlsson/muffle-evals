/*
Open Source Initiative OSI - The MIT License (MIT):Licensing

The MIT License (MIT)
Copyright (c) 2013 - 2022 Ralph Caraveo (deckarep@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

package mapset

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"testing"
)

func TestThreadUnsafeSet_MarshalJSON(t *testing.T) {
	expected := NewThreadUnsafeSet[int64](1, 2, 3)
	actual := newThreadUnsafeSet[int64]()

	// test Marshal from Set method
	b, err := expected.MarshalJSON()
	if err != nil {
		t.Errorf("Error should be nil: %v", err)
	}

	err = json.Unmarshal(b, actual)
	if err != nil {
		t.Errorf("Error should be nil: %v", err)
	}

	if !expected.Equal(actual) {
		t.Errorf("Expected no difference, got: %v", expected.Difference(actual))
	}

	// test Marshal from json package
	b, err = json.Marshal(expected)
	if err != nil {
		t.Errorf("Error should be nil: %v", err)
	}

	err = json.Unmarshal(b, actual)
	if err != nil {
		t.Errorf("Error should be nil: %v", err)
	}

	if !expected.Equal(actual) {
		t.Errorf("Expected no difference, got: %v", expected.Difference(actual))
	}
}

func TestThreadUnsafeSet_UnmarshalJSON(t *testing.T) {
	expected := NewThreadUnsafeSet[int64](1, 2, 3)
	actual := NewThreadUnsafeSet[int64]()

	// test Unmarshal from Set method
	err := actual.UnmarshalJSON([]byte(`[1, 2, 3]`))
	if err != nil {
		t.Errorf("Error should be nil: %v", err)
	}
	if !expected.Equal(actual) {
		t.Errorf("Expected no difference, got: %v", expected.Difference(actual))
	}

	// test Unmarshal from json package
	actual = NewThreadUnsafeSet[int64]()
	err = json.Unmarshal([]byte(`[1, 2, 3]`), actual)
	if err != nil {
		t.Errorf("Error should be nil: %v", err)
	}
	if !expected.Equal(actual) {
		t.Errorf("Expected no difference, got: %v", expected.Difference(actual))
	}
}

func TestThreadUnsafeSet_MarshalJSON_Struct(t *testing.T) {
	expected := &testStruct{"test", NewThreadUnsafeSet("a")}

	b, err := json.Marshal(&testStruct{"test", NewThreadUnsafeSet("a")})
	if err != nil {
		t.Errorf("Error should be nil: %v", err)
	}

	actual := &testStruct{}
	err = json.Unmarshal(b, actual)
	if err != nil {
		t.Errorf("Error should be nil: %v", err)
	}

	if !expected.Set.Equal(actual.Set) {
		t.Errorf("Expected no difference, got: %v", expected.Set.Difference(actual.Set))
	}
}
func TestThreadUnsafeSet_UnmarshalJSON_Struct(t *testing.T) {
	expected := &testStruct{"test", NewThreadUnsafeSet("a", "b", "c")}
	actual := &testStruct{}

	err := json.Unmarshal([]byte(`{"other":"test", "set":["a", "b", "c"]}`), actual)
	if err != nil {
		t.Errorf("Error should be nil: %v", err)
	}
	if !expected.Set.Equal(actual.Set) {
		t.Errorf("Expected no difference, got: %v", expected.Set.Difference(actual.Set))
	}

	expectedComplex := NewThreadUnsafeSet(struct{ Val string }{Val: "a"}, struct{ Val string }{Val: "b"})
	actualComplex := NewThreadUnsafeSet[struct{ Val string }]()

	err = actualComplex.UnmarshalJSON([]byte(`[{"Val": "a"}, {"Val": "b"}]`))
	if err != nil {
		t.Errorf("Error should be nil: %v", err)
	}
	if !expectedComplex.Equal(actualComplex) {
		t.Errorf("Expected no difference, got: %v", expectedComplex.Difference(actualComplex))
	}

	actualComplex = NewThreadUnsafeSet[struct{ Val string }]()
	err = json.Unmarshal([]byte(`[{"Val": "a"}, {"Val": "b"}]`), actualComplex)
	if err != nil {
		t.Errorf("Error should be nil: %v", err)
	}
	if !expectedComplex.Equal(actualComplex) {
		t.Errorf("Expected no difference, got: %v", expectedComplex.Difference(actualComplex))
	}
}

// this serves as an example of how to correctly unmarshal a struct with a Set property
type testStruct struct {
	Other string
	Set   Set[string]
}

func (t *testStruct) UnmarshalJSON(b []byte) error {
	raw := struct {
		Other string
		Set   []string
	}{}

	err := json.Unmarshal(b, &raw)
	if err != nil {
		return err
	}

	t.Other = raw.Other
	t.Set = NewThreadUnsafeSet(raw.Set...)

	return nil
}

func TestSQLValuerScanner(t *testing.T) {
	for name, newSet := range map[string]func(...int) Set[int]{
		"safe":   NewSet[int],
		"unsafe": NewThreadUnsafeSet[int],
	} {
		s := newSet(1, 2, 3)
		v, err := s.(driver.Valuer).Value()
		if err != nil {
			t.Fatalf("%s: Value: %v", name, err)
		}
		b, ok := v.([]byte)
		if !ok {
			t.Fatalf("%s: Value returned %T, want []byte", name, v)
		}

		got := newSet(9)
		sc := got.(sql.Scanner)
		if err := sc.Scan(b); err != nil || !got.Equal(s) {
			t.Errorf("%s: Scan([]byte) = %v, set %v", name, err, got)
		}
		if err := sc.Scan("[4]"); err != nil || !got.Equal(newSet(4)) {
			t.Errorf("%s: Scan(string) = %v, set %v", name, err, got)
		}
		if err := sc.Scan(1.5); err == nil || !got.Equal(newSet(4)) {
			t.Errorf("%s: Scan(float) err %v, set %v", name, err, got)
		}
		if err := sc.Scan("[oops"); err == nil || !got.Equal(newSet(4)) {
			t.Errorf("%s: Scan(invalid) err %v, set %v", name, err, got)
		}
		if err := sc.Scan(nil); err != nil || got.Cardinality() != 0 {
			t.Errorf("%s: Scan(nil) = %v, set %v", name, err, got)
		}
	}
}
