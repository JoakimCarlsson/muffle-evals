Fix in `value.rs` applied. Now adding a test and running it.

Done. `Value::deserialize_struct` in `crates/toml/src/value.rs` now hands `Datetime` out as a datetime map. `deserialize_any` still gives a string, so `serde_json::Value` conversion is unchanged. Added test `datetime_from_value`. It covers your struct case and `try_into::<Datetime>()`. All tests pass.
