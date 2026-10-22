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
| claude | muffle | pass | +4/-1 | 10 | 2,289 | $0.088 |
| claude | hush | pass | +4/-0 | 10 | 2,030 | $0.076 |
| claude | sloth | pass | +7/-1 | 0 | 2,397 | $0.087 |
| claude | all | pass | +3/-0 | 0 | 1,084 | $0.060 |
| codex | base | pass | +4/-1 | 34 | 1,783 | - |
| codex | muffle | pass | +4/-1 | 11 | 1,106 | - |
| codex | hush | pass | +5/-2 | 22 | 860 | - |
| codex | sloth | pass | +4/-1 | 0 | 1,123 | - |
| codex | all | pass | +4/-1 | 0 | 671 | - |

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
index 43c317f..4b610cd 100644
--- a/decode.go
+++ b/decode.go
@@ -1755,7 +1755,10 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 				return err
 			}
 			k = reflect.ValueOf(keyVal)
-			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
+			if k.IsValid() && keyType.Kind() == reflect.String && k.Kind() != reflect.String {
+				// reflect would convert an integer to the rune it represents
+				k = reflect.ValueOf(fmt.Sprint(keyVal)).Convert(keyType)
+			} else if k.IsValid() && k.Type().ConvertibleTo(keyType) {
 				k = k.Convert(keyType)
 			}
 		}
diff --git a/decode_test.go b/decode_test.go
index 2d56942..58a0904 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -3853,3 +3853,13 @@ func TestSetNullValue(t *testing.T) {
 		})
 	}
 }
+
+func TestDecoder_IntKeyToStringMapKey(t *testing.T) {
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

That looks fine; the issue is likely in the typed-map path. Let me reproduce.

The cause is that `reflect.Convert` turns the integer 42 into the rune `'*'` when the target key type is `string`. I'll fix that case.

The edit failed, probably on whitespace, but the test reproduces the bug. I'll re-read the exact lines.

I had the indentation wrong, with 4 tabs where the file has 3.

Decoding `42: 100` into a `map[string]any` now gives `map[42:100]`, with the key as the string `"42"`. The full test suite passes.

The cause was in `decodeMap` in `decode.go`. It used `reflect.Convert` to turn the decoded key into the map's key type. Go converts an integer to a string as the character with that code point, so 42 became `*`. For string-keyed maps, non-string keys now go through `fmt.Sprint` instead. This also covers floats and bools, so a key like `true` becomes `"true"`.

I added a regression test, `TestDecoder_IntKeyToStringMapKey`, in `decode_test.go`. It failed before the fix with `map[*:100]` and passes now. I haven't committed anything.

</details>

### claude, hush: pass

Files: [decode.go](../hush/claude/go-yaml-int-map-keys-1/files/decode.go), [decode_test.go](../hush/claude/go-yaml-int-map-keys-1/files/decode_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decode.go b/decode.go
index 43c317f..5c4e4d6 100644
--- a/decode.go
+++ b/decode.go
@@ -1754,6 +1754,10 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 			if err != nil {
 				return err
 			}
+			if _, isStr := keyVal.(string); keyVal != nil && !isStr && keyType.Kind() == reflect.String {
+				// avoid integer -> string rune conversion (42 -> "*")
+				keyVal = fmt.Sprint(keyVal)
+			}
 			k = reflect.ValueOf(keyVal)
 			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
 				k = k.Convert(keyType)
diff --git a/decode_test.go b/decode_test.go
index 2d56942..5ba077d 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -3853,3 +3853,13 @@ func TestSetNullValue(t *testing.T) {
 		})
 	}
 }
