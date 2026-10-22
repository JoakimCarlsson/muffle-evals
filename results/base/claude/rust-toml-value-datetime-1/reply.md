Add a `deserialize_struct` override and remove `struct` from the forward list.

I mistakenly deleted the existing examples directory; restoring it.

Your example now works. `Settings::deserialize(value)` and `value.try_into::<Datetime>()` both return the datetime with the right date, time and `-06:00` offset.

The fix is in `crates/toml/src/value.rs`. `Value`'s deserializer sent every struct request through `deserialize_any`, which hands a datetime over as a string. I added a `deserialize_struct` override. When the target is `Datetime` and the value is a datetime, it passes the datetime through in the same form the `toml::from_str` path uses. Every other case still goes through `deserialize_any`, so converting to a plain string, or to something like `serde_json::Value`, still gives the datetime as a string. I checked the string case by deserializing the datetime into a `String`, which gave `2023-01-15T11:42:14-06:00`. I didn't run a `serde_json` conversion itself.

The existing test suite passes. I didn't add a regression test, since I checked the fix with a throwaway example that I've since deleted. I accidentally deleted the repo's own `examples/` files while cleaning up and restored them with `git checkout`. `git status` now shows only the change to `value.rs`.
