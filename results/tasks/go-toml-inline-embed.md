# go-toml-inline-embed

Source: https://github.com/pelletier/go-toml/pull/1079

## Prompt

> Decoding broke in v2.4 for embedded structs with the `inline` annotation.
> 
> Since v2.4 (tested with v2.4.1), a struct using the `inline` annotation on an embedded struct is encoded properly but not decoded: the embedded fields remain at their default values. It worked with v2.3.
> 
> My structs:
> 
> ```go
> type Base struct {
> 	Region        string
> 	Name          string
> 	IPv4          string
> 	BsPort        int
> 	WebSocketPort int
> 	OutOfBandPort int
> }
> 
> type Config struct {
> 	Base  `toml:",inline"`
> 	PID   uint32
> 	index int `toml:"-"`
> }
> ```
> 
> Unmarshalling a document like
> 
> ```toml
> Region = "us"
> Name = "srv1"
> BsPort = 100
> PID = 42
> ```
> 
> into a `Config` sets `PID` but leaves `Region`, `Name` and `BsPort` empty.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [unmarshaler.go](../../tasks/go-toml-inline-embed/upstream/unmarshaler.go), [unmarshaler_test.go](../../tasks/go-toml-inline-embed/upstream/unmarshaler_test.go)

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..9817d5b 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2238,14 +2238,16 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 		f := t.Field(i)
 		tag, tagged := f.Tag.Lookup("toml")
 		name := f.Name
