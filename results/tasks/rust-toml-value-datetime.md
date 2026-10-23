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
| claude | muffle | pass | +18/-1 | 27 | 2,599 | $0.106 |
| claude | hush | pass | +18/-1 | 25 | 2,283 | $0.104 |
| claude | sloth | pass | +18/-1 | 18 | 2,913 | $0.116 |
| claude | all | pass | +17/-1 | 14 | 2,276 | $0.091 |
| codex | base | pass | +19/-1 | 41 | 1,492 | - |
| codex | muffle | pass | +19/-1 | 58 | 1,755 | - |
| codex | hush | pass | +18/-1 | 45 | 1,268 | - |
| codex | sloth | pass | +19/-1 | 52 | 2,169 | - |
| codex | all | pass | +19/-1 | 50 | 1,649 | - |

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

Files: [crates/toml/src/value.rs](../muffle/claude/rust-toml-value-datetime-1/files/crates/toml/src/value.rs), [crates/toml/tests/testsuite/de_value_datetime.rs](../muffle/claude/rust-toml-value-datetime-1/files/crates/toml/tests/testsuite/de_value_datetime.rs), [crates/toml/tests/testsuite/main.rs](../muffle/claude/rust-toml-value-datetime-1/files/crates/toml/tests/testsuite/main.rs)

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
diff --git a/crates/toml/tests/testsuite/de_value_datetime.rs b/crates/toml/tests/testsuite/de_value_datetime.rs
new file mode 100644
index 0000000..9bffbbd
--- /dev/null
+++ b/crates/toml/tests/testsuite/de_value_datetime.rs
@@ -0,0 +1,26 @@
+use serde::Deserialize;
+
+#[derive(Deserialize, Debug)]
+struct Settings {
+    last_updated: toml::value::Datetime,
+    minimum_interval: i64,
+}
+
+#[test]
+fn value_into_struct_with_datetime() {
+    let v: toml::value::Table = toml::from_str(
+        "[settings]\nlast_updated = 2023-01-15T11:42:14-06:00\nminimum_interval = 3600\n",
+    )
+    .unwrap();
+    let x = v.get("settings").unwrap().clone();
+    let n = Settings::deserialize(x).unwrap();
+    assert_eq!(n.last_updated.to_string(), "2023-01-15T11:42:14-06:00");
+    assert_eq!(n.minimum_interval, 3600);
+}
+
+#[test]
+fn value_try_into_datetime() {
+    let v: toml::Value = toml::from_str("a = 1979-05-27").unwrap();
+    let d: toml::value::Datetime = v["a"].clone().try_into().unwrap();
+    assert_eq!(d.to_string(), "1979-05-27");
+}
diff --git a/crates/toml/tests/testsuite/main.rs b/crates/toml/tests/testsuite/main.rs
index e6d3379..05f7bee 100644
--- a/crates/toml/tests/testsuite/main.rs
+++ b/crates/toml/tests/testsuite/main.rs
@@ -7,6 +7,7 @@ macro_rules! map( ($($k:expr => $v:expr),*) => ({
     _m
 }) );
 
+mod de_value_datetime;
 mod macros;
 mod table;
 mod value;
