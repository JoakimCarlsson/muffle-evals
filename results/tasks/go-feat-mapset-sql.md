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
| claude | muffle | pass | +64/-0 | 43 | 2,653 | $0.083 |
| claude | hush | pass | +50/-0 | 36 | 2,289 | $0.067 |
| claude | sloth | pass | +50/-0 | 37 | 2,539 | $0.088 |
| claude | all | pass | +47/-0 | 25 | 2,654 | $0.091 |
| codex | base | pass | +57/-0 | 105 | 2,196 | - |
| codex | muffle | pass | +58/-0 | 82 | 2,288 | - |
| codex | hush | pass | +59/-0 | 85 | 2,056 | - |
| codex | sloth | pass | +44/-0 | 76 | 2,450 | - |
| codex | all | pass | +45/-0 | 64 | 1,823 | - |

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
index 0000000..88c454d
--- /dev/null
+++ b/sql_test.go
@@ -0,0 +1,43 @@
+package mapset
+
+import (
+	"database/sql"
+	"database/sql/driver"
+	"testing"
+)
+
+func TestSQLValuerScanner(t *testing.T) {
+	for name, mk := range map[string]func(...int) Set[int]{
+		"safe":   NewSet[int],
+		"unsafe": NewThreadUnsafeSet[int],
+	} {
+		t.Run(name, func(t *testing.T) {
+			s := mk(1, 2, 3)
+			v, err := any(s).(driver.Valuer).Value()
+			if err != nil {
+				t.Fatal(err)
+			}
+			if _, ok := v.([]byte); !ok {
+				t.Fatalf("got %T", v)
+			}
+			d := mk(9)
+			sc := any(d).(sql.Scanner)
+			if err := sc.Scan(v); err != nil || !d.Equal(s) {
+				t.Fatalf("scan []byte: %v %v", err, d)
+			}
+			if err := sc.Scan("[4,5]"); err != nil || !d.Equal(mk(4, 5)) {
+				t.Fatalf("scan string: %v %v", err, d)
+			}
+			if sc.Scan(42) == nil || sc.Scan("{bad") == nil || !d.Equal(mk(4, 5)) {
+				t.Fatalf("errors must leave set unchanged: %v", d)
+			}
+			if err := sc.Scan(nil); err != nil || d.Cardinality() != 0 {
+				t.Fatalf("scan nil: %v %v", err, d)
+			}
+			v, _ = any(d).(driver.Valuer).Value()
+			if string(v.([]byte)) != "[]" {
+				t.Fatalf("empty: %s", v)
+			}
+		})
+	}
+}
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..b36c9d5 100644
--- a/threadsafe.go
+++ b/threadsafe.go
@@ -26,9 +26,16 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql"
+	"database/sql/driver"
 	"sync"
 )
 
