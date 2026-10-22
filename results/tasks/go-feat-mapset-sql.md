# go-feat-mapset-sql

Source: https://github.com/deckarep/golang-set/pull/207

## Prompt

> Let sets be stored in and read from a database column.
> 
> I keep tags in a `mapset.Set[int]` / `mapset.Set[string]` and store them in a JSON column. Right now I have to marshal and unmarshal by hand around every query, because sets do not work with `database/sql`.
> 
> Please make both set implementations (the thread-safe one from `NewSet` and the one from `NewThreadUnsafeSet`) implement `driver.Valuer` and `sql.Scanner`, so the value returned by the constructors can be type-asserted to either interface:
> 
> - `Value() (driver.Value, error)` returns the set as a JSON array, as `[]byte` (for example `[1,2,3]` in any order).
> - `Scan(src any) error` replaces the contents of the set with the JSON array in `src`, which can be a `string` or `[]byte`.
> - `Scan(nil)` (a SQL `NULL`) empties the set.
> - Scanning any other type, or invalid JSON, returns an error and leaves the set as it was.
> 
> Please add this.

## Upstream change (tests left out)

Files: [README.md](../../tasks/go-feat-mapset-sql/upstream/README.md), [threadsafe.go](../../tasks/go-feat-mapset-sql/upstream/threadsafe.go), [threadsafe_test.go](../../tasks/go-feat-mapset-sql/upstream/threadsafe_test.go), [threadunsafe.go](../../tasks/go-feat-mapset-sql/upstream/threadunsafe.go), [threadunsafe_test.go](../../tasks/go-feat-mapset-sql/upstream/threadunsafe_test.go)

```diff
diff --git a/README.md b/README.md
index 53152d4..ec4dc98 100644
--- a/README.md
+++ b/README.md
@@ -67,6 +67,7 @@ go get github.com/deckarep/golang-set/v3
 * One common *interface* to both implementations
   * a **non threadsafe** implementation favoring *performance*
   * a **threadsafe** implementation favoring *concurrent* use
+* SQL support through the standard `sql.Scanner` and `driver.Valuer` interfaces, using JSON arrays
 * Feature complete set implementation modeled after [Python's set implementation](https://docs.python.org/3/library/stdtypes.html#set).
 * Exhaustive unit-test and benchmark suite
 
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..89f2bf6 100644
--- a/threadsafe.go
+++ b/threadsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"sync"
 )
 
@@ -351,3 +352,19 @@ func (t *threadSafeSet[T]) UnmarshalJSON(p []byte) error {
 
 	return err
 }
+
+// Value returns the set encoded as a JSON array for database storage.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	t.RLock()
+	value, err := t.uss.Value()
+	t.RUnlock()
+	return value, err
+}
+
+// Scan replaces the set with the JSON array read from a database column.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	err := t.uss.Scan(src)
+	t.Unlock()
+	return err
+}
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..ae0a33d 100644
--- a/threadunsafe.go
+++ b/threadunsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"encoding/json"
 	"fmt"
 	"strings"
@@ -382,3 +383,35 @@ func (s *threadUnsafeSet[T]) UnmarshalJSON(b []byte) error {
 
 	return nil
 }
+
+// Value returns the set encoded as a JSON array for database storage.
+func (s threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan replaces the set with the JSON array read from a database column.
+func (s *threadUnsafeSet[T]) Scan(src any) error {
+	if src == nil {
+		s.Clear()
+		return nil
+	}
+
+	var data []byte
+	switch value := src.(type) {
+	case []byte:
+		data = value
+	case string:
+		data = []byte(value)
+	default:
+		return fmt.Errorf("mapset: cannot scan %T into Set", src)
+	}
+
+	var values []T
+	if err := json.Unmarshal(data, &values); err != nil {
+		return err
+	}
+
+	s.Clear()
+	s.append(values...)
+	return nil
+}
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +52/-0 | 47 | 2,978 | $0.103 |
| claude | muffle | pass | +67/-0 | 37 | 2,718 | $0.083 |
| claude | hush | pass | +66/-0 | 40 | 2,583 | $0.085 |
| claude | sloth | pass | +49/-0 | 0 | 1,937 | $0.055 |
| claude | all | pass | +51/-0 | 0 | 1,469 | $0.070 |
| codex | base | pass | +57/-0 | 105 | 2,196 | - |
| codex | muffle | pass | +63/-0 | 90 | 2,155 | - |
| codex | hush | pass | +57/-0 | 100 | 2,015 | - |
| codex | sloth | pass | +44/-0 | 0 | 1,191 | - |
| codex | all | pass | +44/-0 | 0 | 898 | - |

### claude, base: pass

Files: [sql_test.go](../base/claude/go-feat-mapset-sql-1/files/sql_test.go), [threadsafe.go](../base/claude/go-feat-mapset-sql-1/files/threadsafe.go), [threadunsafe.go](../base/claude/go-feat-mapset-sql-1/files/threadunsafe.go)

<details><summary>diff</summary>

```diff
diff --git a/sql_test.go b/sql_test.go
new file mode 100644
index 0000000..376a8b5
--- /dev/null
+++ b/sql_test.go
@@ -0,0 +1,47 @@
+package mapset
+
+import (
+	"database/sql"
+	"database/sql/driver"
+	"testing"
+)
+
+func TestSQLValuerScanner(t *testing.T) {
+	for name, mk := range map[string]func() Set[int]{
+		"safe":   func() Set[int] { return NewSet(1, 2, 3) },
+		"unsafe": func() Set[int] { return NewThreadUnsafeSet(1, 2, 3) },
+	} {
+		t.Run(name, func(t *testing.T) {
+			s := mk()
+			b, err := s.(driver.Valuer).Value()
+			if err != nil {
+				t.Fatal(err)
+			}
+			if _, ok := b.([]byte); !ok {
+				t.Fatalf("got %T", b)
+			}
+			o := s.Clone()
+			o.Clear()
+			sc := o.(sql.Scanner)
+			if err := sc.Scan(b); err != nil || !o.Equal(s) {
+				t.Fatalf("scan bytes: %v %v", err, o)
+			}
+			if err := sc.Scan("[7]"); err != nil || !o.Equal(seven(s)) {
+				t.Fatalf("scan string: %v %v", err, o)
+			}
+			if sc.Scan(42) == nil || sc.Scan("{bad") == nil || !o.Equal(seven(s)) {
+				t.Fatalf("errors must leave set unchanged: %v", o)
+			}
+			if err := sc.Scan(nil); err != nil || o.Cardinality() != 0 {
+				t.Fatalf("scan nil: %v %v", err, o)
+			}
+		})
+	}
+}
+
+func seven(like Set[int]) Set[int] {
+	s := like.Clone()
+	s.Clear()
+	s.Add(7)
+	return s
+}
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..6e5cf36 100644
--- a/threadsafe.go
+++ b/threadsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"sync"
 )
 