```

</details>

<details><summary>reply</summary>

Fixing `Value`'s deserializer; now checking `Table` wrapper and testing.

Table is never a datetime, so it's fine. Add a test and run.

Deserializing a `toml::Value` datetime into `toml::value::Datetime` now works, both inside a struct (your example) and through `try_into::<Datetime>()`. The `toml` crate's tests pass. I didn't run your exact snippet; the new tests cover the same case.

The cause was that `Value`'s deserializer always passed a datetime to the visitor as a plain string, and `Datetime` expects the special map form that `toml::from_str` uses. In `crates/toml/src/value.rs` I added a `deserialize_struct` method on `Value`. When the target type is `Datetime` and the value is a datetime, it uses that map form. Everything else falls back to the old behaviour. So converting to other formats, like `serde_json::Value`, still gives a plain string.

I added two tests in `crates/toml/tests/testsuite/de_value_datetime.rs` and registered the module in `main.rs`. One is your example and the other is the `try_into` case. The tests are uncommitted.

</details>

### claude, hush: pass

Files: [crates/toml/src/value.rs](../hush/claude/rust-toml-value-datetime-1/files/crates/toml/src/value.rs), [crates/toml/tests/serde/general.rs](../hush/claude/rust-toml-value-datetime-1/files/crates/toml/tests/serde/general.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..4823769 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -610,9 +610,26 @@ impl<'de> de::Deserializer<'de> for Value {
 
     serde_core::forward_to_deserialize_any! {
         bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 char str string unit seq
-        bytes byte_buf map unit_struct tuple_struct struct
+        bytes byte_buf map unit_struct tuple_struct
         tuple ignored_any identifier
     }
+
+    fn deserialize_struct<V>(
+        self,
+        name: &'static str,
+        _fields: &'static [&'static str],
+        visitor: V,
+    ) -> Result<V::Value, crate::de::Error>
+    where
+        V: de::Visitor<'de>,
+    {
+        if toml_datetime::de::is_datetime(name)
+            && let Self::Datetime(d) = self
+        {
+            return visitor.visit_map(toml_datetime::de::DatetimeDeserializer::new(d));
+        }
+        self.deserialize_any(visitor)
+    }
 }
 
 pub(crate) struct SeqDeserializer {
diff --git a/crates/toml/tests/serde/general.rs b/crates/toml/tests/serde/general.rs
index 48a28e1..e19319d 100644
--- a/crates/toml/tests/serde/general.rs
+++ b/crates/toml/tests/serde/general.rs
@@ -2169,3 +2169,28 @@ key = "value"
 "#]]
     );
 }
+
+#[test]
+fn datetime_from_value() {
+    #[derive(Deserialize, Debug)]
+    struct Settings {
+        last_updated: toml::value::Datetime,
+        minimum_interval: i64,
+    }
+
+    let v: toml::value::Table = toml::from_str(
+        r#"[settings]
+last_updated = 2023-01-15T11:42:14-06:00
+minimum_interval = 3600
+"#,
+    )
+    .unwrap();
+    let x = v.get("settings").unwrap().clone();
+    let n = Settings::deserialize(x).unwrap();
+    assert_eq!(n.last_updated.to_string(), "2023-01-15T11:42:14-06:00");
+    assert_eq!(n.minimum_interval, 3600);
+
+    let dt = toml::Value::Datetime("1979-05-27T07:32:00Z".parse().unwrap());
+    let d: toml::value::Datetime = dt.clone().try_into().unwrap();
+    assert_eq!(d.to_string(), "1979-05-27T07:32:00Z");
+}
```

</details>

<details><summary>reply</summary>

Fix in `value.rs` applied. Now adding a test and running it.

Done. `Value::deserialize_struct` in `crates/toml/src/value.rs` now hands `Datetime` out as a datetime map. `deserialize_any` still gives a string, so `serde_json::Value` conversion is unchanged. Added test `datetime_from_value`. It covers your struct case and `try_into::<Datetime>()`. All tests pass.

</details>

### claude, sloth: pass

Files: [crates/toml/src/value.rs](../sloth/claude/rust-toml-value-datetime-1/files/crates/toml/src/value.rs), [crates/toml/tests/testsuite/value.rs](../sloth/claude/rust-toml-value-datetime-1/files/crates/toml/tests/testsuite/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..85636c6 100644
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
diff --git a/crates/toml/tests/testsuite/value.rs b/crates/toml/tests/testsuite/value.rs
index 46513da..ceeca52 100644
--- a/crates/toml/tests/testsuite/value.rs
+++ b/crates/toml/tests/testsuite/value.rs
@@ -1,3 +1,4 @@
+use serde::Deserialize as _;
 use snapbox::assert_data_eq;
 use snapbox::prelude::*;
 use snapbox::str;
@@ -25,3 +26,20 @@ fn display() {
         str!["{ test = 2, test2 = 3 }"].raw()
     );
 }
