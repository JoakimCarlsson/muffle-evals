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
| claude | muffle | pass | +10/-9 | 17 | 2,194 | $0.083 |
| claude | hush | pass | +14/-4 | 0 | 1,594 | $0.069 |
| claude | sloth | pass | +10/-10 | 0 | 3,165 | $0.100 |
| claude | all | pass | +14/-5 | 0 | 1,343 | $0.055 |
| codex | base | pass | +8/-5 | 29 | 1,480 | - |
| codex | muffle | pass | +8/-5 | 26 | 1,435 | - |
| codex | hush | pass | +8/-5 | 28 | 1,458 | - |
| codex | sloth | pass | +8/-5 | 0 | 1,595 | - |
| codex | all | pass | +8/-5 | 0 | 953 | - |

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
index b98df69..d9b542a 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -76,15 +76,16 @@ impl<'input> Iterator for Tokenizer<'input> {
         }
 
         let (padding, component, advance) = match self.input.get(1) {
-            Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
-            Some(&b'-') => (Some(Padding::None), self.input[2], 3),
-            Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
-            Some(_) => (None, self.input[1], 2),
-            _ => {
-                return Some(Err(error_expected_end(Location {
-                    byte: self.byte_pos,
-                })));
-            }
+            Some(&b'_') => (Some(Padding::Space), self.input.get(2), 3),
+            Some(&b'-') => (Some(Padding::None), self.input.get(2), 3),
+            Some(&b'0') => (Some(Padding::Zero), self.input.get(2), 3),
+            Some(_) => (None, self.input.get(1), 2),
+            None => (None, None, 1),
+        };
+        let Some(&component) = component else {
+            return Some(Err(error_expected_end(Location {
+                byte: self.byte_pos + (advance - 1) as u32,
+            })));
         };
 
         let component_loc = Location {
diff --git a/time/tests/integration/parse_format_description.rs b/time/tests/integration/parse_format_description.rs
index 8e99b42..c2c7bfd 100644
--- a/time/tests/integration/parse_format_description.rs
+++ b/time/tests/integration/parse_format_description.rs
@@ -1090,3 +1090,20 @@ fn strftime_compound_equivalence(#[case] strftime: &str, #[case] custom: &str) -
 
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

Running the tests again with the right target name (`tests`). Also checking the file's current state, since it changed on disk.

`parse_strftime_borrowed` and `parse_strftime_owned` no longer panic on a trailing `%_`, `%-` or `%0`. They now return the same "valid escape sequence" error that other malformed escapes give.

The strftime tests pass, including the new ones. I did not run the whole test suite, or the `poc_strftime_oob_panic` example from your report.

The tokenizer in `time/src/format_description/parse/strftime.rs` read the byte after the padding modifier with direct indexing. It now uses a checked lookup. If that byte is missing, the error index is the position where the component should have been, so `"%_"` gives index 2.

A bare `"%"` still reports index 0, as before.

I added a `strftime_missing_component` test in `time/tests/integration/parse_format_description.rs`. It covers `%`, `%_`, `%-`, `%0` and `a%_` (index 3).

I haven't committed anything.

</details>

### claude, hush: pass

Files: [time/src/format_description/parse/strftime.rs](../hush/claude/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs)

<details><summary>diff</summary>

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..24717b1 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -76,10 +76,20 @@ impl<'input> Iterator for Tokenizer<'input> {
         }
 
         let (padding, component, advance) = match self.input.get(1) {
-            Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
-            Some(&b'-') => (Some(Padding::None), self.input[2], 3),
-            Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
-            Some(_) => (None, self.input[1], 2),
+            Some(&modifier @ (b'_' | b'-' | b'0')) => {
+                let Some(&component) = self.input.get(2) else {
+                    return Some(Err(error_expected_end(Location {
+                        byte: self.byte_pos + 2,
+                    })));
+                };
+                let padding = match modifier {
+                    b'_' => Padding::Space,
+                    b'-' => Padding::None,
+                    _ => Padding::Zero,
+                };
+                (Some(padding), component, 3)
+            }
+            Some(&component) => (None, component, 2),
             _ => {
                 return Some(Err(error_expected_end(Location {
                     byte: self.byte_pos,
```

</details>

<details><summary>reply</summary>

Compiles. Quick check of behavior.

Done. `"%_"`, `"%-"` and `"%0"` now return `Expected { what: "valid escape sequence", index: 2 }` instead of panicking. The fix is in `strftime.rs`. I checked it with a throwaway test, since deleted, but added no permanent regression test.

</details>

### claude, sloth: pass

Files: [time/src/format_description/parse/strftime.rs](../sloth/claude/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs)

<details><summary>diff</summary>

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..5288cbf 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -75,16 +75,16 @@ impl<'input> Iterator for Tokenizer<'input> {
             return Some(Ok(BorrowedFormatItem::StringLiteral(value)));
         }
 
-        let (padding, component, advance) = match self.input.get(1) {
-            Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
-            Some(&b'-') => (Some(Padding::None), self.input[2], 3),
-            Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
-            Some(_) => (None, self.input[1], 2),
-            _ => {
-                return Some(Err(error_expected_end(Location {
-                    byte: self.byte_pos,
-                })));
-            }
+        let (padding, advance) = match self.input.get(1) {
+            Some(&b'_') => (Some(Padding::Space), 3),
+            Some(&b'-') => (Some(Padding::None), 3),
+            Some(&b'0') => (Some(Padding::Zero), 3),
+            _ => (None, 2),
+        };
+        let Some(&component) = self.input.get(advance - 1) else {
+            return Some(Err(error_expected_end(Location {
+                byte: self.byte_pos + if padding.is_some() { 2 } else { 0 },
+            })));
         };
 
         let component_loc = Location {
```

</details>

<details><summary>reply</summary>

Re-running my check with the `formatting` feature enabled.

`parse_strftime_borrowed` no longer panics on `"%_"`, `"%-"` or `"%0"`. It now returns the same error as `"%"` alone, `Expected { what: "valid escape sequence", index }`. The `index` is where the missing component should be, which is 2 for these three. Format strings with text in front of the `%` report the shifted position, so `"a%_"` gives index 3.

The fix is in `time/src/format_description/parse/strftime.rs`. The tokenizer now reads the component byte with `get` instead of indexing, so it can't run off the end. The error index for a bare `"%"` is unchanged at 0.

I ran the five inputs `"%_"`, `"%-"`, `"%0"`, `"%"` and `"a%_"` through a throwaway example, and they gave the errors above. `cargo test -p time --all-features` passed in the unit-test section that I looked at, but I cut the output short, so I didn't confirm that every suite finished. I did not add a regression test, since you didn't ask for one. I removed the throwaway example, and the only changed file is the one above.

</details>

### claude, all: pass

Files: [time/src/format_description/parse/strftime.rs](../all/claude/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs)

<details><summary>diff</summary>

```diff
diff --git a/time/src/format_description/parse/strftime.rs b/time/src/format_description/parse/strftime.rs
index b98df69..a47167e 100644
--- a/time/src/format_description/parse/strftime.rs
+++ b/time/src/format_description/parse/strftime.rs
@@ -75,11 +75,20 @@ impl<'input> Iterator for Tokenizer<'input> {
             return Some(Ok(BorrowedFormatItem::StringLiteral(value)));
         }
 
-        let (padding, component, advance) = match self.input.get(1) {
-            Some(&b'_') => (Some(Padding::Space), self.input[2], 3),
-            Some(&b'-') => (Some(Padding::None), self.input[2], 3),
-            Some(&b'0') => (Some(Padding::Zero), self.input[2], 3),
-            Some(_) => (None, self.input[1], 2),
+        let padding = match self.input.get(1) {
+            Some(&b'_') => Some(Padding::Space),
+            Some(&b'-') => Some(Padding::None),
+            Some(&b'0') => Some(Padding::Zero),
+            _ => None,
+        };
+        let (component, advance) = match (padding, self.input.get(1), self.input.get(2)) {
+            (Some(_), _, Some(&component)) => (component, 3),
+            (Some(_), _, None) => {
+                return Some(Err(error_expected_end(Location {
+                    byte: self.byte_pos + 2,
+                })));
+            }
+            (None, Some(&component), _) => (component, 2),
             _ => {
                 return Some(Err(error_expected_end(Location {
                     byte: self.byte_pos,
```

</details>

<details><summary>reply</summary>

Unrelated feature gap; build lib only.

Done. `"%_"`, `"%-"` and `"%0"` now return `Expected { what: "valid escape sequence" }` at the missing component's index (byte 2 for these inputs). The change is in `strftime.rs`. The library builds. I didn't run the repro or the test suite: the test target fails to compile with these features (`rstest` attribute not found).

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
index 8e99b42..3bb82bf 100644
--- a/time/tests/integration/parse_format_description.rs
+++ b/time/tests/integration/parse_format_description.rs
@@ -1090,3 +1090,29 @@ fn strftime_compound_equivalence(#[case] strftime: &str, #[case] custom: &str) -
 
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
+#[case("%Y%_", 4)]
+#[case("%", 0)]
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
```

</details>

<details><summary>reply</summary>

I’ll check the parser and existing tests, fix the bounds check, and add regression coverage for all three modifiers.

Fixed the bounds check. Trailing `%_`, `%-`, and `%0` now return `InvalidFormatDescription::Expected` for a valid escape sequence at the missing component’s byte position.

Added regression tests for borrowed and owned parsing, including prefixed and UTF-8 inputs. All format-description tests pass.

Formatting checks found only pre-existing issues in unrelated files.

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
index 8e99b42..11bf90b 100644
--- a/time/tests/integration/parse_format_description.rs
+++ b/time/tests/integration/parse_format_description.rs
@@ -1090,3 +1090,31 @@ fn strftime_compound_equivalence(#[case] strftime: &str, #[case] custom: &str) -
 
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
+#[case("%Y%_", 4)]
+fn strftime_missing_component(#[case] input: &str, #[case] expected_index: usize) {
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
```

</details>

<details><summary>reply</summary>

Fix targets padding-modifier parsing and regression tests.

Done.
Missing components return errors with correct byte positions. Borrowed/owned regression tests added; 49 tests passed. Formatting check blocked by existing differences.

</details>

### codex, sloth: pass

Files: [time/src/format_description/parse/strftime.rs](../sloth/codex/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs)

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
```

</details>

<details><summary>reply</summary>

I’ll check the shared strftime parser and its callers, fix the bounds check, then build and run the existing tests.

All three padding branches index the missing component byte without checking its length. The fix belongs in the shared tokenizer, which also covers `parse_strftime_owned`. No caller, export, fixture, or configuration changes are needed. I’ll preserve valid-format behavior and return the existing “valid escape sequence” error at the missing byte’s position.

Fixed the shared tokenizer to check for a component before indexing it. Both borrowed and owned parsers now return `Expected { what: "valid escape sequence", index: 2 }` for `"%_"`, `"%-"`, and `"%0"`.

Verified the reproduction, byte offsets after prefixes, and valid padded formats. Build and existing tests with `--all-features` passed.

</details>

### codex, all: pass

Files: [time/src/format_description/parse/strftime.rs](../all/codex/rust-time-strftime-padding-panic-1/files/time/src/format_description/parse/strftime.rs)

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
```

</details>

<details><summary>reply</summary>

Done.
Borrowed/owned parsers return `Expected` at missing component position for trailing padding modifiers. Build and all-feature tests passed.

</details>
