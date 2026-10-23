# go-yaml-int-map-keys

Source: https://github.com/goccy/go-yaml/pull/829

## Prompt

> Integer keys get converted to `*` when decoding into a `map[string]any`.
> 
> ```go
> package main
> 
> import (
> 	"fmt"
> 	"log"
> 
> 	"github.com/goccy/go-yaml"
> )
> 
> const data = `
> 42: 100
> `
> 
> func main() {
> 	var d map[string]any
> 	if err := yaml.Unmarshal([]byte(data), &d); err != nil {
> 		log.Fatalf("error: %v", err)
> 	}
> 	fmt.Printf("%v\n", d)
> }
> ```
> 
> This prints `map[*:100]`. I expected `map[42:100]`, i.e. the key should be the string `"42"`.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [decode.go](../../tasks/go-yaml-int-map-keys/upstream/decode.go), [decode_test.go](../../tasks/go-yaml-int-map-keys/upstream/decode_test.go)

```diff
diff --git a/decode.go b/decode.go
index 43c317f..a1b5d50 100644
--- a/decode.go
+++ b/decode.go
@@ -1750,14 +1750,11 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 				return err
 			}
 		} else {
-			keyVal, err := d.nodeToValue(ctx, key)
+			keyVal, err := d.createDecodedNewValue(ctx, keyType, reflect.Value{}, key)
 			if err != nil {
 				return err
 			}
-			k = reflect.ValueOf(keyVal)
-			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
-				k = k.Convert(keyType)
-			}
+			k = keyVal
 		}
 
 		if k.IsValid() {
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +4/-1 | 10 | 2,428 | $0.103 |
| claude | muffle | pass | +4/-1 | 10 | 2,296 | $0.092 |
| claude | hush | pass | +8/-1 | 10 | 1,473 | $0.074 |
| claude | sloth | pass | +3/-0 | 11 | 2,719 | $0.096 |
| claude | all | pass | +3/-1 | 4 | 3,124 | $0.101 |
| codex | base | pass | +4/-1 | 34 | 1,783 | - |
| codex | muffle | pass | +4/-1 | 27 | 1,364 | - |
| codex | hush | pass | +4/-1 | 23 | 975 | - |
| codex | sloth | pass | +4/-1 | 11 | 1,123 | - |
| codex | all | pass | +4/-1 | 11 | 1,035 | - |

### claude, base: pass

Files: [decode.go](../base/claude/go-yaml-int-map-keys-1/files/decode.go), [decode_test.go](../base/claude/go-yaml-int-map-keys-1/files/decode_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decode.go b/decode.go
index 43c317f..d81d507 100644
--- a/decode.go
+++ b/decode.go
@@ -1755,7 +1755,10 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 				return err
 			}
 			k = reflect.ValueOf(keyVal)
-			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
+			if k.IsValid() && keyType.Kind() == reflect.String && k.Kind() != reflect.String {
+				// avoid integer -> string rune conversion; use the textual form.
+				k = reflect.ValueOf(fmt.Sprint(keyVal)).Convert(keyType)
+			} else if k.IsValid() && k.Type().ConvertibleTo(keyType) {
 				k = k.Convert(keyType)
 			}
 		}
diff --git a/decode_test.go b/decode_test.go
index 2d56942..85f96ee 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -3853,3 +3853,13 @@ func TestSetNullValue(t *testing.T) {
 		})
 	}
 }
+
+func TestDecoder_IntegerKeyToStringMap(t *testing.T) {
+	var d map[string]any
+	if err := yaml.Unmarshal([]byte("42: 100\n"), &d); err != nil {
+		t.Fatal(err)
+	}
+	if v, ok := d["42"]; !ok || v != uint64(100) {
+		t.Fatalf("unexpected result: %v", d)
+	}
+}
```

</details>

<details><summary>reply</summary>

That looks fine; the issue is likely elsewhere. Let me reproduce.

`reflect.Convert` turns the integer 42 into the rune `'*'` when the target is a string. I'll special-case string keys.