+
+#[test]
+fn datetime_try_into() {
+    #[derive(serde::Deserialize)]
+    struct Settings {
+        last_updated: toml::value::Datetime,
+    }
+
+    let value: toml::Value = toml::from_str("last_updated = 2023-01-15T11:42:14-06:00").unwrap();
+    let json = serde_json::Value::deserialize(value.clone()).unwrap();
+    assert_eq!(json["last_updated"], "2023-01-15T11:42:14-06:00");
+    let settings: Settings = value.try_into().unwrap();
+    assert_eq!(
+        settings.last_updated.to_string(),
+        "2023-01-15T11:42:14-06:00"
+    );
+}
```

</details>

<details><summary>reply</summary>

Fix is in; now adding a test and building.

Deserializing a `toml::Value` datetime into a struct field of type `toml::value::Datetime` now works, including through `value.try_into::<Datetime>()`. The full `toml` crate test suite passes, including the new test.

**Cause:** `Value`'s deserializer always handed a datetime to the visitor as a plain string. `Datetime`'s `Deserialize` impl expects the special map form that `toml::from_str` produces, so it rejected the string.

**Fix** (`crates/toml/src/value.rs`): `Value` now has its own `deserialize_struct`. When the target is `Datetime` and the value is a datetime, it uses `toml_datetime::de::DatetimeDeserializer`, as `toml::from_str` does. `deserialize_any` is unchanged, so conversions to other formats such as `serde_json::Value` still give a string.

**Test** (`crates/toml/tests/testsuite/value.rs`): `datetime_try_into` checks the `try_into` conversion to a struct and that the `serde_json::Value` conversion still yields the string. I didn't run your exact snippet. The test covers the same struct-from-`Value` path.

I haven't committed anything.

</details>

### claude, all: pass

Files: [crates/toml/src/value.rs](../all/claude/rust-toml-value-datetime-1/files/crates/toml/src/value.rs), [crates/toml/tests/testsuite/value.rs](../all/claude/rust-toml-value-datetime-1/files/crates/toml/tests/testsuite/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..b95dcf0 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -608,9 +608,25 @@ impl<'de> de::Deserializer<'de> for Value {
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
+        match self {
+            Self::Datetime(v) if toml_datetime::de::is_datetime(name) => visitor
+                .visit_map(toml_datetime::de::DatetimeDeserializer::new(v)),
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
diff --git a/crates/toml/tests/testsuite/value.rs b/crates/toml/tests/testsuite/value.rs
index 46513da..1bfd723 100644
--- a/crates/toml/tests/testsuite/value.rs
+++ b/crates/toml/tests/testsuite/value.rs
@@ -25,3 +25,17 @@ fn display() {
         str!["{ test = 2, test2 = 3 }"].raw()
     );
 }
+
+#[test]
+fn datetime_from_value() {
+    #[derive(serde::Deserialize)]
+    struct Settings {
+        last_updated: toml::value::Datetime,
+    }
+
+    let v: toml::Table = toml::from_str("last_updated = 2023-01-15T11:42:14-06:00").unwrap();
+    let s = <Settings as serde::Deserialize>::deserialize(toml::Value::Table(v.clone())).unwrap();
+    assert_eq!(s.last_updated.to_string(), "2023-01-15T11:42:14-06:00");
+    let d = toml::Value::try_into::<toml::value::Datetime>(v["last_updated"].clone()).unwrap();
+    assert_eq!(d.to_string(), "2023-01-15T11:42:14-06:00");
+}
```

</details>

<details><summary>reply</summary>

Fix applied in `Value::deserialize_struct`; adding a test now, then building.

Done. `Value::deserialize_struct` in `crates/toml/src/value.rs` now hands a `Datetime` to the datetime deserializer. This fixes both the struct case and `try_into::<Datetime>()`. Other targets such as `serde_json::Value` still get a string through `deserialize_any`. I added `datetime_from_value` to `tests/testsuite/value.rs`, and `cargo test --all-features` passes. I didn't run your exact snippet separately.

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

