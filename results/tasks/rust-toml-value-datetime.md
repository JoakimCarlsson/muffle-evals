# rust-toml-value-datetime

Source: https://github.com/toml-rs/toml/pull/1194

## Prompt

> Deserializing a TOML datetime from a `toml::Value` into a struct fails, even though deserializing the same document directly into the struct works.
> 
> ```rust
> use serde::Deserialize;
> 
> #[derive(Deserialize, Debug)]
> struct Settings {
>     last_updated: toml::value::Datetime,
>     minimum_interval: i64,
> }
> 
> fn main() {
>     let v: toml::value::Table = toml::from_str(r#"[settings]
> last_updated = 2023-01-15T11:42:14-06:00
> minimum_interval = 3600
> "#).unwrap();
> 
>     let x = v.get("settings").unwrap().clone();
>     let n = Settings::deserialize(x).unwrap();
> 
>     println!("last_updated: {}, minimum_interval: {}", n.last_updated, n.minimum_interval);
> }
> ```
> 
> I expected this to behave the same as deserializing the whole document with `toml::from_str`. Instead it fails with:
> 
> ```
> invalid type: string "2023-01-15T11:42:14-06:00", expected a TOML datetime
> ```
> 
> The same happens with `value.try_into::<toml::value::Datetime>()`. Converting such a `Value` into other formats, for example `serde_json::Value`, currently gives the datetime as a plain string, and that should keep working.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [crates/toml/src/table.rs](../../tasks/rust-toml-value-datetime/upstream/crates/toml/src/table.rs), [crates/toml/src/value.rs](../../tasks/rust-toml-value-datetime/upstream/crates/toml/src/value.rs), [crates/toml/tests/serde/general.rs](../../tasks/rust-toml-value-datetime/upstream/crates/toml/tests/serde/general.rs), [crates/toml_edit/tests/serde/general.rs](../../tasks/rust-toml-value-datetime/upstream/crates/toml_edit/tests/serde/general.rs)

```diff
diff --git a/crates/toml/src/table.rs b/crates/toml/src/table.rs
index 214bc8f..ea571ec 100644
--- a/crates/toml/src/table.rs
+++ b/crates/toml/src/table.rs
@@ -157,9 +157,21 @@ impl<'de> de::Deserializer<'de> for Table {
         Value::Table(self).deserialize_newtype_struct(name, visitor)
     }
 
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        Value::Table(self).deserialize_struct(name, fields, visitor)
+    }
+
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..214ca36 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -608,9 +608,26 @@ impl<'de> de::Deserializer<'de> for Value {
         visitor.visit_newtype_struct(self)
     }
 
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        _fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        match (toml_datetime::de::is_datetime(name), self) {
+            (true, Self::Datetime(v)) => {
+                visitor.visit_map(toml_datetime::de::DatetimeDeserializer::new(v))
+            }
+            (_, value) => value.deserialize_any(visitor),
+        }
+    }
+
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +18/-1 | 0 | 3,051 | $0.119 |
| claude | muffle | pass | +18/-1 | 22 | 2,719 | $0.103 |
| claude | hush | pass | +18/-1 | 0 | 1,963 | $0.092 |
| claude | sloth | pass | +19/-1 | 0 | 2,455 | $0.093 |
| claude | all | pass | +19/-1 | 0 | 2,736 | $0.114 |
| codex | base | pass | +19/-1 | 41 | 1,492 | - |
| codex | muffle | pass | +32/-2 | 53 | 1,705 | - |
| codex | hush | pass | +18/-1 | 42 | 1,151 | - |
| codex | sloth | pass | +34/-2 | 0 | 1,547 | - |
| codex | all | pass | +19/-1 | 0 | 878 | - |

### claude, base: pass

Files: [crates/toml/src/value.rs](../base/claude/rust-toml-value-datetime-1/files/crates/toml/src/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..7707403 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -608,9 +608,26 @@ impl<'de> de::Deserializer<'de> for Value {
         visitor.visit_newtype_struct(self)
     }
 
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        _fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        if toml_datetime::de::is_datetime(name) {
+            if let Self::Datetime(v) = self {
+                return visitor.visit_map(toml_datetime::de::DatetimeDeserializer::new(v));
+            }
+        }
+        self.deserialize_any(visitor)
+    }
+
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
```

</details>

<details><summary>reply</summary>

Add a `deserialize_struct` override and remove `struct` from the forward list.