@@ -351,3 +352,21 @@ func (t *threadSafeSet[T]) UnmarshalJSON(p []byte) error {
 
 	return err
 }
+
+// Value implements driver.Valuer. It returns the set as a JSON array ([]byte).
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	t.RLock()
+	defer t.RUnlock()
+
+	return t.uss.Value()
+}
+
+// Scan implements sql.Scanner. It replaces the contents of the set with the
+// JSON array in src, which must be a string or []byte. A nil src empties the
+// set. On error the set is left unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+
+	return t.uss.Scan(src)
+}
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..073fd81 100644
--- a/threadunsafe.go
+++ b/threadunsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"encoding/json"
 	"fmt"
 	"strings"
@@ -382,3 +383,35 @@ func (s *threadUnsafeSet[T]) UnmarshalJSON(b []byte) error {
 
 	return nil
 }
+
+// Value implements driver.Valuer. It returns the set as a JSON array ([]byte).
+func (s threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan implements sql.Scanner. It replaces the contents of the set with the
+// JSON array in src, which must be a string or []byte. A nil src empties the
+// set. On error the set is left unchanged.
+func (s *threadUnsafeSet[T]) Scan(src any) error {
+	var b []byte
+	switch v := src.(type) {
+	case nil:
+		s.Clear()
+		return nil
+	case []byte:
+		b = v
+	case string:
+		b = []byte(v)
+	default:
+		return fmt.Errorf("mapset: cannot scan type %T into set", src)
+	}
+
+	var items []T
+	if err := json.Unmarshal(b, &items); err != nil {
+		return err
+	}
+	s.Clear()
+	s.append(items...)
+
+	return nil
+}
```

</details>

<details><summary>reply</summary>

Empty set marshals to `[]`. Good. Implementing.

My test mixes set kinds (Equal panics across types); fix the test to use the same kind.

Both set types now implement `driver.Valuer` and `sql.Scanner`, so `NewSet` and `NewThreadUnsafeSet` values can be type-asserted to either interface. `go vet` is clean and `go test ./...` passes.

- **`Value()`** returns the set as a JSON array in a `[]byte`, in any order. An empty set gives `[]`.
- **`Scan(src)`** accepts a `string` or `[]byte` and replaces the set's contents with the decoded array.
- **`Scan(nil)`** empties the set.
- **Errors:** any other type, or invalid JSON, returns an error and leaves the set unchanged. The JSON is decoded before the set is cleared, so a failed scan can't half-apply.
- **Thread safety:** the thread-safe set takes its read lock in `Value` and its write lock in `Scan`.

The changes are in `threadunsafe.go` and `threadsafe.go`, with a new test in `sql_test.go`. The test covers both set types with a round trip through bytes, a string scan, the two error cases leaving the set unchanged, and a `nil` scan.

I didn't add the methods to the `Set` interface, since you only asked for type assertion. The existing `UnmarshalJSON` appends to the set rather than replacing it, so I didn't reuse it for `Scan`.

I haven't committed anything.

</details>

### claude, muffle: pass

Files: [sql_test.go](../muffle/claude/go-feat-mapset-sql-1/files/sql_test.go), [threadsafe.go](../muffle/claude/go-feat-mapset-sql-1/files/threadsafe.go), [threadunsafe.go](../muffle/claude/go-feat-mapset-sql-1/files/threadunsafe.go)

<details><summary>diff</summary>

```diff
diff --git a/sql_test.go b/sql_test.go
new file mode 100644
index 0000000..7dc67ea
--- /dev/null
+++ b/sql_test.go
@@ -0,0 +1,37 @@
+package mapset
+
+import (
+	"database/sql"
+	"database/sql/driver"
+	"testing"
+)
+
+func TestSQLValuerScanner(t *testing.T) {
+	for name, mk := range map[string]func(...int) Set[int]{"safe": NewSet[int], "unsafe": NewThreadUnsafeSet[int]} {
+		s := mk(1, 2, 3)
+		v, err := s.(driver.Valuer).Value()
+		if err != nil {
+			t.Fatal(err)
+		}
+		if _, ok := v.([]byte); !ok {
+			t.Fatalf("%s: want []byte, got %T", name, v)
+		}
+		if e, _ := mk().(driver.Valuer).Value(); string(e.([]byte)) != "[]" {
+			t.Fatalf("%s: empty = %s", name, e)
+		}
+		sc := s.(sql.Scanner)
+		for _, src := range []any{"[4,5]", []byte("[4,5]")} {
+			if err := sc.Scan(src); err != nil || !s.Equal(mk(4, 5)) {
+				t.Fatalf("%s: scan %v: %v %v", name, src, err, s)
+			}
+		}
+		for _, bad := range []any{42, "{bad", `["a"]`} {
+			if err := sc.Scan(bad); err == nil || !s.Equal(mk(4, 5)) {
+				t.Fatalf("%s: bad %v: err=%v set=%v", name, bad, err, s)
+			}
+		}
+		if err := sc.Scan(nil); err != nil || s.Cardinality() != 0 {
+			t.Fatalf("%s: nil scan: %v %v", name, err, s)
+		}
+	}
+}
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..bc8e2c5 100644
--- a/threadsafe.go
+++ b/threadsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"sync"
 )
 
@@ -351,3 +352,23 @@ func (t *threadSafeSet[T]) UnmarshalJSON(p []byte) error {
 
 	return err
 }
+
+// Value implements driver.Valuer. It returns the set as a JSON array ([]byte).
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	t.RLock()
+	v, err := t.uss.Value()
+	t.RUnlock()
+
+	return v, err
+}
+
+// Scan implements sql.Scanner. It replaces the contents of the set with the
+// JSON array in src (string or []byte). A nil src empties the set. On error
+// the set is left unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	err := t.uss.Scan(src)
+	t.Unlock()
+
+	return err
+}
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..879f79f 100644
--- a/threadunsafe.go
+++ b/threadunsafe.go
@@ -26,6 +26,8 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql"
+	"database/sql/driver"
 	"encoding/json"
 	"fmt"
 	"strings"