Whitespace mismatch in my patch (the test shows the fix was not applied). Using Edit.

Fixed: decoding `42: 100` into a `map[string]any` now gives `map[42:100]`, with the key as the string `"42"`.

**Cause:** in `decodeMap` (`decode.go`), the decoded key was an integer, and `reflect.Convert` turned it into a string by treating it as a rune. 42 became `'*'`.

**Fix:** when the map's key type is a string kind and the decoded key isn't a string, the key is now built with `fmt.Sprint`. The same applies to other non-string scalar keys such as floats and booleans. All other key types go through the original conversion path.

I added `TestDecoder_IntegerKeyToStringMap` to `decode_test.go`. The full test suite passes and `gofmt` is clean. I haven't committed anything.

</details>

### claude, muffle: pass

Files: [decode.go](../muffle/claude/go-yaml-int-map-keys-1/files/decode.go), [decode_test.go](../muffle/claude/go-yaml-int-map-keys-1/files/decode_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decode.go b/decode.go
index 43c317f..802ced0 100644
--- a/decode.go
+++ b/decode.go
@@ -1755,7 +1755,10 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 				return err
 			}
 			k = reflect.ValueOf(keyVal)
-			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
+			if k.IsValid() && keyType.Kind() == reflect.String && k.Kind() != reflect.String {
+				// avoid integer to string conversion yielding a rune
+				k = reflect.ValueOf(fmt.Sprint(keyVal)).Convert(keyType)
+			} else if k.IsValid() && k.Type().ConvertibleTo(keyType) {
 				k = k.Convert(keyType)
 			}
 		}
diff --git a/decode_test.go b/decode_test.go
index 2d56942..d0d9619 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -3853,3 +3853,13 @@ func TestSetNullValue(t *testing.T) {
 		})
 	}
 }
+
+func TestDecoder_IntegerKeyToStringMap(t *testing.T) {
+	var got map[string]any
+	if err := yaml.Unmarshal([]byte("42: 100\n"), &got); err != nil {
+		t.Fatal(err)
+	}
+	if v, ok := got["42"]; !ok || v != uint64(100) {
+		t.Fatalf("unexpected result: %v", got)
+	}
+}
```

</details>

<details><summary>reply</summary>

That looks fine; the `*` must come from elsewhere. Let me reproduce.

Output is being swallowed by something; let me capture it differently.

Reproduced. Check the decode path for map[string]any.

Let me add a regression test and clean up.

Fixed: `42: 100` now decodes into `map[string]any` as `map[42:100]`, with the key as the string `"42"`.

The cause was in `decodeMap` in `decode.go`. It converted the decoded key (an integer) to the map's key type with reflection. Go converts an integer to a string as a rune, so `42` became `"*"`. When the map key type is a string and the decoded key isn't one, it now formats the key with `fmt.Sprint`. This also covers float and bool keys.

I added a regression test, `TestDecoder_IntegerKeyToStringMap`, in `decode_test.go`. It and the existing test suite pass. I haven't committed anything.

</details>

### claude, hush: pass

Files: [decode.go](../hush/claude/go-yaml-int-map-keys-1/files/decode.go), [decode_test.go](../hush/claude/go-yaml-int-map-keys-1/files/decode_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decode.go b/decode.go
index 43c317f..d11b92e 100644
--- a/decode.go
+++ b/decode.go
@@ -1755,7 +1755,14 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 				return err
 			}
 			k = reflect.ValueOf(keyVal)
-			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
+			if k.IsValid() && keyType.Kind() == reflect.String && k.Kind() != reflect.String {
+				// integer -> string conversion would yield a rune; use the textual form
+				keyStr, err := d.mapKeyNodeToString(ctx, key)
+				if err != nil {
+					return err
+				}
+				k = reflect.ValueOf(keyStr).Convert(keyType)
+			} else if k.IsValid() && k.Type().ConvertibleTo(keyType) {
 				k = k.Convert(keyType)
 			}
 		}
diff --git a/decode_test.go b/decode_test.go
index 2d56942..2fbea2d 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -3853,3 +3853,13 @@ func TestSetNullValue(t *testing.T) {
 		})
 	}
 }
+
+func TestDecoder_IntegerKeyToStringMap(t *testing.T) {
+	var d map[string]any
+	if err := yaml.Unmarshal([]byte("42: 100\n"), &d); err != nil {
+		t.Fatal(err)
+	}
+	if v, ok := d["42"]; !ok || v != uint64(100) {
+		t.Fatalf("unexpected map: %v", d)
+	}
+}
```

