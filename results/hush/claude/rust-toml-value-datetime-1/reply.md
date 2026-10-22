Adding `deserialize_struct` to `Value`'s deserializer. Retrying the edit.

Done. `Value` now has `deserialize_struct` in `crates/toml/src/value.rs`. It hands `Datetime` structs a real datetime, and `deserialize_any` still gives other formats a string. Existing tests pass. I didn't run your repro and didn't add a regression test.