@@ -36,6 +38,11 @@ type threadUnsafeSet[T comparable] map[T]struct{}
 // Assert concrete type:threadUnsafeSet adheres to Set interface.
 var _ Set[string] = (*threadUnsafeSet[string])(nil)
 
+var (
+	_ driver.Valuer = (*threadUnsafeSet[string])(nil)
+	_ sql.Scanner   = (*threadUnsafeSet[string])(nil)
+)
+
 func newThreadUnsafeSet[T comparable]() *threadUnsafeSet[T] {
 	t := make(threadUnsafeSet[T])
 	return &t
@@ -382,3 +389,42 @@ func (s *threadUnsafeSet[T]) UnmarshalJSON(b []byte) error {
 
 	return nil
 }
+
+// Value implements driver.Valuer. It returns the set as a JSON array ([]byte).
+func (s threadUnsafeSet[T]) Value() (driver.Value, error) {
+	b, err := json.Marshal(s.ToSlice())
+	if err != nil {
+		return nil, err
+	}
+	if string(b) == "null" {
+		b = []byte("[]")
+	}
+	return b, nil
+}
+
+// Scan implements sql.Scanner. It replaces the contents of the set with the
+// JSON array in src (string or []byte). A nil src empties the set. On error
+// the set is left unchanged.
+func (s *threadUnsafeSet[T]) Scan(src any) error {
+	var b []byte
+	switch v := src.(type) {
+	case nil:
+		clear(*s)
+		return nil
+	case string:
+		b = []byte(v)
+	case []byte:
+		b = v
+	default:
+		return fmt.Errorf("mapset: cannot scan %T into a set", src)
+	}
+
+	var items []T
+	if err := json.Unmarshal(b, &items); err != nil {
+		return err
+	}
+	clear(*s)
+	s.append(items...)
+
+	return nil
+}
```

</details>

<details><summary>reply</summary>

Both set implementations now implement `driver.Valuer` and `sql.Scanner`, so the sets returned by `NewSet` and `NewThreadUnsafeSet` can be type-asserted to either interface. `go vet` and `go test` pass, including a new test in `sql_test.go` that covers both implementations.

- **`Value()`** returns the set as a JSON array in a `[]byte`, in any order. An empty set gives `[]`, not `null`.
- **`Scan(src)`** replaces the contents of the set with the JSON array in `src`, which can be a `string` or `[]byte`. `Scan(nil)` empties the set.
- **Errors:** any other type, invalid JSON, or elements of the wrong type (such as `["a"]` into a `Set[int]`) return an error and leave the set as it was.

`Scan` replaces the contents, which differs from the existing `UnmarshalJSON`: that one adds elements to the set.

The thread-safe set takes its read lock in `Value` and its write lock in `Scan`. The code is in `threadunsafe.go` and `threadsafe.go`. I haven't committed anything.

</details>

### claude, hush: pass

Files: [sql_scan_test.go](../hush/claude/go-feat-mapset-sql-1/files/sql_scan_test.go), [threadsafe.go](../hush/claude/go-feat-mapset-sql-1/files/threadsafe.go), [threadunsafe.go](../hush/claude/go-feat-mapset-sql-1/files/threadunsafe.go)

<details><summary>diff</summary>

```diff
diff --git a/sql_scan_test.go b/sql_scan_test.go
new file mode 100644
index 0000000..4a42455
--- /dev/null
+++ b/sql_scan_test.go
@@ -0,0 +1,40 @@
+package mapset
+
+import (
+	"database/sql"
+	"database/sql/driver"
+	"testing"
+)
+
+func TestSQLValuerScanner(t *testing.T) {
+	for name, s := range map[string]Set[int]{"safe": NewSet(1, 2), "unsafe": NewThreadUnsafeSet(1, 2)} {
+		v, err := s.(driver.Valuer).Value()
+		if err != nil {
+			t.Fatal(name, err)
+		}
+		if _, ok := v.([]byte); !ok {
+			t.Fatalf("%s: got %T", name, v)
+		}
+		d := NewSet[int]()
+		if name == "unsafe" {
+			d = NewThreadUnsafeSet[int]()
+		}
+		sc := d.(sql.Scanner)
+		if err := sc.Scan(v); err != nil || !d.Equal(s) {
+			t.Fatal(name, err, d)
+		}
+		if err := sc.Scan("[5]"); err != nil || d.Cardinality() != 1 || !d.Contains(5) {
+			t.Fatal(name, err, d)
+		}
+		if sc.Scan(42) == nil || sc.Scan("{bad") == nil || !d.Contains(5) || d.Cardinality() != 1 {
+			t.Fatal(name, "error case", d)
+		}
+		if err := sc.Scan(nil); err != nil || d.Cardinality() != 0 {
+			t.Fatal(name, err, d)
+		}
+		e, _ := d.(driver.Valuer).Value()
+		if string(e.([]byte)) != "[]" {
+			t.Fatal(name, string(e.([]byte)))
+		}
+	}
+}
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..afe16ea 100644
--- a/threadsafe.go
+++ b/threadsafe.go
@@ -26,9 +26,17 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql"
+	"database/sql/driver"
 	"sync"
 )
 
+// Assert concrete type:threadSafeSet can be stored in and read from a database column.
+var (
+	_ driver.Valuer = (*threadSafeSet[string])(nil)
+	_ sql.Scanner   = (*threadSafeSet[string])(nil)
+)
+
 type threadSafeSet[T comparable] struct {
 	sync.RWMutex
 	uss *threadUnsafeSet[T]
@@ -351,3 +359,21 @@ func (t *threadSafeSet[T]) UnmarshalJSON(p []byte) error {
 
 	return err
 }
+
+// Value implements driver.Valuer. It returns the set as a JSON array of bytes.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	t.RLock()
+	defer t.RUnlock()
+
+	return t.uss.Value()
+}
+
+// Scan implements sql.Scanner. It replaces the contents of the set with the
+// JSON array in src, which must be a string or []byte. A nil src empties the
+// set. On error the set is left unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+
+	return t.uss.Scan(src)
+}
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..4fff3b8 100644
--- a/threadunsafe.go
+++ b/threadunsafe.go
@@ -26,6 +26,8 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql"
+	"database/sql/driver"
 	"encoding/json"
 	"fmt"
 	"strings"