</details>

<details><summary>reply</summary>

Done. `decodeMap` in `decode.go` now turns non-string keys into text for string-keyed maps, so `42: 100` gives `map[42:100]`. The old code converted the integer to a rune, which is where `*` came from. I added `TestDecoder_IntegerKeyToStringMap`, and `go test ./...` passes. Nothing committed.

</details>

### claude, sloth: pass

Files: [decode.go](../sloth/claude/go-yaml-int-map-keys-1/files/decode.go), [decode_test.go](../sloth/claude/go-yaml-int-map-keys-1/files/decode_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decode.go b/decode.go
index 43c317f..414b4ed 100644
--- a/decode.go
+++ b/decode.go
@@ -1755,6 +1755,9 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 				return err
 			}
 			k = reflect.ValueOf(keyVal)
+			if k.IsValid() && keyType.Kind() == reflect.String && k.Kind() != reflect.String {
+				k = reflect.ValueOf(fmt.Sprint(keyVal))
+			}
 			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
 				k = k.Convert(keyType)
 			}
diff --git a/decode_test.go b/decode_test.go
index 2d56942..8d43896 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -1334,6 +1334,17 @@ func TestDecoder_Invalid(t *testing.T) {
 	}
 }
 
+func TestDecoder_NonStringKeyToStringMap(t *testing.T) {
+	var got map[string]any
+	if err := yaml.Unmarshal([]byte("42: 100\n1.5: a\ntrue: b\nnull: c\nx: d\n"), &got); err != nil {
+		t.Fatal(err)
+	}
+	want := map[string]any{"42": uint64(100), "1.5": "a", "true": "b", "": "c", "x": "d"}
+	if !reflect.DeepEqual(got, want) {
+		t.Fatalf("got %v, want %v", got, want)
+	}
+}
+
 func TestDecoder_ScientificNotation(t *testing.T) {
 	tests := []struct {
 		source string
```

</details>

<details><summary>reply</summary>

Probably a whitespace mismatch (the file was read with tabs); let me retry with exact lines.

Decoding `42: 100` into a `map[string]any` now gives `map[42:100]`, with the key as the string `"42"`. The full test suite passes.

The cause was in `decodeMap` in `decode.go`. The integer key was converted straight to a string type, and Go's `uint64` to `string` conversion produces the character with that code point. 42 became `*`. Now, when the map's key type is a string kind and the YAML key isn't a string, the key goes through `fmt.Sprint` first.

This also changes other non-string keys. `1.5:` becomes `"1.5"` and `true:` becomes `"true"`. Previously `true:` into a `map[string]any` returned a "cannot convert" error. A `null:` key still becomes `""`, as before.

I added `TestDecoder_NonStringKeyToStringMap` to `decode_test.go`. It covers the integer, float, bool, null and plain string keys.

</details>

### claude, all: pass

Files: [decode.go](../all/claude/go-yaml-int-map-keys-1/files/decode.go), [decode_test.go](../all/claude/go-yaml-int-map-keys-1/files/decode_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decode.go b/decode.go
index 43c317f..ea2a2a1 100644
--- a/decode.go
+++ b/decode.go
@@ -1755,7 +1755,9 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 				return err
 			}
 			k = reflect.ValueOf(keyVal)
-			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
+			if k.IsValid() && keyType.Kind() == reflect.String && (k.CanInt() || k.CanUint()) {
+				k = reflect.ValueOf(fmt.Sprint(keyVal)).Convert(keyType)
+			} else if k.IsValid() && k.Type().ConvertibleTo(keyType) {
 				k = k.Convert(keyType)
 			}
 		}
diff --git a/decode_test.go b/decode_test.go
index 2d56942..2120903 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -37,6 +37,10 @@ func TestDecoder(t *testing.T) {
 			source: "v: hi\n",
 			value:  map[string]string{"v": "hi"},
 		},
+		{
+			source: "42: 100\n",
+			value:  map[string]interface{}{"42": uint64(100)},
+		},
 		{
 			source: "v: hi\n",
 			value:  map[string]TestString{"v": "hi"},
```

</details>

<details><summary>reply</summary>

Fix didn't take; the `*` comes from another code path. Looking for it now.

Applying the edit now; running tests to check.

Done. `decodeMap` in `decode.go` now turns integer keys into decimal strings when the map key type is string, instead of converting them to runes. I added a `42: 100` case to `TestDecoder`, and `go test ./...` passes.

Float keys like `1.5: 2` still fail with `cannot convert "float64" type to "string" type`, as they did before. I left that alone because you only reported integer keys.

</details>

### codex, base: pass

Files: [decode.go](../base/codex/go-yaml-int-map-keys-1/files/decode.go), [decode_test.go](../base/codex/go-yaml-int-map-keys-1/files/decode_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decode.go b/decode.go
index 43c317f..2e84811 100644
--- a/decode.go
+++ b/decode.go
@@ -1756,7 +1756,10 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 			}
 			k = reflect.ValueOf(keyVal)
 			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
-				k = k.Convert(keyType)
+				k, err = d.convertValue(k, keyType, key)
+				if err != nil {
+					return err
+				}
 			}
 		}
 