+var (
+	_ driver.Valuer = (*threadSafeSet[string])(nil)
+	_ sql.Scanner   = (*threadSafeSet[string])(nil)
+)
+
 type threadSafeSet[T comparable] struct {
 	sync.RWMutex
 	uss *threadUnsafeSet[T]
@@ -351,3 +358,21 @@ func (t *threadSafeSet[T]) UnmarshalJSON(p []byte) error {
 
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
+// JSON array in src, which must be a string or []byte. A nil src (SQL NULL)
+// empties the set. On error the set is left unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+
+	return t.uss.Scan(src)
+}
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..86846bf 100644
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
@@ -382,3 +389,35 @@ func (s *threadUnsafeSet[T]) UnmarshalJSON(b []byte) error {
 
 	return nil
 }
+
+// Value implements driver.Valuer. It returns the set as a JSON array ([]byte).
+func (s threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan implements sql.Scanner. It replaces the contents of the set with the
+// JSON array in src, which must be a string or []byte. A nil src (SQL NULL)
+// empties the set. On error the set is left unchanged.
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
+	var i []T
+	if err := json.Unmarshal(b, &i); err != nil {
+		return err
+	}
+	clear(*s)
+	s.append(i...)
+
+	return nil
+}
```

</details>

<details><summary>reply</summary>

Both set types now implement `driver.Valuer` and `sql.Scanner`. The new test and the existing suite pass, and `go vet` is clean.

- **`Value()`** returns the set as a JSON array in a `[]byte`, in any order. An empty set gives `[]`.
- **`Scan(src)`** replaces the contents of the set with the JSON array in `src`, which can be a `string` or `[]byte`.
  - `Scan(nil)` empties the set.
  - Any other type, or invalid JSON, returns an error and leaves the set as it was.
- **Locking:** the thread-safe set takes its lock around both methods, so they are safe to call concurrently.

`Scan` clears the set before filling it, whereas the existing `UnmarshalJSON` adds to what is already there. I left `UnmarshalJSON` alone.

The changes are in `threadunsafe.go` and `threadsafe.go`. The new test, `sql_test.go`, covers both constructors with a type assertion to each interface, a round trip, string and `[]byte` input, `NULL`, the error cases, and the empty set. I haven't committed anything.

</details>

### claude, hush: pass

Files: [sql_test.go](../hush/claude/go-feat-mapset-sql-1/files/sql_test.go), [threadsafe.go](../hush/claude/go-feat-mapset-sql-1/files/threadsafe.go), [threadunsafe.go](../hush/claude/go-feat-mapset-sql-1/files/threadunsafe.go)

<details><summary>diff</summary>

```diff
diff --git a/sql_test.go b/sql_test.go
new file mode 100644
index 0000000..d7344e1
--- /dev/null
+++ b/sql_test.go
@@ -0,0 +1,36 @@
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
+		v, ok := s.(driver.Valuer)
+		sc, ok2 := s.(sql.Scanner)
+		if !ok || !ok2 {
+			t.Fatalf("%s: interfaces not implemented", name)
+		}
+		val, err := v.Value()
+		if b, isB := val.([]byte); err != nil || !isB || len(b) != 5 {
+			t.Fatalf("%s: Value = %v, %v", name, val, err)
+		}
+		if err := sc.Scan("[3,4,5]"); err != nil || s.Cardinality() != 3 || !s.Contains(3, 4, 5) {
+			t.Fatalf("%s: scan string: %v %v", name, err, s)
+		}
+		if err := sc.Scan([]byte("[7]")); err != nil || s.Cardinality() != 1 || !s.Contains(7) {
+			t.Fatalf("%s: scan bytes: %v %v", name, err, s)
+		}
+		if sc.Scan(42) == nil || sc.Scan("{bad") == nil || sc.Scan(`["x"]`) == nil || !s.Contains(7) || s.Cardinality() != 1 {
+			t.Fatalf("%s: error cases changed set: %v", name, s)
+		}
+		if err := sc.Scan(nil); err != nil || s.Cardinality() != 0 {
+			t.Fatalf("%s: scan nil: %v %v", name, err, s)
+		}
+		if val, _ := v.Value(); string(val.([]byte)) != "[]" {
+			t.Fatalf("%s: empty Value = %s", name, val)
+		}
+	}
+}
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..4ad109b 100644
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
+// Value implements driver.Valuer, it returns the set as a JSON array ([]byte).
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	t.RLock()
+	defer t.RUnlock()
+
+	return t.uss.Value()
+}
+
+// Scan implements sql.Scanner, see threadUnsafeSet.Scan.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+
+	return t.uss.Scan(src)
+}
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..e2e5c43 100644
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
+// Value implements driver.Valuer, it returns the set as a JSON array ([]byte).
+func (s threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
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
+		return fmt.Errorf("mapset: cannot scan %T into set", src)
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

Done. Both sets now implement `driver.Valuer` and `sql.Scanner`, in `threadunsafe.go` and `threadsafe.go`. `Scan` replaces the contents, empties the set on `nil`, and leaves the set unchanged on an unsupported type or invalid JSON. I added `sql_test.go`, and `go vet` and `go test ./...` pass. I did not test against a real database driver.

</details>

### claude, sloth: pass

Files: [threadsafe.go](../sloth/claude/go-feat-mapset-sql-1/files/threadsafe.go), [threadunsafe.go](../sloth/claude/go-feat-mapset-sql-1/files/threadunsafe.go), [threadunsafe_test.go](../sloth/claude/go-feat-mapset-sql-1/files/threadunsafe_test.go)

<details><summary>diff</summary>

```diff
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..38f7554 100644
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
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	t.RLock()
+	v, err := t.uss.Value()
+	t.RUnlock()
+
+	return v, err
+}
+
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	err := t.uss.Scan(src)
+	t.Unlock()
+
+	return err
+}
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..82ffe11 100644
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
+// Value implements driver.Valuer, it returns the set as a JSON array of bytes.
+func (s threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan implements sql.Scanner, it replaces the contents of the set with the
+// JSON array in src (string or []byte). A nil src empties the set. On error
+// the set is left unchanged.
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
+		return fmt.Errorf("mapset: cannot scan %T into a set", src)
+	}
+
+	var i []T
+	if err := json.Unmarshal(b, &i); err != nil {
+		return err
+	}
+	s.Clear()
+	s.append(i...)
+
+	return nil
+}
diff --git a/threadunsafe_test.go b/threadunsafe_test.go
index c670305..87d2f85 100644
--- a/threadunsafe_test.go
+++ b/threadunsafe_test.go
@@ -26,6 +26,8 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql"
+	"database/sql/driver"
 	"encoding/json"
 	"testing"
 )
@@ -162,3 +164,38 @@ func (t *testStruct) UnmarshalJSON(b []byte) error {
 
 	return nil
 }
+
+func TestSQLValuerScanner(t *testing.T) {
+	for name, newSet := range map[string]func(...int) Set[int]{
+		"safe":   NewSet[int],
+		"unsafe": NewThreadUnsafeSet[int],
+	} {
+		s := newSet(1, 2, 3)
+		v, err := s.(driver.Valuer).Value()
+		if err != nil {
+			t.Fatalf("%s: Value: %v", name, err)
+		}
+		b, ok := v.([]byte)
+		if !ok {
+			t.Fatalf("%s: Value returned %T, want []byte", name, v)
+		}
+
+		got := newSet(9)
+		sc := got.(sql.Scanner)
+		if err := sc.Scan(b); err != nil || !got.Equal(s) {
+			t.Errorf("%s: Scan([]byte) = %v, set %v", name, err, got)
+		}
+		if err := sc.Scan("[4]"); err != nil || !got.Equal(newSet(4)) {
+			t.Errorf("%s: Scan(string) = %v, set %v", name, err, got)
+		}
+		if err := sc.Scan(1.5); err == nil || !got.Equal(newSet(4)) {
+			t.Errorf("%s: Scan(float) err %v, set %v", name, err, got)
+		}
+		if err := sc.Scan("[oops"); err == nil || !got.Equal(newSet(4)) {
+			t.Errorf("%s: Scan(invalid) err %v, set %v", name, err, got)
+		}
+		if err := sc.Scan(nil); err != nil || got.Cardinality() != 0 {
+			t.Errorf("%s: Scan(nil) = %v, set %v", name, err, got)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

Both set types now implement `driver.Valuer` and `sql.Scanner`, so you can type-assert the value returned by `NewSet` or `NewThreadUnsafeSet` to either interface. Build, vet and the full test suite pass, including the new test.

- **`Value()`** returns the set as a JSON array of `[]byte`, in no particular order.
- **`Scan(src)`** replaces the contents of the set. It accepts a `string` or `[]byte`, and `nil` empties the set. Any other type or invalid JSON returns an error and leaves the set as it was.
- **Thread safety:** the thread-safe set locks around `Value` and `Scan`, as it does for its JSON methods.

I added `TestSQLValuerScanner` to `threadunsafe_test.go`. It runs both implementations through round-trip, `string`, `[]byte`, `nil`, wrong-type and invalid-JSON cases.

I did not add these methods to the `Set` interface, so existing external implementations keep compiling. That means you reach them by type assertion rather than directly on `Set[T]`. The code is in `threadunsafe.go` and `threadsafe.go`.

I haven't committed anything.

</details>

### claude, all: pass

Files: [set_test.go](../all/claude/go-feat-mapset-sql-1/files/set_test.go), [threadsafe.go](../all/claude/go-feat-mapset-sql-1/files/threadsafe.go), [threadunsafe.go](../all/claude/go-feat-mapset-sql-1/files/threadunsafe.go)

<details><summary>diff</summary>

```diff
diff --git a/set_test.go b/set_test.go
index 056781e..337d4c0 100644
--- a/set_test.go
+++ b/set_test.go
@@ -26,6 +26,8 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql"
+	"database/sql/driver"
 	"math"
 	"testing"
 	"time"
@@ -1860,3 +1862,26 @@ func Test_Example(t *testing.T) {
 	   fmt.Println(allClasses.ContainsAll("Welding", "Automotive", "English"))
 	*/
 }
+
+func TestSQLValuerScanner(t *testing.T) {
+	for name, mk := range map[string]func(...int) Set[int]{"safe": NewSet[int], "unsafe": NewThreadUnsafeSet[int]} {
+		s := mk(1, 2)
+		v, err := s.(driver.Valuer).Value()
+		if b, ok := v.([]byte); err != nil || !ok || (string(b) != "[1,2]" && string(b) != "[2,1]") {
+			t.Fatalf("%s: Value() = %v, %v", name, v, err)
+		}
+		sc := s.(sql.Scanner)
+		if err := sc.Scan([]byte("[3]")); err != nil || !s.Equal(mk(3)) {
+			t.Fatalf("%s: Scan bytes: %v %v", name, err, s)
+		}
+		if err := sc.Scan("[4,5]"); err != nil || !s.Equal(mk(4, 5)) {
+			t.Fatalf("%s: Scan string: %v %v", name, err, s)
+		}
+		if sc.Scan(1) == nil || sc.Scan("{") == nil || !s.Equal(mk(4, 5)) {
+			t.Fatalf("%s: bad scan must error and keep set: %v", name, s)
+		}
+		if err := sc.Scan(nil); err != nil || s.Cardinality() != 0 {
+			t.Fatalf("%s: Scan nil: %v %v", name, err, s)
+		}
+	}
+}
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..8f1f416 100644
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
+// Value implements driver.Valuer, returning the set as a JSON array.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	t.RLock()
+	defer t.RUnlock()
+
+	return t.uss.Value()
+}
+
+// Scan implements sql.Scanner. See threadUnsafeSet.Scan.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+
+	return t.uss.Scan(src)
+}
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..7c8b812 100644
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
+// Value implements driver.Valuer, returning the set as a JSON array.
+func (s threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan implements sql.Scanner. It replaces the set contents with the JSON
+// array in src (string or []byte); nil empties the set. On error the set
+// is left unchanged.
+func (s *threadUnsafeSet[T]) Scan(src any) error {
+	var i []T
+	switch v := src.(type) {
+	case nil:
+	case string:
+		if err := json.Unmarshal([]byte(v), &i); err != nil {
+			return err
+		}
+	case []byte:
+		if err := json.Unmarshal(v, &i); err != nil {
+			return err
+		}
+	default:
+		return fmt.Errorf("mapset: cannot scan %T into set", src)
+	}
+	clear(*s)
+	s.append(i...)
+
+	return nil
+}
```

</details>

<details><summary>reply</summary>

Test bug: `Equal` needs same set type. Fixing the test to build expected sets with the matching constructor.

Done. Both set types now implement `driver.Valuer` and `sql.Scanner`, in `threadunsafe.go` and `threadsafe.go`. I added `TestSQLValuerScanner` to `set_test.go`. Vet and the full test suite pass.

`Scan` replaces the set contents. A bad type or bad JSON returns an error and leaves the set unchanged.

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
index 0000000..bc21692
--- /dev/null
+++ b/sql.go
@@ -0,0 +1,58 @@
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
+// Value returns the set as a JSON array for storage in a database column.
+func (s threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan replaces the set with a JSON array from a string or byte slice.
+// A nil source empties the set. On error, the set is unchanged.
+func (s *threadUnsafeSet[T]) Scan(src any) error {
+	var data []byte
+	switch v := src.(type) {
+	case nil:
+		*s = make(threadUnsafeSet[T])
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
+// Value returns the set as a JSON array for storage in a database column.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	t.RLock()
+	defer t.RUnlock()
+	return t.uss.Value()
+}
+
+// Scan replaces the set with a JSON array from a string or byte slice.
+// A nil source empties the set. On error, the set is unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+	return t.uss.Scan(src)
+}
diff --git a/sql_test.go b/sql_test.go
new file mode 100644
index 0000000..d7746a2
--- /dev/null
+++ b/sql_test.go
@@ -0,0 +1,82 @@
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
+func testSQLSet[T comparable](t *testing.T, newSet func(...T) Set[T], original T, values []T, encoded string) {
+	t.Helper()
+	s := newSet(original)
+	scanner := s.(sql.Scanner)
+	valuer := s.(driver.Valuer)
+	for _, src := range []any{encoded, []byte(encoded)} {
+		s.Add(original)
+		if err := scanner.Scan(src); err != nil {
+			t.Fatal(err)
+		}
+		if !s.Equal(newSet(values...)) {
+			t.Fatalf("Scan(%v) produced %v", src, s)
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
+		if !newSet(decoded...).Equal(s) {
+			t.Fatalf("Value round trip produced %v", decoded)
+		}
+	}
+	for _, src := range []any{42, true, struct{}{}, "", "[", "{}", "[true]", encoded + " trailing", []byte(nil)} {
+		before := s.Clone()
+		if err := scanner.Scan(src); err == nil {
+			t.Errorf("Scan(%v) should fail", src)
+		}
+		if !s.Equal(before) {
+			t.Fatalf("Scan(%v) changed the set on error", src)
+		}
+	}
+	for _, src := range []any{nil, "[]", []byte("[]")} {
+		s.Add(original)
+		if err := scanner.Scan(src); err != nil || !s.IsEmpty() {
+			t.Fatalf("Scan(%v): set=%v, error=%v", src, s, err)
+		}
+		value, err := valuer.Value()
+		if err != nil || string(value.([]byte)) != "[]" {
+			t.Fatalf("empty Value: %s, %v", value, err)
+		}
+	}
+}
+
+func TestSQLSet(t *testing.T) {
+	t.Run("thread-safe/int", func(t *testing.T) {
+		testSQLSet(t, NewSet[int], 99, []int{1, 2, 3}, `[1,2,2,3]`)
+	})
+	t.Run("thread-unsafe/int", func(t *testing.T) {
+		testSQLSet(t, NewThreadUnsafeSet[int], 99, []int{1, 2, 3}, `[1,2,2,3]`)
+	})
+	t.Run("thread-safe/string", func(t *testing.T) {
+		testSQLSet(t, NewSet[string], "old", []string{"a", "b"}, `["a","b","a"]`)
+	})
+	t.Run("thread-unsafe/string", func(t *testing.T) {
+		testSQLSet(t, NewThreadUnsafeSet[string], "old", []string{"a", "b"}, `["a","b","a"]`)
+	})
+}
+
+func TestSQLValueError(t *testing.T) {
+	for _, s := range []Set[float64]{NewSet(math.Inf(1)), NewThreadUnsafeSet(math.Inf(1))} {
+		if _, err := s.(driver.Valuer).Value(); err == nil {
+			t.Error("Value should report JSON encoding errors")
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

I’ll check both set implementations and their JSON methods, add database support, and test the scan behavior you described.

The existing JSON decoder adds elements to the set. I’ll have `Scan` decode into a temporary set before replacing the contents, so failed scans leave the original set intact. The thread-safe implementation will use its existing lock.

Implemented `driver.Valuer` and `sql.Scanner` for both set implementations.

- `Value` returns a JSON array as `[]byte`.
- `Scan` replaces contents from a string or `[]byte`.
- `Scan(nil)` empties the set.
- Invalid input returns an error without changing the set.

Added tests for integer and string sets. Both `go test ./...` and `go test -race ./...` pass.

</details>

### codex, hush: pass

Files: [sql.go](../hush/codex/go-feat-mapset-sql-1/files/sql.go), [sql_test.go](../hush/codex/go-feat-mapset-sql-1/files/sql_test.go)

<details><summary>diff</summary>

```diff
diff --git a/sql.go b/sql.go
new file mode 100644
index 0000000..a0f9ac4
--- /dev/null
+++ b/sql.go
@@ -0,0 +1,59 @@
+package mapset
+
+import (
+	"database/sql"
+	"database/sql/driver"
+	"encoding/json"
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
+// Value returns the set as a JSON array for storage in a database column.
+func (s *threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan replaces the set with a JSON array from a string or byte slice.
+// A nil source clears the set. Errors leave the set unchanged.
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
+	var values []T
+	if err := json.Unmarshal(data, &values); err != nil {
+		return err
+	}
+	replacement := make(threadUnsafeSet[T], len(values))
+	replacement.append(values...)
+	*s = replacement
+	return nil
+}
+
+// Value returns the set as a JSON array for storage in a database column.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	return t.MarshalJSON()
+}
+
+// Scan replaces the set with a JSON array from a string or byte slice.
+// A nil source clears the set. Errors leave the set unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+	return t.uss.Scan(src)
+}
diff --git a/sql_test.go b/sql_test.go
new file mode 100644
index 0000000..874c204
--- /dev/null
+++ b/sql_test.go
@@ -0,0 +1,85 @@
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
+func testSQLSet[T comparable](t *testing.T, constructor func(...T) Set[T], old T, values []T, data string) {
+	t.Helper()
+	s := constructor(old)
+	scanner := s.(sql.Scanner)
+	valuer := s.(driver.Valuer)
+	for _, src := range []any{data, []byte(data)} {
+		s.Add(old)
+		if err := scanner.Scan(src); err != nil {
+			t.Fatal(err)
+		}
+		if !s.Equal(constructor(values...)) {
+			t.Fatalf("Scan(%q) = %v", src, s)
+		}
+		value, err := valuer.Value()
+		if err != nil {
+			t.Fatal(err)
+		}
+		b, ok := value.([]byte)
+		if !ok {
+			t.Fatalf("Value returned %T, want []byte", value)
+		}
+		var decoded []T
+		if err := json.Unmarshal(b, &decoded); err != nil {
+			t.Fatal(err)
+		}
+		if len(decoded) != s.Cardinality() || !s.Equal(constructor(decoded...)) {
+			t.Fatalf("Value round trip = %v, want %v", decoded, s)
+		}
+	}
+	before := s.Clone()
+	for _, src := range []any{42, true, struct{}{}, "", []byte(nil), "[", "{}", "true", data + " trailing", `[1,"x"]`} {
+		if err := scanner.Scan(src); err == nil {
+			t.Fatalf("Scan(%q) succeeded", src)
+		}
+		if !s.Equal(before) {
+			t.Fatalf("Scan(%q) changed set to %v", src, s)
+		}
+	}
+	for _, src := range []any{nil, "[]", []byte("[]")} {
+		s.Add(old)
+		if err := scanner.Scan(src); err != nil {
+			t.Fatal(err)
+		}
+		if !s.IsEmpty() {
+			t.Fatalf("Scan(%q) did not clear set", src)
+		}
+		value, err := valuer.Value()
+		if err != nil || string(value.([]byte)) != "[]" {
+			t.Fatalf("empty Value = %s, %v", value, err)
+		}
+	}
+}
+
+func TestSQLSet(t *testing.T) {
+	t.Run("safe/int", func(t *testing.T) {
+		testSQLSet(t, NewSet[int], 99, []int{1, 2}, `[1,2,1]`)
+	})
+	t.Run("unsafe/int", func(t *testing.T) {
+		testSQLSet(t, NewThreadUnsafeSet[int], 99, []int{1, 2}, `[1,2,1]`)
+	})
+	t.Run("safe/string", func(t *testing.T) {
+		testSQLSet(t, NewSet[string], "old", []string{"a", "b"}, `["a","b","a"]`)
+	})
+	t.Run("unsafe/string", func(t *testing.T) {
+		testSQLSet(t, NewThreadUnsafeSet[string], "old", []string{"a", "b"}, `["a","b","a"]`)
+	})
+}
+
+func TestSQLValueError(t *testing.T) {
+	for _, s := range []Set[float64]{NewSet(math.Inf(1)), NewThreadUnsafeSet(math.Inf(1))} {
+		if _, err := s.(driver.Valuer).Value(); err == nil {
+			t.Fatal("Value succeeded for infinity")
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

Set SQL support: checking implementations and tests.


Done. Both sets support SQL JSON values, atomic scans, NULL clearing. Tests and race checks pass.

</details>

### codex, sloth: pass

Files: [set_test.go](../sloth/codex/go-feat-mapset-sql-1/files/set_test.go), [threadsafe.go](../sloth/codex/go-feat-mapset-sql-1/files/threadsafe.go), [threadunsafe.go](../sloth/codex/go-feat-mapset-sql-1/files/threadunsafe.go)

<details><summary>diff</summary>

```diff
diff --git a/set_test.go b/set_test.go
index 056781e..2b45089 100644
--- a/set_test.go
+++ b/set_test.go
@@ -26,6 +26,9 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql"
+	"database/sql/driver"
+	"encoding/json"
 	"math"
 	"testing"
 	"time"
@@ -1860,3 +1863,76 @@ func Test_Example(t *testing.T) {
 	   fmt.Println(allClasses.ContainsAll("Welding", "Automotive", "English"))
 	*/
 }
+
+// TestSQLInterfaces verifies database conversion and atomic replacement for both sets.
+func TestSQLInterfaces(t *testing.T) {
+	for _, tc := range []struct {
+		name    string
+		set     any
+		initial []any
+		input   string
+		want    []any
+		invalid string
+	}{
+		{"safe/int", NewSet(1, 2), []any{float64(1), float64(2)}, `[3,3,4]`, []any{float64(3), float64(4)}, `[5,"bad"]`},
+		{"unsafe/int", NewThreadUnsafeSet(1, 2), []any{float64(1), float64(2)}, `[3,3,4]`, []any{float64(3), float64(4)}, `[5,"bad"]`},
+		{"safe/string", NewSet("a", "b"), []any{"a", "b"}, `["c","c","d"]`, []any{"c", "d"}, `["e",5]`},
+		{"unsafe/string", NewThreadUnsafeSet("a", "b"), []any{"a", "b"}, `["c","c","d"]`, []any{"c", "d"}, `["e",5]`},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			valuer, ok := tc.set.(driver.Valuer)
+			if !ok {
+				t.Fatal("set does not implement driver.Valuer")
+			}
+			scanner, ok := tc.set.(sql.Scanner)
+			if !ok {
+				t.Fatal("set does not implement sql.Scanner")
+			}
+			for _, step := range []struct {
+				src       any
+				scan      bool
+				wantError bool
+				want      []any
+			}{
+				{want: tc.initial},
+				{src: tc.input, scan: true, want: tc.want},
+				{src: []byte(tc.input), scan: true, want: tc.want},
+				{src: 123, scan: true, wantError: true, want: tc.want},
+				{src: true, scan: true, wantError: true, want: tc.want},
+				{src: `[`, scan: true, wantError: true, want: tc.want},
+				{src: `{}`, scan: true, wantError: true, want: tc.want},
+				{src: tc.invalid, scan: true, wantError: true, want: tc.want},
+				{src: []byte(nil), scan: true, wantError: true, want: tc.want},
+				{src: nil, scan: true},
+				{src: tc.input, scan: true, want: tc.want},
+				{src: `[]`, scan: true},
+			} {
+				if step.scan {
+					if err := scanner.Scan(step.src); (err != nil) != step.wantError {
+						t.Fatalf("Scan(%v) error = %v, want error %v", step.src, err, step.wantError)
+					}
+				}
+				value, err := valuer.Value()
+				if err != nil {
+					t.Fatal(err)
+				}
+				b, ok := value.([]byte)
+				if !ok {
+					t.Fatalf("Value returned %T, want []byte", value)
+				}
+				var got []any
+				if err := json.Unmarshal(b, &got); err != nil {
+					t.Fatal(err)
+				}
+				if string(b) == "null" || len(got) != len(step.want) || !NewThreadUnsafeSet(got...).Equal(NewThreadUnsafeSet(step.want...)) {
+					t.Fatalf("Value = %s, want elements %v", b, step.want)
+				}
+			}
+		})
+	}
+	for _, set := range []any{NewSet[chan int](make(chan int)), NewThreadUnsafeSet[chan int](make(chan int))} {
+		if _, err := set.(driver.Valuer).Value(); err == nil {
+			t.Fatal("Value should report unsupported JSON elements")
+		}
+	}
+}
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..57563c2 100644
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
+// Value returns the set as a JSON array for database storage.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	return t.MarshalJSON()
+}
+
+// Scan replaces the set with a JSON array or clears it for SQL NULL.
+// Unsupported source types and decoding errors leave the set unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+	return t.uss.Scan(src)
+}
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..75e300d 100644
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
+// Value returns the set as a JSON array for database storage.
+func (s threadUnsafeSet[T]) Value() (driver.Value, error) {
+	return s.MarshalJSON()
+}
+
+// Scan replaces the set with a JSON array or clears it for SQL NULL.
+// Unsupported source types and decoding errors leave the set unchanged.
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
+
+	replacement := newThreadUnsafeSet[T]()
+	if err := replacement.UnmarshalJSON(b); err != nil {
+		return err
+	}
+	*s = *replacement
+	return nil
+}
```

</details>

<details><summary>reply</summary>

I’ll check both implementations and the existing JSON code, then add SQL support and focused tests.

The change needs to reach both concrete set types and the existing tests; no fixtures, config, or constructor changes are needed. I’ll reuse JSON marshaling and decode scans into a temporary set so errors preserve the contents. The public `Set` interface and existing `UnmarshalJSON` behavior will stay unchanged, preserving compatibility for callers.

Implemented both interfaces on both set implementations.

- `Value()` returns a JSON array as `[]byte`.
- `Scan()` replaces contents from a string or byte slice; `nil` clears the set.
- Unsupported types and invalid JSON return errors without changing contents.

Added tests for integer and string sets. `go build ./...` and `go test ./...` pass.

</details>

### codex, all: pass

Files: [set_test.go](../all/codex/go-feat-mapset-sql-1/files/set_test.go), [threadsafe.go](../all/codex/go-feat-mapset-sql-1/files/threadsafe.go), [threadunsafe.go](../all/codex/go-feat-mapset-sql-1/files/threadunsafe.go)

<details><summary>diff</summary>

```diff
diff --git a/set_test.go b/set_test.go
index 056781e..0353bc9 100644
--- a/set_test.go
+++ b/set_test.go
@@ -26,6 +26,9 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql"
+	"database/sql/driver"
+	"encoding/json"
 	"math"
 	"testing"
 	"time"
@@ -1860,3 +1863,64 @@ func Test_Example(t *testing.T) {
 	   fmt.Println(allClasses.ContainsAll("Welding", "Automotive", "English"))
 	*/
 }
+
+// TestSQL checks database interfaces, replacement, and failed scans for both sets.
+func TestSQL(t *testing.T) {
+	for name, makeSet := range map[string]func(...int) Set[int]{
+		"safe": NewSet[int], "unsafe": NewThreadUnsafeSet[int],
+	} {
+		t.Run(name, func(t *testing.T) {
+			s := makeSet(9)
+			scanner := s.(sql.Scanner)
+			valuer := s.(driver.Valuer)
+			for _, src := range []any{`[1,2,2]`, []byte(`[1,2,2]`)} {
+				if err := scanner.Scan(src); err != nil {
+					t.Fatal(err)
+				}
+				if s.Cardinality() != 2 || !s.Contains(1, 2) {
+					t.Fatalf("scan did not replace contents: %v", s)
+				}
+			}
+			value, err := valuer.Value()
+			if err != nil {
+				t.Fatal(err)
+			}
+			var values []int
+			if err := json.Unmarshal(value.([]byte), &values); err != nil || len(values) != 2 || !s.Contains(values...) {
+				t.Fatalf("invalid value: %s, %v", value, err)
+			}
+			for _, src := range []any{42, true, `[3,`, `[3,"bad"]`, `{}`, `true`, []byte(nil)} {
+				if err := scanner.Scan(src); err == nil {
+					t.Fatalf("scan accepted %v", src)
+				}
+				if s.Cardinality() != 2 || !s.Contains(1, 2) {
+					t.Fatalf("failed scan changed contents: %v", s)
+				}
+			}
+			for _, src := range []any{nil, `[]`, []byte(`null`)} {
+				s.Add(9)
+				if err := scanner.Scan(src); err != nil || !s.IsEmpty() {
+					t.Fatalf("scan did not clear contents: %v, %v", s, err)
+				}
+				value, err := valuer.Value()
+				if err != nil || string(value.([]byte)) != "[]" {
+					t.Fatalf("invalid empty value: %s, %v", value, err)
+				}
+			}
+		})
+	}
+	for _, s := range []Set[string]{NewSet("old"), NewThreadUnsafeSet("old")} {
+		if err := s.(sql.Scanner).Scan(`["new","new"]`); err != nil || s.Cardinality() != 1 || !s.Contains("new") {
+			t.Fatalf("string scan failed: %v, %v", s, err)
+		}
+		value, err := s.(driver.Valuer).Value()
+		if err != nil || string(value.([]byte)) != `["new"]` {
+			t.Fatalf("invalid string value: %s, %v", value, err)
+		}
+	}
+	for _, s := range []Set[float64]{NewSet(math.Inf(1)), NewThreadUnsafeSet(math.Inf(1))} {
+		if _, err := s.(driver.Valuer).Value(); err == nil {
+			t.Fatal("Value accepted infinity")
+		}
+	}
+}
diff --git a/threadsafe.go b/threadsafe.go
index a9d7526..2e74230 100644
--- a/threadsafe.go
+++ b/threadsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"sync"
 )
 
@@ -351,3 +352,18 @@ func (t *threadSafeSet[T]) UnmarshalJSON(p []byte) error {
 
 	return err
 }
+
+// Value returns the set as a JSON array for database storage.
+func (t *threadSafeSet[T]) Value() (driver.Value, error) {
+	t.RLock()
+	defer t.RUnlock()
+	return t.uss.Value()
+}
+
+// Scan replaces the set with a JSON array or clears it for SQL NULL.
+// Invalid input leaves the set unchanged.
+func (t *threadSafeSet[T]) Scan(src any) error {
+	t.Lock()
+	defer t.Unlock()
+	return t.uss.Scan(src)
+}
diff --git a/threadunsafe.go b/threadunsafe.go
index 07b8ee0..5a90b5a 100644
--- a/threadunsafe.go
+++ b/threadunsafe.go
@@ -26,6 +26,7 @@ SOFTWARE.
 package mapset
 
 import (
+	"database/sql/driver"
 	"encoding/json"
 	"fmt"
 	"strings"
@@ -382,3 +383,31 @@ func (s *threadUnsafeSet[T]) UnmarshalJSON(b []byte) error {
 
 	return nil
 }
+
+// Value returns the set as a JSON array for database storage.
+func (s *threadUnsafeSet[T]) Value() (driver.Value, error) {
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
+		return fmt.Errorf("mapset: cannot scan %T", src)
+	}
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

Done.
Both sets support `driver.Valuer` and `sql.Scanner`; failed scans preserve contents. Build, tests, race checks passed.

</details>
