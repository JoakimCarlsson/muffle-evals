I’ll check how the decoder handles embedded fields, add a regression test, and fix the lookup.

The decoder treats any `toml` tag as a field name, so `toml:",inline"` prevents the embedded fields from being flattened. The regression tests reproduce this for both value and pointer embeddings. I’ll make the decoder match the encoder: flatten an embedded struct when its tag has no explicit name.

Fixed the decoder to flatten embedded structs when the `toml` tag has no explicit field name, including `toml:",inline"`.

Added regression tests for value embeddings, pointer embeddings, empty tags, and strict decoding. Confirmed they failed before the fix.

All tests pass with `go test ./...`.