+		explicitName := ""
 		if tagged {
 			// A tag of exactly "-" drops the field. "-," names it "-".
 			if tag == "-" {
 				continue
 			}
 			parts := strings.SplitN(tag, ",", 2)
-			if parts[0] != "" {
-				name = parts[0]
+			explicitName = parts[0]
+			if explicitName != "" {
+				name = explicitName
 			}
 		}
 		if f.Anonymous {
@@ -2257,14 +2259,17 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
-				// type is unexported: only their own exported fields are
-				// reachable.
+			if explicitName == "" {
+				// Embedded structs without an explicit tag name are flattened,
+				// even when their type is unexported: only their own exported
+				// fields are reachable. A tag that only sets options (e.g.
+				// `,inline`) still flattens, matching encoding/json and the
+				// encoder's behavior.
 				embedded = append(embedded, f)
 				continue
 			}
-			// A tagged embedded struct acts as a regular named field.
+			// An embedded struct given an explicit tag name acts as a regular
+			// named field.
 		} else if f.PkgPath != "" {
 			// unexported
 			continue
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +6/-5 | 22 | 1,665 | $0.063 |
| claude | muffle | pass | +11/-4 | 22 | 2,042 | $0.076 |
| claude | hush | pass | +3/-3 | 19 | 1,284 | $0.048 |
| claude | sloth | pass | +5/-3 | 0 | 2,107 | $0.061 |
| claude | all | pass | +2/-2 | 0 | 2,585 | $0.093 |
| codex | base | pass | +7/-5 | 48 | 1,795 | - |
| codex | muffle | pass | +5/-5 | 54 | 1,584 | - |
| codex | hush | pass | +3/-3 | 38 | 1,231 | - |
| codex | sloth | pass | +3/-3 | 0 | 975 | - |
| codex | all | pass | +3/-3 | 0 | 1,155 | - |

### claude, base: pass

Files: [unmarshaler.go](../base/claude/go-toml-inline-embed-1/files/unmarshaler.go), [unmarshaler_test.go](../base/claude/go-toml-inline-embed-1/files/unmarshaler_test.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..c74dd09 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2257,14 +2257,15 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
-				// type is unexported: only their own exported fields are
-				// reachable.
+			if !tagged || tagName(tag) == "" {
+				// Embedded structs without a tagged name (including ones
+				// carrying only options such as ",inline") are flattened,
+				// even when their type is unexported: only their own
+				// exported fields are reachable.
 				embedded = append(embedded, f)
 				continue
 			}
-			// A tagged embedded struct acts as a regular named field.
+			// An embedded struct with a tagged name acts as a regular named field.
 		} else if f.PkgPath != "" {
 			// unexported
 			continue
diff --git a/unmarshaler_test.go b/unmarshaler_test.go
index fbefca8..1ece3f6 100644
--- a/unmarshaler_test.go
+++ b/unmarshaler_test.go
@@ -5603,3 +5603,25 @@ e = 1
 	assert.NoError(t, toml.Unmarshal([]byte(doc), &m))
 	assert.Equal(t, 1, len(m["a"].([]interface{}))-1)
 }
+
+func TestUnmarshalEmbeddedStructInlineTag(t *testing.T) {
+	type Base struct {
+		Region string
+		Name   string
+		BsPort int
+	}
+	type Config struct {
+		Base  `toml:",inline"`
+		PID   uint32
+		index int `toml:"-"`
+	}
+	var c Config
+	err := toml.Unmarshal([]byte("Region = \"us\"\nName = \"srv1\"\nBsPort = 100\nPID = 42\n"), &c)
+	if err != nil {
+		t.Fatal(err)
+	}
+	want := Config{Base: Base{Region: "us", Name: "srv1", BsPort: 100}, PID: 42}
+	if c != want {
+		t.Fatalf("got %+v, want %+v", c, want)
+	}
+}
```

</details>

<details><summary>reply</summary>

Encoder flattens when the tag has no name; make the decoder match.

Fixed: embedded structs tagged `toml:",inline"` now decode into the embedded fields again. `Region`, `Name` and `BsPort` from your example are populated, and the full test suite passes. I haven't committed anything.

**Cause:** the decoder's field planner (`addFields` in `unmarshaler.go`) only flattened embedded structs that had no `toml` tag at all. Any tag, even `",inline"` with no name, made it treat the embedded struct as a regular field named `Base`. The encoder already flattens an embedded struct whenever its tag has no name, which is why encoding worked and decoding didn't.

**Fix:** the decoder now uses the same rule as the encoder. An embedded struct is flattened unless its tag gives it a name (for example `toml:"base"`), in which case it still maps to a table of that name.

**Test:** I added `TestUnmarshalEmbeddedStructInlineTag` to `unmarshaler_test.go`, using a trimmed copy of your `Base`/`Config` structs and TOML document.

</details>

### claude, muffle: pass

Files: [unmarshaler.go](../muffle/claude/go-toml-inline-embed-1/files/unmarshaler.go), [unmarshaler_test.go](../muffle/claude/go-toml-inline-embed-1/files/unmarshaler_test.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..cc5a5f5 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2232,6 +2232,12 @@ func buildPlan(t reflect.Type) *structPlan {
 	return plan
 }
 
+// parts0 returns the name part of a toml struct tag.
+func parts0(tag string) string {
+	name, _, _ := strings.Cut(tag, ",")
+	return name
+}
+
 func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 	var embedded []reflect.StructField
 	for i := 0; i < t.NumField(); i++ {
@@ -2257,10 +2263,11 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
-				// type is unexported: only their own exported fields are
-				// reachable.
+			if !tagged || parts0(tag) == "" {
+				// Embedded structs without a tag name (untagged, or with
+				// only options such as ",inline") are flattened, even when
+				// their type is unexported: only their own exported fields
+				// are reachable. This mirrors the encoder.
 				embedded = append(embedded, f)
 				continue
 			}
diff --git a/unmarshaler_test.go b/unmarshaler_test.go
index fbefca8..ed32381 100644
--- a/unmarshaler_test.go
+++ b/unmarshaler_test.go
@@ -5603,3 +5603,25 @@ e = 1
 	assert.NoError(t, toml.Unmarshal([]byte(doc), &m))
 	assert.Equal(t, 1, len(m["a"].([]interface{}))-1)
 }
+
+func TestUnmarshalEmbeddedInlineTag(t *testing.T) {
+	type Base struct {
+		Region string
+		Name   string
+		BsPort int
+	}
+	type Config struct {
+		Base  `toml:",inline"`
+		PID   uint32
+		index int `toml:"-"`
+	}
+	var c Config
+	err := toml.Unmarshal([]byte("Region = \"us\"\nName = \"srv1\"\nBsPort = 100\nPID = 42\n"), &c)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if c.Region != "us" || c.Name != "srv1" || c.BsPort != 100 || c.PID != 42 {
+		t.Fatalf("unexpected result: %+v", c)
+	}
+	_ = c.index
+}
```

</details>

<details><summary>reply</summary>

The encoder flattens an embedded struct when the tag has no name. The decoder flattens it only when there's no tag at all. I'll make the decoder use the same rule.

Now I'll add a test and run the suite.

The test file is in package `toml_test`, so my test needs the `toml.` prefix.

Decoding into an embedded struct tagged `toml:",inline"` now fills the embedded fields again. The full test suite passes.

The encoder already flattened an embedded struct when its tag has no name, such as `toml:",inline"`. The decoder only flattened it when it had no tag at all. With a tag, it treated the struct as a nested table called `Base`. Your flat keys like `Region` and `Name` then matched nothing and were silently dropped.

The decoder now uses the same rule as the encoder. I changed `addFields` in `unmarshaler.go` and added a small helper, `parts0`, which returns the name part of a tag.

An embedded struct with a named tag, such as `toml:"base"`, still decodes as a regular nested table.

I added `TestUnmarshalEmbeddedInlineTag` to `unmarshaler_test.go`, using your `Config` shape. I haven't committed anything.

</details>

### claude, hush: pass

Files: [unmarshaler.go](../hush/claude/go-toml-inline-embed-1/files/unmarshaler.go), [unmarshaler_test.go](../hush/claude/go-toml-inline-embed-1/files/unmarshaler_test.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..9ca6fad 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2257,14 +2257,14 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
+			if !tagged || name == f.Name && strings.SplitN(tag, ",", 2)[0] == "" {
+				// Embedded structs without a tag name are flattened, even when their
 				// type is unexported: only their own exported fields are
 				// reachable.
 				embedded = append(embedded, f)
 				continue
 			}
-			// A tagged embedded struct acts as a regular named field.
+			// An embedded struct with a tag name acts as a regular named field.
 		} else if f.PkgPath != "" {
 			// unexported
 			continue
diff --git a/unmarshaler_test.go b/unmarshaler_test.go
index fbefca8..5f6572c 100644
--- a/unmarshaler_test.go
+++ b/unmarshaler_test.go
@@ -5603,3 +5603,22 @@ e = 1
 	assert.NoError(t, toml.Unmarshal([]byte(doc), &m))
 	assert.Equal(t, 1, len(m["a"].([]interface{}))-1)
 }
+
+func TestUnmarshalEmbeddedInlineTag(t *testing.T) {
+	type Base struct {
+		Region string
+		BsPort int
+	}
+	type Config struct {
+		Base `toml:",inline"`
+		PID  uint32
+	}
+	var c Config
+	err := toml.Unmarshal([]byte("Region = \"us\"\nBsPort = 100\nPID = 42\n"), &c)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if c.Region != "us" || c.BsPort != 100 || c.PID != 42 {
+		t.Fatalf("got %+v", c)
+	}
+}
```

</details>

<details><summary>reply</summary>

Match encoder: flatten when no tag name.

Done. `addFields` in `unmarshaler.go` now flattens embedded structs whose tag has no name, such as `toml:",inline"`. This matches the encoder. I added `TestUnmarshalEmbeddedInlineTag`, and `go test ./...` passes.

</details>

### claude, sloth: pass

Files: [unmarshaler.go](../sloth/claude/go-toml-inline-embed-1/files/unmarshaler.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..234ec58 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2238,6 +2238,7 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 		f := t.Field(i)
 		tag, tagged := f.Tag.Lookup("toml")
 		name := f.Name
+		renamed := false
 		if tagged {
 			// A tag of exactly "-" drops the field. "-," names it "-".
 			if tag == "-" {
@@ -2246,6 +2247,7 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 			parts := strings.SplitN(tag, ",", 2)
 			if parts[0] != "" {
 				name = parts[0]
+				renamed = true
 			}
 		}
 		if f.Anonymous {
@@ -2257,14 +2259,14 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
+			if !renamed {
+				// Embedded structs without a tag name are flattened, even when their
 				// type is unexported: only their own exported fields are
 				// reachable.
 				embedded = append(embedded, f)
 				continue
 			}
-			// A tagged embedded struct acts as a regular named field.
+			// An embedded struct with a tag name acts as a regular named field.
 		} else if f.PkgPath != "" {
 			// unexported
 			continue
```

</details>

<details><summary>reply</summary>

I fixed the decoding of embedded structs tagged `toml:",inline"`. Your `Config` now decodes `Region`, `Name` and `BsPort` along with `PID`.

**Cause:** in `addFields` in `unmarshaler.go`, any embedded struct with a `toml` tag was treated as a regular field named `Base`. A tag like `",inline"` has an empty name part, so the embedded fields were never flattened into the parent.

**Fix:** an embedded struct is now flattened unless the tag gives it an explicit name. `toml:"base"` still makes it a named field. The change is only in `unmarshaler.go`.

**Testing:**
- A throwaway test with your struct shape passed: `Region`, `BsPort` and `PID` were all populated.
- I deleted that test afterwards, so no regression test is in the repo. I can add a permanent one if you want.
- `go test ./...` passes.
- I haven't committed anything.

</details>

### claude, all: pass

Files: [unmarshaler.go](../all/claude/go-toml-inline-embed-1/files/unmarshaler.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..a59170a 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2257,8 +2257,8 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
+			if !tagged || strings.HasPrefix(tag, ",") {
+				// Untagged embedded structs, or tagged with options but no name, are flattened, even when their
 				// type is unexported: only their own exported fields are
 				// reachable.
 				embedded = append(embedded, f)
```

</details>

<details><summary>reply</summary>

Encoder flattens when tag name empty. Match in decoder.

Three tabs, not four.

Done. In `unmarshaler.go` (`addFields`), an embedded struct whose tag has options but no name (`toml:",inline"`) is now flattened, which matches the encoder. A throwaway test with your `Config` shape passed, along with the existing root-package tests. I then deleted it, so no test was added. I didn't re-run the full `./...` suite after the fix.

</details>

### codex, base: pass

Files: [unmarshaler.go](../base/codex/go-toml-inline-embed-1/files/unmarshaler.go), [unmarshaler_test.go](../base/codex/go-toml-inline-embed-1/files/unmarshaler_test.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..8566895 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2237,6 +2237,7 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 	for i := 0; i < t.NumField(); i++ {
 		f := t.Field(i)
 		tag, tagged := f.Tag.Lookup("toml")
+		named := false
 		name := f.Name
 		if tagged {
 			// A tag of exactly "-" drops the field. "-," names it "-".
@@ -2246,6 +2247,7 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 			parts := strings.SplitN(tag, ",", 2)
 			if parts[0] != "" {
 				name = parts[0]
+				named = true
 			}
 		}
 		if f.Anonymous {
@@ -2257,14 +2259,14 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
-				// type is unexported: only their own exported fields are
-				// reachable.
+			if !named {
+				// Embedded structs without an explicit name are flattened,
+				// even when their type is unexported: only their own exported
+				// fields are reachable.
 				embedded = append(embedded, f)
 				continue
 			}
-			// A tagged embedded struct acts as a regular named field.
+			// An explicitly named embedded struct acts as a regular named field.
 		} else if f.PkgPath != "" {
 			// unexported
 			continue
diff --git a/unmarshaler_test.go b/unmarshaler_test.go
index fbefca8..4825642 100644
--- a/unmarshaler_test.go
+++ b/unmarshaler_test.go
@@ -5603,3 +5603,51 @@ e = 1
 	assert.NoError(t, toml.Unmarshal([]byte(doc), &m))
 	assert.Equal(t, 1, len(m["a"].([]interface{}))-1)
 }
+
+func TestUnmarshalEmbeddedStructTags(t *testing.T) {
+	type Base struct {
+		Region string
+		Name   string
+		BsPort int
+	}
+	type Config struct {
+		Base  `toml:",inline"`
+		PID   uint32
+		index int `toml:"-"`
+	}
+	type PointerConfig struct {
+		*Base `toml:",inline"`
+		PID   uint32
+	}
+	type EmptyTagConfig struct {
+		Base `toml:""`
+		PID  uint32
+	}
+	type NamedConfig struct {
+		Base `toml:"base,inline"`
+		PID  uint32
+	}
+	type IgnoredConfig struct {
+		Base `toml:"-"`
+		PID  uint32
+	}
+	base := Base{Region: "us", Name: "srv1", BsPort: 100}
+	const doc = "Region = \"us\"\nName = \"srv1\"\nBsPort = 100\nPID = 42\n"
+	for _, tt := range []struct {
+		name string
+		doc  string
+		got  interface{}
+		want interface{}
+	}{
+		{"inline", doc, &Config{}, &Config{Base: base, PID: 42}},
+		{"inline pointer", doc, &PointerConfig{}, &PointerConfig{Base: &base, PID: 42}},
+		{"empty tag", doc, &EmptyTagConfig{}, &EmptyTagConfig{Base: base, PID: 42}},
+		{"explicit name", "PID = 42\n[base]\nRegion = \"us\"\nName = \"srv1\"\nBsPort = 100\n", &NamedConfig{}, &NamedConfig{Base: base, PID: 42}},
+		{"ignored", doc, &IgnoredConfig{}, &IgnoredConfig{PID: 42}},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.NoError(t, toml.Unmarshal([]byte(tt.doc), tt.got))
+			assert.Equal(t, tt.want, tt.got)
+		})
+	}
+}
```

</details>

<details><summary>reply</summary>

I’ll trace how the decoder handles embedded fields, fix the regression, and run the relevant tests.

The decoder treats any TOML tag on an embedded struct as a field name, so `toml:",inline"` prevents its fields from being promoted. I’ll make promotion depend on whether the tag supplies a name and add regression tests for value and pointer embeddings.

Fixed the decoder to flatten embedded structs when their TOML tag has no explicit name, including `toml:",inline"`.

Added regression tests covering value and pointer embeddings, empty tags, named fields, and ignored fields.

Validation: `go test -race ./...` passed.

</details>

### codex, muffle: pass

Files: [unmarshaler.go](../muffle/codex/go-toml-inline-embed-1/files/unmarshaler.go), [unmarshaler_test.go](../muffle/codex/go-toml-inline-embed-1/files/unmarshaler_test.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..94098a3 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2257,14 +2257,14 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
-				// type is unexported: only their own exported fields are
-				// reachable.
+			if !tagged || tagName(tag) == "" {
+				// Embedded structs without an explicit name are flattened,
+				// even when their type is unexported: only their own
+				// exported fields are reachable.
 				embedded = append(embedded, f)
 				continue
 			}
-			// A tagged embedded struct acts as a regular named field.
+			// An explicitly named embedded struct acts as a regular field.
 		} else if f.PkgPath != "" {
 			// unexported
 			continue
diff --git a/unmarshaler_test.go b/unmarshaler_test.go
index fbefca8..64b3402 100644
--- a/unmarshaler_test.go
+++ b/unmarshaler_test.go
@@ -16,6 +16,60 @@ import (
 	"github.com/pelletier/go-toml/v2/unstable"
 )
 
+func TestUnmarshalEmbeddedStructWithoutTagName(t *testing.T) {
+	type Base struct {
+		Region string
+		Name   string
+		BsPort int
+	}
+	base := Base{Region: "us", Name: "srv1", BsPort: 100}
+	const document = "Region = 'us'\nName = 'srv1'\nBsPort = 100\nPID = 42\n"
+	for _, tt := range []struct {
+		name string
+		new  func() any
+		want any
+	}{
+		{"inline", func() any {
+			return &struct {
+				Base  `toml:",inline"`
+				PID   uint32
+				index int `toml:"-"`
+			}{}
+		}, &struct {
+			Base  `toml:",inline"`
+			PID   uint32
+			index int `toml:"-"`
+		}{Base: base, PID: 42}},
+		{"pointer", func() any {
+			return &struct {
+				*Base `toml:",inline"`
+				PID   uint32
+			}{}
+		}, &struct {
+			*Base `toml:",inline"`
+			PID   uint32
+		}{Base: &base, PID: 42}},
+		{"empty tag", func() any {
+			return &struct {
+				Base `toml:""`
+				PID  uint32
+			}{}
+		}, &struct {
+			Base `toml:""`
+			PID  uint32
+		}{Base: base, PID: 42}},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			got := tt.new()
+			assert.NoError(t, toml.Unmarshal([]byte(document), got))
+			assert.Equal(t, tt.want, got)
+			got = tt.new()
+			assert.NoError(t, toml.NewDecoder(strings.NewReader(document)).DisallowUnknownFields().Decode(got))
+			assert.Equal(t, tt.want, got)
+		})
+	}
+}
+
 type unmarshalTextKey struct {
 	A string
 	B string
```

</details>

<details><summary>reply</summary>

I’ll check how the decoder handles embedded fields, add a regression test, and fix the lookup.

The decoder treats any `toml` tag as a field name, so `toml:",inline"` prevents the embedded fields from being flattened. The regression tests reproduce this for both value and pointer embeddings. I’ll make the decoder match the encoder: flatten an embedded struct when its tag has no explicit name.

Fixed the decoder to flatten embedded structs when the `toml` tag has no explicit field name, including `toml:",inline"`.

Added regression tests for value embeddings, pointer embeddings, empty tags, and strict decoding. Confirmed they failed before the fix.

All tests pass with `go test ./...`.

</details>

### codex, hush: pass

Files: [unmarshaler.go](../hush/codex/go-toml-inline-embed-1/files/unmarshaler.go), [unmarshaler_test.go](../hush/codex/go-toml-inline-embed-1/files/unmarshaler_test.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..bb276a5 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2257,14 +2257,14 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
+			if !tagged || tagName(tag) == "" {
+				// Embedded structs without an explicit name are flattened, even when their
 				// type is unexported: only their own exported fields are
 				// reachable.
 				embedded = append(embedded, f)
 				continue
 			}
-			// A tagged embedded struct acts as a regular named field.
+			// An explicitly named embedded struct acts as a regular named field.
 		} else if f.PkgPath != "" {
 			// unexported
 			continue
diff --git a/unmarshaler_test.go b/unmarshaler_test.go
index fbefca8..59c0633 100644
--- a/unmarshaler_test.go
+++ b/unmarshaler_test.go
@@ -3942,6 +3942,44 @@ func TestOmitEmpty(t *testing.T) {
 	assert.Equal(t, "X = [{Foo = 'test', Inner = {V = 'alue'}}]\n", string(b))
 }
 
+func TestUnmarshalEmbeddedInline(t *testing.T) {
+	type Base struct {
+		Region string
+		Name   string
+		BsPort int
+	}
+	type Config struct {
+		Base  `toml:",inline"`
+		PID   uint32
+		index int `toml:"-"`
+	}
+	type PointerConfig struct {
+		*Base `toml:",inline"`
+		PID   uint32
+	}
+	const doc = "Region = \"us\"\nName = \"srv1\"\nBsPort = 100\nPID = 42\n"
+	want := Base{Region: "us", Name: "srv1", BsPort: 100}
+	t.Run("value", func(t *testing.T) {
+		var got Config
+		err := toml.NewDecoder(strings.NewReader(doc)).DisallowUnknownFields().Decode(&got)
+		if err != nil {
+			t.Fatal(err)
+		}
+		if got.Base != want || got.PID != 42 || got.index != 0 {
+			t.Fatalf("unexpected config: %+v", got)
+		}
+	})
+	t.Run("pointer", func(t *testing.T) {
+		var got PointerConfig
+		if err := toml.Unmarshal([]byte(doc), &got); err != nil {
+			t.Fatal(err)
+		}
+		if got.Base == nil || *got.Base != want || got.PID != 42 {
+			t.Fatalf("unexpected config: %+v", got)
+		}
+	})
+}
+
 func TestUnmarshalTags(t *testing.T) {
 	type doc struct {
 		Dash   string `toml:"-,"`
```

</details>

<details><summary>reply</summary>

Embedded `inline` decoding regression. Checking field lookup and tests.


Done.
Fixed embedded `inline` decoding for structs and pointers. Added regression tests. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [unmarshaler.go](../sloth/codex/go-toml-inline-embed-1/files/unmarshaler.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..f1f7d73 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2257,14 +2257,14 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
+			if !tagged || tagName(tag) == "" {
+				// Embedded structs without a tag name are flattened, even when their
 				// type is unexported: only their own exported fields are
 				// reachable.
 				embedded = append(embedded, f)
 				continue
 			}
-			// A tagged embedded struct acts as a regular named field.
+			// An embedded struct with a tag name acts as a regular named field.
 		} else if f.PkgPath != "" {
 			// unexported
 			continue
```

</details>

<details><summary>reply</summary>

I’ll trace how decoding handles embedded fields, fix the regression, and run the build and existing tests.

The decoder treats any TOML tag as a field name, so `toml:",inline"` prevents the embedded struct from being flattened. The encoder already handles this correctly by checking whether the tag has a name.

The fix belongs in the shared decoder field mapping, which serves all three decoding paths. No caller, fixture, config, or export changes are needed. Named tags and ignored fields will keep their current behavior.

Fixed in [unmarshaler.go](/home/jdaddy/.cache/muffle-evals/runs/sloth/codex/go-toml-inline-embed-1/work/unmarshaler.go:2260). Embedded structs with unnamed tags such as `toml:",inline"` now decode their promoted fields correctly, matching encoder behavior.

`go build ./...` and all existing tests pass.

</details>

### codex, all: pass

Files: [unmarshaler.go](../all/codex/go-toml-inline-embed-1/files/unmarshaler.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..bb276a5 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2257,14 +2257,14 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
+			if !tagged || tagName(tag) == "" {
+				// Embedded structs without an explicit name are flattened, even when their
 				// type is unexported: only their own exported fields are
 				// reachable.
 				embedded = append(embedded, f)
 				continue
 			}
-			// A tagged embedded struct acts as a regular named field.
+			// An explicitly named embedded struct acts as a regular named field.
 		} else if f.PkgPath != "" {
 			// unexported
 			continue
```

</details>

<details><summary>reply</summary>

Done.
Embedded structs with unnamed `toml:",inline"` tags now decode flattened fields. `go build ./...` and existing tests pass.

</details>
