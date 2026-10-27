# go-mo-either-binary

Source: https://github.com/samber/mo/pull/109

## Prompt

> Please add binary serialization to `Either3`, `Either4` and `Either5`.
> 
> `Either` already round-trips through `encoding/gob` (`MarshalBinary`, `UnmarshalBinary`, `GobEncode`, `GobDecode`), but the three-, four- and five-way variants do not, so a struct that holds one cannot be gob-encoded or stored as binary.
> 
> For each of `Either3[T1, T2, T3]`, `Either4[...]` and `Either5[...]` add, in the same style as `Either`:
> 
> ```go
> func (e EitherN[...]) MarshalBinary() ([]byte, error)
> func (e *EitherN[...]) UnmarshalBinary(data []byte) error
> func (e EitherN[...]) GobEncode() ([]byte, error)
> func (e *EitherN[...]) GobDecode(data []byte) error
> ```
> 
> - The first byte of the encoded form is the id of the side that is set (the same constants the type already uses, such as `either3ArgId1`), followed by the gob encoding of that side's value.
> - Decoding restores the same side and value, and leaves the other sides at their zero value, so a decoded value is `Equal` to the original.
> - Empty input is an error, and so is an unknown side id.
> - `GobEncode` and `GobDecode` just call the binary pair.

## Upstream change (tests left out)

Files: 

```diff
diff --git a/.github/FUNDING.yml b/.github/FUNDING.yml
index e4e0d3c..27ca92f 100644
--- a/.github/FUNDING.yml
+++ b/.github/FUNDING.yml
@@ -1 +1,2 @@
 github: [samber]
+ko_fi: samuelberthe
diff --git a/.github/workflows/security.yml b/.github/workflows/security.yml
index ef7a687..9bad9da 100644
--- a/.github/workflows/security.yml
+++ b/.github/workflows/security.yml
@@ -15,20 +15,20 @@ permissions:
   security-events: write
 
 jobs:
-  govulncheck:
-    name: govulncheck
-    runs-on: ubuntu-latest
-    strategy:
-      fail-fast: false
-    steps:
-      - uses: actions/checkout@v6
-      - uses: actions/setup-go@v6
+  # govulncheck:
+  #   name: govulncheck
+  #   runs-on: ubuntu-latest
+  #   strategy:
+  #     fail-fast: false
+  #   steps:
+  #     - uses: actions/checkout@v6
+  #     - uses: actions/setup-go@v6
 
-      - name: Install govulncheck
-        run: go install golang.org/x/vuln/cmd/govulncheck@latest
+  #     - name: Install govulncheck
+  #       run: go install golang.org/x/vuln/cmd/govulncheck@latest
 
-      - name: govulncheck
-        run: govulncheck ./...
+  #     - name: govulncheck
+  #       run: govulncheck ./...
 
   bearer:
     name: bearer
diff --git a/either3.go b/either3.go
index 3c3e122..8971e34 100644
--- a/either3.go
+++ b/either3.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either3ArgId1 = iota
@@ -221,3 +226,74 @@ func (e Either3[T1, T2, T3]) MapArg3(mapper func(T3) Either3[T1, T2, T3]) Either
 
 	return e
 }
+
+// MarshalBinary encodes Either3 into binary form.
+func (e Either3[T1, T2, T3]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+
+	switch e.argId {
+	case either3ArgId1:
+		if err := enc.Encode(e.arg1); err != nil {
+			return []byte{}, err
+		}
+	case either3ArgId2:
+		if err := enc.Encode(e.arg2); err != nil {
+			return []byte{}, err
+		}
+	case either3ArgId3:
+		if err := enc.Encode(e.arg3); err != nil {
+			return []byte{}, err
+		}
+	default:
+		return []byte{}, errEither3InvalidArgumentId
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either3 from binary form.
+func (e *Either3[T1, T2, T3]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either3[T1, T2, T3].UnmarshalBinary: no data")
+	}
+
+	buf := bytes.NewBuffer(data[1:])
+	dec := gob.NewDecoder(buf)
+
+	switch int8(data[0]) {
+	case either3ArgId1:
+		if err := dec.Decode(&e.arg1); err != nil {
+			return err
+		}
+		e.argId = either3ArgId1
+		e.arg2 = empty[T2]()
+		e.arg3 = empty[T3]()
+	case either3ArgId2:
+		if err := dec.Decode(&e.arg2); err != nil {
+			return err
+		}
+		e.argId = either3ArgId2
+		e.arg1 = empty[T1]()
+		e.arg3 = empty[T3]()
+	case either3ArgId3:
+		if err := dec.Decode(&e.arg3); err != nil {
+			return err
+		}
+		e.argId = either3ArgId3
+		e.arg1 = empty[T1]()
+		e.arg2 = empty[T2]()
+	default:
+		return errEither3InvalidArgumentId
+	}
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either3[T1, T2, T3]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either3[T1, T2, T3]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either4.go b/either4.go
index 40d54cf..afe7314 100644
--- a/either4.go
+++ b/either4.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either4ArgId1 = iota
@@ -283,3 +288,89 @@ func (e Either4[T1, T2, T3, T4]) MapArg4(mapper func(T4) Either4[T1, T2, T3, T4]
 
 	return e
 }
+
+// MarshalBinary encodes Either4 into binary form.
+func (e Either4[T1, T2, T3, T4]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+
+	switch e.argId {
+	case either4ArgId1:
+		if err := enc.Encode(e.arg1); err != nil {
+			return []byte{}, err
+		}
+	case either4ArgId2:
+		if err := enc.Encode(e.arg2); err != nil {
+			return []byte{}, err
+		}
+	case either4ArgId3:
+		if err := enc.Encode(e.arg3); err != nil {
+			return []byte{}, err
+		}
+	case either4ArgId4:
+		if err := enc.Encode(e.arg4); err != nil {
+			return []byte{}, err
+		}
+	default:
+		return []byte{}, errEither4InvalidArgumentId
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either4 from binary form.
+func (e *Either4[T1, T2, T3, T4]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either4[T1, T2, T3, T4].UnmarshalBinary: no data")
+	}
+
+	buf := bytes.NewBuffer(data[1:])
+	dec := gob.NewDecoder(buf)
+
+	switch int8(data[0]) {
+	case either4ArgId1:
+		if err := dec.Decode(&e.arg1); err != nil {
+			return err
+		}
+		e.argId = either4ArgId1
+		e.arg2 = empty[T2]()
+		e.arg3 = empty[T3]()
+		e.arg4 = empty[T4]()
+	case either4ArgId2:
+		if err := dec.Decode(&e.arg2); err != nil {
+			return err
+		}
+		e.argId = either4ArgId2
+		e.arg1 = empty[T1]()
+		e.arg3 = empty[T3]()
+		e.arg4 = empty[T4]()
+	case either4ArgId3:
+		if err := dec.Decode(&e.arg3); err != nil {
+			return err
+		}
+		e.argId = either4ArgId3
+		e.arg1 = empty[T1]()
+		e.arg2 = empty[T2]()
+		e.arg4 = empty[T4]()
+	case either4ArgId4:
+		if err := dec.Decode(&e.arg4); err != nil {
+			return err
+		}
+		e.argId = either4ArgId4
+		e.arg1 = empty[T1]()
+		e.arg2 = empty[T2]()
+		e.arg3 = empty[T3]()
+	default:
+		return errEither4InvalidArgumentId
+	}
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either4[T1, T2, T3, T4]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either4[T1, T2, T3, T4]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either5.go b/either5.go
index 7fca738..4600769 100644
--- a/either5.go
+++ b/either5.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either5ArgId1 = iota
@@ -345,3 +350,106 @@ func (e Either5[T1, T2, T3, T4, T5]) MapArg5(mapper func(T5) Either5[T1, T2, T3,
 
 	return e
 }
+
+// MarshalBinary encodes Either5 into binary form.
+func (e Either5[T1, T2, T3, T4, T5]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+
+	switch e.argId {
+	case either5ArgId1:
+		if err := enc.Encode(e.arg1); err != nil {
+			return []byte{}, err
+		}
+	case either5ArgId2:
+		if err := enc.Encode(e.arg2); err != nil {
+			return []byte{}, err
+		}
+	case either5ArgId3:
+		if err := enc.Encode(e.arg3); err != nil {
+			return []byte{}, err
+		}
+	case either5ArgId4:
+		if err := enc.Encode(e.arg4); err != nil {
+			return []byte{}, err
+		}
+	case either5ArgId5:
+		if err := enc.Encode(e.arg5); err != nil {
+			return []byte{}, err
+		}
+	default:
+		return []byte{}, errEither5InvalidArgumentId
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either5 from binary form.
+func (e *Either5[T1, T2, T3, T4, T5]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either5[T1, T2, T3, T4, T5].UnmarshalBinary: no data")
+	}
+
+	buf := bytes.NewBuffer(data[1:])
+	dec := gob.NewDecoder(buf)
+
+	switch int8(data[0]) {
+	case either5ArgId1:
+		if err := dec.Decode(&e.arg1); err != nil {
+			return err
+		}
+		e.argId = either5ArgId1
+		e.arg2 = empty[T2]()
+		e.arg3 = empty[T3]()
+		e.arg4 = empty[T4]()
+		e.arg5 = empty[T5]()
+	case either5ArgId2:
+		if err := dec.Decode(&e.arg2); err != nil {
+			return err
+		}
+		e.argId = either5ArgId2
+		e.arg1 = empty[T1]()
+		e.arg3 = empty[T3]()
+		e.arg4 = empty[T4]()
+		e.arg5 = empty[T5]()
+	case either5ArgId3:
+		if err := dec.Decode(&e.arg3); err != nil {
+			return err
+		}
+		e.argId = either5ArgId3
+		e.arg1 = empty[T1]()
+		e.arg2 = empty[T2]()
+		e.arg4 = empty[T4]()
+		e.arg5 = empty[T5]()
+	case either5ArgId4:
+		if err := dec.Decode(&e.arg4); err != nil {
+			return err
+		}
+		e.argId = either5ArgId4
+		e.arg1 = empty[T1]()
+		e.arg2 = empty[T2]()
+		e.arg3 = empty[T3]()
+		e.arg5 = empty[T5]()
+	case either5ArgId5:
+		if err := dec.Decode(&e.arg5); err != nil {
+			return err
+		}
+		e.argId = either5ArgId5
+		e.arg1 = empty[T1]()
+		e.arg2 = empty[T2]()
+		e.arg3 = empty[T3]()
+		e.arg4 = empty[T4]()
+	default:
+		return errEither5InvalidArgumentId
+	}
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either5[T1, T2, T3, T4, T5]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either5[T1, T2, T3, T4, T5]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +249/-3 | 0 | 3,082 | $0.108 |
| claude | muffle | pass | +216/-3 | 42 | 2,938 | $0.092 |
| claude | hush | pass | +249/-3 | 0 | 2,594 | $0.102 |
| claude | sloth | pass | +216/-3 | 87 | 3,060 | $0.100 |
| claude | all | pass | +237/-3 | 66 | 2,693 | $0.100 |
| codex | base | pass | +213/-3 | 183 | 1,916 | - |
| codex | muffle | pass | +216/-3 | 137 | 1,648 | - |
| codex | hush | pass | +213/-3 | 150 | 1,602 | - |
| codex | sloth | pass | +195/-3 | 176 | 1,876 | - |
| codex | all | pass | +216/-3 | 203 | 1,692 | - |

### claude, base: pass

Files: [either3.go](../base/claude/go-mo-either-binary-1/files/either3.go), [either4.go](../base/claude/go-mo-either-binary-1/files/either4.go), [either5.go](../base/claude/go-mo-either-binary-1/files/either5.go)

<details><summary>diff</summary>

```diff
diff --git a/either3.go b/either3.go
index 3c3e122..12579ed 100644
--- a/either3.go
+++ b/either3.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either3ArgId1 = iota
@@ -221,3 +226,71 @@ func (e Either3[T1, T2, T3]) MapArg3(mapper func(T3) Either3[T1, T2, T3]) Either
 
 	return e
 }
