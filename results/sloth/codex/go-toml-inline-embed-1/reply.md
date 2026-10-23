I’ll trace how decoding handles embedded fields, add a regression test, and run the build and tests.

The shared decoder field plan treats any TOML tag as a field name, so `toml:",inline"` stops an embedded struct’s fields from being promoted. I’ll make that decision depend on whether the tag supplies a name.

The scope is the field-plan builder and regression tests in `unmarshaler_test.go`; no API, encoder, fixture, or configuration changes are needed. Tests will cover value and pointer embeddings, empty names, explicit names, ignored fields, and field precedence.

Fixed decoding of embedded structs tagged `toml:",inline"`. The decoder now promotes embedded fields when the tag has no explicit name.

Added regression coverage for your example, pointer embeddings, empty tags, explicit names, ignored fields, and field precedence.

Validation passed: `go test ./...` and `go build ./...`.