+
+func TestDecoder_IntKeyToStringMap(t *testing.T) {
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

Edit failed (whitespace mismatch); retrying with exact lines.

Done. `decodeMap` in `decode.go` now turns non-string scalar keys into strings with `fmt.Sprint` when the map key type is string-kinded. Before, the int was converted to a rune, so 42 became `*`. I added `TestDecoder_IntKeyToStringMap`, and the full suite passes. Not committed.

</details>

### claude, sloth: pass

Files: [decode.go](../sloth/claude/go-yaml-int-map-keys-1/files/decode.go)

<details><summary>diff</summary>

```diff
diff --git a/decode.go b/decode.go
index 43c317f..fedbdc6 100644
--- a/decode.go
+++ b/decode.go
@@ -1755,7 +1755,13 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 				return err
 			}
 			k = reflect.ValueOf(keyVal)
-			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
+			if k.IsValid() && keyType.Kind() == reflect.String && k.Kind() != reflect.String {
+				keyStr, err := d.mapKeyNodeToString(ctx, key)
+				if err != nil {
+					return err
+				}
+				k = reflect.ValueOf(keyStr).Convert(keyType)
+			} else if k.IsValid() && k.Type().ConvertibleTo(keyType) {
 				k = k.Convert(keyType)
 			}
 		}
```

</details>

<details><summary>reply</summary>

That looks fine; the problem is likely in decodeMap.

`uint64(42)` is "convertible" to `string` via Go's rune conversion, which gives `"*"`. I'll special-case string keys.

The edit failed (probably whitespace), so I'll check the exact text.

I had one tab too many in the old string. Retrying.

Fixed: your example now prints `map[42:100]`.

The cause was in `decodeMap` in `decode.go`. The key was decoded as `uint64(42)`, then converted to `string` with Go's reflect `Convert`. That conversion treats the number as a rune, and rune 42 is `*`.

For string-keyed maps, non-string keys now go through the existing `mapKeyNodeToString` helper. Bool and float keys previously failed with `cannot convert "bool" type to "string" type`. They now work too: `true: 1` gives `true`, and `1.5: 2` gives `1.5`.

I ran your example plus the bool and float cases in a throwaway test, which I deleted. The existing test suite passes. I didn't add a permanent test, since you didn't ask for one.

</details>

### claude, all: pass

Files: [decode.go](../all/claude/go-yaml-int-map-keys-1/files/decode.go)

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
```

</details>

<details><summary>reply</summary>

Done. `decodeMap` in `decode.go` now turns non-string keys into strings with `fmt.Sprint` when the map key type is a string. Before, reflect converted the integer 42 to the rune `*`. Your example now prints `map[42:100]`, and the existing tests pass. I added no test, and I deleted my scratch repro.

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
index 2d56942..2032d1b 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -33,6 +33,17 @@ func TestDecoder(t *testing.T) {
 		value  interface{}
 		eof    bool
 	}{
+		{
+			source: "42: 100\n-42: 200\n0: 300\n9223372036854775807: 400\n18446744073709551615: 500\n",
+			value: map[string]any{
+				"42": 100, "-42": 200, "0": 300,
+				"9223372036854775807": 400, "18446744073709551615": 500,
+			},
+		},
+		{
+			source: "42: 100\n-42: 200\n",
+			value:  map[TestString]any{"42": 100, "-42": 200},
+		},
 		{
 			source: "v: hi\n",
 			value:  map[string]string{"v": "hi"},
```

</details>

<details><summary>reply</summary>

I’ll check how map keys are decoded, fix the conversion, and add a regression test.

The decoder uses Go’s integer-to-string conversion, which turns `42` into the character `*`. It already has a conversion helper that formats numbers as decimal strings; I’ll use it for map keys too. The regression tests reproduce the bug for both ordinary and named string keys.

Fixed map key conversion to format integers as decimal strings, so your example now produces `map[42:100]`.

Added regression coverage for negative, zero, large integer, and named string keys. All tests pass with `go test ./...`.

</details>

### codex, hush: pass

Files: [decode.go](../hush/codex/go-yaml-int-map-keys-1/files/decode.go), [decode_test.go](../hush/codex/go-yaml-int-map-keys-1/files/decode_test.go)

<details><summary>diff</summary>

```diff
diff --git a/decode.go b/decode.go
index 43c317f..5dbb67b 100644
--- a/decode.go
+++ b/decode.go
@@ -1755,8 +1755,11 @@ func (d *Decoder) decodeMap(ctx context.Context, dst reflect.Value, src ast.Node
 				return err
 			}
 			k = reflect.ValueOf(keyVal)
-			if k.IsValid() && k.Type().ConvertibleTo(keyType) {
-				k = k.Convert(keyType)
+			if k.IsValid() && (keyType.Kind() == reflect.String || k.Type().ConvertibleTo(keyType)) {
+				k, err = d.convertValue(k, keyType, key)
+				if err != nil {
+					return err
+				}
 			}
 		}
 
diff --git a/decode_test.go b/decode_test.go
index 2d56942..a278942 100644
--- a/decode_test.go
+++ b/decode_test.go
@@ -3853,3 +3853,25 @@ func TestSetNullValue(t *testing.T) {
 		})
 	}
 }
+
+func TestUnmarshalIntegerStringMapKeys(t *testing.T) {
+	for _, key := range []string{"42", "-42", "0", "9223372036854775807", "18446744073709551615"} {
+		t.Run(key, func(t *testing.T) {
+			source := []byte(key + ": 100\n")
+			var got map[string]any
+			if err := yaml.Unmarshal(source, &got); err != nil {
+				t.Fatal(err)
+			}
+			if len(got) != 1 || got[key] != uint64(100) {
+				t.Fatalf("unexpected map: %#v", got)
+			}
+			var named map[TestString]any
+			if err := yaml.Unmarshal(source, &named); err != nil {
+				t.Fatal(err)
+			}
+			if len(named) != 1 || named[TestString(key)] != uint64(100) {
+				t.Fatalf("unexpected named-key map: %#v", named)
+			}
+		})
+	}
+}
```

</details>

<details><summary>reply</summary>

Done.
Integer map keys now decode as decimal strings. Regression tests cover signed, unsigned, and named string keys. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [decode.go](../sloth/codex/go-yaml-int-map-keys-1/files/decode.go)

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
```

</details>

<details><summary>reply</summary>

I’ll trace how map keys are converted, fix the shared decoding path, and run the existing tests.

The map decoder uses Go’s direct integer-to-string conversion, which turns `42` into the character `*`. The decoder already has a conversion helper that produces `"42"`; I’ll use it here too. Only `decode.go` needs to change. This covers top-level, nested, and merged maps without changing callers, fixtures, config, or exports.

Fixed in [decode.go](/home/jdaddy/.cache/muffle-evals/runs/sloth/codex/go-yaml-int-map-keys-1/work/decode.go:1759) by reusing the existing string conversion helper. Integer key `42` now becomes `"42"`.

Verified positive, negative, and maximum-width integer keys. `go build ./...` and `go test ./...` pass.

</details>

### codex, all: pass

Files: [decode.go](../all/codex/go-yaml-int-map-keys-1/files/decode.go)

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
```

</details>

<details><summary>reply</summary>

Done.
`decode.go` uses decimal string conversion for integer map keys. `42` stays `"42"`. Build and existing tests pass.

</details>
