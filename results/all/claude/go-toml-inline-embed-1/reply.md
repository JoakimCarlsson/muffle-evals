Encoder flattens when tag name empty. Mirror in decoder.

Done. `addFields` in `unmarshaler.go` now flattens embedded structs whose tag has no name (e.g. `toml:",inline"`), matching the encoder. A named tag still acts as a regular field. I added `TestUnmarshalEmbedInlineTag`, and `go test ./...` passes. `go vet` shows one warning, in `marshaler_test.go:1572`, which I didn't touch.