diff --git a/decode_test.go b/decode_test.go
index 2d56942..e9bdd03 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -27,6 +27,40 @@ type Child struct {
 
 type TestString string
 
+func TestDecoderIntegerStringMapKeys(t *testing.T) {
+	const source = "42: 100\n-42: 200\n0: 300\n9223372036854775807: 400\n18446744073709551615: 500\n"
+	want := map[string]interface{}{
+		"42":                   uint64(100),
+		"-42":                  uint64(200),
+		"0":                    uint64(300),
+		"9223372036854775807":  uint64(400),
+		"18446744073709551615": uint64(500),
+	}
+	t.Run("string", func(t *testing.T) {
+		var got map[string]interface{}
+		if err := yaml.Unmarshal([]byte(source), &got); err != nil {
+			t.Fatal(err)
+		}
+		if !reflect.DeepEqual(got, want) {
+			t.Fatalf("got %v, want %v", got, want)
+		}
+	})
+	t.Run("named string", func(t *testing.T) {
+		var got map[TestString]interface{}
+		if err := yaml.Unmarshal([]byte(source), &got); err != nil {
+			t.Fatal(err)
+		}
+		if len(got) != len(want) {
+			t.Fatalf("got %v, want %v", got, want)
+		}
+		for key, value := range want {
+			if got[TestString(key)] != value {
+				t.Errorf("key %q: got %v, want %v", key, got[TestString(key)], value)
+			}
+		}
+	})
+}
+
 func TestDecoder(t *testing.T) {
 	tests := []struct {
 		source string
```

</details>

<details><summary>reply</summary>

I’ll trace how map keys are converted, fix the integer handling, and add a regression test.

The map decoder uses Go’s integer-to-string conversion, which turns `42` into the character `*`. I’ve changed it to use the decoder’s existing numeric formatting helper and added tests for positive, negative, zero, large, and named-string keys. The test suite is running.

Fixed integer map keys to use decimal string formatting, so your example now produces `map[42:100]`.

Added regression coverage for positive, negative, zero, large integer, and named-string keys. All tests pass with `go test ./...`.

</details>

### codex, muffle: pass

Files: [decode.go](../muffle/codex/go-yaml-int-map-keys-1/files/decode.go), [decode_test.go](../muffle/codex/go-yaml-int-map-keys-1/files/decode_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decode.go b/decode.go
index 43c317f..2e84811 100644
--- a/decode.go
+++ b/decode.go
@@ -1756,7 +1756,10 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 			}
 			k = reflect.ValueOf(keyVal)
 			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
-				k = k.Convert(keyType)
+				k, err = d.convertValue(k, keyType, key)
+				if err != nil {
+					return err
+				}
 			}
 		}
 
diff --git a/decode_test.go b/decode_test.go
index 2d56942..5e7bf13 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -27,6 +27,33 @@ type Child struct {
 
 type TestString string
 
+func TestDecoder_IntegerKeysToString(t *testing.T) {
+	for _, keyType := range []reflect.Type{reflect.TypeOf(""), reflect.TypeOf(TestString(""))} {
+		t.Run(keyType.String(), func(t *testing.T) {
+			for _, tt := range []struct{ source, want string }{
+				{"42", "42"},
+				{"-42", "-42"},
+				{"0", "0"},
+				{"0x2a", "42"},
+				{"-9223372036854775808", "-9223372036854775808"},
+				{"18446744073709551615", "18446744073709551615"},
+			} {
+				t.Run(tt.source, func(t *testing.T) {
+					dst := reflect.New(reflect.MapOf(keyType, reflect.TypeOf((*interface{})(nil)).Elem()))
+					if err := yaml.Unmarshal([]byte(tt.source+": 100\n"), dst.Interface()); err != nil {
+						t.Fatal(err)
+					}
+					key := reflect.ValueOf(tt.want).Convert(keyType)
+					got := dst.Elem().MapIndex(key)
+					if dst.Elem().Len() != 1 || !got.IsValid() || got.Interface() != uint64(100) {
+						t.Fatalf("expected key %q with value 100, got %v", tt.want, dst.Elem().Interface())
+					}
+				})
+			}
+		})
+	}
+}
+
 func TestDecoder(t *testing.T) {
 	tests := []struct {
 		source string
```

</details>

<details><summary>reply</summary>

I’ll trace how mapping keys are converted to strings, add a regression test, and run the relevant tests.

The decoder was using Go’s integer-to-string conversion, which turns `42` into the Unicode character `*`. I changed it to use the decoder’s existing numeric formatting helper. The regression tests cover signed and unsigned integers, hexadecimal input, and named string key types.

Fixed: integer map keys now use decimal string formatting, so your example produces `map[42:100]`.

Added regression tests for signed and unsigned integers, hexadecimal input, and named string key types.

Validation: `go test ./...` passes.

</details>

### codex, hush: pass

Files: [decode.go](../hush/codex/go-yaml-int-map-keys-1/files/decode.go), [decode_test.go](../hush/codex/go-yaml-int-map-keys-1/files/decode_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decode.go b/decode.go
index 43c317f..2e84811 100644
--- a/decode.go
+++ b/decode.go
@@ -1756,7 +1756,10 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 			}
 			k = reflect.ValueOf(keyVal)
 			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
-				k = k.Convert(keyType)
+				k, err = d.convertValue(k, keyType, key)
+				if err != nil {
+					return err
+				}
 			}
 		}
 
diff --git a/decode_test.go b/decode_test.go
index 2d56942..25e23d9 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -3853,3 +3853,26 @@ func TestSetNullValue(t *testing.T) {
 		})
 	}
 }
