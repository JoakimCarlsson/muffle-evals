# rust-time-strftime-padding-panic

Source: https://github.com/time-rs/time/pull/782

## Prompt

> `time::format_description::parse_strftime_borrowed` panics with an index-out-of-bounds error when the format string ends with a padding modifier right after `%`, such as `"%_"`, `"%-"` or `"%0"`.
> 
> Reproduction (`cargo run --example poc_strftime_oob_panic -p time --features formatting`):
> 
> ```rust
> fn main() {
>     let inputs = ["%_", "%-", "%0"];
> 
>     for input in &inputs {
>         println!("Trying to parse strftime format: {:?}", input);
>         time::format_description::parse_strftime_borrowed(input);
>     }
> }
> ```
> 
> Output:
> 
> ```
> Trying to parse strftime format: "%_"
> thread 'main' panicked at time/src/format_description/parse/strftime.rs:79:51:
> index out of bounds: the len is 2 but the index is 2
> ```
> 
> and the same for `"%-"` and `"%0"`. I expected an error to be returned for these malformed format strings instead of a panic, the same kind of
> error an unknown component such as `"%Q"` gives: a valid escape sequence was expected, at the position where the
> component is missing.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [time/src/format_description/parse/strftime.rs](../../tasks/rust-time-strftime-padding-panic/upstream/time/src/format_description/parse/strftime.rs), [time/tests/integration/parse_format_description.rs](../../tasks/rust-time-strftime-padding-panic/upstream/time/tests/integration/parse_format_description.rs)

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..51902a7 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -75,18 +75,28 @@ impl<'input> Iterator for Tokenizer<'input> {
             return Some(Ok(BorrowedFormatItem::StringLiteral(value)));
         }
 
