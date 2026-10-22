Match encoder: flatten when no tag name.

Done. `addFields` in `unmarshaler.go` now flattens embedded structs whose tag has no name, such as `toml:",inline"`. This matches the encoder. I added `TestUnmarshalEmbeddedInlineTag`, and `go test ./...` passes.
