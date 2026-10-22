Adding `deserialize_struct` to `Value`'s deserializer so datetimes go through the datetime map path. `deserialize_any` stays a string, so the `serde_json` conversion is unchanged.

I mistyped the match string. Retrying with the exact text.

Oops, I deleted existing examples. Restoring.

Done. `Value` now has `deserialize_struct` in `crates/toml/src/value.rs`, so `Settings::deserialize(value)` and `try_into::<Datetime>()` both work. I ran your repro, and the existing tests pass. `deserialize_any` still gives a string, so `serde_json` conversion is unchanged, though I didn't test that path. I didn't add a regression test.

I briefly deleted `crates/toml/examples/` while cleaning up my repro file, then restored it with `git checkout`. `git status` shows only `value.rs` modified.