I mistakenly deleted the existing examples directory; restoring it.

Your example now works. `Settings::deserialize(value)` and `value.try_into::<Datetime>()` both return the datetime with the right date, time and `-06:00` offset.

The fix is in `crates/toml/src/value.rs`. `Value`'s deserializer sent every struct request through `deserialize_any`, which hands a datetime over as a string. I added a `deserialize_struct` override. When the target is `Datetime` and the value is a datetime, it passes the datetime through in the same form the `toml::from_str` path uses. Every other case still goes through `deserialize_any`, so converting to a plain string, or to something like `serde_json::Value`, still gives the datetime as a string. I checked the string case by deserializing the datetime into a `String`, which gave `2023-01-15T11:42:14-06:00`. I didn't run a `serde_json` conversion itself.

The existing test suite passes. I didn't add a regression test, since I checked the fix with a throwaway example that I've since deleted. I accidentally deleted the repo's own `examples/` files while cleaning up and restored them with `git checkout`. `git status` now shows only the change to `value.rs`.

</details>

### claude, muffle: pass

Files: [crates/toml/src/value.rs](../muffle/claude/rust-toml-value-datetime-1/files/crates/toml/src/value.rs), [crates/toml/tests/testsuite/value.rs](../muffle/claude/rust-toml-value-datetime-1/files/crates/toml/tests/testsuite/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..7707403 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -608,9 +608,26 @@ impl<'de> de::Deserializer<'de> for Value {
         visitor.visit_newtype_struct(self)
     }
 
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        _fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        if toml_datetime::de::is_datetime(name) {
+            if let Self::Datetime(v) = self {
+                return visitor.visit_map(toml_datetime::de::DatetimeDeserializer::new(v));
+            }
+        }
+        self.deserialize_any(visitor)
+    }
+
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
diff --git a/crates/toml/tests/testsuite/value.rs b/crates/toml/tests/testsuite/value.rs
index 46513da..a43b1ff 100644
--- a/crates/toml/tests/testsuite/value.rs
+++ b/crates/toml/tests/testsuite/value.rs
@@ -25,3 +25,25 @@ fn display() {
         str!["{ test = 2, test2 = 3 }"].raw()
     );
 }
+
+#[test]
+fn deserialize_datetime_from_value() {
+    #[derive(serde::Deserialize)]
+    struct Settings {
+        last_updated: toml::value::Datetime,
+        minimum_interval: i64,
+    }
+
+    let v: toml::Table = toml::from_str(
+        "[settings]\nlast_updated = 2023-01-15T11:42:14-06:00\nminimum_interval = 3600\n",
+    )
+    .unwrap();
+    let s = v["settings"].clone().try_into::<Settings>().unwrap();
+    assert_eq!(s.last_updated.to_string(), "2023-01-15T11:42:14-06:00");
+    assert_eq!(s.minimum_interval, 3600);
+
+    let d = toml::Value::Datetime("1979-05-27".parse().unwrap())
+        .try_into::<toml::value::Datetime>()
+        .unwrap();
+    assert_eq!(d.to_string(), "1979-05-27");
+}
```

</details>

<details><summary>reply</summary>

Fix is in and builds. Next I'm adding a regression test and running the suite.

Deserializing a `toml::Value` datetime into a struct now works. That covers `Settings::deserialize(value)` and `value.try_into::<Datetime>()`. The full test suite passes.

**Cause:** the `Deserializer` impl for `Value` forwarded `deserialize_struct` to `deserialize_any`. A datetime reached the visitor as a plain string. `Datetime`'s own `Deserialize` expects the special datetime map, so it rejected the string.

**Fix:** in `crates/toml/src/value.rs` I added a `deserialize_struct` override on `Value`. When serde asks for the datetime type and the value is a `Datetime`, it now hands the visitor the datetime map. Every other case still goes through `deserialize_any`.

`deserialize_any` still emits datetimes as strings, so converting to `serde_json::Value` is unchanged. I didn't write a test for that case, so it's covered by the code path being untouched.

I added a regression test, `deserialize_datetime_from_value`, in `crates/toml/tests/testsuite/value.rs`. It uses your struct example and a bare `Value::Datetime` converted with `try_into::<Datetime>()`.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [crates/toml/src/value.rs](../hush/claude/rust-toml-value-datetime-1/files/crates/toml/src/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..19d9c86 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -588,6 +588,23 @@ impl<'de> de::Deserializer<'de> for Value {
         }
     }
 
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        _fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        if toml_datetime::de::is_datetime(name) {
+            if let Self::Datetime(v) = self {
+                return visitor.visit_map(toml_datetime::de::DatetimeDeserializer::new(v));
+            }
+        }
+        self.deserialize_any(visitor)
+    }
+
     // `None` is interpreted as a missing field so be sure to implement `Some`
     // as a present field.
     fn deserialize_option<V>(self, visitor: V) -> Result<V::Value, crate::de::Error>
@@ -610,7 +627,7 @@ impl<'de> de::Deserializer<'de> for Value {
 
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
```