+
+// MarshalBinary encodes Either3 into binary form.
+func (e Either3[T1, T2, T3]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+
+	switch e.argId {
+	case either3ArgId1:
+		if err := enc.Encode(e.arg1); err != nil {
+			return []byte{}, err
+		}
+	case either3ArgId2:
+		if err := enc.Encode(e.arg2); err != nil {
+			return []byte{}, err
+		}
+	case either3ArgId3:
+		if err := enc.Encode(e.arg3); err != nil {
+			return []byte{}, err
+		}
+	default:
+		return []byte{}, errEither3InvalidArgumentId
+	}
+
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either3 from binary form.
+func (e *Either3[T1, T2, T3]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either3.UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+
+	var decoded Either3[T1, T2, T3]
+	switch data[0] {
+	case either3ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+		decoded.argId = either3ArgId1
+	case either3ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+		decoded.argId = either3ArgId2
+	case either3ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+		decoded.argId = either3ArgId3
+	default:
+		return errEither3InvalidArgumentId
+	}
+
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either3[T1, T2, T3]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either3[T1, T2, T3]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either4.go b/either4.go
index 40d54cf..7c59d46 100644
--- a/either4.go
+++ b/either4.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either4ArgId1 = iota
@@ -283,3 +288,80 @@ func (e Either4[T1, T2, T3, T4]) MapArg4(mapper func(T4) Either4[T1, T2, T3, T4]
 
 	return e
 }
+
+// MarshalBinary encodes Either4 into binary form.
+func (e Either4[T1, T2, T3, T4]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+
+	switch e.argId {
+	case either4ArgId1:
+		if err := enc.Encode(e.arg1); err != nil {
+			return []byte{}, err
+		}
+	case either4ArgId2:
+		if err := enc.Encode(e.arg2); err != nil {
+			return []byte{}, err
+		}
+	case either4ArgId3:
+		if err := enc.Encode(e.arg3); err != nil {
+			return []byte{}, err
+		}
+	case either4ArgId4:
+		if err := enc.Encode(e.arg4); err != nil {
+			return []byte{}, err
+		}
+	default:
+		return []byte{}, errEither4InvalidArgumentId
+	}
+
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either4 from binary form.
+func (e *Either4[T1, T2, T3, T4]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either4.UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+
+	var decoded Either4[T1, T2, T3, T4]
+	switch data[0] {
+	case either4ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+		decoded.argId = either4ArgId1
+	case either4ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+		decoded.argId = either4ArgId2
+	case either4ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+		decoded.argId = either4ArgId3
+	case either4ArgId4:
+		if err := dec.Decode(&decoded.arg4); err != nil {
+			return err
+		}
+		decoded.argId = either4ArgId4
+	default:
+		return errEither4InvalidArgumentId
+	}
+
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either4[T1, T2, T3, T4]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either4[T1, T2, T3, T4]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either5.go b/either5.go
index 7fca738..dd454ce 100644
--- a/either5.go
+++ b/either5.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either5ArgId1 = iota
@@ -345,3 +350,89 @@ func (e Either5[T1, T2, T3, T4, T5]) MapArg5(mapper func(T5) Either5[T1, T2, T3,
 
 	return e
 }
+
+// MarshalBinary encodes Either5 into binary form.
+func (e Either5[T1, T2, T3, T4, T5]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+
+	switch e.argId {
+	case either5ArgId1:
+		if err := enc.Encode(e.arg1); err != nil {
+			return []byte{}, err
+		}
+	case either5ArgId2:
+		if err := enc.Encode(e.arg2); err != nil {
+			return []byte{}, err
+		}
+	case either5ArgId3:
+		if err := enc.Encode(e.arg3); err != nil {
+			return []byte{}, err
+		}
+	case either5ArgId4:
+		if err := enc.Encode(e.arg4); err != nil {
+			return []byte{}, err
+		}
+	case either5ArgId5:
+		if err := enc.Encode(e.arg5); err != nil {
+			return []byte{}, err
+		}
+	default:
+		return []byte{}, errEither5InvalidArgumentId
+	}
+
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either5 from binary form.
+func (e *Either5[T1, T2, T3, T4, T5]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either5.UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+
+	var decoded Either5[T1, T2, T3, T4, T5]
+	switch data[0] {
+	case either5ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+		decoded.argId = either5ArgId1
+	case either5ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+		decoded.argId = either5ArgId2
+	case either5ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+		decoded.argId = either5ArgId3
+	case either5ArgId4:
+		if err := dec.Decode(&decoded.arg4); err != nil {
+			return err
+		}
+		decoded.argId = either5ArgId4
+	case either5ArgId5:
+		if err := dec.Decode(&decoded.arg5); err != nil {
+			return err
+		}
+		decoded.argId = either5ArgId5
+	default:
+		return errEither5InvalidArgumentId
+	}
+
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either5[T1, T2, T3, T4, T5]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either5[T1, T2, T3, T4, T5]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
```

</details>

<details><summary>reply</summary>

`Either3`, `Either4` and `Either5` now have `MarshalBinary`, `UnmarshalBinary`, `GobEncode` and `GobDecode`, in `either3.go`, `either4.go` and `either5.go`.

I checked it with a throwaway test, which I deleted afterwards, so no test file is added. It gob-encoded and decoded a struct holding all three types into a value that already had a different side set. The decoded struct matched the original under `reflect.DeepEqual`. Empty input and an unknown side id (9) both returned errors. The package's existing tests also pass.

- **Encoding:** the first byte is the set side's id (`either3ArgId1` and so on), followed by the gob encoding of that side's value. Because the constants start at 0, side 1 encodes as byte `0`.
- **Decoding:** it decodes into a fresh value and only assigns it on success. That leaves the other sides at their zero value and keeps the receiver untouched if decoding fails.
- **Errors:** empty input returns a "no data" error. An unknown side id returns the type's existing `errEitherNInvalidArgumentId`. `MarshalBinary` returns the same error if `argId` is invalid, which can only happen for a zero-value `EitherN`.
- **`Equal`:** none of the three types has an `Equal` method, so I compared with `reflect.DeepEqual`. I didn't add one, since you didn't ask for it.

Nothing is committed.

</details>

### claude, muffle: pass

Files: [either3.go](../muffle/claude/go-mo-either-binary-1/files/either3.go), [either4.go](../muffle/claude/go-mo-either-binary-1/files/either4.go), [either5.go](../muffle/claude/go-mo-either-binary-1/files/either5.go), [either_n_binary_test.go](../muffle/claude/go-mo-either-binary-1/files/either_n_binary_test.go)

<details><summary>diff</summary>

```diff
diff --git a/either3.go b/either3.go
index 3c3e122..0cb94e8 100644
--- a/either3.go
+++ b/either3.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either3ArgId1 = iota
@@ -221,3 +226,65 @@ func (e Either3[T1, T2, T3]) MapArg3(mapper func(T3) Either3[T1, T2, T3]) Either
 
 	return e
 }
+
+// MarshalBinary encodes Either3 into binary form.
+func (e Either3[T1, T2, T3]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+
+	var err error
+	switch e.argId {
+	case either3ArgId1:
+		err = enc.Encode(e.arg1)
+	case either3ArgId2:
+		err = enc.Encode(e.arg2)
+	case either3ArgId3:
+		err = enc.Encode(e.arg3)
+	default:
+		return []byte{}, errEither3InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either3 from binary form.
+func (e *Either3[T1, T2, T3]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either3[T1, T2, T3].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+
+	var decoded Either3[T1, T2, T3]
+	var err error
+	switch int8(data[0]) {
+	case either3ArgId1:
+		err = dec.Decode(&decoded.arg1)
+	case either3ArgId2:
+		err = dec.Decode(&decoded.arg2)
+	case either3ArgId3:
+		err = dec.Decode(&decoded.arg3)
+	default:
+		return errEither3InvalidArgumentId
+	}
+	if err != nil {
+		return err
+	}
+
+	decoded.argId = int8(data[0])
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either3[T1, T2, T3]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either3[T1, T2, T3]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either4.go b/either4.go
index 40d54cf..8373d26 100644
--- a/either4.go
+++ b/either4.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either4ArgId1 = iota
@@ -283,3 +288,69 @@ func (e Either4[T1, T2, T3, T4]) MapArg4(mapper func(T4) Either4[T1, T2, T3, T4]
 
 	return e
 }
+
+// MarshalBinary encodes Either4 into binary form.
+func (e Either4[T1, T2, T3, T4]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+
+	var err error
+	switch e.argId {
+	case either4ArgId1:
+		err = enc.Encode(e.arg1)
+	case either4ArgId2:
+		err = enc.Encode(e.arg2)
+	case either4ArgId3:
+		err = enc.Encode(e.arg3)
+	case either4ArgId4:
+		err = enc.Encode(e.arg4)
+	default:
+		return []byte{}, errEither4InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either4 from binary form.
+func (e *Either4[T1, T2, T3, T4]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either4[T1, T2, T3, T4].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+
+	var decoded Either4[T1, T2, T3, T4]
+	var err error
+	switch int8(data[0]) {
+	case either4ArgId1:
+		err = dec.Decode(&decoded.arg1)
+	case either4ArgId2:
+		err = dec.Decode(&decoded.arg2)
+	case either4ArgId3:
+		err = dec.Decode(&decoded.arg3)
+	case either4ArgId4:
+		err = dec.Decode(&decoded.arg4)
+	default:
+		return errEither4InvalidArgumentId
+	}
+	if err != nil {
+		return err
+	}
+
+	decoded.argId = int8(data[0])
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either4[T1, T2, T3, T4]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either4[T1, T2, T3, T4]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either5.go b/either5.go
index 7fca738..f5b6ea9 100644
--- a/either5.go
+++ b/either5.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either5ArgId1 = iota
@@ -345,3 +350,73 @@ func (e Either5[T1, T2, T3, T4, T5]) MapArg5(mapper func(T5) Either5[T1, T2, T3,
 
 	return e
 }
+
+// MarshalBinary encodes Either5 into binary form.
+func (e Either5[T1, T2, T3, T4, T5]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+
+	var err error
+	switch e.argId {
+	case either5ArgId1:
+		err = enc.Encode(e.arg1)
+	case either5ArgId2:
+		err = enc.Encode(e.arg2)
+	case either5ArgId3:
+		err = enc.Encode(e.arg3)
+	case either5ArgId4:
+		err = enc.Encode(e.arg4)
+	case either5ArgId5:
+		err = enc.Encode(e.arg5)
+	default:
+		return []byte{}, errEither5InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either5 from binary form.
+func (e *Either5[T1, T2, T3, T4, T5]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either5[T1, T2, T3, T4, T5].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+
+	var decoded Either5[T1, T2, T3, T4, T5]
+	var err error
+	switch int8(data[0]) {
+	case either5ArgId1:
+		err = dec.Decode(&decoded.arg1)
+	case either5ArgId2:
+		err = dec.Decode(&decoded.arg2)
+	case either5ArgId3:
+		err = dec.Decode(&decoded.arg3)
+	case either5ArgId4:
+		err = dec.Decode(&decoded.arg4)
+	case either5ArgId5:
+		err = dec.Decode(&decoded.arg5)
+	default:
+		return errEither5InvalidArgumentId
+	}
+	if err != nil {
+		return err
+	}
+
+	decoded.argId = int8(data[0])
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either5[T1, T2, T3, T4, T5]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either5[T1, T2, T3, T4, T5]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either_n_binary_test.go b/either_n_binary_test.go
new file mode 100644
index 0000000..3d60e08
--- /dev/null
+++ b/either_n_binary_test.go
@@ -0,0 +1,42 @@
+package mo
+
+import (
+	"bytes"
+	"encoding/gob"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+)
+
+func TestEitherNBinary(t *testing.T) {
+	is := assert.New(t)
+
+	e3 := NewEither3Arg2[int, string, bool]("a")
+	bin, err := e3.MarshalBinary()
+	is.NoError(err)
+	is.Equal(byte(either3ArgId2), bin[0])
+	var d3 Either3[int, string, bool]
+	is.NoError(d3.UnmarshalBinary(bin))
+	is.Equal(e3, d3)
+
+	e4 := NewEither4Arg4[int, string, bool, float64](2.5)
+	bin, err = e4.GobEncode()
+	is.NoError(err)
+	var d4 Either4[int, string, bool, float64]
+	is.NoError(d4.GobDecode(bin))
+	is.Equal(e4, d4)
+
+	e5 := NewEither5Arg1[int, string, bool, float64, uint](0)
+	var buf bytes.Buffer
+	is.NoError(gob.NewEncoder(&buf).Encode(e5))
+	var d5 Either5[int, string, bool, float64, uint]
+	is.NoError(gob.NewDecoder(&buf).Decode(&d5))
+	is.Equal(e5, d5)
+
+	is.Error(d3.UnmarshalBinary(nil))
+	is.Error(d3.UnmarshalBinary([]byte{9}))
+	is.Error(d4.UnmarshalBinary(nil))
+	is.Error(d4.UnmarshalBinary([]byte{9}))
+	is.Error(d5.UnmarshalBinary(nil))
+	is.Error(d5.UnmarshalBinary([]byte{9}))
+}
```

</details>

<details><summary>reply</summary>

`Either3`, `Either4` and `Either5` now have `MarshalBinary`, `UnmarshalBinary`, `GobEncode` and `GobDecode`, in `either3.go`, `either4.go` and `either5.go`. The tests pass.

- **Encoding:** the first byte is the set side's id (`either3ArgId1` and so on), followed by the gob encoding of that side's value. `GobEncode` and `GobDecode` just call the binary pair.
- **Decoding:** it restores the same side and value, and the other sides stay at their zero value. A decoded value is `Equal` to the original.
- **Errors:** empty input returns an error, and so does an unknown side id.
- **Failed decode:** a decode that fails leaves the receiver unchanged. That differs slightly from `Either`, which can partly overwrite it.

I added `either_n_binary_test.go`. It round-trips each type, including through a real gob encoder, and covers the empty-input and unknown-id errors. I also ran a throwaway test with the three types as fields in a struct, gob-encoded and decoded, then deleted it.

I made no commit.

</details>

### claude, hush: pass

Files: [either3.go](../hush/claude/go-mo-either-binary-1/files/either3.go), [either4.go](../hush/claude/go-mo-either-binary-1/files/either4.go), [either5.go](../hush/claude/go-mo-either-binary-1/files/either5.go)

<details><summary>diff</summary>

```diff
diff --git a/either3.go b/either3.go
index 3c3e122..117223d 100644
--- a/either3.go
+++ b/either3.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either3ArgId1 = iota
@@ -221,3 +226,71 @@ func (e Either3[T1, T2, T3]) MapArg3(mapper func(T3) Either3[T1, T2, T3]) Either
 
 	return e
 }
+
+// MarshalBinary encodes Either3 into binary form.
+func (e Either3[T1, T2, T3]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+
+	var err error
+	switch e.argId {
+	case either3ArgId1:
+		err = enc.Encode(e.arg1)
+	case either3ArgId2:
+		err = enc.Encode(e.arg2)
+	case either3ArgId3:
+		err = enc.Encode(e.arg3)
+	default:
+		return []byte{}, errEither3InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either3 from binary form.
+func (e *Either3[T1, T2, T3]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either3[T1, T2, T3].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+
+	switch int8(data[0]) {
+	case either3ArgId1:
+		var v T1
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = NewEither3Arg1[T1, T2, T3](v)
+		return nil
+	case either3ArgId2:
+		var v T2
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = NewEither3Arg2[T1, T2, T3](v)
+		return nil
+	case either3ArgId3:
+		var v T3
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = NewEither3Arg3[T1, T2, T3](v)
+		return nil
+	default:
+		return errEither3InvalidArgumentId
+	}
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either3[T1, T2, T3]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either3[T1, T2, T3]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either4.go b/either4.go
index 40d54cf..25f12cd 100644
--- a/either4.go
+++ b/either4.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either4ArgId1 = iota
@@ -283,3 +288,80 @@ func (e Either4[T1, T2, T3, T4]) MapArg4(mapper func(T4) Either4[T1, T2, T3, T4]
 
 	return e
 }
+
+// MarshalBinary encodes Either4 into binary form.
+func (e Either4[T1, T2, T3, T4]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+
+	var err error
+	switch e.argId {
+	case either4ArgId1:
+		err = enc.Encode(e.arg1)
+	case either4ArgId2:
+		err = enc.Encode(e.arg2)
+	case either4ArgId3:
+		err = enc.Encode(e.arg3)
+	case either4ArgId4:
+		err = enc.Encode(e.arg4)
+	default:
+		return []byte{}, errEither4InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either4 from binary form.
+func (e *Either4[T1, T2, T3, T4]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either4[T1, T2, T3, T4].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+
+	switch int8(data[0]) {
+	case either4ArgId1:
+		var v T1
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = NewEither4Arg1[T1, T2, T3, T4](v)
+		return nil
+	case either4ArgId2:
+		var v T2
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = NewEither4Arg2[T1, T2, T3, T4](v)
+		return nil
+	case either4ArgId3:
+		var v T3
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = NewEither4Arg3[T1, T2, T3, T4](v)
+		return nil
+	case either4ArgId4:
+		var v T4
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = NewEither4Arg4[T1, T2, T3, T4](v)
+		return nil
+	default:
+		return errEither4InvalidArgumentId
+	}
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either4[T1, T2, T3, T4]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either4[T1, T2, T3, T4]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either5.go b/either5.go
index 7fca738..603b1d0 100644
--- a/either5.go
+++ b/either5.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either5ArgId1 = iota
@@ -345,3 +350,89 @@ func (e Either5[T1, T2, T3, T4, T5]) MapArg5(mapper func(T5) Either5[T1, T2, T3,
 
 	return e
 }
+
+// MarshalBinary encodes Either5 into binary form.
+func (e Either5[T1, T2, T3, T4, T5]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+
+	var err error
+	switch e.argId {
+	case either5ArgId1:
+		err = enc.Encode(e.arg1)
+	case either5ArgId2:
+		err = enc.Encode(e.arg2)
+	case either5ArgId3:
+		err = enc.Encode(e.arg3)
+	case either5ArgId4:
+		err = enc.Encode(e.arg4)
+	case either5ArgId5:
+		err = enc.Encode(e.arg5)
+	default:
+		return []byte{}, errEither5InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either5 from binary form.
+func (e *Either5[T1, T2, T3, T4, T5]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either5[T1, T2, T3, T4, T5].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+
+	switch int8(data[0]) {
+	case either5ArgId1:
+		var v T1
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = NewEither5Arg1[T1, T2, T3, T4, T5](v)
+		return nil
+	case either5ArgId2:
+		var v T2
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = NewEither5Arg2[T1, T2, T3, T4, T5](v)
+		return nil
+	case either5ArgId3:
+		var v T3
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = NewEither5Arg3[T1, T2, T3, T4, T5](v)
+		return nil
+	case either5ArgId4:
+		var v T4
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = NewEither5Arg4[T1, T2, T3, T4, T5](v)
+		return nil
+	case either5ArgId5:
+		var v T5
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = NewEither5Arg5[T1, T2, T3, T4, T5](v)
+		return nil
+	default:
+		return errEither5InvalidArgumentId
+	}
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either5[T1, T2, T3, T4, T5]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either5[T1, T2, T3, T4, T5]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
```

</details>

<details><summary>reply</summary>

Done. Added `MarshalBinary`, `UnmarshalBinary`, `GobEncode` and `GobDecode` to `Either3`, `Either4` and `Either5`. A throwaway `Either3` gob round-trip and error test passed, then I deleted it. `Either4` and `Either5` are compiled but not tested, and I added no permanent tests. The types have no `Equal` method, so I compared decoded values with `==`.

</details>

### claude, sloth: pass

Files: [either3.go](../sloth/claude/go-mo-either-binary-1/files/either3.go), [either3_test.go](../sloth/claude/go-mo-either-binary-1/files/either3_test.go), [either4.go](../sloth/claude/go-mo-either-binary-1/files/either4.go), [either4_test.go](../sloth/claude/go-mo-either-binary-1/files/either4_test.go), [either5.go](../sloth/claude/go-mo-either-binary-1/files/either5.go), [either5_test.go](../sloth/claude/go-mo-either-binary-1/files/either5_test.go)

<details><summary>diff</summary>

```diff
diff --git a/either3.go b/either3.go
index 3c3e122..98a46b7 100644
--- a/either3.go
+++ b/either3.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either3ArgId1 = iota
@@ -221,3 +226,65 @@ func (e Either3[T1, T2, T3]) MapArg3(mapper func(T3) Either3[T1, T2, T3]) Either
 
 	return e
 }
+
+// MarshalBinary encodes Either3 into binary form.
+// The first byte is the id of the argument set, followed by its gob encoding.
+func (e Either3[T1, T2, T3]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+
+	switch e.argId {
+	case either3ArgId1:
+		err = enc.Encode(e.arg1)
+	case either3ArgId2:
+		err = enc.Encode(e.arg2)
+	case either3ArgId3:
+		err = enc.Encode(e.arg3)
+	default:
+		return []byte{}, errEither3InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either3 from binary form.
+func (e *Either3[T1, T2, T3]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either3[T1, T2, T3].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	decoded := Either3[T1, T2, T3]{argId: int8(data[0])}
+	var err error
+
+	switch decoded.argId {
+	case either3ArgId1:
+		err = dec.Decode(&decoded.arg1)
+	case either3ArgId2:
+		err = dec.Decode(&decoded.arg2)
+	case either3ArgId3:
+		err = dec.Decode(&decoded.arg3)
+	default:
+		return errEither3InvalidArgumentId
+	}
+	if err != nil {
+		return err
+	}
+
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either3[T1, T2, T3]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either3[T1, T2, T3]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either3_test.go b/either3_test.go
index 10b84e1..923a3bb 100644
--- a/either3_test.go
+++ b/either3_test.go
@@ -295,3 +295,32 @@ func TestEither3MapArg(t *testing.T) {
 	})
 	is.Equal(NewEither3Arg3[int, bool, float64](2.1), result3_3)
 }
+
+func TestEither3BinaryRoundTrip(t *testing.T) {
+	is := assert.New(t)
+
+	for i, original := range []Either3[int, string, bool]{NewEither3Arg1[int, string, bool](42), NewEither3Arg2[int, string, bool]("foo"), NewEither3Arg3[int, string, bool](true)} {
+		bin, err := original.MarshalBinary()
+		is.Nil(err)
+		is.Equal(byte(i), bin[0])
+
+		var decoded Either3[int, string, bool]
+		is.Nil(decoded.UnmarshalBinary(bin))
+		is.Equal(original, decoded)
+
+		gobBin, err := original.GobEncode()
+		is.Nil(err)
+		var gobDecoded Either3[int, string, bool]
+		is.Nil(gobDecoded.GobDecode(gobBin))
+		is.Equal(original, gobDecoded)
+	}
+}
+
+func TestEither3UnmarshalBinaryErrors(t *testing.T) {
+	is := assert.New(t)
+
+	var e Either3[int, string, bool]
+	is.Error(e.UnmarshalBinary(nil))
+	is.Error(e.UnmarshalBinary([]byte{3}))
+	is.Error(e.UnmarshalBinary([]byte{255}))
+}
diff --git a/either4.go b/either4.go
index 40d54cf..804831b 100644
--- a/either4.go
+++ b/either4.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either4ArgId1 = iota
@@ -283,3 +288,69 @@ func (e Either4[T1, T2, T3, T4]) MapArg4(mapper func(T4) Either4[T1, T2, T3, T4]
 
 	return e
 }
+
+// MarshalBinary encodes Either4 into binary form.
+// The first byte is the id of the argument set, followed by its gob encoding.
+func (e Either4[T1, T2, T3, T4]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+
+	switch e.argId {
+	case either4ArgId1:
+		err = enc.Encode(e.arg1)
+	case either4ArgId2:
+		err = enc.Encode(e.arg2)
+	case either4ArgId3:
+		err = enc.Encode(e.arg3)
+	case either4ArgId4:
+		err = enc.Encode(e.arg4)
+	default:
+		return []byte{}, errEither4InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either4 from binary form.
+func (e *Either4[T1, T2, T3, T4]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either4[T1, T2, T3, T4].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	decoded := Either4[T1, T2, T3, T4]{argId: int8(data[0])}
+	var err error
+
+	switch decoded.argId {
+	case either4ArgId1:
+		err = dec.Decode(&decoded.arg1)
+	case either4ArgId2:
+		err = dec.Decode(&decoded.arg2)
+	case either4ArgId3:
+		err = dec.Decode(&decoded.arg3)
+	case either4ArgId4:
+		err = dec.Decode(&decoded.arg4)
+	default:
+		return errEither4InvalidArgumentId
+	}
+	if err != nil {
+		return err
+	}
+
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either4[T1, T2, T3, T4]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either4[T1, T2, T3, T4]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either4_test.go b/either4_test.go
index 4d5726b..2c5ac0d 100644
--- a/either4_test.go
+++ b/either4_test.go
@@ -451,3 +451,32 @@ func TestEither4MapArg(t *testing.T) {
 	})
 	is.Equal(NewEither4Arg4[int, bool, float64, string]("Bye"), result4_4)
 }
+
+func TestEither4BinaryRoundTrip(t *testing.T) {
+	is := assert.New(t)
+
+	for i, original := range []Either4[int, string, bool, float64]{NewEither4Arg1[int, string, bool, float64](42), NewEither4Arg2[int, string, bool, float64]("foo"), NewEither4Arg3[int, string, bool, float64](true), NewEither4Arg4[int, string, bool, float64](1.5)} {
+		bin, err := original.MarshalBinary()
+		is.Nil(err)
+		is.Equal(byte(i), bin[0])
+
+		var decoded Either4[int, string, bool, float64]
+		is.Nil(decoded.UnmarshalBinary(bin))
+		is.Equal(original, decoded)
+
+		gobBin, err := original.GobEncode()
+		is.Nil(err)
+		var gobDecoded Either4[int, string, bool, float64]
+		is.Nil(gobDecoded.GobDecode(gobBin))
+		is.Equal(original, gobDecoded)
+	}
+}
+
+func TestEither4UnmarshalBinaryErrors(t *testing.T) {
+	is := assert.New(t)
+
+	var e Either4[int, string, bool, float64]
+	is.Error(e.UnmarshalBinary(nil))
+	is.Error(e.UnmarshalBinary([]byte{4}))
+	is.Error(e.UnmarshalBinary([]byte{255}))
+}
diff --git a/either5.go b/either5.go
index 7fca738..e628531 100644
--- a/either5.go
+++ b/either5.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either5ArgId1 = iota
@@ -345,3 +350,73 @@ func (e Either5[T1, T2, T3, T4, T5]) MapArg5(mapper func(T5) Either5[T1, T2, T3,
 
 	return e
 }
+
+// MarshalBinary encodes Either5 into binary form.
+// The first byte is the id of the argument set, followed by its gob encoding.
+func (e Either5[T1, T2, T3, T4, T5]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+
+	switch e.argId {
+	case either5ArgId1:
+		err = enc.Encode(e.arg1)
+	case either5ArgId2:
+		err = enc.Encode(e.arg2)
+	case either5ArgId3:
+		err = enc.Encode(e.arg3)
+	case either5ArgId4:
+		err = enc.Encode(e.arg4)
+	case either5ArgId5:
+		err = enc.Encode(e.arg5)
+	default:
+		return []byte{}, errEither5InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either5 from binary form.
+func (e *Either5[T1, T2, T3, T4, T5]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either5[T1, T2, T3, T4, T5].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	decoded := Either5[T1, T2, T3, T4, T5]{argId: int8(data[0])}
+	var err error
+
+	switch decoded.argId {
+	case either5ArgId1:
+		err = dec.Decode(&decoded.arg1)
+	case either5ArgId2:
+		err = dec.Decode(&decoded.arg2)
+	case either5ArgId3:
+		err = dec.Decode(&decoded.arg3)
+	case either5ArgId4:
+		err = dec.Decode(&decoded.arg4)
+	case either5ArgId5:
+		err = dec.Decode(&decoded.arg5)
+	default:
+		return errEither5InvalidArgumentId
+	}
+	if err != nil {
+		return err
+	}
+
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either5[T1, T2, T3, T4, T5]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either5[T1, T2, T3, T4, T5]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either5_test.go b/either5_test.go
index 754f141..9ef545d 100644
--- a/either5_test.go
+++ b/either5_test.go
@@ -645,3 +645,32 @@ func TestEither5MapArg(t *testing.T) {
 	})
 	is.Equal(NewEither5Arg5[int, bool, float64, string, byte](10), result5_5)
 }
+
+func TestEither5BinaryRoundTrip(t *testing.T) {
+	is := assert.New(t)
+
+	for i, original := range []Either5[int, string, bool, float64, uint]{NewEither5Arg1[int, string, bool, float64, uint](42), NewEither5Arg2[int, string, bool, float64, uint]("foo"), NewEither5Arg3[int, string, bool, float64, uint](true), NewEither5Arg4[int, string, bool, float64, uint](1.5), NewEither5Arg5[int, string, bool, float64, uint](7)} {
+		bin, err := original.MarshalBinary()
+		is.Nil(err)
+		is.Equal(byte(i), bin[0])
+
+		var decoded Either5[int, string, bool, float64, uint]
+		is.Nil(decoded.UnmarshalBinary(bin))
+		is.Equal(original, decoded)
+
+		gobBin, err := original.GobEncode()
+		is.Nil(err)
+		var gobDecoded Either5[int, string, bool, float64, uint]
+		is.Nil(gobDecoded.GobDecode(gobBin))
+		is.Equal(original, gobDecoded)
+	}
+}
+
+func TestEither5UnmarshalBinaryErrors(t *testing.T) {
+	is := assert.New(t)
+
+	var e Either5[int, string, bool, float64, uint]
+	is.Error(e.UnmarshalBinary(nil))
+	is.Error(e.UnmarshalBinary([]byte{5}))
+	is.Error(e.UnmarshalBinary([]byte{255}))
+}
```

</details>

<details><summary>reply</summary>

`Either3`, `Either4` and `Either5` now have `MarshalBinary`, `UnmarshalBinary`, `GobEncode` and `GobDecode`, in the same style as `Either`. `go vet` and `go test .` pass.

- **Encoding:** the first byte is the side id, using the existing `eitherNArgIdK` constants. The gob encoding of that side's value follows.
- **Id numbering:** those constants start at 0, so side 1 encodes as `0`, side 2 as `1`, and so on.
- **Decoding:** it builds a fresh value and only assigns it to the receiver on success. The other sides stay at their zero value, so a decoded value is `Equal` to the original. A failed decode leaves the receiver unchanged.
- **Errors:** empty input and an unknown side id both return an error. The unknown-id case returns the existing `errEitherNInvalidArgumentId`. `MarshalBinary` also returns that error if the value's own id is invalid.
- **Gob methods:** `GobEncode` and `GobDecode` just call the binary pair.
- **Tests:** each `eitherN_test.go` has a round-trip test and an error-case test. The round-trip test covers every side and both the binary and gob paths. The error test covers empty input, an id one past the last side, and `255`.

`gofmt -l` flags `option/transforms_test.go` and `result/transforms_test.go`. I didn't touch either file.

I haven't committed anything.

</details>

### claude, all: pass

Files: [either3.go](../all/claude/go-mo-either-binary-1/files/either3.go), [either3_test.go](../all/claude/go-mo-either-binary-1/files/either3_test.go), [either4.go](../all/claude/go-mo-either-binary-1/files/either4.go), [either4_test.go](../all/claude/go-mo-either-binary-1/files/either4_test.go), [either5.go](../all/claude/go-mo-either-binary-1/files/either5.go), [either5_test.go](../all/claude/go-mo-either-binary-1/files/either5_test.go)

<details><summary>diff</summary>

```diff
diff --git a/either3.go b/either3.go
index 3c3e122..28d0477 100644
--- a/either3.go
+++ b/either3.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either3ArgId1 = iota
@@ -221,3 +226,68 @@ func (e Either3[T1, T2, T3]) MapArg3(mapper func(T3) Either3[T1, T2, T3]) Either
 
 	return e
 }
+
+// MarshalBinary encodes Either3 into binary form.
+func (e Either3[T1, T2, T3]) MarshalBinary() ([]byte, error) {
+	var value any
+	switch e.argId {
+	case either3ArgId1:
+		value = e.arg1
+	case either3ArgId2:
+		value = e.arg2
+	case either3ArgId3:
+		value = e.arg3
+	default:
+		return []byte{}, errEither3InvalidArgumentId
+	}
+
+	var buf bytes.Buffer
+	buf.WriteByte(byte(e.argId))
+	if err := gob.NewEncoder(&buf).Encode(value); err != nil {
+		return []byte{}, err
+	}
+	return buf.Bytes(), nil
+}
+
+// UnmarshalBinary decodes Either3 from binary form.
+func (e *Either3[T1, T2, T3]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either3[T1, T2, T3].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewReader(data[1:]))
+
+	switch data[0] {
+	case either3ArgId1:
+		var v T1
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = Either3[T1, T2, T3]{argId: either3ArgId1, arg1: v}
+	case either3ArgId2:
+		var v T2
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = Either3[T1, T2, T3]{argId: either3ArgId2, arg2: v}
+	case either3ArgId3:
+		var v T3
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = Either3[T1, T2, T3]{argId: either3ArgId3, arg3: v}
+	default:
+		return errEither3InvalidArgumentId
+	}
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either3[T1, T2, T3]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either3[T1, T2, T3]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either3_test.go b/either3_test.go
index 10b84e1..fac97a5 100644
--- a/either3_test.go
+++ b/either3_test.go
@@ -295,3 +295,24 @@ func TestEither3MapArg(t *testing.T) {
 	})
 	is.Equal(NewEither3Arg3[int, bool, float64](2.1), result3_3)
 }
+
+func TestEither3Gob(t *testing.T) {
+	is := assert.New(t)
+
+	for _, original := range []Either3[int, string, bool]{
+		NewEither3Arg1[int, string, bool](1),
+		NewEither3Arg2[int, string, bool]("a"),
+		NewEither3Arg3[int, string, bool](true),
+	} {
+		bin, err := original.GobEncode()
+		is.NoError(err)
+
+		var decoded Either3[int, string, bool]
+		is.NoError(decoded.GobDecode(bin))
+		is.Equal(original, decoded)
+	}
+
+	var decoded Either3[int, string, bool]
+	is.Error(decoded.UnmarshalBinary(nil))
+	is.Error(decoded.UnmarshalBinary([]byte{3}))
+}
diff --git a/either4.go b/either4.go
index 40d54cf..af21c0f 100644
--- a/either4.go
+++ b/either4.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either4ArgId1 = iota
@@ -283,3 +288,76 @@ func (e Either4[T1, T2, T3, T4]) MapArg4(mapper func(T4) Either4[T1, T2, T3, T4]
 
 	return e
 }
+
+// MarshalBinary encodes Either4 into binary form.
+func (e Either4[T1, T2, T3, T4]) MarshalBinary() ([]byte, error) {
+	var value any
+	switch e.argId {
+	case either4ArgId1:
+		value = e.arg1
+	case either4ArgId2:
+		value = e.arg2
+	case either4ArgId3:
+		value = e.arg3
+	case either4ArgId4:
+		value = e.arg4
+	default:
+		return []byte{}, errEither4InvalidArgumentId
+	}
+
+	var buf bytes.Buffer
+	buf.WriteByte(byte(e.argId))
+	if err := gob.NewEncoder(&buf).Encode(value); err != nil {
+		return []byte{}, err
+	}
+	return buf.Bytes(), nil
+}
+
+// UnmarshalBinary decodes Either4 from binary form.
+func (e *Either4[T1, T2, T3, T4]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either4[T1, T2, T3, T4].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewReader(data[1:]))
+
+	switch data[0] {
+	case either4ArgId1:
+		var v T1
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = Either4[T1, T2, T3, T4]{argId: either4ArgId1, arg1: v}
+	case either4ArgId2:
+		var v T2
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = Either4[T1, T2, T3, T4]{argId: either4ArgId2, arg2: v}
+	case either4ArgId3:
+		var v T3
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = Either4[T1, T2, T3, T4]{argId: either4ArgId3, arg3: v}
+	case either4ArgId4:
+		var v T4
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = Either4[T1, T2, T3, T4]{argId: either4ArgId4, arg4: v}
+	default:
+		return errEither4InvalidArgumentId
+	}
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either4[T1, T2, T3, T4]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either4[T1, T2, T3, T4]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either4_test.go b/either4_test.go
index 4d5726b..470af6c 100644
--- a/either4_test.go
+++ b/either4_test.go
@@ -451,3 +451,25 @@ func TestEither4MapArg(t *testing.T) {
 	})
 	is.Equal(NewEither4Arg4[int, bool, float64, string]("Bye"), result4_4)
 }
+
+func TestEither4Gob(t *testing.T) {
+	is := assert.New(t)
+
+	for _, original := range []Either4[int, string, bool, float64]{
+		NewEither4Arg1[int, string, bool, float64](1),
+		NewEither4Arg2[int, string, bool, float64]("a"),
+		NewEither4Arg3[int, string, bool, float64](true),
+		NewEither4Arg4[int, string, bool, float64](1.5),
+	} {
+		bin, err := original.GobEncode()
+		is.NoError(err)
+
+		var decoded Either4[int, string, bool, float64]
+		is.NoError(decoded.GobDecode(bin))
+		is.Equal(original, decoded)
+	}
+
+	var decoded Either4[int, string, bool, float64]
+	is.Error(decoded.UnmarshalBinary(nil))
+	is.Error(decoded.UnmarshalBinary([]byte{4}))
+}
diff --git a/either5.go b/either5.go
index 7fca738..4a5f00d 100644
--- a/either5.go
+++ b/either5.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either5ArgId1 = iota
@@ -345,3 +350,84 @@ func (e Either5[T1, T2, T3, T4, T5]) MapArg5(mapper func(T5) Either5[T1, T2, T3,
 
 	return e
 }
+
+// MarshalBinary encodes Either5 into binary form.
+func (e Either5[T1, T2, T3, T4, T5]) MarshalBinary() ([]byte, error) {
+	var value any
+	switch e.argId {
+	case either5ArgId1:
+		value = e.arg1
+	case either5ArgId2:
+		value = e.arg2
+	case either5ArgId3:
+		value = e.arg3
+	case either5ArgId4:
+		value = e.arg4
+	case either5ArgId5:
+		value = e.arg5
+	default:
+		return []byte{}, errEither5InvalidArgumentId
+	}
+
+	var buf bytes.Buffer
+	buf.WriteByte(byte(e.argId))
+	if err := gob.NewEncoder(&buf).Encode(value); err != nil {
+		return []byte{}, err
+	}
+	return buf.Bytes(), nil
+}
+
+// UnmarshalBinary decodes Either5 from binary form.
+func (e *Either5[T1, T2, T3, T4, T5]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either5[T1, T2, T3, T4, T5].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewReader(data[1:]))
+
+	switch data[0] {
+	case either5ArgId1:
+		var v T1
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = Either5[T1, T2, T3, T4, T5]{argId: either5ArgId1, arg1: v}
+	case either5ArgId2:
+		var v T2
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = Either5[T1, T2, T3, T4, T5]{argId: either5ArgId2, arg2: v}
+	case either5ArgId3:
+		var v T3
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = Either5[T1, T2, T3, T4, T5]{argId: either5ArgId3, arg3: v}
+	case either5ArgId4:
+		var v T4
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = Either5[T1, T2, T3, T4, T5]{argId: either5ArgId4, arg4: v}
+	case either5ArgId5:
+		var v T5
+		if err := dec.Decode(&v); err != nil {
+			return err
+		}
+		*e = Either5[T1, T2, T3, T4, T5]{argId: either5ArgId5, arg5: v}
+	default:
+		return errEither5InvalidArgumentId
+	}
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either5[T1, T2, T3, T4, T5]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either5[T1, T2, T3, T4, T5]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either5_test.go b/either5_test.go
index 754f141..332f097 100644
--- a/either5_test.go
+++ b/either5_test.go
@@ -645,3 +645,26 @@ func TestEither5MapArg(t *testing.T) {
 	})
 	is.Equal(NewEither5Arg5[int, bool, float64, string, byte](10), result5_5)
 }
+
+func TestEither5Gob(t *testing.T) {
+	is := assert.New(t)
+
+	for _, original := range []Either5[int, string, bool, float64, int64]{
+		NewEither5Arg1[int, string, bool, float64, int64](1),
+		NewEither5Arg2[int, string, bool, float64, int64]("a"),
+		NewEither5Arg3[int, string, bool, float64, int64](true),
+		NewEither5Arg4[int, string, bool, float64, int64](1.5),
+		NewEither5Arg5[int, string, bool, float64, int64](int64(7)),
+	} {
+		bin, err := original.GobEncode()
+		is.NoError(err)
+
+		var decoded Either5[int, string, bool, float64, int64]
+		is.NoError(decoded.GobDecode(bin))
+		is.Equal(original, decoded)
+	}
+
+	var decoded Either5[int, string, bool, float64, int64]
+	is.Error(decoded.UnmarshalBinary(nil))
+	is.Error(decoded.UnmarshalBinary([]byte{5}))
+}
```

</details>

<details><summary>reply</summary>

Now tests.

Done. Added the four methods to `Either3`, `Either4` and `Either5`, plus a gob round-trip test for each; `go test .` passes. The tests check `assert.Equal` rather than `Equal`, because these types have no `Equal` method.

</details>

### codex, base: pass

Files: [either3.go](../base/codex/go-mo-either-binary-1/files/either3.go), [either4.go](../base/codex/go-mo-either-binary-1/files/either4.go), [either5.go](../base/codex/go-mo-either-binary-1/files/either5.go), [either_binary_test.go](../base/codex/go-mo-either-binary-1/files/either_binary_test.go)

<details><summary>diff</summary>

```diff
diff --git a/either3.go b/either3.go
index 3c3e122..887ddd9 100644
--- a/either3.go
+++ b/either3.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either3ArgId1 = iota
@@ -221,3 +226,62 @@ func (e Either3[T1, T2, T3]) MapArg3(mapper func(T3) Either3[T1, T2, T3]) Either
 
 	return e
 }
+
+// MarshalBinary encodes Either3 into binary form.
+func (e Either3[T1, T2, T3]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either3ArgId1:
+		err = enc.Encode(e.arg1)
+	case either3ArgId2:
+		err = enc.Encode(e.arg2)
+	case either3ArgId3:
+		err = enc.Encode(e.arg3)
+	default:
+		return []byte{}, errEither3InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either3 from binary form.
+func (e *Either3[T1, T2, T3]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either3[T1, T2, T3].UnmarshalBinary: no data")
+	}
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	var decoded Either3[T1, T2, T3]
+	switch data[0] {
+	case either3ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+	case either3ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+	case either3ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+	default:
+		return errEither3InvalidArgumentId
+	}
+	decoded.argId = int8(data[0])
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either3[T1, T2, T3]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either3[T1, T2, T3]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either4.go b/either4.go
index 40d54cf..38e57c6 100644
--- a/either4.go
+++ b/either4.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either4ArgId1 = iota
@@ -283,3 +288,68 @@ func (e Either4[T1, T2, T3, T4]) MapArg4(mapper func(T4) Either4[T1, T2, T3, T4]
 
 	return e
 }
+
+// MarshalBinary encodes Either4 into binary form.
+func (e Either4[T1, T2, T3, T4]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either4ArgId1:
+		err = enc.Encode(e.arg1)
+	case either4ArgId2:
+		err = enc.Encode(e.arg2)
+	case either4ArgId3:
+		err = enc.Encode(e.arg3)
+	case either4ArgId4:
+		err = enc.Encode(e.arg4)
+	default:
+		return []byte{}, errEither4InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either4 from binary form.
+func (e *Either4[T1, T2, T3, T4]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either4[T1, T2, T3, T4].UnmarshalBinary: no data")
+	}
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	var decoded Either4[T1, T2, T3, T4]
+	switch data[0] {
+	case either4ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+	case either4ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+	case either4ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+	case either4ArgId4:
+		if err := dec.Decode(&decoded.arg4); err != nil {
+			return err
+		}
+	default:
+		return errEither4InvalidArgumentId
+	}
+	decoded.argId = int8(data[0])
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either4[T1, T2, T3, T4]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either4[T1, T2, T3, T4]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either5.go b/either5.go
index 7fca738..e47e152 100644
--- a/either5.go
+++ b/either5.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either5ArgId1 = iota
@@ -345,3 +350,74 @@ func (e Either5[T1, T2, T3, T4, T5]) MapArg5(mapper func(T5) Either5[T1, T2, T3,
 
 	return e
 }
+
+// MarshalBinary encodes Either5 into binary form.
+func (e Either5[T1, T2, T3, T4, T5]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either5ArgId1:
+		err = enc.Encode(e.arg1)
+	case either5ArgId2:
+		err = enc.Encode(e.arg2)
+	case either5ArgId3:
+		err = enc.Encode(e.arg3)
+	case either5ArgId4:
+		err = enc.Encode(e.arg4)
+	case either5ArgId5:
+		err = enc.Encode(e.arg5)
+	default:
+		return []byte{}, errEither5InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either5 from binary form.
+func (e *Either5[T1, T2, T3, T4, T5]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either5[T1, T2, T3, T4, T5].UnmarshalBinary: no data")
+	}
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	var decoded Either5[T1, T2, T3, T4, T5]
+	switch data[0] {
+	case either5ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+	case either5ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+	case either5ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+	case either5ArgId4:
+		if err := dec.Decode(&decoded.arg4); err != nil {
+			return err
+		}
+	case either5ArgId5:
+		if err := dec.Decode(&decoded.arg5); err != nil {
+			return err
+		}
+	default:
+		return errEither5InvalidArgumentId
+	}
+	decoded.argId = int8(data[0])
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either5[T1, T2, T3, T4, T5]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either5[T1, T2, T3, T4, T5]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either_binary_test.go b/either_binary_test.go
new file mode 100644
index 0000000..6d5457d
--- /dev/null
+++ b/either_binary_test.go
@@ -0,0 +1,183 @@
+package mo
+
+import (
+	"bytes"
+	"encoding/gob"
+	"testing"
+)
+
+func TestEither3BinarySerialization(t *testing.T) {
+	originals := []Either3[int, int, int]{
+		{argId: either3ArgId1, arg1: 10},
+		{argId: either3ArgId2, arg2: 20},
+		{argId: either3ArgId3, arg3: 30},
+	}
+	for _, original := range originals {
+		data, err := original.MarshalBinary()
+		if err != nil {
+			t.Fatal(err)
+		}
+		if data[0] != byte(original.argId) {
+			t.Fatalf("unexpected side id: %d", data[0])
+		}
+		var payload int
+		if err := gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&payload); err != nil {
+			t.Fatal(err)
+		}
+		if payload != (int(original.argId)+1)*10 {
+			t.Fatalf("unexpected payload: %d", payload)
+		}
+		decoded := Either3[int, int, int]{arg1: 99, arg2: 99, arg3: 99}
+		if err := decoded.UnmarshalBinary(data); err != nil {
+			t.Fatal(err)
+		}
+		if decoded != original {
+			t.Fatalf("binary round trip: got %#v, want %#v", decoded, original)
+		}
+		var buf bytes.Buffer
+		holder := struct{ Value Either3[int, int, int] }{original}
+		if err := gob.NewEncoder(&buf).Encode(holder); err != nil {
+			t.Fatal(err)
+		}
+		decodedHolder := holder
+		if err := gob.NewDecoder(&buf).Decode(&decodedHolder); err != nil {
+			t.Fatal(err)
+		}
+		if decodedHolder.Value != original {
+			t.Fatalf("gob round trip: got %#v, want %#v", decodedHolder.Value, original)
+		}
+	}
+	var decoded Either3[int, int, int]
+	for _, data := range [][]byte{nil, {}, {255}, {3}, {0}, {0, 255}} {
+		if err := decoded.UnmarshalBinary(data); err == nil {
+			t.Fatalf("expected error for %v", data)
+		}
+	}
+	invalid := Either3[int, int, int]{argId: -1}
+	if _, err := invalid.MarshalBinary(); err == nil {
+		t.Fatal("expected invalid side error")
+	}
+	unsupported := Either3[func(), int, int]{arg1: func() {}}
+	if _, err := unsupported.MarshalBinary(); err == nil {
+		t.Fatal("expected gob encoding error")
+	}
+}
+
+func TestEither4BinarySerialization(t *testing.T) {
+	originals := []Either4[int, int, int, int]{
+		{argId: either4ArgId1, arg1: 10},
+		{argId: either4ArgId2, arg2: 20},
+		{argId: either4ArgId3, arg3: 30},
+		{argId: either4ArgId4, arg4: 40},
+	}
+	for _, original := range originals {
+		data, err := original.MarshalBinary()
+		if err != nil {
+			t.Fatal(err)
+		}
+		if data[0] != byte(original.argId) {
+			t.Fatalf("unexpected side id: %d", data[0])
+		}
+		var payload int
+		if err := gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&payload); err != nil {
+			t.Fatal(err)
+		}
+		if payload != (int(original.argId)+1)*10 {
+			t.Fatalf("unexpected payload: %d", payload)
+		}
+		decoded := Either4[int, int, int, int]{arg1: 99, arg2: 99, arg3: 99, arg4: 99}
+		if err := decoded.UnmarshalBinary(data); err != nil {
+			t.Fatal(err)
+		}
+		if decoded != original {
+			t.Fatalf("binary round trip: got %#v, want %#v", decoded, original)
+		}
+		var buf bytes.Buffer
+		holder := struct{ Value Either4[int, int, int, int] }{original}
+		if err := gob.NewEncoder(&buf).Encode(holder); err != nil {
+			t.Fatal(err)
+		}
+		decodedHolder := holder
+		if err := gob.NewDecoder(&buf).Decode(&decodedHolder); err != nil {
+			t.Fatal(err)
+		}
+		if decodedHolder.Value != original {
+			t.Fatalf("gob round trip: got %#v, want %#v", decodedHolder.Value, original)
+		}
+	}
+	var decoded Either4[int, int, int, int]
+	for _, data := range [][]byte{nil, {}, {255}, {4}, {0}, {0, 255}} {
+		if err := decoded.UnmarshalBinary(data); err == nil {
+			t.Fatalf("expected error for %v", data)
+		}
+	}
+	invalid := Either4[int, int, int, int]{argId: -1}
+	if _, err := invalid.MarshalBinary(); err == nil {
+		t.Fatal("expected invalid side error")
+	}
+	unsupported := Either4[func(), int, int, int]{arg1: func() {}}
+	if _, err := unsupported.MarshalBinary(); err == nil {
+		t.Fatal("expected gob encoding error")
+	}
+}
+
+func TestEither5BinarySerialization(t *testing.T) {
+	originals := []Either5[int, int, int, int, int]{
+		{argId: either5ArgId1, arg1: 10},
+		{argId: either5ArgId2, arg2: 20},
+		{argId: either5ArgId3, arg3: 30},
+		{argId: either5ArgId4, arg4: 40},
+		{argId: either5ArgId5, arg5: 50},
+	}
+	for _, original := range originals {
+		data, err := original.MarshalBinary()
+		if err != nil {
+			t.Fatal(err)
+		}
+		if data[0] != byte(original.argId) {
+			t.Fatalf("unexpected side id: %d", data[0])
+		}
+		var payload int
+		if err := gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&payload); err != nil {
+			t.Fatal(err)
+		}
+		if payload != (int(original.argId)+1)*10 {
+			t.Fatalf("unexpected payload: %d", payload)
+		}
+		decoded := Either5[int, int, int, int, int]{arg1: 99, arg2: 99, arg3: 99, arg4: 99, arg5: 99}
+		if err := decoded.UnmarshalBinary(data); err != nil {
+			t.Fatal(err)
+		}
+		if decoded != original {
+			t.Fatalf("binary round trip: got %#v, want %#v", decoded, original)
+		}
+		var buf bytes.Buffer
+		holder := struct {
+			Value Either5[int, int, int, int, int]
+		}{original}
+		if err := gob.NewEncoder(&buf).Encode(holder); err != nil {
+			t.Fatal(err)
+		}
+		decodedHolder := holder
+		if err := gob.NewDecoder(&buf).Decode(&decodedHolder); err != nil {
+			t.Fatal(err)
+		}
+		if decodedHolder.Value != original {
+			t.Fatalf("gob round trip: got %#v, want %#v", decodedHolder.Value, original)
+		}
+	}
+	var decoded Either5[int, int, int, int, int]
+	for _, data := range [][]byte{nil, {}, {255}, {5}, {0}, {0, 255}} {
+		if err := decoded.UnmarshalBinary(data); err == nil {
+			t.Fatalf("expected error for %v", data)
+		}
+	}
+	invalid := Either5[int, int, int, int, int]{argId: -1}
+	if _, err := invalid.MarshalBinary(); err == nil {
+		t.Fatal("expected invalid side error")
+	}
+	unsupported := Either5[func(), int, int, int, int]{arg1: func() {}}
+	if _, err := unsupported.MarshalBinary(); err == nil {
+		t.Fatal("expected gob encoding error")
+	}
+}
```

</details>

<details><summary>reply</summary>

I’ll check `Either`’s implementation, add matching methods to the three larger variants, and test their binary and gob round trips.

Added all four serialization methods to `Either3`, `Either4`, and `Either5`.

Encoding prefixes the gob payload with the side id. Decoding clears inactive sides and rejects empty input or unknown ids. Gob methods delegate to the binary methods.

Added tests for every side, struct gob round trips, stale-value clearing, and invalid inputs. `go test ./...` passes.

</details>

### codex, muffle: pass

Files: [either3.go](../muffle/codex/go-mo-either-binary-1/files/either3.go), [either4.go](../muffle/codex/go-mo-either-binary-1/files/either4.go), [either5.go](../muffle/codex/go-mo-either-binary-1/files/either5.go), [either_binary_test.go](../muffle/codex/go-mo-either-binary-1/files/either_binary_test.go)

<details><summary>diff</summary>

```diff
diff --git a/either3.go b/either3.go
index 3c3e122..a9fa9a7 100644
--- a/either3.go
+++ b/either3.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either3ArgId1 = iota
@@ -221,3 +226,63 @@ func (e Either3[T1, T2, T3]) MapArg3(mapper func(T3) Either3[T1, T2, T3]) Either
 
 	return e
 }
+
+// MarshalBinary encodes Either3 into binary form.
+func (e Either3[T1, T2, T3]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either3ArgId1:
+		err = enc.Encode(e.arg1)
+	case either3ArgId2:
+		err = enc.Encode(e.arg2)
+	case either3ArgId3:
+		err = enc.Encode(e.arg3)
+	default:
+		return []byte{}, errEither3InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either3 from binary form.
+func (e *Either3[T1, T2, T3]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either3[T1, T2, T3].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	var decoded Either3[T1, T2, T3]
+	switch data[0] {
+	case either3ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+	case either3ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+	case either3ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+	default:
+		return errEither3InvalidArgumentId
+	}
+	decoded.argId = int8(data[0])
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either3[T1, T2, T3]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either3[T1, T2, T3]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either4.go b/either4.go
index 40d54cf..84038b7 100644
--- a/either4.go
+++ b/either4.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either4ArgId1 = iota
@@ -283,3 +288,69 @@ func (e Either4[T1, T2, T3, T4]) MapArg4(mapper func(T4) Either4[T1, T2, T3, T4]
 
 	return e
 }
+
+// MarshalBinary encodes Either4 into binary form.
+func (e Either4[T1, T2, T3, T4]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either4ArgId1:
+		err = enc.Encode(e.arg1)
+	case either4ArgId2:
+		err = enc.Encode(e.arg2)
+	case either4ArgId3:
+		err = enc.Encode(e.arg3)
+	case either4ArgId4:
+		err = enc.Encode(e.arg4)
+	default:
+		return []byte{}, errEither4InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either4 from binary form.
+func (e *Either4[T1, T2, T3, T4]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either4[T1, T2, T3, T4].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	var decoded Either4[T1, T2, T3, T4]
+	switch data[0] {
+	case either4ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+	case either4ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+	case either4ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+	case either4ArgId4:
+		if err := dec.Decode(&decoded.arg4); err != nil {
+			return err
+		}
+	default:
+		return errEither4InvalidArgumentId
+	}
+	decoded.argId = int8(data[0])
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either4[T1, T2, T3, T4]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either4[T1, T2, T3, T4]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either5.go b/either5.go
index 7fca738..67f3b21 100644
--- a/either5.go
+++ b/either5.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either5ArgId1 = iota
@@ -345,3 +350,75 @@ func (e Either5[T1, T2, T3, T4, T5]) MapArg5(mapper func(T5) Either5[T1, T2, T3,
 
 	return e
 }
+
+// MarshalBinary encodes Either5 into binary form.
+func (e Either5[T1, T2, T3, T4, T5]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either5ArgId1:
+		err = enc.Encode(e.arg1)
+	case either5ArgId2:
+		err = enc.Encode(e.arg2)
+	case either5ArgId3:
+		err = enc.Encode(e.arg3)
+	case either5ArgId4:
+		err = enc.Encode(e.arg4)
+	case either5ArgId5:
+		err = enc.Encode(e.arg5)
+	default:
+		return []byte{}, errEither5InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either5 from binary form.
+func (e *Either5[T1, T2, T3, T4, T5]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either5[T1, T2, T3, T4, T5].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	var decoded Either5[T1, T2, T3, T4, T5]
+	switch data[0] {
+	case either5ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+	case either5ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+	case either5ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+	case either5ArgId4:
+		if err := dec.Decode(&decoded.arg4); err != nil {
+			return err
+		}
+	case either5ArgId5:
+		if err := dec.Decode(&decoded.arg5); err != nil {
+			return err
+		}
+	default:
+		return errEither5InvalidArgumentId
+	}
+	decoded.argId = int8(data[0])
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either5[T1, T2, T3, T4, T5]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either5[T1, T2, T3, T4, T5]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either_binary_test.go b/either_binary_test.go
new file mode 100644
index 0000000..24c7ffa
--- /dev/null
+++ b/either_binary_test.go
@@ -0,0 +1,137 @@
+package mo
+
+import (
+	"bytes"
+	"encoding/gob"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+func TestEither3BinarySerialization(t *testing.T) {
+	originals := []Either3[int, string, bool]{
+		NewEither3Arg1[int, string, bool](42),
+		NewEither3Arg2[int, string, bool]("hello"),
+		NewEither3Arg3[int, string, bool](true),
+	}
+	for id, original := range originals {
+		data, err := original.MarshalBinary()
+		require.NoError(t, err)
+		require.NotEmpty(t, data)
+		assert.Equal(t, byte(id), data[0])
+		// Decode into every previously selected side to check that stale values are cleared.
+		for _, decoded := range originals {
+			require.NoError(t, decoded.UnmarshalBinary(data))
+			assert.Equal(t, original, decoded)
+		}
+		gobData, err := original.GobEncode()
+		require.NoError(t, err)
+		assert.Equal(t, data, gobData)
+		var decoded Either3[int, string, bool]
+		require.NoError(t, decoded.GobDecode(gobData))
+		assert.Equal(t, original, decoded)
+		var buf bytes.Buffer
+		holder := struct{ Value Either3[int, string, bool] }{Value: original}
+		require.NoError(t, gob.NewEncoder(&buf).Encode(holder))
+		restored := holder
+		require.NoError(t, gob.NewDecoder(&buf).Decode(&restored))
+		assert.Equal(t, holder, restored)
+	}
+	var decoded Either3[int, string, bool]
+	for _, data := range [][]byte{nil, {}, {255}, {0}, {0, 255}} {
+		assert.Error(t, decoded.UnmarshalBinary(data))
+		assert.Error(t, decoded.GobDecode(data))
+	}
+	_, err := (Either3[int, string, bool]{argId: -1}).MarshalBinary()
+	assert.Error(t, err)
+	_, err = NewEither3Arg1[chan int, int, int](make(chan int)).MarshalBinary()
+	assert.Error(t, err)
+}
+
+func TestEither4BinarySerialization(t *testing.T) {
+	originals := []Either4[int, string, bool, float64]{
+		NewEither4Arg1[int, string, bool, float64](42),
+		NewEither4Arg2[int, string, bool, float64]("hello"),
+		NewEither4Arg3[int, string, bool, float64](true),
+		NewEither4Arg4[int, string, bool, float64](1.5),
+	}
+	for id, original := range originals {
+		data, err := original.MarshalBinary()
+		require.NoError(t, err)
+		require.NotEmpty(t, data)
+		assert.Equal(t, byte(id), data[0])
+		// Decode into every previously selected side to check that stale values are cleared.
+		for _, decoded := range originals {
+			require.NoError(t, decoded.UnmarshalBinary(data))
+			assert.Equal(t, original, decoded)
+		}
+		gobData, err := original.GobEncode()
+		require.NoError(t, err)
+		assert.Equal(t, data, gobData)
+		var decoded Either4[int, string, bool, float64]
+		require.NoError(t, decoded.GobDecode(gobData))
+		assert.Equal(t, original, decoded)
+		var buf bytes.Buffer
+		holder := struct {
+			Value Either4[int, string, bool, float64]
+		}{Value: original}
+		require.NoError(t, gob.NewEncoder(&buf).Encode(holder))
+		restored := holder
+		require.NoError(t, gob.NewDecoder(&buf).Decode(&restored))
+		assert.Equal(t, holder, restored)
+	}
+	var decoded Either4[int, string, bool, float64]
+	for _, data := range [][]byte{nil, {}, {255}, {0}, {0, 255}} {
+		assert.Error(t, decoded.UnmarshalBinary(data))
+		assert.Error(t, decoded.GobDecode(data))
+	}
+	_, err := (Either4[int, string, bool, float64]{argId: -1}).MarshalBinary()
+	assert.Error(t, err)
+	_, err = NewEither4Arg1[chan int, int, int, int](make(chan int)).MarshalBinary()
+	assert.Error(t, err)
+}
+
+func TestEither5BinarySerialization(t *testing.T) {
+	originals := []Either5[int, string, bool, float64, []int]{
+		NewEither5Arg1[int, string, bool, float64, []int](42),
+		NewEither5Arg2[int, string, bool, float64, []int]("hello"),
+		NewEither5Arg3[int, string, bool, float64, []int](true),
+		NewEither5Arg4[int, string, bool, float64, []int](1.5),
+		NewEither5Arg5[int, string, bool, float64, []int]([]int{1, 2}),
+	}
+	for id, original := range originals {
+		data, err := original.MarshalBinary()
+		require.NoError(t, err)
+		require.NotEmpty(t, data)
+		assert.Equal(t, byte(id), data[0])
+		// Decode into every previously selected side to check that stale values are cleared.
+		for _, decoded := range originals {
+			require.NoError(t, decoded.UnmarshalBinary(data))
+			assert.Equal(t, original, decoded)
+		}
+		gobData, err := original.GobEncode()
+		require.NoError(t, err)
+		assert.Equal(t, data, gobData)
+		var decoded Either5[int, string, bool, float64, []int]
+		require.NoError(t, decoded.GobDecode(gobData))
+		assert.Equal(t, original, decoded)
+		var buf bytes.Buffer
+		holder := struct {
+			Value Either5[int, string, bool, float64, []int]
+		}{Value: original}
+		require.NoError(t, gob.NewEncoder(&buf).Encode(holder))
+		restored := holder
+		require.NoError(t, gob.NewDecoder(&buf).Decode(&restored))
+		assert.Equal(t, holder, restored)
+	}
+	var decoded Either5[int, string, bool, float64, []int]
+	for _, data := range [][]byte{nil, {}, {255}, {0}, {0, 255}} {
+		assert.Error(t, decoded.UnmarshalBinary(data))
+		assert.Error(t, decoded.GobDecode(data))
+	}
+	_, err := (Either5[int, string, bool, float64, []int]{argId: -1}).MarshalBinary()
+	assert.Error(t, err)
+	_, err = NewEither5Arg1[chan int, int, int, int, int](make(chan int)).MarshalBinary()
+	assert.Error(t, err)
+}
```

</details>

<details><summary>reply</summary>

I’ll check the existing `Either` implementation, add matching methods to the three variants, and test round-trips and invalid input.

Added all four serialization methods to `Either3`, `Either4`, and `Either5`.

Encoding uses the side id followed by its gob payload. Decoding clears inactive sides and rejects empty input or unknown ids. Gob methods delegate to the binary methods.

Tests cover every side, reused destinations, struct gob round-trips, and error cases. `go test ./...` passes.

</details>

### codex, hush: pass

Files: [either3.go](../hush/codex/go-mo-either-binary-1/files/either3.go), [either4.go](../hush/codex/go-mo-either-binary-1/files/either4.go), [either5.go](../hush/codex/go-mo-either-binary-1/files/either5.go), [either_binary_test.go](../hush/codex/go-mo-either-binary-1/files/either_binary_test.go)

<details><summary>diff</summary>

```diff
diff --git a/either3.go b/either3.go
index 3c3e122..887ddd9 100644
--- a/either3.go
+++ b/either3.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either3ArgId1 = iota
@@ -221,3 +226,62 @@ func (e Either3[T1, T2, T3]) MapArg3(mapper func(T3) Either3[T1, T2, T3]) Either
 
 	return e
 }
+
+// MarshalBinary encodes Either3 into binary form.
+func (e Either3[T1, T2, T3]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either3ArgId1:
+		err = enc.Encode(e.arg1)
+	case either3ArgId2:
+		err = enc.Encode(e.arg2)
+	case either3ArgId3:
+		err = enc.Encode(e.arg3)
+	default:
+		return []byte{}, errEither3InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either3 from binary form.
+func (e *Either3[T1, T2, T3]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either3[T1, T2, T3].UnmarshalBinary: no data")
+	}
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	var decoded Either3[T1, T2, T3]
+	switch data[0] {
+	case either3ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+	case either3ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+	case either3ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+	default:
+		return errEither3InvalidArgumentId
+	}
+	decoded.argId = int8(data[0])
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either3[T1, T2, T3]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either3[T1, T2, T3]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either4.go b/either4.go
index 40d54cf..38e57c6 100644
--- a/either4.go
+++ b/either4.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either4ArgId1 = iota
@@ -283,3 +288,68 @@ func (e Either4[T1, T2, T3, T4]) MapArg4(mapper func(T4) Either4[T1, T2, T3, T4]
 
 	return e
 }
+
+// MarshalBinary encodes Either4 into binary form.
+func (e Either4[T1, T2, T3, T4]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either4ArgId1:
+		err = enc.Encode(e.arg1)
+	case either4ArgId2:
+		err = enc.Encode(e.arg2)
+	case either4ArgId3:
+		err = enc.Encode(e.arg3)
+	case either4ArgId4:
+		err = enc.Encode(e.arg4)
+	default:
+		return []byte{}, errEither4InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either4 from binary form.
+func (e *Either4[T1, T2, T3, T4]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either4[T1, T2, T3, T4].UnmarshalBinary: no data")
+	}
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	var decoded Either4[T1, T2, T3, T4]
+	switch data[0] {
+	case either4ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+	case either4ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+	case either4ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+	case either4ArgId4:
+		if err := dec.Decode(&decoded.arg4); err != nil {
+			return err
+		}
+	default:
+		return errEither4InvalidArgumentId
+	}
+	decoded.argId = int8(data[0])
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either4[T1, T2, T3, T4]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either4[T1, T2, T3, T4]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either5.go b/either5.go
index 7fca738..e47e152 100644
--- a/either5.go
+++ b/either5.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either5ArgId1 = iota
@@ -345,3 +350,74 @@ func (e Either5[T1, T2, T3, T4, T5]) MapArg5(mapper func(T5) Either5[T1, T2, T3,
 
 	return e
 }
+
+// MarshalBinary encodes Either5 into binary form.
+func (e Either5[T1, T2, T3, T4, T5]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either5ArgId1:
+		err = enc.Encode(e.arg1)
+	case either5ArgId2:
+		err = enc.Encode(e.arg2)
+	case either5ArgId3:
+		err = enc.Encode(e.arg3)
+	case either5ArgId4:
+		err = enc.Encode(e.arg4)
+	case either5ArgId5:
+		err = enc.Encode(e.arg5)
+	default:
+		return []byte{}, errEither5InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either5 from binary form.
+func (e *Either5[T1, T2, T3, T4, T5]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either5[T1, T2, T3, T4, T5].UnmarshalBinary: no data")
+	}
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	var decoded Either5[T1, T2, T3, T4, T5]
+	switch data[0] {
+	case either5ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+	case either5ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+	case either5ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+	case either5ArgId4:
+		if err := dec.Decode(&decoded.arg4); err != nil {
+			return err
+		}
+	case either5ArgId5:
+		if err := dec.Decode(&decoded.arg5); err != nil {
+			return err
+		}
+	default:
+		return errEither5InvalidArgumentId
+	}
+	decoded.argId = int8(data[0])
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either5[T1, T2, T3, T4, T5]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either5[T1, T2, T3, T4, T5]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either_binary_test.go b/either_binary_test.go
new file mode 100644
index 0000000..364a808
--- /dev/null
+++ b/either_binary_test.go
@@ -0,0 +1,150 @@
+package mo
+
+import (
+	"bytes"
+	"encoding/gob"
+	"reflect"
+	"testing"
+)
+
+func TestEither3BinarySerialization(t *testing.T) {
+	values := []Either3[int, string, bool]{
+		NewEither3Arg1[int, string, bool](42),
+		NewEither3Arg2[int, string, bool]("value"),
+		NewEither3Arg3[int, string, bool](true),
+	}
+	for side, original := range values {
+		data, err := original.MarshalBinary()
+		if err != nil {
+			t.Fatal(err)
+		}
+		if data[0] != byte(side) {
+			t.Fatalf("side: got %d, want %d", data[0], side)
+		}
+		decoded := Either3[int, string, bool]{arg1: 42, arg2: "value", arg3: true}
+		if err := decoded.UnmarshalBinary(data); err != nil {
+			t.Fatal(err)
+		}
+		if !reflect.DeepEqual(original, decoded) {
+			t.Fatalf("round trip: got %#v, want %#v", decoded, original)
+		}
+		var payload bytes.Buffer
+		holder := struct{ Value Either3[int, string, bool] }{original}
+		if err := gob.NewEncoder(&payload).Encode(holder); err != nil {
+			t.Fatal(err)
+		}
+		decodedHolder := holder
+		if err := gob.NewDecoder(&payload).Decode(&decodedHolder); err != nil {
+			t.Fatal(err)
+		}
+		if !reflect.DeepEqual(holder, decodedHolder) {
+			t.Fatalf("gob round trip: got %#v, want %#v", decodedHolder, holder)
+		}
+	}
+	var decoded Either3[int, string, bool]
+	for _, data := range [][]byte{nil, {}, {255}, {0}, {0, 255}} {
+		if err := decoded.UnmarshalBinary(data); err == nil {
+			t.Fatalf("expected error for %v", data)
+		}
+		if err := decoded.GobDecode(data); err == nil {
+			t.Fatalf("expected gob error for %v", data)
+		}
+	}
+}
+
+func TestEither4BinarySerialization(t *testing.T) {
+	values := []Either4[int, string, bool, float64]{
+		NewEither4Arg1[int, string, bool, float64](42),
+		NewEither4Arg2[int, string, bool, float64]("value"),
+		NewEither4Arg3[int, string, bool, float64](true),
+		NewEither4Arg4[int, string, bool, float64](3.5),
+	}
+	for side, original := range values {
+		data, err := original.MarshalBinary()
+		if err != nil {
+			t.Fatal(err)
+		}
+		if data[0] != byte(side) {
+			t.Fatalf("side: got %d, want %d", data[0], side)
+		}
+		decoded := Either4[int, string, bool, float64]{arg1: 42, arg2: "value", arg3: true, arg4: 3.5}
+		if err := decoded.UnmarshalBinary(data); err != nil {
+			t.Fatal(err)
+		}
+		if !reflect.DeepEqual(original, decoded) {
+			t.Fatalf("round trip: got %#v, want %#v", decoded, original)
+		}
+		var payload bytes.Buffer
+		holder := struct {
+			Value Either4[int, string, bool, float64]
+		}{original}
+		if err := gob.NewEncoder(&payload).Encode(holder); err != nil {
+			t.Fatal(err)
+		}
+		decodedHolder := holder
+		if err := gob.NewDecoder(&payload).Decode(&decodedHolder); err != nil {
+			t.Fatal(err)
+		}
+		if !reflect.DeepEqual(holder, decodedHolder) {
+			t.Fatalf("gob round trip: got %#v, want %#v", decodedHolder, holder)
+		}
+	}
+	var decoded Either4[int, string, bool, float64]
+	for _, data := range [][]byte{nil, {}, {255}, {0}, {0, 255}} {
+		if err := decoded.UnmarshalBinary(data); err == nil {
+			t.Fatalf("expected error for %v", data)
+		}
+		if err := decoded.GobDecode(data); err == nil {
+			t.Fatalf("expected gob error for %v", data)
+		}
+	}
+}
+
+func TestEither5BinarySerialization(t *testing.T) {
+	values := []Either5[int, string, bool, float64, []int]{
+		NewEither5Arg1[int, string, bool, float64, []int](42),
+		NewEither5Arg2[int, string, bool, float64, []int]("value"),
+		NewEither5Arg3[int, string, bool, float64, []int](true),
+		NewEither5Arg4[int, string, bool, float64, []int](3.5),
+		NewEither5Arg5[int, string, bool, float64, []int]([]int{1, 2}),
+	}
+	for side, original := range values {
+		data, err := original.MarshalBinary()
+		if err != nil {
+			t.Fatal(err)
+		}
+		if data[0] != byte(side) {
+			t.Fatalf("side: got %d, want %d", data[0], side)
+		}
+		decoded := Either5[int, string, bool, float64, []int]{arg1: 42, arg2: "value", arg3: true, arg4: 3.5, arg5: []int{1, 2}}
+		if err := decoded.UnmarshalBinary(data); err != nil {
+			t.Fatal(err)
+		}
+		if !reflect.DeepEqual(original, decoded) {
+			t.Fatalf("round trip: got %#v, want %#v", decoded, original)
+		}
+		var payload bytes.Buffer
+		holder := struct {
+			Value Either5[int, string, bool, float64, []int]
+		}{original}
+		if err := gob.NewEncoder(&payload).Encode(holder); err != nil {
+			t.Fatal(err)
+		}
+		decodedHolder := holder
+		if err := gob.NewDecoder(&payload).Decode(&decodedHolder); err != nil {
+			t.Fatal(err)
+		}
+		if !reflect.DeepEqual(holder, decodedHolder) {
+			t.Fatalf("gob round trip: got %#v, want %#v", decodedHolder, holder)
+		}
+	}
+	var decoded Either5[int, string, bool, float64, []int]
+	for _, data := range [][]byte{nil, {}, {255}, {0}, {0, 255}} {
+		if err := decoded.UnmarshalBinary(data); err == nil {
+			t.Fatalf("expected error for %v", data)
+		}
+		if err := decoded.GobDecode(data); err == nil {
+			t.Fatalf("expected gob error for %v", data)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

Done.
Added binary/gob serialization for `Either3`, `Either4`, `Either5`, clearing inactive sides and rejecting invalid input. Round-trip tests added; `go test ./...` passes.

</details>

### codex, sloth: pass

Files: [either3.go](../sloth/codex/go-mo-either-binary-1/files/either3.go), [either3_test.go](../sloth/codex/go-mo-either-binary-1/files/either3_test.go), [either4.go](../sloth/codex/go-mo-either-binary-1/files/either4.go), [either4_test.go](../sloth/codex/go-mo-either-binary-1/files/either4_test.go), [either5.go](../sloth/codex/go-mo-either-binary-1/files/either5.go), [either5_test.go](../sloth/codex/go-mo-either-binary-1/files/either5_test.go)

<details><summary>diff</summary>

```diff
diff --git a/either3.go b/either3.go
index 3c3e122..26b85ce 100644
--- a/either3.go
+++ b/either3.go
@@ -1,6 +1,10 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"fmt"
+)
 
 const (
 	either3ArgId1 = iota
@@ -221,3 +225,59 @@ func (e Either3[T1, T2, T3]) MapArg3(mapper func(T3) Either3[T1, T2, T3]) Either
 
 	return e
 }
+
+// MarshalBinary encodes Either3 into binary form.
+func (e Either3[T1, T2, T3]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either3ArgId1:
+		err = enc.Encode(e.arg1)
+	case either3ArgId2:
+		err = enc.Encode(e.arg2)
+	case either3ArgId3:
+		err = enc.Encode(e.arg3)
+	default:
+		return []byte{}, errEither3InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either3 from binary form.
+func (e *Either3[T1, T2, T3]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return fmt.Errorf("Either3[T1, T2, T3].UnmarshalBinary: no data")
+	}
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	decoded := Either3[T1, T2, T3]{argId: int8(data[0])}
+	var err error
+	switch data[0] {
+	case either3ArgId1:
+		err = dec.Decode(&decoded.arg1)
+	case either3ArgId2:
+		err = dec.Decode(&decoded.arg2)
+	case either3ArgId3:
+		err = dec.Decode(&decoded.arg3)
+	default:
+		return errEither3InvalidArgumentId
+	}
+	if err != nil {
+		return err
+	}
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either3[T1, T2, T3]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either3[T1, T2, T3]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either3_test.go b/either3_test.go
index 10b84e1..d839c4e 100644
--- a/either3_test.go
+++ b/either3_test.go
@@ -1,6 +1,8 @@
 package mo
 
 import (
+	"bytes"
+	"encoding/gob"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -295,3 +297,56 @@ func TestEither3MapArg(t *testing.T) {
 	})
 	is.Equal(NewEither3Arg3[int, bool, float64](2.1), result3_3)
 }
+
+// TestEither3Binary checks the binary format and gob round trips for every side.
+func TestEither3Binary(t *testing.T) {
+	is := assert.New(t)
+	cases := []struct {
+		original Either3[int, bool, float64]
+		value    any
+	}{
+		{NewEither3Arg1[int, bool, float64](42), 42},
+		{NewEither3Arg2[int, bool, float64](true), true},
+		{NewEither3Arg3[int, bool, float64](1.2), 1.2},
+	}
+	for id, tc := range cases {
+		data, err := tc.original.MarshalBinary()
+		if !is.NoError(err) {
+			continue
+		}
+		var payload bytes.Buffer
+		is.NoError(gob.NewEncoder(&payload).Encode(tc.value))
+		is.Equal(append([]byte{byte(id)}, payload.Bytes()...), data)
+		binary, err := tc.original.GobEncode()
+		is.NoError(err)
+		is.Equal(data, binary)
+		decoded := Either3[int, bool, float64]{arg1: 42, arg2: true, arg3: 1.2}
+		is.NoError(decoded.UnmarshalBinary(data))
+		is.Equal(tc.original, decoded)
+		decoded = Either3[int, bool, float64]{arg1: 42, arg2: true, arg3: 1.2}
+		is.NoError(decoded.GobDecode(data))
+		is.Equal(tc.original, decoded)
+		original := struct{ Value Either3[int, bool, float64] }{tc.original}
+		var buf bytes.Buffer
+		is.NoError(gob.NewEncoder(&buf).Encode(original))
+		var restored struct{ Value Either3[int, bool, float64] }
+		is.NoError(gob.NewDecoder(&buf).Decode(&restored))
+		is.Equal(original, restored)
+	}
+}
+
+// TestEither3BinaryErrors checks invalid input and gob encoding failures.
+func TestEither3BinaryErrors(t *testing.T) {
+	is := assert.New(t)
+	var decoded Either3[int, bool, float64]
+	for _, data := range [][]byte{nil, {}, {byte(3)}, {255}, {0}, {0, 255}} {
+		is.Error(decoded.UnmarshalBinary(data))
+		is.Error(decoded.GobDecode(data))
+	}
+	invalid := Either3[int, bool, float64]{argId: -1}
+	_, err := invalid.MarshalBinary()
+	is.Error(err)
+	unsupported := NewEither3Arg1[func(), bool, float64](func() {})
+	_, err = unsupported.MarshalBinary()
+	is.Error(err)
+}
diff --git a/either4.go b/either4.go
index 40d54cf..025b0e7 100644
--- a/either4.go
+++ b/either4.go
@@ -1,6 +1,10 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"fmt"
+)
 
 const (
 	either4ArgId1 = iota
@@ -283,3 +287,63 @@ func (e Either4[T1, T2, T3, T4]) MapArg4(mapper func(T4) Either4[T1, T2, T3, T4]
 
 	return e
 }
+
+// MarshalBinary encodes Either4 into binary form.
+func (e Either4[T1, T2, T3, T4]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either4ArgId1:
+		err = enc.Encode(e.arg1)
+	case either4ArgId2:
+		err = enc.Encode(e.arg2)
+	case either4ArgId3:
+		err = enc.Encode(e.arg3)
+	case either4ArgId4:
+		err = enc.Encode(e.arg4)
+	default:
+		return []byte{}, errEither4InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either4 from binary form.
+func (e *Either4[T1, T2, T3, T4]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return fmt.Errorf("Either4[T1, T2, T3, T4].UnmarshalBinary: no data")
+	}
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	decoded := Either4[T1, T2, T3, T4]{argId: int8(data[0])}
+	var err error
+	switch data[0] {
+	case either4ArgId1:
+		err = dec.Decode(&decoded.arg1)
+	case either4ArgId2:
+		err = dec.Decode(&decoded.arg2)
+	case either4ArgId3:
+		err = dec.Decode(&decoded.arg3)
+	case either4ArgId4:
+		err = dec.Decode(&decoded.arg4)
+	default:
+		return errEither4InvalidArgumentId
+	}
+	if err != nil {
+		return err
+	}
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either4[T1, T2, T3, T4]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either4[T1, T2, T3, T4]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either4_test.go b/either4_test.go
index 4d5726b..c03d8e8 100644
--- a/either4_test.go
+++ b/either4_test.go
@@ -1,6 +1,8 @@
 package mo
 
 import (
+	"bytes"
+	"encoding/gob"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -451,3 +453,61 @@ func TestEither4MapArg(t *testing.T) {
 	})
 	is.Equal(NewEither4Arg4[int, bool, float64, string]("Bye"), result4_4)
 }
+
+// TestEither4Binary checks the binary format and gob round trips for every side.
+func TestEither4Binary(t *testing.T) {
+	is := assert.New(t)
+	cases := []struct {
+		original Either4[int, bool, float64, string]
+		value    any
+	}{
+		{NewEither4Arg1[int, bool, float64, string](42), 42},
+		{NewEither4Arg2[int, bool, float64, string](true), true},
+		{NewEither4Arg3[int, bool, float64, string](1.2), 1.2},
+		{NewEither4Arg4[int, bool, float64, string]("hello"), "hello"},
+	}
+	for id, tc := range cases {
+		data, err := tc.original.MarshalBinary()
+		if !is.NoError(err) {
+			continue
+		}
+		var payload bytes.Buffer
+		is.NoError(gob.NewEncoder(&payload).Encode(tc.value))
+		is.Equal(append([]byte{byte(id)}, payload.Bytes()...), data)
+		binary, err := tc.original.GobEncode()
+		is.NoError(err)
+		is.Equal(data, binary)
+		decoded := Either4[int, bool, float64, string]{arg1: 42, arg2: true, arg3: 1.2, arg4: "hello"}
+		is.NoError(decoded.UnmarshalBinary(data))
+		is.Equal(tc.original, decoded)
+		decoded = Either4[int, bool, float64, string]{arg1: 42, arg2: true, arg3: 1.2, arg4: "hello"}
+		is.NoError(decoded.GobDecode(data))
+		is.Equal(tc.original, decoded)
+		original := struct {
+			Value Either4[int, bool, float64, string]
+		}{tc.original}
+		var buf bytes.Buffer
+		is.NoError(gob.NewEncoder(&buf).Encode(original))
+		var restored struct {
+			Value Either4[int, bool, float64, string]
+		}
+		is.NoError(gob.NewDecoder(&buf).Decode(&restored))
+		is.Equal(original, restored)
+	}
+}
+
+// TestEither4BinaryErrors checks invalid input and gob encoding failures.
+func TestEither4BinaryErrors(t *testing.T) {
+	is := assert.New(t)
+	var decoded Either4[int, bool, float64, string]
+	for _, data := range [][]byte{nil, {}, {byte(4)}, {255}, {0}, {0, 255}} {
+		is.Error(decoded.UnmarshalBinary(data))
+		is.Error(decoded.GobDecode(data))
+	}
+	invalid := Either4[int, bool, float64, string]{argId: -1}
+	_, err := invalid.MarshalBinary()
+	is.Error(err)
+	unsupported := NewEither4Arg1[func(), bool, float64, string](func() {})
+	_, err = unsupported.MarshalBinary()
+	is.Error(err)
+}
diff --git a/either5.go b/either5.go
index 7fca738..ac7fdb1 100644
--- a/either5.go
+++ b/either5.go
@@ -1,6 +1,10 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"fmt"
+)
 
 const (
 	either5ArgId1 = iota
@@ -345,3 +349,67 @@ func (e Either5[T1, T2, T3, T4, T5]) MapArg5(mapper func(T5) Either5[T1, T2, T3,
 
 	return e
 }
+
+// MarshalBinary encodes Either5 into binary form.
+func (e Either5[T1, T2, T3, T4, T5]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either5ArgId1:
+		err = enc.Encode(e.arg1)
+	case either5ArgId2:
+		err = enc.Encode(e.arg2)
+	case either5ArgId3:
+		err = enc.Encode(e.arg3)
+	case either5ArgId4:
+		err = enc.Encode(e.arg4)
+	case either5ArgId5:
+		err = enc.Encode(e.arg5)
+	default:
+		return []byte{}, errEither5InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either5 from binary form.
+func (e *Either5[T1, T2, T3, T4, T5]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return fmt.Errorf("Either5[T1, T2, T3, T4, T5].UnmarshalBinary: no data")
+	}
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	decoded := Either5[T1, T2, T3, T4, T5]{argId: int8(data[0])}
+	var err error
+	switch data[0] {
+	case either5ArgId1:
+		err = dec.Decode(&decoded.arg1)
+	case either5ArgId2:
+		err = dec.Decode(&decoded.arg2)
+	case either5ArgId3:
+		err = dec.Decode(&decoded.arg3)
+	case either5ArgId4:
+		err = dec.Decode(&decoded.arg4)
+	case either5ArgId5:
+		err = dec.Decode(&decoded.arg5)
+	default:
+		return errEither5InvalidArgumentId
+	}
+	if err != nil {
+		return err
+	}
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either5[T1, T2, T3, T4, T5]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either5[T1, T2, T3, T4, T5]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either5_test.go b/either5_test.go
index 754f141..b2bb494 100644
--- a/either5_test.go
+++ b/either5_test.go
@@ -1,6 +1,8 @@
 package mo
 
 import (
+	"bytes"
+	"encoding/gob"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -645,3 +647,62 @@ func TestEither5MapArg(t *testing.T) {
 	})
 	is.Equal(NewEither5Arg5[int, bool, float64, string, byte](10), result5_5)
 }
+
+// TestEither5Binary checks the binary format and gob round trips for every side.
+func TestEither5Binary(t *testing.T) {
+	is := assert.New(t)
+	cases := []struct {
+		original Either5[int, bool, float64, string, byte]
+		value    any
+	}{
+		{NewEither5Arg1[int, bool, float64, string, byte](42), 42},
+		{NewEither5Arg2[int, bool, float64, string, byte](true), true},
+		{NewEither5Arg3[int, bool, float64, string, byte](1.2), 1.2},
+		{NewEither5Arg4[int, bool, float64, string, byte]("hello"), "hello"},
+		{NewEither5Arg5[int, bool, float64, string, byte](byte(5)), byte(5)},
+	}
+	for id, tc := range cases {
+		data, err := tc.original.MarshalBinary()
+		if !is.NoError(err) {
+			continue
+		}
+		var payload bytes.Buffer
+		is.NoError(gob.NewEncoder(&payload).Encode(tc.value))
+		is.Equal(append([]byte{byte(id)}, payload.Bytes()...), data)
+		binary, err := tc.original.GobEncode()
+		is.NoError(err)
+		is.Equal(data, binary)
+		decoded := Either5[int, bool, float64, string, byte]{arg1: 42, arg2: true, arg3: 1.2, arg4: "hello", arg5: byte(5)}
+		is.NoError(decoded.UnmarshalBinary(data))
+		is.Equal(tc.original, decoded)
+		decoded = Either5[int, bool, float64, string, byte]{arg1: 42, arg2: true, arg3: 1.2, arg4: "hello", arg5: byte(5)}
+		is.NoError(decoded.GobDecode(data))
+		is.Equal(tc.original, decoded)
+		original := struct {
+			Value Either5[int, bool, float64, string, byte]
+		}{tc.original}
+		var buf bytes.Buffer
+		is.NoError(gob.NewEncoder(&buf).Encode(original))
+		var restored struct {
+			Value Either5[int, bool, float64, string, byte]
+		}
+		is.NoError(gob.NewDecoder(&buf).Decode(&restored))
+		is.Equal(original, restored)
+	}
+}
+
+// TestEither5BinaryErrors checks invalid input and gob encoding failures.
+func TestEither5BinaryErrors(t *testing.T) {
+	is := assert.New(t)
+	var decoded Either5[int, bool, float64, string, byte]
+	for _, data := range [][]byte{nil, {}, {byte(5)}, {255}, {0}, {0, 255}} {
+		is.Error(decoded.UnmarshalBinary(data))
+		is.Error(decoded.GobDecode(data))
+	}
+	invalid := Either5[int, bool, float64, string, byte]{argId: -1}
+	_, err := invalid.MarshalBinary()
+	is.Error(err)
+	unsupported := NewEither5Arg1[func(), bool, float64, string, byte](func() {})
+	_, err = unsupported.MarshalBinary()
+	is.Error(err)
+}
```

</details>

<details><summary>reply</summary>

I’ll check `Either`’s implementation and tests, then use the same pattern for `Either3`, `Either4`, and `Either5`.

I’ll decode into a fresh value so successful decoding clears any old values on the other sides. Tests will cover every side, the byte format, gob encoding inside a struct, and invalid input.

Added all four serialization methods to `Either3`, `Either4`, and `Either5`.

Tests cover every side, exact byte format, clearing inactive sides, gob round trips inside structs, and invalid input.

Passed: `go build ./... && go test ./...`.

Left out unrequested options and dependencies. Race tests were not run.

</details>

### codex, all: pass

Files: [either3.go](../all/codex/go-mo-either-binary-1/files/either3.go), [either3_test.go](../all/codex/go-mo-either-binary-1/files/either3_test.go), [either4.go](../all/codex/go-mo-either-binary-1/files/either4.go), [either4_test.go](../all/codex/go-mo-either-binary-1/files/either4_test.go), [either5.go](../all/codex/go-mo-either-binary-1/files/either5.go), [either5_test.go](../all/codex/go-mo-either-binary-1/files/either5_test.go)

<details><summary>diff</summary>

```diff
diff --git a/either3.go b/either3.go
index 3c3e122..cbaa85e 100644
--- a/either3.go
+++ b/either3.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either3ArgId1 = iota
@@ -221,3 +226,63 @@ func (e Either3[T1, T2, T3]) MapArg3(mapper func(T3) Either3[T1, T2, T3]) Either
 
 	return e
 }
+
+// MarshalBinary encodes Either3 into binary form.
+func (e Either3[T1, T2, T3]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either3ArgId1:
+		err = enc.Encode(e.arg1)
+	case either3ArgId2:
+		err = enc.Encode(e.arg2)
+	case either3ArgId3:
+		err = enc.Encode(e.arg3)
+	default:
+		return []byte{}, errEither3InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either3 from binary form.
+func (e *Either3[T1, T2, T3]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either3[T1, T2, T3].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	var decoded Either3[T1, T2, T3]
+	decoded.argId = int8(data[0])
+	switch decoded.argId {
+	case either3ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+	case either3ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+	case either3ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+	default:
+		return errEither3InvalidArgumentId
+	}
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either3[T1, T2, T3]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either3[T1, T2, T3]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either3_test.go b/either3_test.go
index 10b84e1..07b2f76 100644
--- a/either3_test.go
+++ b/either3_test.go
@@ -1,6 +1,8 @@
 package mo
 
 import (
+	"bytes"
+	"encoding/gob"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -295,3 +297,61 @@ func TestEither3MapArg(t *testing.T) {
 	})
 	is.Equal(NewEither3Arg3[int, bool, float64](2.1), result3_3)
 }
+
+// TestEither3Binary verifies binary and gob serialization for every side.
+func TestEither3Binary(t *testing.T) {
+	is := assert.New(t)
+	originals := []Either3[int, string, bool]{
+		NewEither3Arg1[int, string, bool](42),
+		NewEither3Arg2[int, string, bool]("foobar"),
+		NewEither3Arg3[int, string, bool](true),
+	}
+	for id, original := range originals {
+		data, err := original.MarshalBinary()
+		if !is.NoError(err) {
+			continue
+		}
+		is.Equal(byte(id), data[0])
+		switch id {
+		case either3ArgId1:
+			var value int
+			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
+			is.Equal(original.arg1, value)
+		case either3ArgId2:
+			var value string
+			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
+			is.Equal(original.arg2, value)
+		case either3ArgId3:
+			var value bool
+			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
+			is.Equal(original.arg3, value)
+		}
+		decoded := Either3[int, string, bool]{arg1: 42, arg2: "foobar", arg3: true}
+		is.NoError(decoded.UnmarshalBinary(data))
+		is.Equal(original, decoded)
+		gobData, err := original.GobEncode()
+		is.NoError(err)
+		is.Equal(data, gobData)
+		is.NoError(decoded.GobDecode(gobData))
+		is.Equal(original, decoded)
+		holder := struct{ Value Either3[int, string, bool] }{Value: original}
+		var buf bytes.Buffer
+		is.NoError(gob.NewEncoder(&buf).Encode(holder))
+		var restored struct{ Value Either3[int, string, bool] }
+		is.NoError(gob.NewDecoder(&buf).Decode(&restored))
+		is.Equal(holder, restored)
+	}
+	var decoded Either3[int, string, bool]
+	for _, data := range [][]byte{nil, {}, {255}, {3}, {0}, {0, 255}} {
+		is.Error(decoded.UnmarshalBinary(data))
+		is.Error(decoded.GobDecode(data))
+	}
+	invalid := Either3[int, string, bool]{argId: -1}
+	_, err := invalid.MarshalBinary()
+	is.Error(err)
+	unsupported := NewEither3Arg1[func(), string, bool](func() {})
+	_, err = unsupported.MarshalBinary()
+	is.Error(err)
+	_, err = unsupported.GobEncode()
+	is.Error(err)
+}
diff --git a/either4.go b/either4.go
index 40d54cf..c61a02a 100644
--- a/either4.go
+++ b/either4.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either4ArgId1 = iota
@@ -283,3 +288,69 @@ func (e Either4[T1, T2, T3, T4]) MapArg4(mapper func(T4) Either4[T1, T2, T3, T4]
 
 	return e
 }
+
+// MarshalBinary encodes Either4 into binary form.
+func (e Either4[T1, T2, T3, T4]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either4ArgId1:
+		err = enc.Encode(e.arg1)
+	case either4ArgId2:
+		err = enc.Encode(e.arg2)
+	case either4ArgId3:
+		err = enc.Encode(e.arg3)
+	case either4ArgId4:
+		err = enc.Encode(e.arg4)
+	default:
+		return []byte{}, errEither4InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either4 from binary form.
+func (e *Either4[T1, T2, T3, T4]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either4[T1, T2, T3, T4].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	var decoded Either4[T1, T2, T3, T4]
+	decoded.argId = int8(data[0])
+	switch decoded.argId {
+	case either4ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+	case either4ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+	case either4ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+	case either4ArgId4:
+		if err := dec.Decode(&decoded.arg4); err != nil {
+			return err
+		}
+	default:
+		return errEither4InvalidArgumentId
+	}
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either4[T1, T2, T3, T4]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either4[T1, T2, T3, T4]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either4_test.go b/either4_test.go
index 4d5726b..8417d4f 100644
--- a/either4_test.go
+++ b/either4_test.go
@@ -1,6 +1,8 @@
 package mo
 
 import (
+	"bytes"
+	"encoding/gob"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -451,3 +453,70 @@ func TestEither4MapArg(t *testing.T) {
 	})
 	is.Equal(NewEither4Arg4[int, bool, float64, string]("Bye"), result4_4)
 }
+
+// TestEither4Binary verifies binary and gob serialization for every side.
+func TestEither4Binary(t *testing.T) {
+	is := assert.New(t)
+	originals := []Either4[int, string, bool, float64]{
+		NewEither4Arg1[int, string, bool, float64](42),
+		NewEither4Arg2[int, string, bool, float64]("foobar"),
+		NewEither4Arg3[int, string, bool, float64](true),
+		NewEither4Arg4[int, string, bool, float64](1.2),
+	}
+	for id, original := range originals {
+		data, err := original.MarshalBinary()
+		if !is.NoError(err) {
+			continue
+		}
+		is.Equal(byte(id), data[0])
+		switch id {
+		case either4ArgId1:
+			var value int
+			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
+			is.Equal(original.arg1, value)
+		case either4ArgId2:
+			var value string
+			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
+			is.Equal(original.arg2, value)
+		case either4ArgId3:
+			var value bool
+			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
+			is.Equal(original.arg3, value)
+		case either4ArgId4:
+			var value float64
+			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
+			is.Equal(original.arg4, value)
+		}
+		decoded := Either4[int, string, bool, float64]{arg1: 42, arg2: "foobar", arg3: true, arg4: 1.2}
+		is.NoError(decoded.UnmarshalBinary(data))
+		is.Equal(original, decoded)
+		gobData, err := original.GobEncode()
+		is.NoError(err)
+		is.Equal(data, gobData)
+		is.NoError(decoded.GobDecode(gobData))
+		is.Equal(original, decoded)
+		holder := struct {
+			Value Either4[int, string, bool, float64]
+		}{Value: original}
+		var buf bytes.Buffer
+		is.NoError(gob.NewEncoder(&buf).Encode(holder))
+		var restored struct {
+			Value Either4[int, string, bool, float64]
+		}
+		is.NoError(gob.NewDecoder(&buf).Decode(&restored))
+		is.Equal(holder, restored)
+	}
+	var decoded Either4[int, string, bool, float64]
+	for _, data := range [][]byte{nil, {}, {255}, {4}, {0}, {0, 255}} {
+		is.Error(decoded.UnmarshalBinary(data))
+		is.Error(decoded.GobDecode(data))
+	}
+	invalid := Either4[int, string, bool, float64]{argId: -1}
+	_, err := invalid.MarshalBinary()
+	is.Error(err)
+	unsupported := NewEither4Arg1[func(), string, bool, float64](func() {})
+	_, err = unsupported.MarshalBinary()
+	is.Error(err)
+	_, err = unsupported.GobEncode()
+	is.Error(err)
+}
diff --git a/either5.go b/either5.go
index 7fca738..19330aa 100644
--- a/either5.go
+++ b/either5.go
@@ -1,6 +1,11 @@
 package mo
 
-import "fmt"
+import (
+	"bytes"
+	"encoding/gob"
+	"errors"
+	"fmt"
+)
 
 const (
 	either5ArgId1 = iota
@@ -345,3 +350,75 @@ func (e Either5[T1, T2, T3, T4, T5]) MapArg5(mapper func(T5) Either5[T1, T2, T3,
 
 	return e
 }
+
+// MarshalBinary encodes Either5 into binary form.
+func (e Either5[T1, T2, T3, T4, T5]) MarshalBinary() ([]byte, error) {
+	var buf bytes.Buffer
+	enc := gob.NewEncoder(&buf)
+	var err error
+	switch e.argId {
+	case either5ArgId1:
+		err = enc.Encode(e.arg1)
+	case either5ArgId2:
+		err = enc.Encode(e.arg2)
+	case either5ArgId3:
+		err = enc.Encode(e.arg3)
+	case either5ArgId4:
+		err = enc.Encode(e.arg4)
+	case either5ArgId5:
+		err = enc.Encode(e.arg5)
+	default:
+		return []byte{}, errEither5InvalidArgumentId
+	}
+	if err != nil {
+		return []byte{}, err
+	}
+	return append([]byte{byte(e.argId)}, buf.Bytes()...), nil
+}
+
+// UnmarshalBinary decodes Either5 from binary form.
+func (e *Either5[T1, T2, T3, T4, T5]) UnmarshalBinary(data []byte) error {
+	if len(data) == 0 {
+		return errors.New("Either5[T1, T2, T3, T4, T5].UnmarshalBinary: no data")
+	}
+
+	dec := gob.NewDecoder(bytes.NewBuffer(data[1:]))
+	var decoded Either5[T1, T2, T3, T4, T5]
+	decoded.argId = int8(data[0])
+	switch decoded.argId {
+	case either5ArgId1:
+		if err := dec.Decode(&decoded.arg1); err != nil {
+			return err
+		}
+	case either5ArgId2:
+		if err := dec.Decode(&decoded.arg2); err != nil {
+			return err
+		}
+	case either5ArgId3:
+		if err := dec.Decode(&decoded.arg3); err != nil {
+			return err
+		}
+	case either5ArgId4:
+		if err := dec.Decode(&decoded.arg4); err != nil {
+			return err
+		}
+	case either5ArgId5:
+		if err := dec.Decode(&decoded.arg5); err != nil {
+			return err
+		}
+	default:
+		return errEither5InvalidArgumentId
+	}
+	*e = decoded
+	return nil
+}
+
+// GobEncode implements the gob.GobEncoder interface.
+func (e Either5[T1, T2, T3, T4, T5]) GobEncode() ([]byte, error) {
+	return e.MarshalBinary()
+}
+
+// GobDecode implements the gob.GobDecoder interface.
+func (e *Either5[T1, T2, T3, T4, T5]) GobDecode(data []byte) error {
+	return e.UnmarshalBinary(data)
+}
diff --git a/either5_test.go b/either5_test.go
index 754f141..b4c5b92 100644
--- a/either5_test.go
+++ b/either5_test.go
@@ -1,6 +1,8 @@
 package mo
 
 import (
+	"bytes"
+	"encoding/gob"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -645,3 +647,75 @@ func TestEither5MapArg(t *testing.T) {
 	})
 	is.Equal(NewEither5Arg5[int, bool, float64, string, byte](10), result5_5)
 }
+
+// TestEither5Binary verifies binary and gob serialization for every side.
+func TestEither5Binary(t *testing.T) {
+	is := assert.New(t)
+	originals := []Either5[int, string, bool, float64, []int]{
+		NewEither5Arg1[int, string, bool, float64, []int](42),
+		NewEither5Arg2[int, string, bool, float64, []int]("foobar"),
+		NewEither5Arg3[int, string, bool, float64, []int](true),
+		NewEither5Arg4[int, string, bool, float64, []int](1.2),
+		NewEither5Arg5[int, string, bool, float64, []int]([]int{1, 2}),
+	}
+	for id, original := range originals {
+		data, err := original.MarshalBinary()
+		if !is.NoError(err) {
+			continue
+		}
+		is.Equal(byte(id), data[0])
+		switch id {
+		case either5ArgId1:
+			var value int
+			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
+			is.Equal(original.arg1, value)
+		case either5ArgId2:
+			var value string
+			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
+			is.Equal(original.arg2, value)
+		case either5ArgId3:
+			var value bool
+			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
+			is.Equal(original.arg3, value)
+		case either5ArgId4:
+			var value float64
+			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
+			is.Equal(original.arg4, value)
+		case either5ArgId5:
+			var value []int
+			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
+			is.Equal(original.arg5, value)
+		}
+		decoded := Either5[int, string, bool, float64, []int]{arg1: 42, arg2: "foobar", arg3: true, arg4: 1.2, arg5: []int{1, 2}}
+		is.NoError(decoded.UnmarshalBinary(data))
+		is.Equal(original, decoded)
+		gobData, err := original.GobEncode()
+		is.NoError(err)
+		is.Equal(data, gobData)
+		is.NoError(decoded.GobDecode(gobData))
+		is.Equal(original, decoded)
+		holder := struct {
+			Value Either5[int, string, bool, float64, []int]
+		}{Value: original}
+		var buf bytes.Buffer
+		is.NoError(gob.NewEncoder(&buf).Encode(holder))
+		var restored struct {
+			Value Either5[int, string, bool, float64, []int]
+		}
+		is.NoError(gob.NewDecoder(&buf).Decode(&restored))
+		is.Equal(holder, restored)
+	}
+	var decoded Either5[int, string, bool, float64, []int]
+	for _, data := range [][]byte{nil, {}, {255}, {5}, {0}, {0, 255}} {
+		is.Error(decoded.UnmarshalBinary(data))
+		is.Error(decoded.GobDecode(data))
+	}
+	invalid := Either5[int, string, bool, float64, []int]{argId: -1}
+	_, err := invalid.MarshalBinary()
+	is.Error(err)
+	unsupported := NewEither5Arg1[func(), string, bool, float64, []int](func() {})
+	_, err = unsupported.MarshalBinary()
+	is.Error(err)
+	_, err = unsupported.GobEncode()
+	is.Error(err)
+}
```

</details>

<details><summary>reply</summary>

Done.
Added binary and gob serialization to `Either3`, `Either4`, `Either5`, with side restoration, zeroing, validation, and tests. `go build ./...` and `go test ./...` passed.

</details>
