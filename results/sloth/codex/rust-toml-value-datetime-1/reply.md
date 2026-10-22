I’ll trace how `Value` deserializes datetimes and fix the shared path while preserving string output for formats such as JSON.

The cause is in `Value`’s deserializer: it always presents datetimes as strings. I’ll use the existing datetime adapter when the target explicitly requests a TOML datetime, keeping the generic string behavior.

The change is limited to `value.rs`. Struct fields and `try_into` share this path; `Table` already forwards struct deserialization. No fixtures, configuration, exports, or new dependencies need changes.

The fix uses the existing datetime adapter and preserves the generic string conversion. I also updated `Table` to delegate the new method, as required by the code’s forwarding convention. The initial build and existing tests passed; I’m rerunning checks after that delegation change and checking the serde-only feature configuration.

Fixed datetime deserialization from `toml::Value`, covering struct fields and `try_into::<Datetime>()`. Generic conversions such as `serde_json::Value` still receive datetime strings.

Build, existing TOML tests, serde-only compilation, and formatting checks passed.
