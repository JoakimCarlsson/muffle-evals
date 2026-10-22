I’ll trace how the decoder handles embedded fields, fix the regression, and run the relevant tests.

The decoder treats any TOML tag on an embedded struct as a field name, so `toml:",inline"` prevents its fields from being promoted. I’ll make promotion depend on whether the tag supplies a name and add regression tests for value and pointer embeddings.

Fixed the decoder to flatten embedded structs when their TOML tag has no explicit name, including `toml:",inline"`.

Added regression tests covering value and pointer embeddings, empty tags, named fields, and ignored fields.

Validation: `go test -race ./...` passed.
