I’ll check how `Value` deserialization handles datetimes, fix the shared path, and add regression coverage while preserving JSON string output.

`Value` forwards datetime struct requests to `deserialize_any`, which emits a string. The fix can use the existing datetime helper for those requests and leave generic conversions unchanged. It needs only the `Value` implementation and an existing test file; the table wrapper already delegates correctly. No new dependencies or public APIs are needed.

Fixed `Value` deserialization to preserve datetimes when explicitly requested, including struct fields and `try_into::<Datetime>()`. JSON and string conversions remain unchanged.

Added regression coverage for all datetime forms and the existing string rejection error.

Validation passed: `cargo test -p toml`, formatting, and diff checks.