@@ -36,6 +38,12 @@ type threadUnsafeSet[T comparable] map[T]struct{}
 // Assert concrete type:threadUnsafeSet adheres to Set interface.
 var _ Set[string] = (*threadUnsafeSet[string])(nil)
 
+// Assert concrete type:threadUnsafeSet can be stored in and read from a database column.
+var (
+	_ driver.Valuer = (*threadUnsafeSet[string])(nil)
+	_ sql.Scanner   = (*threadUnsafeSet[string])(nil)
+)
+
 func newThreadUnsafeSet[T comparable]() *threadUnsafeSet[T] {
 	t := make(threadUnsafeSet[T])
 	return &t
@@ -382,3 +390,35 @@ func (s *threadUnsafeSet[T]) UnmarshalJSON(b []byte) error {
 
 	return nil
 }
+
+// Value implements driver.Valuer. It returns the set as a JSON array of bytes.
+func (s threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan implements sql.Scanner. It replaces the contents of the set with the
+// JSON array in src, which must be a string or []byte. A nil src empties the
+// set. On error the set is left unchanged.
+func (s *threadUnsafeSet[T]) Scan(src any) error {
+	var b []byte
+	switch v := src.(type) {
+	case nil:
+		clear(*s)
+		return nil
+	case string:
+		b = []byte(v)
+	case []byte:
+		b = v
+	default:
+		return fmt.Errorf("mapset: cannot scan %T into a set", src)
+	}
+
+	var elems []T
+	if err := json.Unmarshal(b, &elems); err != nil {
+		return err
+	}
+	clear(*s)
+	s.append(elems...)
+
+	return nil
+}
```

</details>

<details><summary>reply</summary>

Done. Both set types now implement `Value` and `Scan`, with a type-assertion test in `sql_scan_test.go`. `go vet` and `go test` pass. I didn't run it against a real database driver.

</details>

### claude, sloth: pass

Files: [threadsafe.go](../sloth/claude/go-feat-mapset-sql-1/files/threadsafe.go), [threadunsafe.go](../sloth/claude/go-feat-mapset-sql-1/files/threadunsafe.go)

<details><summary>diff</summary>

```diff
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..e4c2871 100644
--- a/threadsafe.go
+++ b/threadsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"sync"
 )
 
@@ -351,3 +352,20 @@ func (t *threadSafeSet[T]) UnmarshalJSON(p []byte) error {
 
 	return err
 }
+
+// Value implements driver.Valuer, returning the set as a JSON array of bytes.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	t.RLock()
+	defer t.RUnlock()
+
+	return t.uss.Value()
+}
+
+// Scan implements sql.Scanner, replacing the set's contents with the JSON
+// array in src. A nil src empties the set. On error the set is unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+
+	return t.uss.Scan(src)
+}
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..041e965 100644
--- a/threadunsafe.go
+++ b/threadunsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"encoding/json"
 	"fmt"
 	"strings"
@@ -382,3 +383,33 @@ func (s *threadUnsafeSet[T]) UnmarshalJSON(b []byte) error {
 
 	return nil
 }
+
+// Value implements driver.Valuer, returning the set as a JSON array of bytes.
+func (s threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan implements sql.Scanner, replacing the set's contents with the JSON
+// array in src. A nil src empties the set. On error the set is unchanged.
+func (s *threadUnsafeSet[T]) Scan(src any) error {
+	var b []byte
+	switch v := src.(type) {
+	case nil:
+		clear(*s)
+		return nil
+	case string:
+		b = []byte(v)
+	case []byte:
+		b = v
+	default:
+		return fmt.Errorf("mapset: cannot scan %T into a set", src)
+	}
+	var elems []T
+	if err := json.Unmarshal(b, &elems); err != nil {
+		return err
+	}
+	clear(*s)
+	s.append(elems...)
+
+	return nil
+}
```

</details>

<details><summary>reply</summary>

Both set types now implement `driver.Valuer` and `sql.Scanner`, so the value from `NewSet` or `NewThreadUnsafeSet` can be type-asserted to either interface. The build, vet and existing tests pass. I also ran a throwaway test covering Scan, Value and `Scan(nil)` on both types. I deleted it afterwards, so no test for this is left in the repo.

- **`Value()`** returns the set as a JSON array in a `[]byte`. It reuses the existing `MarshalJSON`.
- **`Scan(src)`** accepts a `string` or `[]byte` and replaces the set's contents with the decoded array.
- **`Scan(nil)`** empties the set.
- **Errors:** any other type, or invalid JSON, returns an error and leaves the set as it was. It decodes first and only clears the set once the JSON is valid.
- **Thread-safe set:** `Value` takes the read lock and `Scan` takes the write lock.

The changes are in `threadunsafe.go` and `threadsafe.go`. I didn't add tests or a README note, since you didn't ask for them.

</details>

### claude, all: pass

Files: [threadsafe.go](../all/claude/go-feat-mapset-sql-1/files/threadsafe.go), [threadunsafe.go](../all/claude/go-feat-mapset-sql-1/files/threadunsafe.go)

<details><summary>diff</summary>

```diff
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..b74236b 100644
--- a/threadsafe.go
+++ b/threadsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"sync"
 )
 
@@ -351,3 +352,21 @@ func (t *threadSafeSet[T]) UnmarshalJSON(p []byte) error {
 
 	return err
 }
+
+// Value implements driver.Valuer, returning the set as a JSON array.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	t.RLock()
+	defer t.RUnlock()
+
+	return t.uss.Value()
+}
+
+// Scan implements sql.Scanner. It replaces the set contents with the JSON
+// array in src (string or []byte); nil empties the set. On error the set
+// is unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+
+	return t.uss.Scan(src)
+}
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..747a291 100644
--- a/threadunsafe.go
+++ b/threadunsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"encoding/json"
 	"fmt"
 	"strings"
@@ -382,3 +383,34 @@ func (s *threadUnsafeSet[T]) UnmarshalJSON(b []byte) error {
 
 	return nil
 }