+
+func TestDecoder_IntegerStringMapKeys(t *testing.T) {
+	for _, key := range []string{"42", "-42", "0", "9223372036854775807", "18446744073709551615"} {
+		t.Run(key, func(t *testing.T) {
+			source := []byte(key + ": 100\n")
+			var got map[string]any
+			if err := yaml.Unmarshal(source, &got); err != nil {
+				t.Fatal(err)
+			}
+			if len(got) != 1 || got[key] != uint64(100) {
+				t.Fatalf("expected key %q with value 100, got %#v", key, got)
+			}
+
+			var named map[TestString]any
+			if err := yaml.Unmarshal(source, &named); err != nil {
+				t.Fatal(err)
+			}
+			if len(named) != 1 || named[TestString(key)] != uint64(100) {
+				t.Fatalf("expected named key %q with value 100, got %#v", key, named)
+			}
+		})
+	}
+}
```

</details>

<details><summary>reply</summary>

Done.
Integer map keys now convert to decimal strings. Regression tests cover signed, unsigned, and named string keys. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [decode.go](../sloth/codex/go-yaml-int-map-keys-1/files/decode.go), [decode_test.go](../sloth/codex/go-yaml-int-map-keys-1/files/decode_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decode.go b/decode.go
index 43c317f..2e84811 100644
--- a/decode.go
+++ b/decode.go
@@ -1756,7 +1756,10 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 			}
 			k = reflect.ValueOf(keyVal)
 			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
-				k = k.Convert(keyType)
+				k, err = d.convertValue(k, keyType, key)
+				if err != nil {
+					return err
+				}
 			}
 		}
 
diff --git a/decode_test.go b/decode_test.go
index 2d56942..87c1fd0 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -33,6 +33,17 @@ func TestDecoder(t *testing.T) {
 		value  interface{}
 		eof    bool
 	}{
+		{
+			source: "42: 100\n0: 0\n-42: 1\n9223372036854775807: 2\n18446744073709551615: 3\n",
+			value: map[string]any{
+				"42": 100, "0": 0, "-42": 1,
+				"9223372036854775807": 2, "18446744073709551615": 3,
+			},
+		},
+		{
+			source: "42: 100\n-42: 1\n",
+			value:  map[TestString]int{"42": 100, "-42": 1},
+		},
 		{
 			source: "v: hi\n",
 			value:  map[string]string{"v": "hi"},
```

