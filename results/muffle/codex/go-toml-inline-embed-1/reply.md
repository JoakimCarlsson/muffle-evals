I’ll check how decoding handles embedded fields, add a regression test, and fix the failure.

The decoder treats any TOML tag on an embedded struct as a field name, even when the tag only contains `inline`. The encoder already distinguishes those cases. I’ll make decoding follow the same rule: flatten the embedded struct when the tag has no name.

Fixed decoding for embedded structs tagged `toml:",inline"`. Tags without an explicit field name now preserve embedded-field flattening, matching the encoder.

Added regression coverage for embedded values, pointers, empty tags, and explicitly named fields.

Validation: `go test ./...` passes.
