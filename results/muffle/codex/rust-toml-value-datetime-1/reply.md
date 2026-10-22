I’ll check how `Value` deserializes datetimes, fix the mismatch, and verify that conversion to other formats still produces a string.


`Value` was passing datetimes to every target as strings. The fix recognizes when the target specifically requests a TOML datetime and uses its datetime visitor. Other targets still receive a string. I’ve added regression coverage for nested structs, `try_into`, all four TOML datetime forms, and JSON conversion.


Fixed datetime deserialization from `toml::Value`, including nested struct fields and `try_into::<Datetime>()`.

Conversions to `serde_json::Value` and strings retain their existing string behavior. Added regression tests covering all TOML datetime forms.

Validation passed: 12 tests, the serde-only build check, formatting, and diff checks.
