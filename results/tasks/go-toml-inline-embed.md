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
| claude | muffle | pass | +3/-2 | 22 | 1,996 | $0.090 |
| claude | hush | pass | +10/-3 | 22 | 2,267 | $0.096 |
| claude | sloth | pass | +6/-5 | 17 | 2,049 | $0.069 |
| claude | all | pass | +5/-3 | 25 | 2,184 | $0.096 |
| codex | base | pass | +7/-5 | 48 | 1,795 | - |
| codex | muffle | pass | +5/-5 | 40 | 1,601 | - |
| codex | hush | pass | +3/-3 | 49 | 1,511 | - |
| codex | sloth | pass | +5/-3 | 58 | 2,123 | - |
| codex | all | pass | +2/-1 | 59 | 1,847 | - |

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
index d497669..59117a4 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2257,8 +2257,9 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
+			if !tagged || tagName(tag) == "" {
+				// Embedded structs without a tag name (untagged, or only
+				// options such as ",inline") are flattened, even when their
 				// type is unexported: only their own exported fields are
 				// reachable.
 				embedded = append(embedded, f)
diff --git a/unmarshaler_test.go b/unmarshaler_test.go
index fbefca8..2175a0f 100644
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
+	want := Config{Base: Base{Region: "us", Name: "srv1", BsPort: 100}, PID: 42}
+	if c != want {
+		t.Fatalf("got %+v, want %+v", c, want)
+	}
+}
```

</details>

<details><summary>reply</summary>

The encoder flattens when the tag has no name; the decoder should match.

Test file uses an external package; fix the qualifier.

Decoding now fills the embedded fields. Your `Config` example gets `Region`, `Name` and `BsPort` as well as `PID`, and the full test suite passes.

The decoder treated any embedded struct with a `toml` tag as a regular named field, so `toml:",inline"` made it look for a `Base` table. The encoder already flattens an embedded struct when the tag has no name, which is why encoding worked. I made the decoder follow the same rule in `addFields` in `unmarshaler.go`. Embedded structs with an explicit name, like `toml:"base"`, still decode as named tables.

I added `TestUnmarshalEmbeddedInlineTag` to `unmarshaler_test.go`, using your struct shape. I haven't committed anything.

</details>

### claude, hush: pass

Files: [unmarshaler.go](../hush/claude/go-toml-inline-embed-1/files/unmarshaler.go), [unmarshaler_test.go](../hush/claude/go-toml-inline-embed-1/files/unmarshaler_test.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..1ae9a32 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2232,6 +2232,12 @@ func buildPlan(t reflect.Type) *structPlan {
 	return plan
 }
 
+// parts0 returns the name part of a toml tag.
+func parts0(tag string) string {
+	name, _, _ := strings.Cut(tag, ",")
+	return name
+}
+
 func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 	var embedded []reflect.StructField
 	for i := 0; i < t.NumField(); i++ {
@@ -2257,14 +2263,15 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
+			if !tagged || parts0(tag) == "" {
+				// Embedded structs without a tag name (including options-only
+				// tags such as ",inline") are flattened, even when their
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
index fbefca8..4c34972 100644
--- a/unmarshaler_test.go
+++ b/unmarshaler_test.go
@@ -5603,3 +5603,25 @@ e = 1
 	assert.NoError(t, toml.Unmarshal([]byte(doc), &m))
 	assert.Equal(t, 1, len(m["a"].([]interface{}))-1)
 }
+
+type inlineEmbeddedBase struct {
+	Region string
+	Name   string
+	BsPort int
+}
+
+type inlineEmbeddedConfig struct {
+	inlineEmbeddedBase `toml:",inline"`
+	PID                uint32
+}
+
+func TestUnmarshalInlineEmbeddedStruct(t *testing.T) {
+	var c inlineEmbeddedConfig
+	err := toml.Unmarshal([]byte("Region = \"us\"\nName = \"srv1\"\nBsPort = 100\nPID = 42\n"), &c)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if c.Region != "us" || c.Name != "srv1" || c.BsPort != 100 || c.PID != 42 {
+		t.Fatalf("unexpected result: %+v", c)
+	}
+}
```

</details>

<details><summary>reply</summary>

Fix passes the full suite. Now tidying the test into `unmarshaler_test.go`.

Done. `addFields` in `unmarshaler.go` now flattens embedded structs whose tag has no name, such as `toml:",inline"`. This matches the encoder. I added `TestUnmarshalInlineEmbeddedStruct`, and the full suite passes. Nothing committed.