</details>

<details><summary>reply</summary>

Adding `deserialize_struct` to `Value`'s deserializer. Retrying the edit.

Done. `Value` now has `deserialize_struct` in `crates/toml/src/value.rs`. It hands `Datetime` structs a real datetime, and `deserialize_any` still gives other formats a string. Existing tests pass. I didn't run your repro and didn't add a regression test.

</details>

### claude, sloth: pass

Files: [crates/toml/src/value.rs](../sloth/claude/rust-toml-value-datetime-1/files/crates/toml/src/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..f0843af 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -608,9 +608,27 @@ impl<'de> de::Deserializer<'de> for Value {
         visitor.visit_newtype_struct(self)
     }
 
+    /// Hands a datetime to `Datetime`'s own `Deserialize` impl instead of as a string.
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        _fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        match self {
+            Self::Datetime(v) if toml_datetime::de::is_datetime(name) => {
+                visitor.visit_map(toml_datetime::de::DatetimeDeserializer::new(v))
+            }
+            _ => self.deserialize_any(visitor),
+        }
+    }
+
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
```

</details>

<details><summary>reply</summary>

Add a `deserialize_struct` override and remove `struct` from the forwarded list.

Deserializing a `toml::Value` into a struct with a `Datetime` field should now work. I didn't run your example, and I didn't add a test for it. The existing `toml` crate tests pass.

**Cause:** `Value`'s `Deserializer` turned every datetime into a string. `Datetime`'s `Deserialize` impl expects the special map form, so you got "expected a TOML datetime".

**Fix:** I added a `deserialize_struct` override in `crates/toml/src/value.rs`. When the target type is `Datetime` and the value is a datetime, it now hands over the datetime in that map form. `try_into::<Datetime>()` goes through the same path, so it is fixed too.

**Other formats:** `deserialize_any` still produces a string, so converting to `serde_json::Value` still gives a plain string.

`Table`'s deserializer wraps `Value`'s, so I didn't touch it.

</details>

### claude, all: pass

Files: [crates/toml/src/value.rs](../all/claude/rust-toml-value-datetime-1/files/crates/toml/src/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..eaad272 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -608,9 +608,27 @@ impl<'de> de::Deserializer<'de> for Value {
         visitor.visit_newtype_struct(self)
     }
 
+    /// Emits [`Datetime`] as its private map form when asked for one, otherwise defers to `deserialize_any`.
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        _fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        match self {
+            Self::Datetime(v) if toml_datetime::de::is_datetime(name) => {
+                visitor.visit_map(toml_datetime::de::DatetimeDeserializer::new(v))
+            }
+            other => other.deserialize_any(visitor),
+        }
+    }
+
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
```

</details>

<details><summary>reply</summary>

Adding `deserialize_struct` to `Value`'s deserializer so datetimes go through the datetime map path. `deserialize_any` stays a string, so the `serde_json` conversion is unchanged.

I mistyped the match string. Retrying with the exact text.

Oops, I deleted existing examples. Restoring.

Done. `Value` now has `deserialize_struct` in `crates/toml/src/value.rs`, so `Settings::deserialize(value)` and `try_into::<Datetime>()` both work. I ran your repro, and the existing tests pass. `deserialize_any` still gives a string, so `serde_json` conversion is unchanged, though I didn't test that path. I didn't add a regression test.

I briefly deleted `crates/toml/examples/` while cleaning up my repro file, then restored it with `git checkout`. `git status` shows only `value.rs` modified.

</details>

### codex, base: pass

