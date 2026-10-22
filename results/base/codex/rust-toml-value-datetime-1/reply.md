I’ll inspect the `Value` deserializer and datetime handling, add a fix that preserves string conversion to other formats, and run the relevant tests.

Fixed `Value` deserialization to recognize datetime requests and use TOML’s datetime representation. Conversions to JSON and strings retain their existing behavior.

Added regression coverage for struct fields, `try_into::<Datetime>()`, and all TOML datetime forms.

Validation passed: 12 tests, formatting, and a build with only the `serde` feature enabled.