</details>

### claude, sloth: pass

Files: [unmarshaler.go](../sloth/claude/go-toml-inline-embed-1/files/unmarshaler.go), [unmarshaler_test.go](../sloth/claude/go-toml-inline-embed-1/files/unmarshaler_test.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..03ad064 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2238,12 +2238,13 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 		f := t.Field(i)
 		tag, tagged := f.Tag.Lookup("toml")
 		name := f.Name
+		var parts []string
 		if tagged {
 			// A tag of exactly "-" drops the field. "-," names it "-".
 			if tag == "-" {
 				continue
 			}
-			parts := strings.SplitN(tag, ",", 2)
+			parts = strings.SplitN(tag, ",", 2)
 			if parts[0] != "" {
 				name = parts[0]
 			}
@@ -2257,10 +2258,10 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
-				// type is unexported: only their own exported fields are
-				// reachable.
+			if !tagged || parts[0] == "" {
+				// Embedded structs without a tag name are flattened, even
+				// when their type is unexported: only their own exported
+				// fields are reachable.
 				embedded = append(embedded, f)
 				continue
 			}
diff --git a/unmarshaler_test.go b/unmarshaler_test.go
index fbefca8..9da4d3b 100644
--- a/unmarshaler_test.go
+++ b/unmarshaler_test.go
@@ -5603,3 +5603,20 @@ e = 1
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
+	assert.NoError(t, err)
+	assert.Equal(t, Config{Base: Base{Region: "us", Name: "srv1", BsPort: 100}, PID: 42}, c)
+}
```

</details>

<details><summary>reply</summary>

Encoder flattens when the tag has no name; mirror that in the decoder.

Fixed. The decoder now flattens an embedded struct whose tag has no name, such as `toml:",inline"`, the same way the encoder already did. Your `Config` example now fills `Region`, `Name` and `BsPort` as well as `PID`.

The change is in `addFields` in `unmarshaler.go`. Before, any tag on an embedded struct made the decoder treat it as a named sub-table. A tag with an explicit name, like `toml:"base"`, still does that.

I added `TestUnmarshalEmbeddedInlineTag` to `unmarshaler_test.go`, using your struct shape and document. The build succeeds and the full test suite passes.

</details>

### claude, all: pass

Files: [unmarshaler.go](../all/claude/go-toml-inline-embed-1/files/unmarshaler.go), [unmarshaler_test.go](../all/claude/go-toml-inline-embed-1/files/unmarshaler_test.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..6acaedc 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2238,12 +2238,13 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 		f := t.Field(i)
 		tag, tagged := f.Tag.Lookup("toml")
 		name := f.Name
+		var parts []string
 		if tagged {
 			// A tag of exactly "-" drops the field. "-," names it "-".
 			if tag == "-" {
 				continue
 			}
-			parts := strings.SplitN(tag, ",", 2)
+			parts = strings.SplitN(tag, ",", 2)
 			if parts[0] != "" {
 				name = parts[0]
 			}
@@ -2257,8 +2258,9 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				// Embedded non-struct fields are not decoded into.
 				continue
 			}
-			if !tagged {
-				// Untagged embedded structs are flattened, even when their
+			if !tagged || strings.SplitN(tag, ",", 2)[0] == "" {
+				// Embedded structs without a tag name (untagged, or only
+				// options such as ",inline") are flattened, even when their
 				// type is unexported: only their own exported fields are
 				// reachable.
 				embedded = append(embedded, f)
diff --git a/unmarshaler_test.go b/unmarshaler_test.go
index fbefca8..d33f120 100644
--- a/unmarshaler_test.go
+++ b/unmarshaler_test.go
@@ -4296,6 +4296,31 @@ func TestUnmarshalEmbedNonString(t *testing.T) {
 	assert.Equal(t, d.Foo, nil)
 }
 
+func TestUnmarshalEmbedInlineTag(t *testing.T) {
+	type Base struct {
+		Region string
+		BsPort int
+	}
+	type Config struct {
+		Base  `toml:",inline"`
+		PID   uint32
+		index int `toml:"-"`
+	}
+	type Named struct {
+		Base `toml:"base"`
+	}
+
+	var c Config
+	err := toml.Unmarshal([]byte("Region = 'us'\nBsPort = 100\nPID = 42"), &c)
+	assert.NoError(t, err)
+	assert.Equal(t, Config{Base: Base{Region: "us", BsPort: 100}, PID: 42}, c)
+
+	var n Named
+	err = toml.Unmarshal([]byte("[base]\nRegion = 'us'"), &n)
+	assert.NoError(t, err)
+	assert.Equal(t, "us", n.Base.Region)
+}
+
 func TestUnmarshal_Nil(t *testing.T) {
 	type Foo struct {
 		Foo *Foo `toml:"foo,omitempty"`
```

</details>

<details><summary>reply</summary>

Encoder flattens when tag name empty. Mirror in decoder.

Done. `addFields` in `unmarshaler.go` now flattens embedded structs whose tag has no name (e.g. `toml:",inline"`), matching the encoder. A named tag still acts as a regular field. I added `TestUnmarshalEmbedInlineTag`, and `go test ./...` passes. `go vet` shows one warning, in `marshaler_test.go:1572`, which I didn't touch.

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
index d497669..7ecd974 100644
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
+				// even when their type is unexported: only their own exported
+				// fields are reachable. Tag options do not change this.
 				embedded = append(embedded, f)
 				continue
 			}