</details>

<details><summary>reply</summary>

I’ll trace map-key decoding, fix the shared conversion, and add a regression test. I’ll check that typed map keys and existing error behavior stay intact; no new options or dependencies are needed.

The map decoder uses Go’s integer-to-string conversion, which turns `42` into the Unicode character `*`. The existing scalar conversion helper already formats integers as decimal strings. I’ll reuse it in the map decoder and add cases to the existing decoder tests. No public API, fixture, or config changes are needed.

Fixed integer map keys to use decimal string formatting, so the example now produces `map[42:100]`.

Added regression coverage for zero, negative integers, large integer boundaries, and named string key types.

Validation passed: `go test ./...`, `go build ./...`, and `git diff --check`.

</details>

### codex, all: pass

Files: [decode.go](../all/codex/go-yaml-int-map-keys-1/files/decode.go), [decode_test.go](../all/codex/go-yaml-int-map-keys-1/files/decode_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decode.go b/decode.go
index 43c317f..2e84811 100644
--- a/decode.go
+++ b/decode.go
@@ -1756,7 +1756,10 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 			}
 			k = reflect.ValueOf(keyVal)
 			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
-				k = k.Convert(keyType)
+				k, err = d.convertValue(k, keyType, key)
+				if err != nil {
+					return err
+				}
 			}
 		}
 
diff --git a/decode_test.go b/decode_test.go
index 2d56942..719d9cc 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -33,6 +33,17 @@ func TestDecoder(t *testing.T) {
 		value  interface{}
 		eof    bool
 	}{
+		{
+			source: "42: 100\n0: 0\n-42: -100\n9223372036854775807: 1\n18446744073709551615: 2\n",
+			value: map[string]interface{}{
+				"42": 100, "0": 0, "-42": -100,
+				"9223372036854775807": 1, "18446744073709551615": 2,
+			},
+		},
+		{
+			source: "42: 100\n-42: -100\n",
+			value:  map[TestString]interface{}{"42": 100, "-42": -100},
+		},
 		{
 			source: "v: hi\n",
 			value:  map[string]string{"v": "hi"},
```

</details>

<details><summary>reply</summary>

Integer map keys should retain decimal text. Checking decoder paths and existing tests.


Done.
Integer keys now decode as decimal strings. Regression tests cover zero, negatives, limits, named strings. `go test ./...` and `go build ./...` pass.

</details>