-        let (padding, component, advance) = match self.input.get(1) {
-            Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
-            Some(&b'-') => (Some(Padding::None), self.input[2], 3),
-            Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
-            Some(_) => (None, self.input[1], 2),
-            _ => {
+        let padding = match self.input.get(1) {
+            Some(&b'_') => Some(Padding::Space),
+            Some(&b'-') => Some(Padding::None),
+            Some(&b'0') => Some(Padding::Zero),
+            Some(_) => None,
+            None => {
                 return Some(Err(error_expected_end(Location {
                     byte: self.byte_pos,
                 })));
             }
         };
 
+        let (component, advance) = match (padding, self.input.get(2)) {
+            (Some(_), Some(&component)) => (component, 3),
+            (Some(_), None) => {
+                return Some(Err(error_expected_end(Location {
+                    byte: self.byte_pos + 2,
+                })));
+            }
+            (None, _) => (self.input[1], 2),
+        };
+
         let component_loc = Location {
             byte: self.byte_pos + (advance - 1) as u32,
         };
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +17/-5 | 25 | 2,457 | $0.104 |
| claude | muffle | pass | +17/-5 | 25 | 2,615 | $0.103 |
| claude | hush | pass | +10/-4 | 0 | 1,259 | $0.068 |
| claude | sloth | pass | +11/-6 | 19 | 3,237 | $0.120 |
| claude | all | pass | +10/-5 | 25 | 2,259 | $0.099 |
| codex | base | pass | +8/-5 | 29 | 1,480 | - |
| codex | muffle | pass | +7/-4 | 32 | 1,526 | - |
| codex | hush | pass | +8/-5 | 29 | 1,576 | - |
| codex | sloth | pass | +5/-0 | 28 | 2,066 | - |
| codex | all | pass | +5/-0 | 26 | 1,894 | - |

### claude, base: pass

Files: [time/src/format_description/parse/strftime.rs](../base/claude/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs), [time/tests/integration/parse_format_description.rs](../base/claude/rust-time-strftime-padding-panic-1/files/time/tests/integration/parse_format_description.rs)

<details><summary>diff</summary>

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..f16acbd 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -76,11 +76,23 @@ impl<'input> Iterator for Tokenizer<'input> {
         }
 
         let (padding, component, advance) = match self.input.get(1) {
-            Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
-            Some(&b'-') => (Some(Padding::None), self.input[2], 3),
-            Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
-            Some(_) => (None, self.input[1], 2),
-            _ => {
+            Some(&modifier @ (b'_' | b'-' | b'0')) => {
+                let padding = match modifier {
+                    b'_' => Padding::Space,
+                    b'-' => Padding::None,
+                    _ => Padding::Zero,
+                };
+                match self.input.get(2) {
+                    Some(&component) => (Some(padding), component, 3),
+                    None => {
+                        return Some(Err(error_expected_end(Location {
+                            byte: self.byte_pos + 2,
+                        })));
+                    }
+                }
+            }
+            Some(&component) => (None, component, 2),
+            None => {
                 return Some(Err(error_expected_end(Location {
                     byte: self.byte_pos,
                 })));
diff --git a/time/tests/integration/parse_format_description.rs b/time/tests/integration/parse_format_description.rs
index 8e99b42..04b4cdd 100644
--- a/time/tests/integration/parse_format_description.rs
+++ b/time/tests/integration/parse_format_description.rs
@@ -1090,3 +1090,28 @@ fn strftime_compound_equivalence(#[case] strftime: &str, #[case] custom: &str) -
 
     Ok(())
 }
+
+#[rstest]
+#[case("%", 0)]
+#[case("%_", 2)]
+#[case("%-", 2)]
+#[case("%0", 2)]
+#[case("a%0", 3)]
+fn strftime_missing_component_error(#[case] strftime: &str, #[case] expected_index: usize) {
+    assert!(matches!(
+        format_description::parse_strftime_borrowed(strftime),
+        Err(InvalidFormatDescription::Expected {
+            what: "valid escape sequence",
+            index,
+            ..
+        }) if index == expected_index
+    ));
+    assert!(matches!(
+        format_description::parse_strftime_owned(strftime),
+        Err(InvalidFormatDescription::Expected {
+            what: "valid escape sequence",
+            index,
+            ..
+        }) if index == expected_index
+    ));
+}
```

</details>

<details><summary>reply</summary>

Let me add a test.

`parse_strftime_borrowed` no longer panics on `"%_"`, `"%-"` or `"%0"`. It now returns the same `Expected { what: "valid escape sequence", .. }` error that the bare `"%"` case already gave. The new and existing strftime tests pass; I didn't run the rest of the suite or your `poc_strftime_oob_panic` example (there is no `examples` directory in the repo).

The panic came from the tokenizer indexing `input[2]` without checking that a byte followed the padding modifier. The fix is in `time/src/format_description/parse/strftime.rs`. It now uses `get(2)` and reports the error at the byte offset where the component should have been, which is `%` position + 2. A bare trailing `%` still reports the position of the `%`.

I added a test, `strftime_missing_component_error`, in `time/tests/integration/parse_format_description.rs`. It covers `"%"`, `"%_"`, `"%-"`, `"%0"` and `"a%0"`, through both the borrowed and owned parsers, and checks the reported index.

I haven't committed anything.

</details>

### claude, muffle: pass

Files: [time/src/format_description/parse/strftime.rs](../muffle/claude/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs), [time/tests/integration/parse_format_description.rs](../muffle/claude/rust-time-strftime-padding-panic-1/files/time/tests/integration/parse_format_description.rs)

<details><summary>diff</summary>

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..f16acbd 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -76,11 +76,23 @@ impl<'input> Iterator for Tokenizer<'input> {
         }
 
         let (padding, component, advance) = match self.input.get(1) {
-            Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
-            Some(&b'-') => (Some(Padding::None), self.input[2], 3),
-            Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
-            Some(_) => (None, self.input[1], 2),
-            _ => {
+            Some(&modifier @ (b'_' | b'-' | b'0')) => {
+                let padding = match modifier {
+                    b'_' => Padding::Space,
+                    b'-' => Padding::None,
+                    _ => Padding::Zero,
+                };
+                match self.input.get(2) {
+                    Some(&component) => (Some(padding), component, 3),
+                    None => {
+                        return Some(Err(error_expected_end(Location {
+                            byte: self.byte_pos + 2,
+                        })));
+                    }
+                }
+            }
+            Some(&component) => (None, component, 2),
+            None => {
                 return Some(Err(error_expected_end(Location {
                     byte: self.byte_pos,
                 })));
diff --git a/time/tests/integration/parse_format_description.rs b/time/tests/integration/parse_format_description.rs
index 8e99b42..5b97713 100644
--- a/time/tests/integration/parse_format_description.rs
+++ b/time/tests/integration/parse_format_description.rs
@@ -1090,3 +1090,28 @@ fn strftime_compound_equivalence(#[case] strftime: &str, #[case] custom: &str) -
 
     Ok(())
 }
+
+#[rstest]
+#[case("%", 0)]
+#[case("%_", 2)]
+#[case("%-", 2)]
+#[case("%0", 2)]
+#[case("a%_", 3)]
+fn strftime_missing_component_error(#[case] strftime: &str, #[case] expected_index: usize) {
+    assert!(matches!(
+        format_description::parse_strftime_borrowed(strftime),
+        Err(InvalidFormatDescription::Expected {
+            what: "valid escape sequence",
+            index,
+            ..
+        }) if index == expected_index
+    ));
+    assert!(matches!(
+        format_description::parse_strftime_owned(strftime),
+        Err(InvalidFormatDescription::Expected {
+            what: "valid escape sequence",
+            index,
+            ..
+        }) if index == expected_index
+    ));
+}
```

</details>

<details><summary>reply</summary>

I've fixed the panic in the tokenizer and am adding a regression test next.

`parse_strftime_borrowed` (and `parse_strftime_owned`) now return an error for `"%_"`, `"%-"` and `"%0"` instead of panicking. The strftime tests pass, including the new ones. I only ran the strftime tests, not the whole suite, and I didn't run your `poc_strftime_oob_panic` example.

The tokenizer read the byte after the padding modifier without checking it existed. It now checks, and when the component is missing it returns the same `Expected { what: "valid escape sequence" }` error as other malformed escapes. The error index is the position where the component should have been, so 2 for `"%_"`. The fix is in `time/src/format_description/parse/strftime.rs`.

I added `strftime_missing_component_error` to `time/tests/integration/parse_format_description.rs`. It covers `%_`, `%-`, `%0`, `a%_` and a bare `%`. A bare `%` already returned an error, and its index is still 0.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [time/src/format_description/parse/strftime.rs](../hush/claude/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs)

<details><summary>diff</summary>

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..adc4efb 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -76,10 +76,10 @@ impl<'input> Iterator for Tokenizer<'input> {
         }
 
         let (padding, component, advance) = match self.input.get(1) {
-            Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
-            Some(&b'-') => (Some(Padding::None), self.input[2], 3),
-            Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
-            Some(_) => (None, self.input[1], 2),
+            Some(&b'_') => (Some(Padding::Space), self.input.get(2), 3),
+            Some(&b'-') => (Some(Padding::None), self.input.get(2), 3),
+            Some(&b'0') => (Some(Padding::Zero), self.input.get(2), 3),
+            Some(_) => (None, self.input.get(1), 2),
             _ => {
                 return Some(Err(error_expected_end(Location {
                     byte: self.byte_pos,
@@ -87,6 +87,12 @@ impl<'input> Iterator for Tokenizer<'input> {
             }
         };
 
+        let Some(&component) = component else {
+            return Some(Err(error_expected_end(Location {
+                byte: self.byte_pos + (advance - 1) as u32,
+            })));
+        };
+
         let component_loc = Location {
             byte: self.byte_pos + (advance - 1) as u32,
         };
```

</details>

<details><summary>reply</summary>

Done. `"%_"`, `"%-"` and `"%0"` now return `Expected { what: "valid escape sequence", index: 2 }` instead of panicking, using `.get()` in `strftime.rs`. It compiles, but I didn't run the repro or any tests, and I added no regression test.

</details>

### claude, sloth: pass

Files: [time/src/format_description/parse/strftime.rs](../sloth/claude/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs), [time/tests/integration/parse_format_description.rs](../sloth/claude/rust-time-strftime-padding-panic-1/files/time/tests/integration/parse_format_description.rs)

<details><summary>diff</summary>

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..82908e7 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -75,17 +75,22 @@ impl<'input> Iterator for Tokenizer<'input> {
             return Some(Ok(BorrowedFormatItem::StringLiteral(value)));
         }
 
-        let (padding, component, advance) = match self.input.get(1) {
-            Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
-            Some(&b'-') => (Some(Padding::None), self.input[2], 3),
-            Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
-            Some(_) => (None, self.input[1], 2),
-            _ => {
+        let (padding, advance) = match self.input.get(1) {
+            Some(&b'_') => (Some(Padding::Space), 3),
+            Some(&b'-') => (Some(Padding::None), 3),
+            Some(&b'0') => (Some(Padding::Zero), 3),
+            Some(_) => (None, 2),
+            None => {
                 return Some(Err(error_expected_end(Location {
                     byte: self.byte_pos,
                 })));
             }
         };
+        let Some(&component) = self.input.get(advance - 1) else {
+            return Some(Err(error_expected_end(Location {
+                byte: self.byte_pos + advance as u32 - 1,
+            })));
+        };
 
         let component_loc = Location {
             byte: self.byte_pos + (advance - 1) as u32,
diff --git a/time/tests/integration/parse_format_description.rs b/time/tests/integration/parse_format_description.rs
index 8e99b42..0833cb4 100644
--- a/time/tests/integration/parse_format_description.rs
+++ b/time/tests/integration/parse_format_description.rs
@@ -1090,3 +1090,22 @@ fn strftime_compound_equivalence(#[case] strftime: &str, #[case] custom: &str) -
 
     Ok(())
 }
+
+#[rstest]
+#[case("%", 0)]
+#[case("%_", 2)]
+#[case("%-", 2)]
+#[case("%0", 2)]
+#[case("a%_", 3)]
+fn strftime_missing_component(#[case] strftime: &str, #[case] expected_index: usize) {
+    assert!(matches!(
+        format_description::parse_strftime_borrowed(strftime),
+        Err(InvalidFormatDescription::Expected { what: "valid escape sequence", index, .. })
+            if index == expected_index
+    ));
+    assert!(matches!(
+        format_description::parse_strftime_owned(strftime),
+        Err(InvalidFormatDescription::Expected { what: "valid escape sequence", index, .. })
+            if index == expected_index
+    ));
+}
```

</details>

<details><summary>reply</summary>

Now the fix and test.

Use pattern matching like the existing tests.

`parse_strftime_borrowed("%_")`, `"%-"` and `"%0"` now return an error instead of panicking. It is the same "valid escape sequence" expected-error that a truncated `"%"` already gave. Its index is the position where the component is missing, so 2 for each of your three inputs. The strftime tests pass (46), but I didn't run the rest of the suite or your `poc_strftime_oob_panic` example.

The fix is in `time/src/format_description/parse/strftime.rs`. The tokenizer now reads the component byte with `get` and returns the error when it is absent. Previously it indexed `self.input[2]` directly after a padding modifier. `parse_strftime_owned` goes through the borrowed parser, so it is fixed too.

I added a `strftime_missing_component` test to `time/tests/integration/parse_format_description.rs`. It covers `%`, `%_`, `%-`, `%0` and `a%_` (index 3 after a literal), for both the borrowed and owned parsers.

The integration tests need `--all-features`, e.g. `cargo test -p time --all-features --test tests strftime`.

</details>

### claude, all: pass

Files: [time/src/format_description/parse/strftime.rs](../all/claude/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs), [time/tests/integration/parse_format_description.rs](../all/claude/rust-time-strftime-padding-panic-1/files/time/tests/integration/parse_format_description.rs)

<details><summary>diff</summary>

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..927e161 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -75,17 +75,22 @@ impl<'input> Iterator for Tokenizer<'input> {
             return Some(Ok(BorrowedFormatItem::StringLiteral(value)));
         }
 
-        let (padding, component, advance) = match self.input.get(1) {
-            Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
-            Some(&b'-') => (Some(Padding::None), self.input[2], 3),
-            Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
-            Some(_) => (None, self.input[1], 2),
+        let (padding, advance) = match self.input.get(1) {
+            Some(&b'_') => (Some(Padding::Space), 3),
+            Some(&b'-') => (Some(Padding::None), 3),
+            Some(&b'0') => (Some(Padding::Zero), 3),
+            Some(_) => (None, 2),
             _ => {
                 return Some(Err(error_expected_end(Location {
                     byte: self.byte_pos,
                 })));
             }
         };
+        let Some(&component) = self.input.get(advance - 1) else {
+            return Some(Err(error_expected_end(Location {
+                byte: self.byte_pos + advance as u32 - 1,
+            })));
+        };
 
         let component_loc = Location {
             byte: self.byte_pos + (advance - 1) as u32,
diff --git a/time/tests/integration/parse_format_description.rs b/time/tests/integration/parse_format_description.rs
index 8e99b42..5b97713 100644
--- a/time/tests/integration/parse_format_description.rs
+++ b/time/tests/integration/parse_format_description.rs
@@ -1090,3 +1090,28 @@ fn strftime_compound_equivalence(#[case] strftime: &str, #[case] custom: &str) -
 
     Ok(())
 }
+
+#[rstest]
+#[case("%", 0)]
+#[case("%_", 2)]
+#[case("%-", 2)]
+#[case("%0", 2)]
+#[case("a%_", 3)]
+fn strftime_missing_component_error(#[case] strftime: &str, #[case] expected_index: usize) {
+    assert!(matches!(
+        format_description::parse_strftime_borrowed(strftime),
+        Err(InvalidFormatDescription::Expected {
+            what: "valid escape sequence",
+            index,
+            ..
+        }) if index == expected_index
+    ));
+    assert!(matches!(
+        format_description::parse_strftime_owned(strftime),
+        Err(InvalidFormatDescription::Expected {
+            what: "valid escape sequence",
+            index,
+            ..
+        }) if index == expected_index
+    ));
+}
```

</details>

<details><summary>reply</summary>

Running the new test; target name was wrong, retrying with `--test tests`.

Done. `"%_"`, `"%-"`, `"%0"` now return `Expected { what: "valid escape sequence" }` at the missing component's index (2 for these) instead of panicking. The fix is in `strftime.rs`, and I added `strftime_missing_component_error` to the integration tests. The 46 strftime tests pass; I did not run the full suite.

</details>

### codex, base: pass

Files: [time/src/format_description/parse/strftime.rs](../base/codex/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs), [time/tests/integration/parse_format_description.rs](../base/codex/rust-time-strftime-padding-panic-1/files/time/tests/integration/parse_format_description.rs)

<details><summary>diff</summary>

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..eece455 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -75,11 +75,11 @@ impl<'input> Iterator for Tokenizer<'input> {
             return Some(Ok(BorrowedFormatItem::StringLiteral(value)));
         }
 
-        let (padding, component, advance) = match self.input.get(1) {
-            Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
-            Some(&b'-') => (Some(Padding::None), self.input[2], 3),
-            Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
-            Some(_) => (None, self.input[1], 2),
+        let (padding, advance) = match self.input.get(1) {
+            Some(&b'_') => (Some(Padding::Space), 3),
+            Some(&b'-') => (Some(Padding::None), 3),
+            Some(&b'0') => (Some(Padding::Zero), 3),
+            Some(_) => (None, 2),
             _ => {
                 return Some(Err(error_expected_end(Location {
                     byte: self.byte_pos,
@@ -90,6 +90,9 @@ impl<'input> Iterator for Tokenizer<'input> {
         let component_loc = Location {
             byte: self.byte_pos + (advance - 1) as u32,
         };
+        let Some(&component) = self.input.get(advance - 1) else {
+            return Some(Err(error_expected_end(component_loc)));
+        };
         self.input = &self.input[advance..];
         self.byte_pos += advance as u32;
         Some(parse_component(
diff --git a/time/tests/integration/parse_format_description.rs b/time/tests/integration/parse_format_description.rs
index 8e99b42..6124a46 100644
--- a/time/tests/integration/parse_format_description.rs
+++ b/time/tests/integration/parse_format_description.rs
@@ -1027,6 +1027,9 @@ fn rfc_3339() {
 #[case("%B", format_description!("[month repr:long]"))]
 #[case("%C", format_description!("[year repr:century]"))]
 #[case("%d", format_description!("[day]"))]
+#[case("%_d", format_description!("[day padding:space]"))]
+#[case("%-d", format_description!("[day padding:none]"))]
+#[case("%0d", format_description!("[day padding:zero]"))]
 #[case("%e", format_description!("[day padding:space]"))]
 #[case("%g", format_description!("[year repr:last_two base:iso_week]"))]
 #[case("%G", format_description!("[year base:iso_week]"))]
@@ -1090,3 +1093,29 @@ fn strftime_compound_equivalence(#[case] strftime: &str, #[case] custom: &str) -
 
     Ok(())
 }
+
+#[rstest]
+#[case("%", 0)]
+#[case("%_", 2)]
+#[case("%-", 2)]
+#[case("%0", 2)]
+#[case("prefix %_", 9)]
+#[case("prefix %-", 9)]
+#[case("prefix %0", 9)]
+#[case("é%_", 4)]
+#[case("%d%_", 4)]
+fn strftime_incomplete_escape(#[case] input: &str, #[case] index: usize) {
+    for error in [
+        format_description::parse_strftime_borrowed(input).unwrap_err(),
+        format_description::parse_strftime_owned(input).unwrap_err(),
+    ] {
+        assert!(matches!(
+            error,
+            InvalidFormatDescription::Expected {
+                what: "valid escape sequence",
+                index: actual_index,
+                ..
+            } if actual_index == index
+        ));
+    }
+}
```

</details>

<details><summary>reply</summary>

I’ll check the parser and existing tests, add the error handling, and run the relevant tests.

Fixed the panic in both borrowed and owned strftime parsers. Trailing `%_`, `%-`, and `%0` now return `InvalidFormatDescription::Expected` with `"valid escape sequence"` at the missing component’s byte index.

Added regression coverage for prefixes, UTF-8 byte positions, and valid padding modifiers. All 53 strftime tests pass.

Formatting checks found only existing issues in unrelated files.

</details>

### codex, muffle: pass

Files: [time/src/format_description/parse/strftime.rs](../muffle/codex/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs), [time/tests/integration/parse_format_description.rs](../muffle/codex/rust-time-strftime-padding-panic-1/files/time/tests/integration/parse_format_description.rs)

<details><summary>diff</summary>

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..3240f0e 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -76,10 +76,10 @@ impl<'input> Iterator for Tokenizer<'input> {
         }
 
         let (padding, component, advance) = match self.input.get(1) {
-            Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
-            Some(&b'-') => (Some(Padding::None), self.input[2], 3),
-            Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
-            Some(_) => (None, self.input[1], 2),
+            Some(&b'_') => (Some(Padding::Space), self.input.get(2), 3),
+            Some(&b'-') => (Some(Padding::None), self.input.get(2), 3),
+            Some(&b'0') => (Some(Padding::Zero), self.input.get(2), 3),
+            Some(component) => (None, Some(component), 2),
             _ => {
                 return Some(Err(error_expected_end(Location {
                     byte: self.byte_pos,
@@ -90,6 +90,9 @@ impl<'input> Iterator for Tokenizer<'input> {
         let component_loc = Location {
             byte: self.byte_pos + (advance - 1) as u32,
         };
+        let Some(&component) = component else {
+            return Some(Err(error_expected_end(component_loc)));
+        };
         self.input = &self.input[advance..];
         self.byte_pos += advance as u32;
         Some(parse_component(
diff --git a/time/tests/integration/parse_format_description.rs b/time/tests/integration/parse_format_description.rs
index 8e99b42..238a840 100644
--- a/time/tests/integration/parse_format_description.rs
+++ b/time/tests/integration/parse_format_description.rs
@@ -1019,8 +1019,40 @@ fn rfc_3339() {
     );
 }
 
+#[rstest]
+#[case("%_", 2)]
+#[case("%-", 2)]
+#[case("%0", 2)]
+#[case("foo%_", 5)]
+#[case("foo%-", 5)]
+#[case("foo%0", 5)]
+#[case("é%_", 4)]
+#[case("%Y%0", 4)]
+#[case("%", 0)]
+fn strftime_incomplete_escape(#[case] input: &str, #[case] expected_index: usize) {
+    assert!(matches!(
+        format_description::parse_strftime_borrowed(input),
+        Err(InvalidFormatDescription::Expected {
+            what: "valid escape sequence",
+            index,
+            ..
+        }) if index == expected_index
+    ));
+    assert!(matches!(
+        format_description::parse_strftime_owned(input),
+        Err(InvalidFormatDescription::Expected {
+            what: "valid escape sequence",
+            index,
+            ..
+        }) if index == expected_index
+    ));
+}
+
 #[rstest]
 #[case("foo", format_description!("foo"))]
+#[case("%_d", format_description!("[day padding:space]"))]
+#[case("%-d", format_description!("[day padding:none]"))]
+#[case("%0d", format_description!("[day padding:zero]"))]
 #[case("%a", format_description!("[weekday repr:short]"))]
 #[case("%A", format_description!("[weekday]"))]
 #[case("%b", format_description!("[month repr:short]"))]
```

</details>

<details><summary>reply</summary>

I’ll check how the parser handles padding modifiers, add a regression test, and make the malformed inputs return an error.

The parser now checks for a component after the padding modifier and returns `Expected { what: "valid escape sequence", index: 2 }` for each reported input. Regression tests cover both parsing APIs, byte offsets after prefixes, and valid padded formats. The focused test run is still running.

Fixed both borrowed and owned strftime parsers. `"%_"`, `"%-"`, and `"%0"` now return `InvalidFormatDescription::Expected` with `"valid escape sequence"` at byte index 2 instead of panicking.

Added regression coverage for all three modifiers, prefixed inputs, Unicode byte offsets, and valid padding.

Validation: all 53 strftime tests passed; `git diff --check` passed.

</details>

### codex, hush: pass

Files: [time/src/format_description/parse/strftime.rs](../hush/codex/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs), [time/tests/integration/parse_format_description.rs](../hush/codex/rust-time-strftime-padding-panic-1/files/time/tests/integration/parse_format_description.rs)

<details><summary>diff</summary>

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..eece455 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -75,11 +75,11 @@ impl<'input> Iterator for Tokenizer<'input> {
             return Some(Ok(BorrowedFormatItem::StringLiteral(value)));
         }
 
-        let (padding, component, advance) = match self.input.get(1) {
-            Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
-            Some(&b'-') => (Some(Padding::None), self.input[2], 3),
-            Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
-            Some(_) => (None, self.input[1], 2),
+        let (padding, advance) = match self.input.get(1) {
+            Some(&b'_') => (Some(Padding::Space), 3),
+            Some(&b'-') => (Some(Padding::None), 3),
+            Some(&b'0') => (Some(Padding::Zero), 3),
+            Some(_) => (None, 2),
             _ => {
                 return Some(Err(error_expected_end(Location {
                     byte: self.byte_pos,
@@ -90,6 +90,9 @@ impl<'input> Iterator for Tokenizer<'input> {
         let component_loc = Location {
             byte: self.byte_pos + (advance - 1) as u32,
         };
+        let Some(&component) = self.input.get(advance - 1) else {
+            return Some(Err(error_expected_end(component_loc)));
+        };
         self.input = &self.input[advance..];
         self.byte_pos += advance as u32;
         Some(parse_component(
diff --git a/time/tests/integration/parse_format_description.rs b/time/tests/integration/parse_format_description.rs
index 8e99b42..569d051 100644
--- a/time/tests/integration/parse_format_description.rs
+++ b/time/tests/integration/parse_format_description.rs
@@ -1027,6 +1027,9 @@ fn rfc_3339() {
 #[case("%B", format_description!("[month repr:long]"))]
 #[case("%C", format_description!("[year repr:century]"))]
 #[case("%d", format_description!("[day]"))]
+#[case("%_d", format_description!("[day padding:space]"))]
+#[case("%-d", format_description!("[day padding:none]"))]
+#[case("%0d", format_description!("[day padding:zero]"))]
 #[case("%e", format_description!("[day padding:space]"))]
 #[case("%g", format_description!("[year repr:last_two base:iso_week]"))]
 #[case("%G", format_description!("[year base:iso_week]"))]
@@ -1090,3 +1093,29 @@ fn strftime_compound_equivalence(#[case] strftime: &str, #[case] custom: &str) -
 
     Ok(())
 }
+
+#[rstest]
+#[case("%_", 2)]
+#[case("%-", 2)]
+#[case("%0", 2)]
+#[case("prefix %_", 9)]
+#[case("prefix %-", 9)]
+#[case("prefix %0", 9)]
+#[case("é%_", 4)]
+#[case("%Y%0", 4)]
+#[case("%", 0)]
+fn strftime_escape_error(#[case] input: &str, #[case] expected_index: usize) {
+    for error in [
+        format_description::parse_strftime_borrowed(input).unwrap_err(),
+        format_description::parse_strftime_owned(input).unwrap_err(),
+    ] {
+        assert!(matches!(
+            error,
+            InvalidFormatDescription::Expected {
+                what: "valid escape sequence",
+                index,
+                ..
+            } if index == expected_index
+        ));
+    }
+}
```

</details>

<details><summary>reply</summary>

Fix targets missing component after padding modifier; check parser and regression tests.


Done.
Trailing padding modifiers return errors at missing component’s byte index. Borrowed and owned parsers covered; 53 strftime tests passed.

</details>

### codex, sloth: pass

Files: [time/src/format_description/parse/strftime.rs](../sloth/codex/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs), [time/tests/integration/parse_format_description.rs](../sloth/codex/rust-time-strftime-padding-panic-1/files/time/tests/integration/parse_format_description.rs)

<details><summary>diff</summary>

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..ca9e3ad 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -76,6 +76,11 @@ impl<'input> Iterator for Tokenizer<'input> {
         }
 
         let (padding, component, advance) = match self.input.get(1) {
+            Some(b'_' | b'-' | b'0') if self.input.len() == 2 => {
+                return Some(Err(error_expected_end(Location {
+                    byte: self.byte_pos + 2,
+                })));
+            }
             Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
             Some(&b'-') => (Some(Padding::None), self.input[2], 3),
             Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
diff --git a/time/tests/integration/parse_format_description.rs b/time/tests/integration/parse_format_description.rs
index 8e99b42..bf6c243 100644
--- a/time/tests/integration/parse_format_description.rs
+++ b/time/tests/integration/parse_format_description.rs
@@ -1019,6 +1019,34 @@ fn rfc_3339() {
     );
 }
 
+/// Incomplete escapes return an error at the expected byte position in both parsers.
+#[rstest]
+#[case("%", 0)]
+#[case("%_", 2)]
+#[case("%-", 2)]
+#[case("%0", 2)]
+#[case("prefix %_", 9)]
+#[case("é%-", 4)]
+#[case("%Y%0", 4)]
+fn strftime_incomplete_escape(#[case] input: &str, #[case] index: usize) {
+    assert!(matches!(
+        format_description::parse_strftime_borrowed(input),
+        Err(InvalidFormatDescription::Expected {
+            what: "valid escape sequence",
+            index: actual,
+            ..
+        }) if actual == index
+    ));
+    assert!(matches!(
+        format_description::parse_strftime_owned(input),
+        Err(InvalidFormatDescription::Expected {
+            what: "valid escape sequence",
+            index: actual,
+            ..
+        }) if actual == index
+    ));
+}
+
 #[rstest]
 #[case("foo", format_description!("foo"))]
 #[case("%a", format_description!("[weekday repr:short]"))]
```

</details>

<details><summary>reply</summary>

I’ll check how the parser handles padding modifiers and reports error positions, add a focused regression test, then build and run the tests.

Both public strftime parsers use the same tokenizer, so the fix belongs there. I’ll add a bounds check and tests for both APIs, including literal and multibyte prefixes to verify byte positions. No caller, export, fixture, or configuration changes are needed; the existing error position for a bare `%` will stay unchanged.

The build and all 5,029 integration tests passed, including the seven regression cases. Documentation tests are still running. The malformed padded escapes now return `Expected { what: "valid escape sequence", index: … }` at the missing component’s byte position.

Fixed the shared tokenizer so `"%_"`, `"%-"`, and `"%0"` return an `Expected` error for `"valid escape sequence"` at byte index 2 instead of panicking. Both borrowed and owned parsers are covered.

Added regression tests for all three modifiers and prefixed inputs, including UTF-8 byte positions.

Validation passed: formatting-feature build and all tests, including documentation tests.

</details>

### codex, all: pass

Files: [time/src/format_description/parse/strftime.rs](../all/codex/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs), [time/tests/integration/parse_format_description.rs](../all/codex/rust-time-strftime-padding-panic-1/files/time/tests/integration/parse_format_description.rs)

<details><summary>diff</summary>

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..ca9e3ad 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -76,6 +76,11 @@ impl<'input> Iterator for Tokenizer<'input> {
         }
 
         let (padding, component, advance) = match self.input.get(1) {
+            Some(b'_' | b'-' | b'0') if self.input.len() == 2 => {
+                return Some(Err(error_expected_end(Location {
+                    byte: self.byte_pos + 2,
+                })));
+            }
             Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
             Some(&b'-') => (Some(Padding::None), self.input[2], 3),
             Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
diff --git a/time/tests/integration/parse_format_description.rs b/time/tests/integration/parse_format_description.rs
index 8e99b42..9664f88 100644
--- a/time/tests/integration/parse_format_description.rs
+++ b/time/tests/integration/parse_format_description.rs
@@ -1065,6 +1065,32 @@ fn strftime_equivalence(
     Ok(())
 }
 
+/// Missing strftime components report their byte position for both parsers.
+#[rstest]
+#[case("%_", 2)]
+#[case("%-", 2)]
+#[case("%0", 2)]
+#[case("abc%_", 5)]
+#[case("é%-", 4)]
+#[case("%Y%0", 4)]
+#[case("%", 0)]
+#[case("abc%", 3)]
+fn strftime_missing_component(#[case] input: &str, #[case] index: usize) {
+    for error in [
+        format_description::parse_strftime_borrowed(input).unwrap_err(),
+        format_description::parse_strftime_owned(input).unwrap_err(),
+    ] {
+        assert!(matches!(
+            error,
+            InvalidFormatDescription::Expected {
+                what: "valid escape sequence",
+                index: actual_index,
+                ..
+            } if actual_index == index
+        ));
+    }
+}
+
 #[rstest]
 #[case(
     "%c",
```

</details>

<details><summary>reply</summary>

Done.
Both parsers return errors at missing component positions. Regression tests, build, all-feature tests pass. Formatting check blocked by existing differences.

</details>