+
+// Value implements driver.Valuer, returning the set as a JSON array.
+func (s threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan implements sql.Scanner. It replaces the set contents with the JSON
+// array in src (string or []byte); nil empties the set. On error the set
+// is unchanged.
+func (s *threadUnsafeSet[T]) Scan(src any) error {
+	var b []byte
+	switch v := src.(type) {
+	case nil:
+		s.Clear()
+		return nil
+	case string:
+		b = []byte(v)
+	case []byte:
+		b = v
+	default:
+		return fmt.Errorf("mapset: cannot scan %T into set", src)
+	}
+	var items []T
+	if err := json.Unmarshal(b, &items); err != nil {
+		return err
+	}
+	s.Clear()
+	s.append(items...)
+
+	return nil
+}
```

</details>

<details><summary>reply</summary>

Done. Both sets now implement `Value()` and `Scan()` in `threadunsafe.go` and `threadsafe.go`. The build and existing tests pass. I added no new tests, since you didn't ask for any, so `Value` and `Scan` haven't been run.

</details>

### codex, base: pass

Files: [sql.go](../base/codex/go-feat-mapset-sql-1/files/sql.go), [sql_test.go](../base/codex/go-feat-mapset-sql-1/files/sql_test.go)

<details><summary>diff</summary>

```diff
diff --git a/sql.go b/sql.go
new file mode 100644
index 0000000..f4bfba6
--- /dev/null
+++ b/sql.go
@@ -0,0 +1,57 @@
+package mapset
+
+import (
+	"database/sql"
+	"database/sql/driver"
+	"fmt"
+)
+
+var (
+	_ driver.Valuer = (*threadUnsafeSet[int])(nil)
+	_ sql.Scanner   = (*threadUnsafeSet[int])(nil)
+	_ driver.Valuer = (*threadSafeSet[int])(nil)
+	_ sql.Scanner   = (*threadSafeSet[int])(nil)
+)
+
+// Value returns the set as a JSON array of bytes for database storage.
+func (s *threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan replaces the set with a JSON array from a string or byte slice.
+// SQL NULL clears the set. Errors leave the set unchanged.
+func (s *threadUnsafeSet[T]) Scan(src any) error {
+	replacement := newThreadUnsafeSet[T]()
+	var data []byte
+	switch src := src.(type) {
+	case nil:
+	case string:
+		data = []byte(src)
+	case []byte:
+		data = src
+	default:
+		return fmt.Errorf("mapset: cannot scan %T into a set", src)
+	}
+	if src != nil {
+		if err := replacement.UnmarshalJSON(data); err != nil {
+			return err
+		}
+	}
+	*s = *replacement
+	return nil
+}
+
+// Value returns the set as a JSON array of bytes for database storage.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	t.RLock()
+	defer t.RUnlock()
+	return t.uss.Value()
+}
+
+// Scan replaces the set with a JSON array from a string or byte slice.
+// SQL NULL clears the set. Errors leave the set unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+	return t.uss.Scan(src)
+}
diff --git a/sql_test.go b/sql_test.go
new file mode 100644
index 0000000..7ab2874
--- /dev/null
+++ b/sql_test.go
@@ -0,0 +1,105 @@
+package mapset
+
+import (
+	"database/sql"
+	"database/sql/driver"
+	"encoding/json"
+	"sync"
+	"testing"
+)
+
+func testSQLSet[T comparable](t *testing.T, newSet func(...T) Set[T], old T, input string, want ...T) {
+	t.Helper()
+	s := newSet(old)
+	scanner := s.(sql.Scanner)
+	valuer := s.(driver.Valuer)
+	for _, src := range []any{input, []byte(input)} {
+		s.Add(old)
+		if err := scanner.Scan(src); err != nil {
+			t.Fatal(err)
+		}
+		if s.Cardinality() != len(want) || !s.Contains(want...) {
+			t.Fatalf("Scan(%T) = %v, want %v", src, s, want)
+		}
+		value, err := valuer.Value()
+		if err != nil {
+			t.Fatal(err)
+		}
+		data, ok := value.([]byte)
+		if !ok {
+			t.Fatalf("Value returned %T, want []byte", value)
+		}
+		var got []T
+		if err := json.Unmarshal(data, &got); err != nil {
+			t.Fatal(err)
+		}
+		if len(got) != len(want) || !s.Contains(got...) {
+			t.Fatalf("Value = %s, want %v", data, want)
+		}
+	}
+	for _, src := range []any{42, true, struct{}{}, "[", []byte("[] trailing"), "{}", "true", "[1,\"wrong\"]", []byte(nil)} {
+		if err := scanner.Scan(src); err == nil {
+			t.Fatalf("Scan(%#v) succeeded", src)
+		}
+		if s.Cardinality() != len(want) || !s.Contains(want...) {
+			t.Fatalf("failed Scan(%#v) changed set to %v", src, s)
+		}
+	}
+	for _, src := range []any{nil, "[]", []byte("[]")} {
+		s.Add(old)
+		if err := scanner.Scan(src); err != nil {
+			t.Fatal(err)
+		}
+		if !s.IsEmpty() {
+			t.Fatalf("Scan(%#v) did not clear set: %v", src, s)
+		}
+		value, err := valuer.Value()
+		if err != nil {
+			t.Fatal(err)
+		}
+		if string(value.([]byte)) != "[]" {
+			t.Fatalf("empty Value = %s", value)
+		}
+		s.Add(old)
+		if !s.Contains(old) {
+			t.Fatal("set unusable after clearing")
+		}
+	}
+}
+
+func TestSQLSet(t *testing.T) {
+	t.Run("safe/int", func(t *testing.T) { testSQLSet(t, NewSet[int], 99, "[1,2,2,3]", 1, 2, 3) })
+	t.Run("unsafe/int", func(t *testing.T) { testSQLSet(t, NewThreadUnsafeSet[int], 99, "[1,2,2,3]", 1, 2, 3) })
+	t.Run("safe/string", func(t *testing.T) { testSQLSet(t, NewSet[string], "old", `["a","b","a"]`, "a", "b") })
+	t.Run("unsafe/string", func(t *testing.T) { testSQLSet(t, NewThreadUnsafeSet[string], "old", `["a","b","a"]`, "a", "b") })
+}
+
+func TestSQLValueError(t *testing.T) {
+	for _, s := range []Set[complex128]{NewSet[complex128](1i), NewThreadUnsafeSet[complex128](1i)} {
+		if _, err := s.(driver.Valuer).Value(); err == nil {
+			t.Fatal("Value accepted unsupported JSON element")
+		}
+	}
+}
+
+func TestSQLThreadSafeConcurrent(t *testing.T) {
+	s := NewSet[int](1, 2, 3)
+	var wg sync.WaitGroup
+	for worker := 0; worker < 4; worker++ {
+		wg.Add(1)
+		go func() {
+			defer wg.Done()
+			for i := 0; i < 100; i++ {
+				s.Add(i)
+				if err := s.(sql.Scanner).Scan(`[1,2,3]`); err != nil {
+					t.Error(err)
+				}
+				if _, err := s.(driver.Valuer).Value(); err != nil {
+					t.Error(err)
+				}
+				s.Contains(i)
+			}
+		}()
+	}
+	wg.Wait()
+}
```

</details>

<details><summary>reply</summary>

I’ll check both set implementations, add SQL support, and test that failed scans preserve the existing contents.

The existing JSON decoder adds elements to a set. I’ve made `Scan` decode into a temporary set first, so it replaces the contents only after decoding succeeds. The thread-safe version holds its lock during the operation.

Implemented SQL support for both set implementations.

- `Value()` returns a JSON array as `[]byte`.
- `Scan()` replaces contents from a string or byte slice.
- `Scan(nil)` clears the set.
- Unsupported types and invalid JSON return errors without changing contents.

Added tests for integers, strings, errors, and concurrent access. Both `go test ./...` and `go test -race ./...` pass.

</details>

### codex, muffle: pass

Files: [sql.go](../muffle/codex/go-feat-mapset-sql-1/files/sql.go), [sql_test.go](../muffle/codex/go-feat-mapset-sql-1/files/sql_test.go)

<details><summary>diff</summary>

```diff
diff --git a/sql.go b/sql.go
new file mode 100644
index 0000000..f224530
--- /dev/null
+++ b/sql.go
@@ -0,0 +1,63 @@
+package mapset
+
+import (
+	"database/sql/driver"
+	"encoding/json"
+	"fmt"
+)
+
+// Value returns the set as a JSON array for storage in a database column.
+func (s *threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan replaces the set with a JSON array from a database column.
+// A SQL NULL clears the set. Errors leave the set unchanged.
+func (s *threadUnsafeSet[T]) Scan(src any) error {
+	replacement, err := scanSet[T](src)
+	if err != nil {
+		return err
+	}
+	*s = replacement
+	return nil
+}
+
+// Value returns the set as a JSON array for storage in a database column.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	return t.MarshalJSON()
+}
+
+// Scan replaces the set with a JSON array from a database column.
+// A SQL NULL clears the set. Errors leave the set unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	replacement, err := scanSet[T](src)
+	if err != nil {
+		return err
+	}
+	t.Lock()
+	*t.uss = replacement
+	t.Unlock()
+	return nil
+}
+
+func scanSet[T comparable](src any) (threadUnsafeSet[T], error) {
+	var data []byte
+	switch value := src.(type) {
+	case nil:
+		return make(threadUnsafeSet[T]), nil
+	case string:
+		data = []byte(value)
+	case []byte:
+		data = value
+	default:
+		return nil, fmt.Errorf("mapset: cannot scan %T into a set", src)
+	}
+
+	var values []T
+	if err := json.Unmarshal(data, &values); err != nil {
+		return nil, err
+	}
+	replacement := make(threadUnsafeSet[T], len(values))
+	replacement.append(values...)
+	return replacement, nil
+}
diff --git a/sql_test.go b/sql_test.go
new file mode 100644
index 0000000..82b6667
--- /dev/null
+++ b/sql_test.go
@@ -0,0 +1,90 @@
+package mapset
+
+import (
+	"database/sql"
+	"database/sql/driver"
+	"encoding/json"
+	"math"
+	"testing"
+)
+
+func testSQLSet[T comparable](t *testing.T, newSet func(...T) Set[T], initial T, input string, expected ...T) {
+	t.Helper()
+	s := newSet(initial)
+	scanner, ok := s.(sql.Scanner)
+	if !ok {
+		t.Fatal("set does not implement sql.Scanner")
+	}
+	valuer, ok := s.(driver.Valuer)
+	if !ok {
+		t.Fatal("set does not implement driver.Valuer")
+	}
+	for _, src := range []any{input, []byte(input)} {
+		s.Add(initial)
+		if err := scanner.Scan(src); err != nil {
+			t.Fatal(err)
+		}
+		if s.Cardinality() != len(expected) || !s.Contains(expected...) {
+			t.Fatalf("unexpected contents: %v", s)
+		}
+		value, err := valuer.Value()
+		if err != nil {
+			t.Fatal(err)
+		}
+		data, ok := value.([]byte)
+		if !ok {
+			t.Fatalf("Value returned %T, want []byte", value)
+		}
+		var decoded []T
+		if err := json.Unmarshal(data, &decoded); err != nil {
+			t.Fatal(err)
+		}
+		if len(decoded) != len(expected) || !s.Contains(decoded...) {
+			t.Fatalf("unexpected JSON: %s", data)
+		}
+	}
+	for _, src := range []any{42, true, []string{}, "", "[", "{}", "true", "[1,", `[1,"wrong"]`, []byte(`{"x":1}`)} {
+		before := s.Clone()
+		if err := scanner.Scan(src); err == nil {
+			t.Fatalf("Scan(%#v) succeeded", src)
+		}
+		if !s.Equal(before) {
+			t.Fatalf("Scan(%#v) changed contents", src)
+		}
+	}
+	for _, src := range []any{nil, "[]", []byte("[]")} {
+		s.Add(initial)
+		if err := scanner.Scan(src); err != nil {
+			t.Fatal(err)
+		}
+		if !s.IsEmpty() {
+			t.Fatalf("Scan(%#v) did not empty the set", src)
+		}
+		value, err := valuer.Value()
+		if err != nil {
+			t.Fatal(err)
+		}
+		if string(value.([]byte)) != "[]" {
+			t.Fatalf("empty set encoded as %s", value)
+		}
+		s.Add(initial)
+		if !s.Contains(initial) {
+			t.Fatal("cannot add after clearing")
+		}
+	}
+}
+
+func TestSQLSet(t *testing.T) {
+	t.Run("safe/int", func(t *testing.T) { testSQLSet(t, NewSet[int], 99, "[1,2,2,3]", 1, 2, 3) })
+	t.Run("unsafe/int", func(t *testing.T) { testSQLSet(t, NewThreadUnsafeSet[int], 99, "[1,2,2,3]", 1, 2, 3) })
+	t.Run("safe/string", func(t *testing.T) { testSQLSet(t, NewSet[string], "old", `["a","b","a"]`, "a", "b") })
+	t.Run("unsafe/string", func(t *testing.T) { testSQLSet(t, NewThreadUnsafeSet[string], "old", `["a","b","a"]`, "a", "b") })
+}
+
+func TestSQLValueError(t *testing.T) {
+	for _, s := range []Set[float64]{NewSet(math.Inf(1)), NewThreadUnsafeSet(math.Inf(1))} {
+		if _, err := s.(driver.Valuer).Value(); err == nil {
+			t.Fatal("Value should fail for infinity")
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

I’ll check the set implementations and JSON handling, add SQL support to both, and test that failed scans leave the contents unchanged.

The existing JSON decoder adds elements to the set. I’ll keep that behavior and make `Scan` decode into a temporary set, replacing the contents only after decoding succeeds. The thread-safe version will lock when it commits the replacement.

Implemented SQL support for both set implementations in [sql.go](/home/jdaddy/.cache/muffle-evals/runs/muffle/codex/go-feat-mapset-sql-1/work/sql.go).

- `Value()` returns a JSON array as `[]byte`.
- `Scan()` accepts strings and byte slices, replacing existing contents.
- SQL `NULL` clears the set.
- Failed scans preserve existing contents.

Added tests for integer and string sets. Both `go test ./...` and `go test -race ./...` pass.

</details>

### codex, hush: pass

Files: [sql.go](../hush/codex/go-feat-mapset-sql-1/files/sql.go), [sql_test.go](../hush/codex/go-feat-mapset-sql-1/files/sql_test.go)

<details><summary>diff</summary>

```diff
diff --git a/sql.go b/sql.go
new file mode 100644
index 0000000..2aacf7f
--- /dev/null
+++ b/sql.go
@@ -0,0 +1,57 @@
+package mapset
+
+import (
+	"database/sql"
+	"database/sql/driver"
+	"fmt"
+)
+
+var (
+	_ driver.Valuer = (*threadUnsafeSet[int])(nil)
+	_ sql.Scanner   = (*threadUnsafeSet[int])(nil)
+	_ driver.Valuer = (*threadSafeSet[int])(nil)
+	_ sql.Scanner   = (*threadSafeSet[int])(nil)
+)
+
+// Value returns the set as a JSON array of bytes.
+func (s *threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan replaces the set with a JSON array from a string or byte slice.
+// SQL NULL clears the set. Errors leave the set unchanged.
+func (s *threadUnsafeSet[T]) Scan(src any) error {
+	replacement := newThreadUnsafeSet[T]()
+	var data []byte
+	switch v := src.(type) {
+	case nil:
+	case string:
+		data = []byte(v)
+	case []byte:
+		data = v
+	default:
+		return fmt.Errorf("mapset: cannot scan %T into set", src)
+	}
+	if src != nil {
+		if err := replacement.UnmarshalJSON(data); err != nil {
+			return err
+		}
+	}
+	*s = *replacement
+	return nil
+}
+
+// Value returns the set as a JSON array of bytes.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	t.RLock()
+	defer t.RUnlock()
+	return t.uss.Value()
+}
+
+// Scan replaces the set with a JSON array from a string or byte slice.
+// SQL NULL clears the set. Errors leave the set unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+	return t.uss.Scan(src)
+}
diff --git a/sql_test.go b/sql_test.go
new file mode 100644
index 0000000..b4e00f5
--- /dev/null
+++ b/sql_test.go
@@ -0,0 +1,100 @@
+package mapset
+
+import (
+	"database/sql"
+	"database/sql/driver"
+	"encoding/json"
+	"math"
+	"sync"
+	"testing"
+)
+
+func checkSQLSet[T comparable](t *testing.T, newSet func(...T) Set[T], old, first, second T, array string) {
+	t.Helper()
+	s := newSet(old)
+	scanner := s.(sql.Scanner)
+	valuer := s.(driver.Valuer)
+	for _, src := range []any{array, []byte(array)} {
+		s.Add(old)
+		if err := scanner.Scan(src); err != nil {
+			t.Fatal(err)
+		}
+		if s.Cardinality() != 2 || !s.Contains(first, second) {
+			t.Fatalf("Scan did not replace contents: %v", s)
+		}
+		value, err := valuer.Value()
+		if err != nil {
+			t.Fatal(err)
+		}
+		data, ok := value.([]byte)
+		if !ok {
+			t.Fatalf("Value returned %T, want []byte", value)
+		}
+		var items []T
+		if err := json.Unmarshal(data, &items); err != nil {
+			t.Fatal(err)
+		}
+		if len(items) != 2 || !newSet(items...).Contains(first, second) {
+			t.Fatalf("unexpected Value: %s", data)
+		}
+	}
+	for _, src := range []any{42, true, []int{1}, "[", "{}", "true", `[1,"bad",`, []byte(nil), ""} {
+		if err := scanner.Scan(src); err == nil {
+			t.Fatalf("Scan(%#v) succeeded", src)
+		}
+		if s.Cardinality() != 2 || !s.Contains(first, second) {
+			t.Fatalf("failed Scan changed contents: %v", s)
+		}
+	}
+	for _, src := range []any{nil, "[]", []byte("[]")} {
+		s.Add(old)
+		if err := scanner.Scan(src); err != nil {
+			t.Fatal(err)
+		}
+		if !s.IsEmpty() {
+			t.Fatalf("Scan(%#v) did not clear contents", src)
+		}
+		value, err := valuer.Value()
+		if err != nil || string(value.([]byte)) != "[]" {
+			t.Fatalf("empty Value = %s, %v", value, err)
+		}
+		s.Add(first) // The cleared set remains writable.
+	}
+}
+
+func TestSQLSet(t *testing.T) {
+	t.Run("safe/int", func(t *testing.T) { checkSQLSet(t, NewSet[int], 9, 1, 2, "[1,2,2]") })
+	t.Run("unsafe/int", func(t *testing.T) { checkSQLSet(t, NewThreadUnsafeSet[int], 9, 1, 2, "[1,2,2]") })
+	t.Run("safe/string", func(t *testing.T) { checkSQLSet(t, NewSet[string], "old", "a", "b", `["a","b","b"]`) })
+	t.Run("unsafe/string", func(t *testing.T) { checkSQLSet(t, NewThreadUnsafeSet[string], "old", "a", "b", `["a","b","b"]`) })
+	for _, s := range []Set[float64]{NewSet(math.NaN()), NewThreadUnsafeSet(math.NaN())} {
+		if _, err := s.(driver.Valuer).Value(); err == nil {
+			t.Fatal("Value should return JSON encoding errors")
+		}
+	}
+	for _, s := range []Set[int]{NewSet(9), NewThreadUnsafeSet(9)} {
+		if err := s.(sql.Scanner).Scan(`[1,"bad"]`); err == nil || s.Cardinality() != 1 || !s.Contains(9) {
+			t.Fatal("element decoding error must preserve contents")
+		}
+	}
+}
+
+func TestSQLSetConcurrent(t *testing.T) {
+	s := NewSet(1)
+	var wg sync.WaitGroup
+	for range 4 {
+		wg.Go(func() {
+			for range 100 {
+				if err := s.(sql.Scanner).Scan("[1,2]"); err != nil {
+					t.Error(err)
+				}
+				if _, err := s.(driver.Valuer).Value(); err != nil {
+					t.Error(err)
+				}
+				s.Add(3)
+				s.Contains(1)
+			}
+		})
+	}
+	wg.Wait()
+}
```

</details>

<details><summary>reply</summary>

Set SQL support needs atomic scans. Checking implementations and tests.


Done.
Both sets support `driver.Valuer` and `sql.Scanner`; scans replace contents, clear NULL, preserve contents on errors. `go test -race ./...` passed.

</details>

### codex, sloth: pass

Files: [threadsafe.go](../sloth/codex/go-feat-mapset-sql-1/files/threadsafe.go), [threadunsafe.go](../sloth/codex/go-feat-mapset-sql-1/files/threadunsafe.go)

<details><summary>diff</summary>

```diff
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..bd600be 100644
--- a/threadsafe.go
+++ b/threadsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"sync"
 )
 
@@ -351,3 +352,16 @@ func (t *threadSafeSet[T]) UnmarshalJSON(p []byte) error {
 
 	return err
 }
+
+// Value returns the set as a JSON array for storage in a database column.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	return t.MarshalJSON()
+}
+
+// Scan replaces the set with a JSON array from a string or byte slice.
+// A nil source empties the set; errors leave its contents unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+	return t.uss.Scan(src)
+}
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..b03f47f 100644
--- a/threadunsafe.go
+++ b/threadunsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"encoding/json"
 	"fmt"
 	"strings"
@@ -382,3 +383,32 @@ func (s *threadUnsafeSet[T]) UnmarshalJSON(b []byte) error {
 
 	return nil
 }
+
+// Value returns the set as a JSON array for storage in a database column.
+func (s *threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan replaces the set with a JSON array from a string or byte slice.
+// A nil source empties the set; errors leave its contents unchanged.
+func (s *threadUnsafeSet[T]) Scan(src any) error {
+	var data []byte
+	switch v := src.(type) {
+	case nil:
+		s.Clear()
+		return nil
+	case string:
+		data = []byte(v)
+	case []byte:
+		data = v
+	default:
+		return fmt.Errorf("mapset: cannot scan %T into a set", src)
+	}
+
+	replacement := newThreadUnsafeSet[T]()
+	if err := replacement.UnmarshalJSON(data); err != nil {
+		return err
+	}
+	*s = *replacement
+	return nil
+}
```

</details>

<details><summary>reply</summary>

I’ll check both implementations and their JSON methods, add SQL support using the existing code, then build and run the existing tests.

The change only needs methods on the two concrete implementations. Constructors and the `Set` interface can stay as they are; callers will be able to type-assert constructor results to either SQL interface. No fixtures or configuration need changes.

The existing JSON decoder adds elements, so `Scan` will decode into a temporary set before replacing the contents. This preserves the existing JSON behavior and leaves the set unchanged on errors.

Both set implementations now implement `driver.Valuer` and `sql.Scanner`.

- `Value` returns a JSON array as `[]byte`.
- `Scan` replaces contents from a string or byte slice.
- `Scan(nil)` empties the set.
- Unsupported types and invalid JSON return errors without changing contents.

Validation passed: `go build ./...` and `go test ./...`.

</details>

### codex, all: pass

Files: [threadsafe.go](../all/codex/go-feat-mapset-sql-1/files/threadsafe.go), [threadunsafe.go](../all/codex/go-feat-mapset-sql-1/files/threadunsafe.go)

<details><summary>diff</summary>

```diff
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..c598bd2 100644
--- a/threadsafe.go
+++ b/threadsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"sync"
 )
 
@@ -344,6 +345,19 @@ func (t *threadSafeSet[T]) MarshalJSON() ([]byte, error) {
 	return b, err
 }
 
+// Value returns the set as a JSON array for a database column.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	return t.MarshalJSON()
+}
+
+// Scan replaces the set with a JSON array or clears it for SQL NULL.
+// Invalid input leaves the set unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+	return t.uss.Scan(src)
+}
+
 func (t *threadSafeSet[T]) UnmarshalJSON(p []byte) error {
 	t.Lock()
 	err := t.uss.UnmarshalJSON(p)
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..1b06251 100644
--- a/threadunsafe.go
+++ b/threadunsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"encoding/json"
 	"fmt"
 	"strings"
@@ -370,6 +371,35 @@ func (s threadUnsafeSet[T]) MarshalJSON() ([]byte, error) {
 	return json.Marshal(s.ToSlice())
 }
 
+// Value returns the set as a JSON array for a database column.
+func (s threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan replaces the set with a JSON array or clears it for SQL NULL.
+// Invalid input leaves the set unchanged.
+func (s *threadUnsafeSet[T]) Scan(src any) error {
+	var data []byte
+	switch v := src.(type) {
+	case nil:
+		s.Clear()
+		return nil
+	case string:
+		data = []byte(v)
+	case []byte:
+		data = v
+	default:
+		return fmt.Errorf("mapset: cannot scan %T into a set", src)
+	}
+
+	replacement := newThreadUnsafeSet[T]()
+	if err := replacement.UnmarshalJSON(data); err != nil {
+		return err
+	}
+	*s = *replacement
+	return nil
+}
+
 // UnmarshalJSON recreates a set from a JSON array, it only decodes
 // primitive types. Numbers are decoded as json.Number.
 func (s *threadUnsafeSet[T]) UnmarshalJSON(b []byte) error {
```

</details>

<details><summary>reply</summary>

Sets need SQL conversion with atomic scan replacement. Checking implementations and existing JSON handling.


Done.
Both sets support SQL JSON values, scan replacement, NULL clearing, unchanged contents on errors. Build and existing tests pass.

</details>