Files: [crates/toml/src/value.rs](../muffle/codex/rust-toml-value-datetime-1/files/crates/toml/src/value.rs), [crates/toml/tests/testsuite/value.rs](../muffle/codex/rust-toml-value-datetime-1/files/crates/toml/tests/testsuite/value.rs)

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
index 46513da..64c78e5 100644
--- a/crates/toml/tests/testsuite/value.rs
+++ b/crates/toml/tests/testsuite/value.rs
@@ -5,6 +5,64 @@ use snapbox::str;
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
+    #[derive(Debug, Deserialize, PartialEq)]
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
+        let expected: Document = toml::from_str(&input).unwrap();
+        let table: toml::Table = toml::from_str(&input).unwrap();
+        let value = table.get("settings").unwrap().clone();
+        assert_eq!(
+            Settings::deserialize(value.clone()).unwrap(),
+            expected.settings
+        );
+        assert_eq!(
+            value.clone().try_into::<Settings>().unwrap(),
+            expected.settings
+        );
+
+        let datetime_value = value.get("last_updated").unwrap().clone();
+        assert_eq!(
+            datetime_value
+                .clone()
+                .try_into::<toml::value::Datetime>()
+                .unwrap(),
+            expected.settings.last_updated
+        );
+        assert_eq!(
+            serde_json::Value::deserialize(datetime_value.clone()).unwrap(),
+            serde_json::Value::String(datetime.to_owned())
+        );
+        assert_eq!(
+            std::string::String::deserialize(datetime_value).unwrap(),
+            datetime
+        );
+        assert_eq!(
+            serde_json::Value::deserialize(value).unwrap(),
+            serde_json::json!({"last_updated": datetime, "minimum_interval": 3600})
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

I’ll check how `Value` deserializes datetimes and add a fix that preserves their string representation in other formats.

`Value` currently passes datetimes to every target as strings. I’ve added handling for targets that request a TOML datetime, while keeping the existing string behavior for JSON and `String`. The regression test covers struct deserialization, `try_into`, and all four TOML datetime forms.

Fixed `Value` deserialization to recognize TOML datetime targets, so struct deserialization and `try_into::<Datetime>()` now work. JSON and `String` conversions still receive plain strings.

Added regression coverage for all TOML datetime forms. All 12 testsuite tests pass, and the serde-only build check passes.

</details>

### codex, hush: pass

Files: [crates/toml/src/value.rs](../hush/codex/rust-toml-value-datetime-1/files/crates/toml/src/value.rs), [crates/toml/tests/testsuite/value.rs](../hush/codex/rust-toml-value-datetime-1/files/crates/toml/tests/testsuite/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..ddf1ab5 100644
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
index 46513da..8839e16 100644
--- a/crates/toml/tests/testsuite/value.rs
+++ b/crates/toml/tests/testsuite/value.rs
@@ -25,3 +25,48 @@ fn display() {
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
+        "2023-01-15T11:42:14",
+        "2023-01-15",
+        "11:42:14",
+    ] {
+        let input = format!("[settings]\nlast_updated = {datetime}\nminimum_interval = 3600\n");
+        let direct: Document = toml::from_str(&input).unwrap();
+        let table: toml::Table = toml::from_str(&input).unwrap();
+        let settings = table.get("settings").unwrap().clone();
+        assert_eq!(Settings::deserialize(settings).unwrap(), direct.settings);
+
+        let value = table["settings"]["last_updated"].clone();
+        assert_eq!(
+            value.clone().try_into::<toml::value::Datetime>().unwrap(),
+            direct.settings.last_updated
+        );
+        assert_eq!(
+            serde_json::Value::deserialize(value).unwrap(),
+            serde_json::Value::String(datetime.to_owned())
+        );
+        assert!(
+            String(datetime.to_owned())
+                .try_into::<toml::value::Datetime>()
+                .is_err()
+        );
+    }
+}
```

</details>

<details><summary>reply</summary>

Done.
Fixed datetime deserialization from `Value`; JSON strings preserved. Added regression coverage; 12 tests and formatting check passed.

</details>

### codex, sloth: pass

Files: [crates/toml/src/value.rs](../sloth/codex/rust-toml-value-datetime-1/files/crates/toml/src/value.rs), [crates/toml/tests/testsuite/value.rs](../sloth/codex/rust-toml-value-datetime-1/files/crates/toml/tests/testsuite/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..dc9457e 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -608,9 +608,27 @@ impl<'de> de::Deserializer<'de> for Value {
         visitor.visit_newtype_struct(self)
     }
 
+    /// Preserve datetime types when explicitly requested by the visitor.
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
index 46513da..251e276 100644
--- a/crates/toml/tests/testsuite/value.rs
+++ b/crates/toml/tests/testsuite/value.rs
@@ -5,6 +5,58 @@ use snapbox::str;
 use toml::Value::{Array, Boolean, Float, Integer, String, Table};
 use toml::map::Map;
 
+/// Datetimes retain their type for typed requests and remain strings for JSON.
+#[test]
+fn deserialize_datetime() {
+    use serde::Deserialize;
+    use toml::value::Datetime;
+
+    #[derive(Debug, Deserialize, PartialEq)]
+    struct Settings {
+        last_updated: Datetime,
+        minimum_interval: i64,
+    }
+
+    for datetime in [
+        "2023-01-15T11:42:14-06:00",
+        "2023-01-15T11:42:14Z",
+        "2023-01-15T11:42:14.123456789",
+        "2023-01-15",
+        "11:42:14",
+    ] {
+        let document = format!("[settings]\nlast_updated = {datetime}\nminimum_interval = 3600\n");
+        let table: toml::Table = toml::from_str(&document).unwrap();
+        let value = table.get("settings").unwrap().clone();
+        let expected: Settings =
+            toml::from_str(document.strip_prefix("[settings]\n").unwrap()).unwrap();
+        assert_eq!(Settings::deserialize(value.clone()).unwrap(), expected);
+        assert_eq!(value.clone().try_into::<Settings>().unwrap(), expected);
+
+        let date = value.get("last_updated").unwrap().clone();
+        assert_eq!(
+            date.clone().try_into::<Datetime>().unwrap(),
+            expected.last_updated
+        );
+        assert_eq!(
+            serde_json::Value::deserialize(date.clone()).unwrap(),
+            datetime
+        );
+        assert_eq!(date.try_into::<std::string::String>().unwrap(), datetime);
+        assert_eq!(
+            serde_json::Value::deserialize(value).unwrap(),
+            serde_json::json!({"last_updated": datetime, "minimum_interval": 3600})
+        );
+    }
+
+    let error = String("2023-01-15T11:42:14-06:00".to_owned())
+        .try_into::<Datetime>()
+        .unwrap_err();
+    assert_eq!(
+        error.to_string(),
+        "invalid type: string \"2023-01-15T11:42:14-06:00\", expected a TOML datetime\n"
+    );
+}
+
 #[test]
 fn display() {
     assert_data_eq!(
```

</details>

<details><summary>reply</summary>

I’ll check how `Value` deserialization handles datetimes, fix the shared path, and add regression coverage while preserving JSON string output.

`Value` forwards datetime struct requests to `deserialize_any`, which emits a string. The fix can use the existing datetime helper for those requests and leave generic conversions unchanged. It needs only the `Value` implementation and an existing test file; the table wrapper already delegates correctly. No new dependencies or public APIs are needed.

Fixed `Value` deserialization to preserve datetimes when explicitly requested, including struct fields and `try_into::<Datetime>()`. JSON and string conversions remain unchanged.

Added regression coverage for all datetime forms and the existing string rejection error.

Validation passed: `cargo test -p toml`, formatting, and diff checks.

</details>

### codex, all: pass

Files: [crates/toml/src/value.rs](../all/codex/rust-toml-value-datetime-1/files/crates/toml/src/value.rs), [crates/toml/tests/testsuite/value.rs](../all/codex/rust-toml-value-datetime-1/files/crates/toml/tests/testsuite/value.rs)

<details><summary>diff</summary>

```diff
diff --git a/crates/toml/src/value.rs b/crates/toml/src/value.rs
index 892d2d8..32309f7 100644
--- a/crates/toml/src/value.rs
+++ b/crates/toml/src/value.rs
@@ -608,9 +608,27 @@ impl<'de> de::Deserializer<'de> for Value {
         visitor.visit_newtype_struct(self)
     }
 
+    /// Deserialize a struct, preserving TOML datetime identity when requested.
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
index 46513da..c3101d1 100644
--- a/crates/toml/tests/testsuite/value.rs
+++ b/crates/toml/tests/testsuite/value.rs
@@ -5,6 +5,56 @@ use snapbox::str;
 use toml::Value::{Array, Boolean, Float, Integer, String, Table};
 use toml::map::Map;
 
+/// Datetime values retain their type for typed deserialization and remain JSON strings.
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
+        "2023-01-15T11:42:14",
+        "2023-01-15",
+        "11:42:14.123",
+    ] {
+        let input = format!("[settings]\nlast_updated = {datetime}\nminimum_interval = 3600\n");
+        let direct: Document = toml::from_str(&input).unwrap();
+        let table: toml::Table = toml::from_str(&input).unwrap();
+        let value = table.get("settings").unwrap().clone();
+        assert_eq!(
+            Settings::deserialize(value.clone()).unwrap(),
+            direct.settings
+        );
+        assert_eq!(value.try_into::<Settings>().unwrap(), direct.settings);
+
+        let value = table["settings"]["last_updated"].clone();
+        assert_eq!(
+            value.clone().try_into::<toml::value::Datetime>().unwrap(),
+            direct.settings.last_updated
+        );
+        assert_eq!(
+            serde_json::Value::deserialize(value).unwrap(),
+            serde_json::Value::String(datetime.to_owned())
+        );
+        assert!(
+            String(datetime.to_owned())
+                .try_into::<toml::value::Datetime>()
+                .is_err()
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

Done.
Fixed typed datetime deserialization from `Value`; JSON strings preserved. Regression tests added. `cargo test -p toml` passed; existing deprecation warnings remain.

</details>
