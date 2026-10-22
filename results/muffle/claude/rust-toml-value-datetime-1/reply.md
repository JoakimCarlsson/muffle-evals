Fix is in and builds. Next I'm adding a regression test and running the suite.

Deserializing a `toml::Value` datetime into a struct now works. That covers `Settings::deserialize(value)` and `value.try_into::<Datetime>()`. The full test suite passes.

**Cause:** the `Deserializer` impl for `Value` forwarded `deserialize_struct` to `deserialize_any`. A datetime reached the visitor as a plain string. `Datetime`'s own `Deserialize` expects the special datetime map, so it rejected the string.

**Fix:** in `crates/toml/src/value.rs` I added a `deserialize_struct` override on `Value`. When serde asks for the datetime type and the value is a `Datetime`, it now hands the visitor the datetime map. Every other case still goes through `deserialize_any`.

`deserialize_any` still emits datetimes as strings, so converting to `serde_json::Value` is unchanged. I didn't write a test for that case, so it's covered by the code path being untouched.

I added a regression test, `deserialize_datetime_from_value`, in `crates/toml/tests/testsuite/value.rs`. It uses your struct example and a bare `Value::Datetime` converted with `try_into::<Datetime>()`.

I haven't committed anything.