-			// A tagged embedded struct acts as a regular named field.
+			// An explicitly named embedded struct acts as a regular field.
 		} else if f.PkgPath != "" {
 			// unexported
 			continue
diff --git a/unmarshaler_test.go b/unmarshaler_test.go
index fbefca8..2750fc6 100644
--- a/unmarshaler_test.go
+++ b/unmarshaler_test.go
@@ -6,6 +6,7 @@ import (
 	"errors"
 	"fmt"
 	"math"
+	"reflect"
 	"strconv"
 	"strings"
 	"testing"
@@ -4283,6 +4284,45 @@ func TestUnmarshal_RecursiveTableArray(t *testing.T) {
 	}
 }
 
+func TestUnmarshalEmbeddedStructWithOptions(t *testing.T) {
+	type Base struct {
+		Region string
+		Name   string
+		BsPort int
+	}
+	want := Base{Region: "us", Name: "srv1", BsPort: 100}
+	for _, tt := range []struct {
+		name  string
+		value interface{}
+	}{
+		{"inline", &struct {
+			Base `toml:",inline"`
+			PID  uint32
+		}{Base: want, PID: 42}},
+		{"inline pointer", &struct {
+			*Base `toml:",inline"`
+			PID   uint32
+		}{Base: &want, PID: 42}},
+		{"empty tag", &struct {
+			Base `toml:""`
+			PID  uint32
+		}{Base: want, PID: 42}},
+		{"named inline", &struct {
+			Base `toml:"base,inline"`
+			PID  uint32
+		}{Base: want, PID: 42}},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			data, err := toml.Marshal(tt.value)
+			assert.NoError(t, err)
+			got := reflect.New(reflect.TypeOf(tt.value).Elem()).Interface()
+			err = toml.NewDecoder(bytes.NewReader(data)).DisallowUnknownFields().Decode(got)
+			assert.NoError(t, err)
+			assert.Equal(t, tt.value, got)
+		})
+	}
+}
+
 func TestUnmarshalEmbedNonString(t *testing.T) {
 	type Foo []byte
 	type doc struct {
```

</details>

<details><summary>reply</summary>

I’ll check how decoding handles embedded fields, add a regression test, and fix the failure.

The decoder treats any TOML tag on an embedded struct as a field name, even when the tag only contains `inline`. The encoder already distinguishes those cases. I’ll make decoding follow the same rule: flatten the embedded struct when the tag has no name.

Fixed decoding for embedded structs tagged `toml:",inline"`. Tags without an explicit field name now preserve embedded-field flattening, matching the encoder.

Added regression coverage for embedded values, pointers, empty tags, and explicitly named fields.

Validation: `go test ./...` passes.

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
index fbefca8..97ce0c1 100644
--- a/unmarshaler_test.go
+++ b/unmarshaler_test.go
@@ -5603,3 +5603,52 @@ e = 1
 	assert.NoError(t, toml.Unmarshal([]byte(doc), &m))
 	assert.Equal(t, 1, len(m["a"].([]interface{}))-1)
 }
+
+func TestUnmarshalEmbeddedStructWithOptions(t *testing.T) {
+	type Base struct {
+		Region string
+		Name   string
+		BsPort int
+	}
+	type config struct {
+		Base  `toml:",inline"`
+		PID   uint32
+		index int `toml:"-"`
+	}
+	type pointerConfig struct {
+		*Base `toml:",inline"`
+		PID   uint32
+	}
+	type emptyTagConfig struct {
+		Base `toml:""`
+		PID  uint32
+	}
+	type optionsConfig struct {
+		Base `toml:",omitempty,inline"`
+		PID  uint32
+	}
+	type namedConfig struct {
+		Base `toml:"base,inline"`
+		PID  uint32
+	}
+	base := Base{Region: "us", Name: "srv1", BsPort: 100}
+	flat := "Region = 'us'\nName = 'srv1'\nBsPort = 100\nPID = 42\n"
+	for _, tc := range []struct {
+		name string
+		doc  string
+		got  interface{}
+		want interface{}
+	}{
+		{"inline", flat, &config{}, &config{Base: base, PID: 42}},
+		{"pointer", flat, &pointerConfig{}, &pointerConfig{Base: &base, PID: 42}},
+		{"empty tag", flat, &emptyTagConfig{}, &emptyTagConfig{Base: base, PID: 42}},
+		{"multiple options", flat, &optionsConfig{}, &optionsConfig{Base: base, PID: 42}},
+		{"explicit name", "PID = 42\nbase = { Region = 'us', Name = 'srv1', BsPort = 100 }\n", &namedConfig{}, &namedConfig{Base: base, PID: 42}},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			decoder := toml.NewDecoder(strings.NewReader(tc.doc)).DisallowUnknownFields()
+			assert.NoError(t, decoder.Decode(tc.got))
+			assert.Equal(t, tc.want, tc.got)
+		})
+	}
+}
```

</details>

<details><summary>reply</summary>

Embedded `inline` decoding needs fixing; checking field lookup and regression tests.


Done.
Fixed embedded `inline` decoding; preserved explicit names. Added regression tests for values, pointers, empty tags, multiple options. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [unmarshaler.go](../sloth/codex/go-toml-inline-embed-1/files/unmarshaler.go), [unmarshaler_test.go](../sloth/codex/go-toml-inline-embed-1/files/unmarshaler_test.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..77f2e71 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2232,6 +2232,7 @@ func buildPlan(t reflect.Type) *structPlan {
 	return plan
 }
 
+// addFields indexes named and promoted fields of t in plan.
 func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 	var embedded []reflect.StructField
 	for i := 0; i < t.NumField(); i++ {
@@ -2244,7 +2245,8 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				continue
 			}
 			parts := strings.SplitN(tag, ",", 2)
-			if parts[0] != "" {
+			tagged = parts[0] != ""
+			if tagged {
 				name = parts[0]
 			}
 		}
@@ -2258,13 +2260,13 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				continue
 			}
 			if !tagged {
-				// Untagged embedded structs are flattened, even when their
+				// Embedded structs without a tag name are flattened, even when their
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
index fbefca8..e6bc95e 100644
--- a/unmarshaler_test.go
+++ b/unmarshaler_test.go
@@ -16,6 +16,64 @@ import (
 	"github.com/pelletier/go-toml/v2/unstable"
 )
 
+// TestUnmarshalEmbeddedStructTags checks field promotion for embedded TOML tags.
+func TestUnmarshalEmbeddedStructTags(t *testing.T) {
+	type Base struct {
+		Region        string
+		Name          string
+		IPv4          string
+		BsPort        int
+		WebSocketPort int
+		OutOfBandPort int
+	}
+	type Config struct {
+		Base  `toml:",inline"`
+		PID   uint32
+		index int `toml:"-"`
+	}
+	type Pointer struct {
+		*Base `toml:",inline"`
+		PID   uint32
+	}
+	type Empty struct {
+		Base `toml:""`
+		PID  uint32
+	}
+	type Named struct {
+		Base `toml:"base,inline"`
+		PID  uint32
+	}
+	type Ignored struct {
+		Base `toml:"-"`
+		PID  uint32
+	}
+	type Shadowed struct {
+		Base   `toml:",inline"`
+		Region string
+		PID    uint32
+	}
+	base := Base{Region: "us", Name: "srv1", BsPort: 100}
+	for _, tt := range []struct {
+		name string
+		doc  string
+		got  interface{}
+		want interface{}
+	}{
+		{"inline", "Region = 'us'\nName = 'srv1'\nBsPort = 100\nPID = 42", &Config{}, &Config{Base: base, PID: 42}},
+		{"pointer", "Region = 'us'\nName = 'srv1'\nBsPort = 100\nPID = 42", &Pointer{}, &Pointer{Base: &base, PID: 42}},
+		{"empty tag", "Region = 'us'\nName = 'srv1'\nBsPort = 100\nPID = 42", &Empty{}, &Empty{Base: base, PID: 42}},
+		{"named", "PID = 42\n[base]\nRegion = 'us'\nName = 'srv1'\nBsPort = 100", &Named{}, &Named{Base: base, PID: 42}},
+		{"ignored", "Region = 'us'\nPID = 42", &Ignored{}, &Ignored{PID: 42}},
+		{"shadowed", "Region = 'us'\nPID = 42", &Shadowed{}, &Shadowed{Region: "us", PID: 42}},
+		{"empty document", "", &Pointer{}, &Pointer{}},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.NoError(t, toml.Unmarshal([]byte(tt.doc), tt.got))
+			assert.Equal(t, tt.want, tt.got)
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

I’ll trace how decoding handles embedded fields, add a regression test, and run the build and tests.

The shared decoder field plan treats any TOML tag as a field name, so `toml:",inline"` stops an embedded struct’s fields from being promoted. I’ll make that decision depend on whether the tag supplies a name.

The scope is the field-plan builder and regression tests in `unmarshaler_test.go`; no API, encoder, fixture, or configuration changes are needed. Tests will cover value and pointer embeddings, empty names, explicit names, ignored fields, and field precedence.

Fixed decoding of embedded structs tagged `toml:",inline"`. The decoder now promotes embedded fields when the tag has no explicit name.

Added regression coverage for your example, pointer embeddings, empty tags, explicit names, ignored fields, and field precedence.

Validation passed: `go test ./...` and `go build ./...`.

</details>

### codex, all: pass

Files: [unmarshaler.go](../all/codex/go-toml-inline-embed-1/files/unmarshaler.go), [unmarshaler_test.go](../all/codex/go-toml-inline-embed-1/files/unmarshaler_test.go)

<details><summary>diff</summary>

```diff
diff --git a/unmarshaler.go b/unmarshaler.go
index d497669..7ac5d4b 100644
--- a/unmarshaler.go
+++ b/unmarshaler.go
@@ -2244,6 +2244,7 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				continue
 			}
 			parts := strings.SplitN(tag, ",", 2)
+			tagged = parts[0] != ""
 			if parts[0] != "" {
 				name = parts[0]
 			}
@@ -2258,7 +2259,7 @@ func addFields(plan *structPlan, t reflect.Type, prefix []int) {
 				continue
 			}
 			if !tagged {
-				// Untagged embedded structs are flattened, even when their
+				// Embedded structs without a tag name are flattened, even when their
 				// type is unexported: only their own exported fields are
 				// reachable.
 				embedded = append(embedded, f)
diff --git a/unmarshaler_test.go b/unmarshaler_test.go
index fbefca8..40c6f0a 100644
--- a/unmarshaler_test.go
+++ b/unmarshaler_test.go
@@ -16,6 +16,65 @@ import (
 	"github.com/pelletier/go-toml/v2/unstable"
 )
 
+// TestUnmarshalEmbeddedStructTagOptions checks flattening and explicit tag names.
+func TestUnmarshalEmbeddedStructTagOptions(t *testing.T) {
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
+	type ShadowConfig struct {
+		Base   `toml:",inline"`
+		Region string
+		PID    uint32
+	}
+	base := Base{Region: "us", Name: "srv1", BsPort: 100}
+	for _, tc := range []struct {
+		name string
+		doc  string
+		got  interface{}
+		want interface{}
+	}{
+		{"inline", "", &Config{}, &Config{Base: base, PID: 42}},
+		{"pointer", "", &PointerConfig{}, &PointerConfig{Base: &base, PID: 42}},
+		{"empty tag", "", &EmptyTagConfig{}, &EmptyTagConfig{Base: base, PID: 42}},
+		{"named", "PID = 42\n[base]\n", &NamedConfig{}, &NamedConfig{Base: base, PID: 42}},
+		{"ignored", "", &IgnoredConfig{}, &IgnoredConfig{PID: 42}},
+		{"shadow", "", &ShadowConfig{}, &ShadowConfig{Base: Base{Name: "srv1", BsPort: 100}, Region: "us", PID: 42}},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			doc := tc.doc
+			if doc == "" {
+				doc = "PID = 42\n"
+			}
+			doc += "Region = \"us\"\nName = \"srv1\"\nBsPort = 100\n"
+			assert.NoError(t, toml.Unmarshal([]byte(doc), tc.got))
+			assert.Equal(t, tc.want, tc.got)
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

Done.
Fixed embedded `inline` decoding. Added regression coverage for pointers, empty tags, named fields, ignored fields, shadowing. `go build ./...` and `go test ./...` passed.

</details>