Files: [crates/toml/src/value.rs](../base/codex/rust-toml-value-datetime-1/files/crates/toml/src/value.rs), [crates/toml/tests/testsuite/value.rs](../base/codex/rust-toml-value-datetime-1/files/crates/toml/tests/testsuite/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..eaa3e13 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -608,9 +608,27 @@ impl<'de> de::Deserializer<'de> for Value {
         visitor.visit_newtype_struct(self)
     }
 
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        _fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        if toml_datetime::de::is_datetime(name) {
+            if let Self::Datetime(datetime) = self {
+                return visitor.visit_map(toml_datetime::de::DatetimeDeserializer::new(datetime));
+            }
+        }
+
+        self.deserialize_any(visitor)
+    }
+
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
diff --git a/crates/toml/tests/testsuite/value.rs b/crates/toml/tests/testsuite/value.rs
index 46513da..565df80 100644
--- a/crates/toml/tests/testsuite/value.rs
+++ b/crates/toml/tests/testsuite/value.rs
@@ -5,6 +5,47 @@ use snapbox::str;
 use toml::Value::{Array, Boolean, Float, Integer, String, Table};
 use toml::map::Map;
 
+#[test]
+fn deserialize_datetime() {
+    use serde::Deserialize;
+
+    #[derive(Debug, Deserialize, PartialEq)]
+    struct Settings {
+        last_updated: toml::value::Datetime,
+        minimum_interval: i64,
+    }
+
+    for datetime in [
+        "2023-01-15T11:42:14-06:00",
+        "2023-01-15T11:42:14Z",
+        "2023-01-15T11:42:14.123",
+        "2023-01-15",
+        "11:42:14.123",
+    ] {
+        let document = format!("last_updated = {datetime}\nminimum_interval = 3600\n");
+        let expected: Settings = toml::from_str(&document).unwrap();
+        let value: toml::Value = toml::from_str(&document).unwrap();
+        assert_eq!(Settings::deserialize(value.clone()).unwrap(), expected);
+
+        let datetime_value = value.get("last_updated").unwrap().clone();
+        assert_eq!(
+            datetime_value
+                .clone()
+                .try_into::<toml::value::Datetime>()
+                .unwrap(),
+            expected.last_updated
+        );
+        assert_eq!(
+            serde_json::Value::deserialize(datetime_value.clone()).unwrap(),
+            serde_json::Value::String(datetime.to_owned())
+        );
+        assert_eq!(
+            std::string::String::deserialize(datetime_value).unwrap(),
+            datetime
+        );
+    }
+}
+
 #[test]
 fn display() {
     assert_data_eq!(
```

</details>

<details><summary>reply</summary>

I’ll inspect the `Value` deserializer and datetime handling, add a fix that preserves string conversion to other formats, and run the relevant tests.

Fixed `Value` deserialization to recognize datetime requests and use TOML’s datetime representation. Conversions to JSON and strings retain their existing behavior.

Added regression coverage for struct fields, `try_into::<Datetime>()`, and all TOML datetime forms.

Validation passed: 12 tests, formatting, and a build with only the `serde` feature enabled.

</details>

### codex, muffle: pass

Files: [crates/toml/src/table.rs](../muffle/codex/rust-toml-value-datetime-1/files/crates/toml/src/table.rs), [crates/toml/src/value.rs](../muffle/codex/rust-toml-value-datetime-1/files/crates/toml/src/value.rs), [crates/toml/tests/testsuite/value.rs](../muffle/codex/rust-toml-value-datetime-1/files/crates/toml/tests/testsuite/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/table.rs b/crates/toml/src/table.rs
index 214bc8f..ea571ec 100644
--- a/crates/toml/src/table.rs
+++ b/crates/toml/src/table.rs
@@ -157,9 +157,21 @@ impl<'de> de::Deserializer<'de> for Table {
         Value::Table(self).deserialize_newtype_struct(name, visitor)
     }
 
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        Value::Table(self).deserialize_struct(name, fields, visitor)
+    }
+
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..eaa3e13 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -608,9 +608,27 @@ impl<'de> de::Deserializer<'de> for Value {
         visitor.visit_newtype_struct(self)
     }
 
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        _fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        if toml_datetime::de::is_datetime(name) {
+            if let Self::Datetime(datetime) = self {
+                return visitor.visit_map(toml_datetime::de::DatetimeDeserializer::new(datetime));
+            }
+        }
+
+        self.deserialize_any(visitor)
+    }
+
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
diff --git a/crates/toml/tests/testsuite/value.rs b/crates/toml/tests/testsuite/value.rs
index 46513da..858f49a 100644
--- a/crates/toml/tests/testsuite/value.rs
+++ b/crates/toml/tests/testsuite/value.rs
@@ -25,3 +25,56 @@ fn display() {
         str!["{ test = 2, test2 = 3 }"].raw()
     );
 }
+
+#[test]
+fn deserialize_datetime() {
+    use serde::Deserialize;
+
+    #[derive(Debug, Deserialize, PartialEq)]
+    struct Settings {
+        last_updated: toml::value::Datetime,
+        minimum_interval: i64,
+    }
+
+    #[derive(Deserialize)]
+    struct Document {
+        settings: Settings,
+    }
+
+    for datetime in [
+        "2023-01-15T11:42:14-06:00",
+        "2023-01-15T11:42:14Z",
+        "2023-01-15T11:42:14.123",
+        "2023-01-15",
+        "11:42:14.123",
+    ] {
+        let input = format!("[settings]\nlast_updated = {datetime}\nminimum_interval = 3600\n");
+        let direct: Document = toml::from_str(&input).unwrap();
+        let table: toml::Table = toml::from_str(&input).unwrap();
+        let value = table.get("settings").unwrap().clone();
+        let settings = Settings::deserialize(value.clone()).unwrap();
+        assert_eq!(settings, direct.settings);
+        assert_eq!(value.clone().try_into::<Settings>().unwrap(), settings);
+        assert_eq!(
+            Settings::deserialize(value.as_table().unwrap().clone()).unwrap(),
+            settings
+        );
+
+        let value = value.get("last_updated").unwrap().clone();
+        assert_eq!(
+            value.clone().try_into::<toml::value::Datetime>().unwrap(),
+            settings.last_updated
+        );
+        assert_eq!(
+            serde_json::Value::deserialize(value.clone()).unwrap(),
+            serde_json::Value::String(datetime.to_owned())
+        );
+        assert_eq!(value.try_into::<std::string::String>().unwrap(), datetime);
+    }
+
+    assert!(
+        String("2023-01-15T11:42:14-06:00".to_owned())
+            .try_into::<toml::value::Datetime>()
+            .is_err()
+    );
+}
```

</details>

<details><summary>reply</summary>

I’ll check how `Value` deserializes datetimes, fix the mismatch, and verify that conversion to other formats still produces a string.


`Value` was passing datetimes to every target as strings. The fix recognizes when the target specifically requests a TOML datetime and uses its datetime visitor. Other targets still receive a string. I’ve added regression coverage for nested structs, `try_into`, all four TOML datetime forms, and JSON conversion.


Fixed datetime deserialization from `toml::Value`, including nested struct fields and `try_into::<Datetime>()`.

Conversions to `serde_json::Value` and strings retain their existing string behavior. Added regression tests covering all TOML datetime forms.

Validation passed: 12 tests, the serde-only build check, formatting, and diff checks.

</details>

### codex, hush: pass

Files: [crates/toml/src/value.rs](../hush/codex/rust-toml-value-datetime-1/files/crates/toml/src/value.rs), [crates/toml/tests/testsuite/value.rs](../hush/codex/rust-toml-value-datetime-1/files/crates/toml/tests/testsuite/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..20b4938 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -608,9 +608,26 @@ impl<'de> de::Deserializer<'de> for Value {
         visitor.visit_newtype_struct(self)
     }
 
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        _fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, Self::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        if toml_datetime::de::is_datetime(name) {
+            if let Self::Datetime(datetime) = self {
+                return visitor.visit_map(toml_datetime::de::DatetimeDeserializer::new(datetime));
+            }
+        }
+        self.deserialize_any(visitor)
+    }
+
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
diff --git a/crates/toml/tests/testsuite/value.rs b/crates/toml/tests/testsuite/value.rs
index 46513da..9801aa8 100644
--- a/crates/toml/tests/testsuite/value.rs
+++ b/crates/toml/tests/testsuite/value.rs
@@ -25,3 +25,45 @@ fn display() {
         str!["{ test = 2, test2 = 3 }"].raw()
     );
 }
+
+#[test]
+fn deserialize_datetime() {
+    use serde::Deserialize;
+
+    #[derive(Debug, Deserialize, PartialEq)]
+    struct Settings {
+        last_updated: toml::value::Datetime,
+        minimum_interval: i64,
+    }
+
+    for datetime in [
+        "2023-01-15T11:42:14-06:00",
+        "2023-01-15T11:42:14",
+        "2023-01-15",
+        "11:42:14",
+    ] {
+        let document = format!("last_updated = {datetime}\nminimum_interval = 3600\n");
+        let expected: Settings = toml::from_str(&document).unwrap();
+        let value: toml::Value = toml::from_str(&document).unwrap();
+        assert_eq!(Settings::deserialize(value.clone()).unwrap(), expected);
+        assert_eq!(value.clone().try_into::<Settings>().unwrap(), expected);
+        let datetime_value = value.get("last_updated").unwrap().clone();
+        assert_eq!(
+            datetime_value
+                .clone()
+                .try_into::<toml::value::Datetime>()
+                .unwrap(),
+            expected.last_updated
+        );
+        assert_eq!(
+            serde_json::Value::deserialize(datetime_value).unwrap(),
+            serde_json::Value::String(datetime.to_owned())
+        );
+    }
+
+    assert!(
+        String("2023-01-15".to_owned())
+            .try_into::<toml::value::Datetime>()
+            .is_err()
+    );
+}
```

</details>

<details><summary>reply</summary>

Done.
Fixed datetime deserialization from `Value`; JSON strings preserved. Regression coverage added; 12 tests passed. Formatting applied.

</details>

### codex, sloth: pass

Files: [crates/toml/src/table.rs](../sloth/codex/rust-toml-value-datetime-1/files/crates/toml/src/table.rs), [crates/toml/src/value.rs](../sloth/codex/rust-toml-value-datetime-1/files/crates/toml/src/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/table.rs b/crates/toml/src/table.rs
index 214bc8f..1a556c6 100644
--- a/crates/toml/src/table.rs
+++ b/crates/toml/src/table.rs
@@ -157,9 +157,22 @@ impl<'de> de::Deserializer<'de> for Table {
         Value::Table(self).deserialize_newtype_struct(name, visitor)
     }
 
+    /// Deserialize a struct through the value deserializer.
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        Value::Table(self).deserialize_struct(name, fields, visitor)
+    }
+
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..81f83dd 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -608,9 +608,28 @@ impl<'de> de::Deserializer<'de> for Value {
         visitor.visit_newtype_struct(self)
     }
 
+    /// Deserialize a struct, preserving datetimes when explicitly requested.
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        _fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        if toml_datetime::de::is_datetime(name) {
+            if let Self::Datetime(datetime) = self {
+                return visitor.visit_map(toml_datetime::de::DatetimeDeserializer::new(datetime));
+            }
+        }
+
+        self.deserialize_any(visitor)
+    }
+
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
```

</details>

<details><summary>reply</summary>

I’ll trace how `Value` deserializes datetimes and fix the shared path while preserving string output for formats such as JSON.

The cause is in `Value`’s deserializer: it always presents datetimes as strings. I’ll use the existing datetime adapter when the target explicitly requests a TOML datetime, keeping the generic string behavior.

The change is limited to `value.rs`. Struct fields and `try_into` share this path; `Table` already forwards struct deserialization. No fixtures, configuration, exports, or new dependencies need changes.

The fix uses the existing datetime adapter and preserves the generic string conversion. I also updated `Table` to delegate the new method, as required by the code’s forwarding convention. The initial build and existing tests passed; I’m rerunning checks after that delegation change and checking the serde-only feature configuration.

Fixed datetime deserialization from `toml::Value`, covering struct fields and `try_into::<Datetime>()`. Generic conversions such as `serde_json::Value` still receive datetime strings.

Build, existing TOML tests, serde-only compilation, and formatting checks passed.

</details>

### codex, all: pass

Files: [crates/toml/src/value.rs](../all/codex/rust-toml-value-datetime-1/files/crates/toml/src/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..fb08ae5 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -608,9 +608,27 @@ impl<'de> de::Deserializer<'de> for Value {
         visitor.visit_newtype_struct(self)
     }
 
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        _fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        if toml_datetime::de::is_datetime(name) {
+            if let Self::Datetime(d) = self {
+                return visitor.visit_map(toml_datetime::de::DatetimeDeserializer::new(d));
+            }
+        }
+
+        self.deserialize_any(visitor)
+    }
+
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
 }
```

</details>

<details><summary>reply</summary>

Done.
`Value` now handles datetime struct deserialization; JSON string conversion preserved. `cargo build -p toml` and `cargo test -p toml` passed.

</details>
