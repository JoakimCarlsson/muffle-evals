Fix passes the full suite. Now tidying the test into `unmarshaler_test.go`.

Done. `addFields` in `unmarshaler.go` now flattens embedded structs whose tag has no name, such as `toml:",inline"`. This matches the encoder. I added `TestUnmarshalInlineEmbeddedStruct`, and the full suite passes. Nothing committed.
